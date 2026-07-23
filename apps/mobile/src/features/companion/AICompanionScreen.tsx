import { useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ZodError } from 'zod';

import { agentStatusLabel } from './agentStatus';
import { generateKnowledgeCard, getAIServiceStatus, streamStudyChat } from './api';
import { ChatMessageBubble } from './ChatMessageBubble';
import { CompactKnowledgeCard } from './CompactKnowledgeCard';
import {
  createDetailBranch,
  createInitialSession,
  knowledgeCardContent,
  requestMessagesFor,
} from './conversation';
import type {
  AgentRuntimeStatus,
  CardNode,
  CardRelationType,
  CardSourceType,
  CompanionMessage,
  ConversationSession,
  InlineKeywordItem,
  KnowledgeCard,
} from './contracts';
import { cardTreeFromList } from './contracts';
import { SessionSwitcherModal } from './SessionSwitcherModal';
import { StashedCardRail } from './StashedCardRail';
import { TextSelectionModal } from './TextSelectionModal';
import { palette, radii, spacing } from '@/src/ui/theme';
import { useKnowledgeWorkspace } from '@/src/features/knowledge-workspace';

const welcomeMessage: CompanionMessage = {
  id: 'message-welcome',
  role: 'assistant',
  content: '你好，我是你的 AI 通识伴学伙伴。可以陪你理解课程、分析实验结果，也可以围绕回答中的重点继续探索。',
};

type TemporaryCardEntry = {
  card: KnowledgeCard;
  modelLabel: string;
  sourceMessageContent: string;
};

type TemporaryKnowledgeCard = TemporaryCardEntry & {
  sourceSessionId: string;
  ancestors: TemporaryCardEntry[];
};

const SESSION_STORAGE_KEY = '@campus-ai:companion-sessions:v1';

type StoredConversationWorkspace = {
  schemaVersion: 1;
  sessions: ConversationSession[];
  activeSessionId: string;
};

function isCompanionMessage(value: unknown): value is CompanionMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Partial<CompanionMessage>;
  return (
    typeof message.id === 'string'
    && (message.role === 'user' || message.role === 'assistant')
    && typeof message.content === 'string'
  );
}

function restoreConversationWorkspace(raw: string): StoredConversationWorkspace | null {
  try {
    const value = JSON.parse(raw) as Partial<StoredConversationWorkspace>;
    if (value.schemaVersion !== 1 || !Array.isArray(value.sessions)) return null;
    const sessions = value.sessions.filter((session): session is ConversationSession => (
      Boolean(session)
      && typeof session.id === 'string'
      && typeof session.title === 'string'
      && Array.isArray(session.messages)
      && session.messages.every(isCompanionMessage)
      && Array.isArray(session.contextMessages)
      && session.contextMessages.every(isCompanionMessage)
    ));
    if (sessions.length === 0) return null;
    const activeSessionId = sessions.some((session) => session.id === value.activeSessionId)
      ? value.activeSessionId!
      : sessions[0].id;
    return { schemaVersion: 1, sessions, activeSessionId };
  } catch {
    return null;
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof ZodError) return '服务返回内容没有通过结构校验，请重新生成。';
  if (error instanceof Error) return error.message;
  return '发生未知错误，请稍后重试。';
}

function createStreamingMessage(id: string, runtime: AgentRuntimeStatus): CompanionMessage {
  return {
    id,
    role: 'assistant',
    content: '',
    reasoning: '',
    keywords: [],
    isStreaming: true,
    provider: runtime.provider,
    model: runtime.model,
  };
}

export function AICompanionScreen() {
  const {
    cards,
    stashedCardIds,
    addCard: persistCard,
    removeCard: removePersistedCard,
    stashCard: persistStashedCard,
    restoreCard: restorePersistedCard,
    reorderStashedCard,
  } = useKnowledgeWorkspace();
  const initialSession = useMemo(() => createInitialSession(welcomeMessage), []);
  const [sessions, setSessions] = useState<ConversationSession[]>([initialSession]);
  const [activeSessionId, setActiveSessionId] = useState(initialSession.id);
  const [sessionsHydrated, setSessionsHydrated] = useState(false);
  const [input, setInput] = useState('');
  const [isChatGenerating, setIsChatGenerating] = useState(false);
  const [isCardGenerating, setIsCardGenerating] = useState(false);
  const [runtimeStatus, setRuntimeStatus] = useState<AgentRuntimeStatus>({ phase: 'checking' });
  const [selectionMessage, setSelectionMessage] = useState<CompanionMessage | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [temporaryCard, setTemporaryCard] = useState<TemporaryKnowledgeCard | null>(null);
  const [cardModels, setCardModels] = useState<Record<string, string>>({});
  const [expandedCardIds, setExpandedCardIds] = useState<Set<string>>(new Set());
  const [sessionPickerVisible, setSessionPickerVisible] = useState(false);
  const listRef = useRef<FlatList<any>>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cardGenerationRef = useRef(false);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? sessions[0],
    [activeSessionId, sessions],
  );
  const messages = activeSession.messages;
  const statusLabel = agentStatusLabel(runtimeStatus);
  const persistedActiveCard = cards.find((card) => card.card_id === activeCardId) ?? null;
  const activeCard = temporaryCard?.card ?? persistedActiveCard;

  const cardTree = useMemo(() => cardTreeFromList(cards), [cards]);

  const spawnedCardsByMessage = useMemo(() => {
    const map = new Map<string, KnowledgeCard[]>();
    for (const card of cards) {
      const key = card.source_message_id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(card);
    }
    return map;
  }, [cards]);

  function hasSpawnedCards(message: CompanionMessage): boolean {
    const key = message.serverId ?? message.id;
    return spawnedCardsByMessage.has(key);
  }

  function getSpawnedCards(message: CompanionMessage): KnowledgeCard[] {
    const key = message.serverId ?? message.id;
    return spawnedCardsByMessage.get(key) ?? [];
  }

  const rootCards = useMemo(() => cardTree.filter((c) => !c.parent_card_id), [cardTree]);

  function flattenCardNode(node: CardNode): CardNode[] {
    return [node, ...node.children.flatMap(flattenCardNode)];
  }

  const allCardNodes = useMemo(() => cardTree.flatMap(flattenCardNode), [cardTree]);

  const visibleCardNode = useMemo(() => {
    const map = new Map<string, CardNode>();
    for (const node of allCardNodes) map.set(node.card_id, node);
    return map;
  }, [allCardNodes]);

  function getCardNode(cardId: string): CardNode | undefined {
    return visibleCardNode.get(cardId);
  }

  const stashedCards = useMemo(
    () => stashedCardIds
      .map((cardId) => cards.find((card) => card.card_id === cardId))
      .filter((card): card is KnowledgeCard => Boolean(card)),
    [cards, stashedCardIds],
  );

  useEffect(() => {
    let mounted = true;
    void getAIServiceStatus()
      .then((status) => {
        if (!mounted) return;
        setRuntimeStatus({
          phase: 'ready',
          provider: status.provider,
          configured: status.configured,
          fallbackEnabled: status.mock_fallback_enabled,
        });
      })
      .catch(() => {
        if (mounted) setRuntimeStatus({ phase: 'error' });
      });

    return () => {
      mounted = false;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(SESSION_STORAGE_KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        const restored = restoreConversationWorkspace(raw);
        if (!restored) return;
        setSessions(restored.sessions);
        setActiveSessionId(restored.activeSessionId);
      })
      .finally(() => {
        if (!cancelled) setSessionsHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!sessionsHydrated) return;
    const timeout = setTimeout(() => {
      const snapshot: StoredConversationWorkspace = {
        schemaVersion: 1,
        sessions,
        activeSessionId,
      };
      AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(snapshot)).catch(() => undefined);
    }, 250);
    return () => clearTimeout(timeout);
  }, [activeSessionId, sessions, sessionsHydrated]);

  function setSessionMessages(
    sessionId: string,
    updater: (messages: CompanionMessage[]) => CompanionMessage[],
  ) {
    setSessions((current) => current.map((session) => (
      session.id === sessionId
        ? { ...session, messages: updater(session.messages) }
        : session
    )));
  }

  function updateMessage(
    sessionId: string,
    messageId: string,
    updater: (message: CompanionMessage) => CompanionMessage,
  ) {
    setSessionMessages(sessionId, (current) => current.map((message) => (
      message.id === messageId ? updater(message) : message
    )));
  }

  async function runStream(
    sessionId: string,
    requestMessages: CompanionMessage[],
    assistantId: string,
  ) {
    setIsChatGenerating(true);
    setRuntimeStatus((current) => ({ ...current, phase: 'connecting' }));
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamStudyChat(
        sessionId,
        requestMessages,
        {
          onMeta: (meta) => {
            updateMessage(sessionId, assistantId, (message) => ({
              ...message,
              serverId: meta.message_id,
              provider: meta.provider,
              model: meta.model,
            }));
            setRuntimeStatus({
              phase: 'connecting',
              provider: meta.provider,
              model: meta.model,
              configured: true,
            });
          },
          onReasoningDelta: (text) => {
            setRuntimeStatus((current) => ({ ...current, phase: 'reasoning' }));
            updateMessage(sessionId, assistantId, (message) => ({
              ...message,
              reasoning: `${message.reasoning ?? ''}${text}`,
            }));
          },
          onAnswerStart: () => {
            setRuntimeStatus((current) => ({ ...current, phase: 'answering' }));
          },
          onAnswerDelta: (text) => {
            updateMessage(sessionId, assistantId, (message) => ({
              ...message,
              content: `${message.content}${text}`,
            }));
          },
          onKeywords: (items) => {
            setRuntimeStatus((current) => ({ ...current, phase: 'extracting' }));
            updateMessage(sessionId, assistantId, (message) => ({
              ...message,
              keywords: items.map((keyword, index) => ({
                ...keyword,
                id: `${message.serverId ?? assistantId}-keyword-${index}`,
              })),
            }));
          },
          onDone: () => {
            updateMessage(sessionId, assistantId, (message) => ({ ...message, isStreaming: false }));
            setRuntimeStatus((current) => ({ ...current, phase: 'completed' }));
          },
        },
        controller.signal,
      );
    } catch (error) {
      updateMessage(sessionId, assistantId, (message) => ({
        ...message,
        isStreaming: false,
        content: message.content || '这次没有成功生成回答，请稍后再试。',
      }));
      setRuntimeStatus((current) => ({ ...current, phase: 'error' }));
      Alert.alert('回答生成失败', errorMessage(error));
    } finally {
      abortRef.current = null;
      setIsChatGenerating(false);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }

  async function submitMessage() {
    const content = input.trim();
    if (!content || isChatGenerating) return;

    const userMessage: CompanionMessage = {
      id: `message-user-${Date.now()}`,
      role: 'user',
      content,
    };
    const assistantId = `message-stream-${Date.now()}`;
    const assistantMessage = createStreamingMessage(assistantId, runtimeStatus);
    const visibleHistory = [...messages, userMessage];

    setSessionMessages(activeSession.id, () => [...visibleHistory, assistantMessage]);
    setInput('');
    await runStream(
      activeSession.id,
      requestMessagesFor(activeSession, visibleHistory),
      assistantId,
    );
  }

  async function createCard(cardInput: {
    selectedText: string;
    sourceMessageId: string;
    sourceMessageContent: string;
    parentCardId?: string | null;
    keywordContext?: string;
    relation?: CardRelationType;
    sourceType?: CardSourceType;
    persist?: boolean;
    sourceSessionId?: string;
    temporaryAncestors?: TemporaryCardEntry[];
  }): Promise<KnowledgeCard | null> {
    if (cardGenerationRef.current) return null;
    cardGenerationRef.current = true;
    setIsCardGenerating(true);
    try {
      const result = await generateKnowledgeCard({
        selectedText: cardInput.selectedText,
        sourceMessageId: cardInput.sourceMessageId,
        sourceMessageContent: cardInput.sourceMessageContent,
        parentCardId: cardInput.parentCardId ?? null,
        keywordContext: cardInput.keywordContext ?? null,
        relation: cardInput.relation,
        sourceType: cardInput.sourceType,
      });
      if (cardInput.persist === false) {
        setTemporaryCard({
          card: result.card,
          modelLabel: result.model,
          sourceMessageContent: cardInput.sourceMessageContent,
          sourceSessionId: cardInput.sourceSessionId ?? activeSession.id,
          ancestors: cardInput.temporaryAncestors ?? [],
        });
        setActiveCardId(null);
      } else {
        persistCard(result.card, { sourceMessageContent: cardInput.sourceMessageContent });
        setTemporaryCard(null);
        setActiveCardId(result.card.card_id);
      }
      setCardModels((current) => ({ ...current, [result.card.card_id]: result.model }));
      return result.card;
    } catch (error) {
      Alert.alert('知识卡片生成失败', errorMessage(error));
      return null;
    } finally {
      cardGenerationRef.current = false;
      setIsCardGenerating(false);
    }
  }

  function handleMessageKeyword(message: CompanionMessage, keyword: InlineKeywordItem) {
    void createCard({
      selectedText: keyword.text,
      sourceMessageId: message.serverId ?? message.id,
      sourceMessageContent: message.content,
      parentCardId: activeSession.sourceCardId ?? null,
      keywordContext: keyword.text,
      relation: 'deepen',
      persist: false,
      sourceSessionId: activeSession.id,
      temporaryAncestors: [],
    });
  }

  function handleCardKeyword(card: KnowledgeCard, keyword: InlineKeywordItem) {
    const sourceMessageContent = knowledgeCardContent(card);
    const isCurrentTemporary = temporaryCard?.card.card_id === card.card_id;
    const ancestors = isCurrentTemporary
      ? [
          ...temporaryCard.ancestors,
          {
            card: temporaryCard.card,
            modelLabel: temporaryCard.modelLabel,
            sourceMessageContent: temporaryCard.sourceMessageContent,
          },
        ]
      : [];
    void createCard({
      selectedText: keyword.text,
      sourceMessageId: `message-card-seed-${card.card_id}`,
      sourceMessageContent,
      parentCardId: card.card_id,
      keywordContext: keyword.text,
      relation: 'deepen',
      persist: false,
      sourceSessionId: isCurrentTemporary
        ? temporaryCard.sourceSessionId
        : activeSession.id,
      temporaryAncestors: ancestors,
    });
  }

  function toggleCardExpanded(cardId: string) {
    setExpandedCardIds((current) => {
      const next = new Set(current);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  }

  function openBranchChain(
    entries: TemporaryCardEntry[],
    sourceSessionId: string,
  ) {
    const nextSessions = [...sessions];
    let sourceSession = nextSessions.find((session) => session.id === sourceSessionId)
      ?? activeSession;
    let targetSession = sourceSession;

    for (const entry of entries) {
      const existing = nextSessions.find((session) => session.sourceCardId === entry.card.card_id);
      if (existing) {
        targetSession = existing;
        sourceSession = existing;
        continue;
      }
      const launch = createDetailBranch(sourceSession, entry.card);
      nextSessions.push(launch.session);
      targetSession = launch.session;
      sourceSession = launch.session;
    }

    setSessions(nextSessions);
    setActiveSessionId(targetSession.id);
    setTemporaryCard(null);
    setActiveCardId(null);
  }

  function extendCard(card: KnowledgeCard) {
    if (temporaryCard?.card.card_id === card.card_id) {
      const chain = [
        ...temporaryCard.ancestors,
        {
          card,
          modelLabel: temporaryCard.modelLabel,
          sourceMessageContent: temporaryCard.sourceMessageContent,
        },
      ];
      for (const entry of chain) {
        persistCard(entry.card, { sourceMessageContent: entry.sourceMessageContent });
      }
      setCardModels((current) => Object.fromEntries([
        ...Object.entries(current),
        ...chain.map((entry) => [entry.card.card_id, entry.modelLabel]),
      ]));
      openBranchChain(chain, temporaryCard.sourceSessionId);
      return;
    }
    openBranchChain(
      [{
        card,
        modelLabel: cardModels[card.card_id] ?? '',
        sourceMessageContent: knowledgeCardContent(card),
      }],
      activeSession.id,
    );
  }

  function stashCard(cardId: string) {
    if (temporaryCard?.card.card_id === cardId) {
      const chain = [
        ...temporaryCard.ancestors,
        {
          card: temporaryCard.card,
          modelLabel: temporaryCard.modelLabel,
          sourceMessageContent: temporaryCard.sourceMessageContent,
        },
      ];
      for (const entry of chain) {
        persistCard(entry.card, { sourceMessageContent: entry.sourceMessageContent });
      }
      persistStashedCard(cardId);
      setCardModels((current) => Object.fromEntries([
        ...Object.entries(current),
        ...chain.map((entry) => [entry.card.card_id, entry.modelLabel]),
      ]));
      setTemporaryCard(null);
      setActiveCardId(null);
      return;
    }
    persistStashedCard(cardId);
    setExpandedCardIds((current) => {
      const next = new Set(current);
      next.delete(cardId);
      return next;
    });
    setActiveCardId((current) => (current === cardId ? null : current));
  }

  function restoreCard(cardId: string) {
    const card = cards.find((item) => item.card_id === cardId);
    if (!card) return;
    restorePersistedCard(cardId);
    setActiveCardId(cardId);
  }

  function presentCard(cardId: string) {
    if (!cards.some((card) => card.card_id === cardId)) return;
    setTemporaryCard(null);
    restorePersistedCard(cardId);
    setActiveCardId(cardId);
  }

  function requestDeleteCard(cardId: string) {
    if (temporaryCard?.card.card_id === cardId) {
      setTemporaryCard(null);
      return;
    }
    const card = cards.find((item) => item.card_id === cardId);
    if (!card) return;
    Alert.alert(
      '删除知识卡片？',
      `"${card.title}"删除后无法从暂存区恢复。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            removePersistedCard(cardId);
            setActiveCardId((current) => (current === cardId ? null : current));
            setCardModels((current) => {
              const next = { ...current };
              delete next[cardId];
              return next;
            });
            setExpandedCardIds((current) => {
              const next = new Set(current);
              next.delete(cardId);
              return next;
            });
          },
        },
      ],
    );
  }

  function returnToParentConversation() {
    if (!activeSession.parentConversationId || isChatGenerating) return;
    setActiveSessionId(activeSession.parentConversationId);
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={6}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>可复用 AGENT 交互模块</Text>
            <Text style={styles.title}>AI 伴学</Text>
          </View>
          <View style={styles.providerBadge}>
            <View style={[
              styles.statusDot,
              runtimeStatus.phase === 'error' && styles.errorDot,
              isChatGenerating && styles.busyDot,
            ]} />
            <Text numberOfLines={1} style={styles.providerText}>{statusLabel}</Text>
          </View>
        </View>

        <View style={styles.topicStrip}>
          {activeSession.parentConversationId && (
            <Pressable
              disabled={isChatGenerating}
              onPress={returnToParentConversation}
              style={styles.backButton}>
              <Text style={styles.backText}>← 原会话</Text>
            </Pressable>
          )}
          <View style={styles.topicBody}>
            <Text style={styles.topicLabel}>
              {activeSession.parentConversationId ? '知识分支' : '当前会话'}
            </Text>
            <Text numberOfLines={1} style={styles.topicText}>{activeSession.title}</Text>
          </View>
          <Pressable onPress={() => setSessionPickerVisible(true)} style={styles.sessionButton}>
            <Text style={styles.sessionText}>{sessions.length} 个会话</Text>
          </Pressable>
          <Pressable
            disabled={isChatGenerating}
            onPress={() => router.push('/chat')}
            style={({ pressed }) => [styles.qaButton, pressed && styles.qaPressed]}>
            <Text style={styles.qaText}>通用问答</Text>
          </Pressable>
          <Text style={styles.cardCount}>{cards.length} 卡</Text>
        </View>

        <View style={styles.body}>
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View>
                <ChatMessageBubble
                  message={item}
                  onSelectionRequest={setSelectionMessage}
                  onKeywordPress={handleMessageKeyword}
                />
                {!item.isStreaming && hasSpawnedCards(item) && (
                  <View style={styles.cardPreviewStrip}>
                    {getSpawnedCards(item).map((card) => {
                      const node = getCardNode(card.card_id);
                      const isExpanded = expandedCardIds.has(card.card_id);
                      return (
                        <View key={card.card_id}>
                          <View style={styles.cardPreview}>
                            <Pressable
                              accessibilityLabel={`打开知识卡片 ${card.title}`}
                              onPress={() => presentCard(card.card_id)}
                              style={({ pressed }) => [
                                styles.cardPreviewMain,
                                pressed && styles.cardPreviewPressed,
                              ]}>
                              <View style={styles.cardPreviewAccent} />
                              <View style={styles.cardPreviewBody}>
                                <Text numberOfLines={1} style={styles.cardPreviewTitle}>
                                  {card.title}
                                </Text>
                                <Text numberOfLines={2} style={styles.cardPreviewSummary}>
                                  {card.plain_explanation}
                                </Text>
                              </View>
                            </Pressable>
                            <Pressable
                              accessibilityLabel={isExpanded ? '收起卡片树' : '展开卡片树'}
                              hitSlop={8}
                              onPress={() => toggleCardExpanded(card.card_id)}
                              style={styles.cardTreeToggle}>
                              <Text style={styles.cardPreviewArrow}>
                                {isExpanded ? '▾' : '▸'}
                              </Text>
                            </Pressable>
                          </View>
                          {isExpanded && node && (
                            <CompactKnowledgeCard
                              card={card}
                              modelLabel={cardModels[card.card_id]}
                              node={node}
                              expandedCardIds={expandedCardIds}
                              onToggleExpand={toggleCardExpanded}
                              onExtend={extendCard}
                              onKeywordPress={handleCardKeyword}
                              onStash={stashCard}
                              onRequestDelete={requestDeleteCard}
                              onCreateChildCard={async (parentCard, text) => {
                                const newCard = await createCard({
                                  selectedText: text,
                                  sourceMessageId: parentCard.source_message_id,
                                  sourceMessageContent: parentCard.plain_explanation,
                                   parentCardId: parentCard.card_id,
                                   keywordContext: text,
                                   sourceType: parentCard.source_type,
                                });
                                if (newCard) {
                                  setExpandedCardIds((current) =>
                                    new Set(current).add(newCard.card_id));
                                }
                              }}
                              inline
                            />
                          )}
                          {isExpanded && node && node.children.length > 0 && (
                            <View style={styles.childCardStrip}>
                              {node.children.map((child) => (
                                <Pressable
                                  key={child.card_id}
                                  onPress={() => toggleCardExpanded(child.card_id)}
                                  style={({ pressed }) => [
                                    styles.cardPreview,
                                    styles.childCardPreview,
                                    pressed && styles.cardPreviewPressed,
                                  ]}>
                                  <View style={styles.childCardAccent} />
                                  <View style={styles.cardPreviewBody}>
                                    <Text numberOfLines={1} style={styles.cardPreviewTitle}>
                                      {child.title}
                                    </Text>
                                  </View>
                                  <Text style={styles.cardPreviewArrow}>
                                    {expandedCardIds.has(child.card_id) ? '▾' : '▸'}
                                  </Text>
                                </Pressable>
                              ))}
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}
            contentContainerStyle={styles.messageList}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          />
          <StashedCardRail
            cards={stashedCards}
            onRestore={restoreCard}
            onReorder={reorderStashedCard}
          />
          {isCardGenerating && (
            <View pointerEvents="none" style={styles.cardLoadingOverlay}>
              <View style={styles.cardLoading}>
                <View style={styles.cardLoadingDot} />
                <View style={styles.cardLoadingBody}>
                  <Text style={styles.cardLoadingTitle}>正在提炼知识卡片</Text>
                  <Text style={styles.cardLoadingText}>Flash 模型正在整理核心结论</Text>
                </View>
              </View>
            </View>
          )}
          {activeCard && (
            <CompactKnowledgeCard
              key={activeCard.card_id}
              card={activeCard}
              modelLabel={
                temporaryCard?.card.card_id === activeCard.card_id
                  ? temporaryCard.modelLabel
                  : cardModels[activeCard.card_id]
              }
              node={getCardNode(activeCard.card_id)}
              expandedCardIds={expandedCardIds}
              onClose={() => {
                setTemporaryCard(null);
                setActiveCardId(null);
              }}
              onToggleExpand={toggleCardExpanded}
              onExtend={extendCard}
              onKeywordPress={handleCardKeyword}
              onStash={stashCard}
              onRequestDelete={requestDeleteCard}
              temporary={temporaryCard?.card.card_id === activeCard.card_id}
            />
          )}
        </View>

        {isChatGenerating && (
          <View style={styles.progressBar}>
            <View style={styles.progressPulse} />
            <Text style={styles.progressText}>{statusLabel}</Text>
          </View>
        )}

        <View style={styles.composer}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="围绕 AI 课程或实验继续提问…"
            placeholderTextColor={palette.faint}
            multiline
            maxLength={2000}
            style={styles.input}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="发送消息"
            disabled={!input.trim() || isChatGenerating}
            onPress={() => void submitMessage()}
            style={({ pressed }) => [
              styles.sendButton,
              (!input.trim() || isChatGenerating) && styles.sendDisabled,
              pressed && styles.sendPressed,
            ]}>
            <Text style={styles.sendText}>→</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <TextSelectionModal
        visible={selectionMessage !== null}
        message={selectionMessage}
        onClose={() => setSelectionMessage(null)}
        onConfirm={(message, selectedText) => {
          setSelectionMessage(null);
          void createCard({
            selectedText,
            sourceMessageId: message.serverId ?? message.id,
            sourceMessageContent: message.content,
          });
        }}
      />
      <SessionSwitcherModal
        activeSessionId={activeSession.id}
        sessions={sessions}
        visible={sessionPickerVisible}
        onClose={() => setSessionPickerVisible(false)}
        onSelect={(sessionId) => {
          if (!isChatGenerating) setActiveSessionId(sessionId);
          setSessionPickerVisible(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: palette.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingHorizontal: spacing.md, paddingTop: 8, paddingBottom: 12 },
  eyebrow: { color: palette.indigo, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  title: { color: palette.ink, fontSize: 24, fontWeight: '800', marginTop: 1 },
  providerBadge: { maxWidth: '58%', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: palette.surface, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: palette.border },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: palette.mint },
  busyDot: { backgroundColor: palette.amber },
  errorDot: { backgroundColor: palette.danger },
  providerText: { flexShrink: 1, color: palette.muted, fontSize: 10, fontWeight: '700' },
  topicStrip: { minHeight: 49, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: spacing.md, paddingVertical: 8, backgroundColor: palette.surfaceSoft, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#E2E4F8' },
  backButton: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 99, backgroundColor: palette.surface },
  backText: { color: palette.indigo, fontSize: 10, fontWeight: '800' },
  topicBody: { flex: 1 },
  topicLabel: { color: palette.purple, fontSize: 9, fontWeight: '800' },
  topicText: { color: palette.ink, fontSize: 12, fontWeight: '700', marginTop: 1 },
  sessionButton: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 99, backgroundColor: palette.surface },
  sessionText: { color: palette.indigo, fontSize: 9, fontWeight: '800' },
  qaButton: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99, backgroundColor: palette.indigo },
  qaPressed: { opacity: 0.8 },
  qaText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  cardCount: { color: palette.muted, fontSize: 10 },
  body: { flex: 1, position: 'relative' },
  messageList: { paddingTop: 16, paddingBottom: 18 },
  progressBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: spacing.md, marginBottom: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.md, backgroundColor: palette.surfaceSoft },
  progressPulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.purple },
  progressText: { color: palette.indigoDark, fontSize: 11, fontWeight: '700' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: spacing.md, paddingTop: 9, borderTopWidth: 1, borderTopColor: palette.border, backgroundColor: palette.surface },
  input: { flex: 1, minHeight: 46, maxHeight: 112, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 18, backgroundColor: palette.background, color: palette.ink, fontSize: 15, lineHeight: 21 },
  sendButton: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.indigo },
  sendDisabled: { backgroundColor: '#B8BDD3' },
  sendPressed: { transform: [{ scale: 0.94 }] },
  sendText: { color: '#FFFFFF', fontSize: 24, fontWeight: '600', marginTop: -2 },
  cardPreviewStrip: {
    marginTop: -6,
    marginBottom: 10,
    paddingHorizontal: spacing.md,
  },
  cardPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
    borderRadius: radii.md,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  cardPreviewMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTreeToggle: { marginLeft: 8, paddingHorizontal: 5, paddingVertical: 8 },
  cardPreviewPressed: { opacity: 0.75 },
  cardPreviewAccent: { width: 4, height: 36, borderRadius: 3, backgroundColor: palette.mint },
  childCardAccent: { width: 4, height: 24, borderRadius: 3, backgroundColor: palette.purple },
  cardPreviewBody: { flex: 1 },
  cardPreviewTitle: { color: palette.ink, fontSize: 13, fontWeight: '800' },
  cardPreviewSummary: { color: palette.muted, fontSize: 11, lineHeight: 16, marginTop: 2 },
  cardPreviewArrow: { color: palette.muted, fontSize: 14, fontWeight: '700', paddingHorizontal: 4 },
  childCardStrip: {
    marginLeft: 20,
    paddingLeft: 4,
    borderLeftWidth: 2,
    borderLeftColor: '#D9DDF2',
  },
  childCardPreview: {
    paddingVertical: 7,
  },
  cardLoadingOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 110,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  cardLoading: {
    width: '100%',
    maxWidth: 360,
    minHeight: 104,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: spacing.md,
    borderRadius: radii.xl,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: '#D9DDF2',
  },
  cardLoadingDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: palette.purple },
  cardLoadingBody: { flex: 1 },
  cardLoadingTitle: { color: palette.ink, fontSize: 14, fontWeight: '800' },
  cardLoadingText: { color: palette.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
});
