import type {
  CompanionMessage,
  ConversationSession,
  InlineKeywordItem,
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
};

export function knowledgeCardContent(card: KnowledgeCard): string {
  const relatedTerms = card.keywords.map((keyword) => keyword.text);
  return [
    card.plain_explanation,
    ...card.key_points.map((point) => `• ${point}`),
    ...(relatedTerms.length > 0 ? [`继续探索：${relatedTerms.join(' · ')}`] : []),
  ].join('\n');
}

export function knowledgeCardKeywords(card: KnowledgeCard): InlineKeywordItem[] {
  return card.keywords.map((keyword, index) => ({
    id: `${card.card_id}-seed-keyword-${index}`,
    text: keyword.text,
    normalized_text: keyword.normalized_text,
    importance: keyword.confidence >= 0.9 ? 3 : keyword.confidence >= 0.75 ? 2 : 1,
  }));
}

export function createDetailBranch(
  sourceSession: ConversationSession,
  card: KnowledgeCard,
): DetailBranchLaunch {
  const sessionId = createConversationId('detail');
  const seedMessage: CompanionMessage = {
    id: `message-card-seed-${card.card_id}`,
    role: 'assistant',
    content: knowledgeCardContent(card),
    reasoning: card.reasoning_summary,
    keywords: knowledgeCardKeywords(card),
    isStreaming: false,
  };
  const contextMessages = relevantContextFor(sourceSession, card);
  const session: ConversationSession = {
    id: sessionId,
    title: `引申：${card.title}`,
    messages: [seedMessage],
    contextMessages,
    parentConversationId: sourceSession.id,
    sourceCardId: card.card_id,
  };

  return { session };
}
