import type {
  CompanionMessage,
  ConversationSession,
  KnowledgeCard,
} from './contracts';

const MAX_CONTEXT_MESSAGES = 14;

function uniqueMessages(messages: CompanionMessage[]): CompanionMessage[] {
  const seen = new Set<string>();
  return messages.filter((message) => {
    const key = message.serverId ?? message.id;
    if (!message.content.trim() || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function createConversationId(prefix = 'conversation'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createInitialSession(welcomeMessage: CompanionMessage): ConversationSession {
  return {
    id: createConversationId(),
    title: '自由对话',
    messages: [welcomeMessage],
    contextMessages: [],
  };
}

export function requestMessagesFor(
  session: ConversationSession,
  visibleMessages: CompanionMessage[],
): CompanionMessage[] {
  return uniqueMessages([
    ...session.contextMessages,
    ...visibleMessages,
  ]).slice(-24);
}

function relevantContextFor(
  session: ConversationSession,
  card: KnowledgeCard,
): CompanionMessage[] {
  const allMessages = uniqueMessages([
    ...session.contextMessages,
    ...session.messages,
  ]);
  const sourceIndex = allMessages.findIndex((message) => (
    message.id === card.source_message_id || message.serverId === card.source_message_id
  ));

  if (sourceIndex < 0) return allMessages.slice(-MAX_CONTEXT_MESSAGES);
  const start = Math.max(0, sourceIndex - (MAX_CONTEXT_MESSAGES - 1));
  return allMessages.slice(start, sourceIndex + 1);
}

export type DetailBranchLaunch = {
  session: ConversationSession;
  requestMessages: CompanionMessage[];
  assistantMessageId: string;
};

export function createDetailBranch(
  sourceSession: ConversationSession,
  card: KnowledgeCard,
): DetailBranchLaunch {
  const sessionId = createConversationId('detail');
  const userMessage: CompanionMessage = {
    id: `message-user-${Date.now()}`,
    role: 'user',
    content: [
      `我想详细了解知识点“${card.title}”。`,
      `触发内容：${card.selected_text}`,
      `卡片结论：${card.plain_explanation}`,
      `关键要点：${card.key_points.slice(0, 2).join('；')}`,
      '请结合随会话带入的来源上下文，先说明核心原理，再给一个容易理解的例子，最后提醒一个常见误区。',
    ].join('\n'),
  };
  const assistantMessageId = `message-stream-${Date.now()}`;
  const assistantMessage: CompanionMessage = {
    id: assistantMessageId,
    role: 'assistant',
    content: '',
    reasoning: '',
    keywords: [],
    isStreaming: true,
  };
  const contextMessages = relevantContextFor(sourceSession, card);
  const session: ConversationSession = {
    id: sessionId,
    title: `知识分支：${card.title}`,
    messages: [userMessage, assistantMessage],
    contextMessages,
    parentConversationId: sourceSession.id,
    sourceCardId: card.card_id,
  };

  return {
    session,
    requestMessages: requestMessagesFor(session, [userMessage]),
    assistantMessageId,
  };
}
