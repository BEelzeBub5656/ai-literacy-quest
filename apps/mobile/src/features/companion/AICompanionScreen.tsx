import { useEffect, useMemo, useRef, useState } from 'react';
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
import { ZodError } from 'zod';

import { generateKnowledgeCard, streamStudyChat } from './api';
import { ChatMessageBubble } from './ChatMessageBubble';
import type {
  CompanionMessage,
  InlineKeywordItem,
  KeywordItem,
  KnowledgeCard,
} from './contracts';
import { DraggableKnowledgeCard } from './DraggableKnowledgeCard';
import { StashedCardRail } from './StashedCardRail';
import { TextSelectionModal } from './TextSelectionModal';
import { palette, radii, spacing } from '@/src/ui/theme';

const conversationId = `conversation-${Date.now()}`;

const welcomeMessage: CompanionMessage = {
  id: 'message-welcome',
  role: 'assistant',
  content: '你好，我是你的 AI 伴学。可以随意聊天，也可以从 Agent、Tool、Skill 或 Middleware 开始探索。',
};

function errorMessage(error: unknown): string {
  if (error instanceof ZodError) return '流式事件没有通过客户端结构校验，请重新生成。';
  if (error instanceof Error) return error.message;
  return '发生未知错误，请稍后重试。';
}

export function AICompanionScreen() {
  const [messages, setMessages] = useState<CompanionMessage[]>([welcomeMessage]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [providerLabel, setProviderLabel] = useState('DeepSeek · 推理流');
  const [selectionMessage, setSelectionMessage] = useState<CompanionMessage | null>(null);
  const [cards, setCards] = useState<KnowledgeCard[]>([]);
  const [stashedIds, setStashedIds] = useState<Set<string>>(new Set());
  const listRef = useRef<FlatList<CompanionMessage>>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const activeCards = useMemo(
    () => cards.filter((card) => !stashedIds.has(card.card_id)),
    [cards, stashedIds],
  );
  const stashedCards = useMemo(
    () => cards.filter((card) => stashedIds.has(card.card_id)),
    [cards, stashedIds],
  );

  function updateMessage(
    id: string,
    updater: (message: CompanionMessage) => CompanionMessage,
  ) {
    setMessages((current) => current.map((message) => (
      message.id === id ? updater(message) : message
    )));
  }

  async function submitMessage() {
    const content = input.trim();
    if (!content || isGenerating) return;

    const userMessage: CompanionMessage = {
      id: `message-user-${Date.now()}`,
      role: 'user',
      content,
    };
    const assistantId = `message-stream-${Date.now()}`;
    const assistantMessage: CompanionMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      reasoning: '',
      keywords: [],
      isStreaming: true,
      provider: 'deepseek',
    };
    const historyForRequest = [...messages, userMessage];
    setMessages([...historyForRequest, assistantMessage]);
    setInput('');
    setIsGenerating(true);
    setProviderLabel('DeepSeek · 正在连接');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamStudyChat(
        conversationId,
        historyForRequest,
        {
          onMeta: (meta) => {
            updateMessage(assistantId, (message) => ({
              ...message,
              serverId: meta.message_id,
              provider: meta.provider,
              model: meta.model,
            }));
            setProviderLabel(`${meta.model} · 思考中`);
          },
          onReasoningDelta: (text) => {
            updateMessage(assistantId, (message) => ({
              ...message,
              reasoning: `${message.reasoning ?? ''}${text}`,
            }));
          },
          onAnswerStart: () => setProviderLabel('DeepSeek · 正在回答'),
          onAnswerDelta: (text) => {
            updateMessage(assistantId, (message) => ({
              ...message,
              content: `${message.content}${text}`,
            }));
          },
          onKeywords: (items) => {
            updateMessage(assistantId, (message) => ({
              ...message,
              keywords: items.map((keyword, index) => ({
                ...keyword,
                id: `${message.serverId ?? assistantId}-keyword-${index}`,
              })),
            }));
          },
          onDone: () => {
            updateMessage(assistantId, (message) => ({ ...message, isStreaming: false }));
            setProviderLabel('DeepSeek · 推理完成');
          },
        },
        controller.signal,
      );
    } catch (error) {
      updateMessage(assistantId, (message) => ({
        ...message,
        isStreaming: false,
        content: message.content || '这次没有成功生成回答，请稍后再试。',
      }));
      Alert.alert('回答生成失败', errorMessage(error));
      setProviderLabel('DeepSeek · 暂时不可用');
    } finally {
      abortRef.current = null;
      setIsGenerating(false);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }

  async function createCard(input: {
    selectedText: string;
    sourceMessageId: string;
    sourceMessageContent: string;
    parentCardId?: string | null;
    keywordContext?: string;
  }) {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const card = await generateKnowledgeCard(input);
      setCards((current) => [...current, card]);
      setProviderLabel('DeepSeek · 知识卡已验证');
    } catch (error) {
      Alert.alert('知识卡生成失败', errorMessage(error));
    } finally {
      setIsGenerating(false);
    }
  }

  function handleMessageKeyword(message: CompanionMessage, keyword: InlineKeywordItem) {
    void createCard({
      selectedText: keyword.text,
      sourceMessageId: message.serverId ?? message.id,
      sourceMessageContent: message.content,
      keywordContext: keyword.text,
    });
  }

  function handleCardKeyword(card: KnowledgeCard, keyword: KeywordItem) {
    void createCard({
      selectedText: keyword.text,
      sourceMessageId: card.source_message_id,
      sourceMessageContent: card.plain_explanation,
      parentCardId: card.card_id,
      keywordContext: keyword.text,
    });
  }

  function requestDelete(cardId: string) {
    const card = cards.find((item) => item.card_id === cardId);
    Alert.alert(
      '删除知识卡片？',
      card ? `“${card.title}”将从当前 Demo 视图移除。` : '卡片将从当前 Demo 视图移除。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            setCards((current) => current.filter((item) => item.card_id !== cardId));
            setStashedIds((current) => {
              const next = new Set(current);
              next.delete(cardId);
              return next;
            });
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={6}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>可生长知识空间</Text>
            <Text style={styles.title}>AI 伴学</Text>
          </View>
          <View style={styles.providerBadge}>
            <View style={styles.onlineDot} />
            <Text style={styles.providerText}>{providerLabel}</Text>
          </View>
        </View>

        <View style={styles.topicStrip}>
          <Text style={styles.topicLabel}>自由对话</Text>
          <Text style={styles.topicText}>DeepSeek 推理模式</Text>
          <Text style={styles.cardCount}>{cards.length} 张卡片</Text>
        </View>

        <View style={styles.body}>
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ChatMessageBubble
                message={item}
                onLongPress={setSelectionMessage}
                onKeywordPress={handleMessageKeyword}
              />
            )}
            contentContainerStyle={styles.messageList}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          />

          {activeCards.map((card, index) => (
            <DraggableKnowledgeCard
              key={card.card_id}
              card={card}
              stackIndex={index}
              onStash={(cardId) => setStashedIds((current) => new Set(current).add(cardId))}
              onRequestDelete={requestDelete}
              onKeywordPress={handleCardKeyword}
            />
          ))}
          <StashedCardRail
            cards={stashedCards}
            onRestore={(cardId) => setStashedIds((current) => {
              const next = new Set(current);
              next.delete(cardId);
              return next;
            })}
          />
        </View>

        {isGenerating && (
          <View style={styles.progressBar}>
            <View style={styles.progressPulse} />
            <Text style={styles.progressText}>正在接收 DeepSeek 实时推理与回答</Text>
          </View>
        )}

        <View style={styles.composer}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="想聊什么都可以…"
            placeholderTextColor={palette.faint}
            multiline
            maxLength={2000}
            style={styles.input}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="发送消息"
            disabled={!input.trim() || isGenerating}
            onPress={() => void submitMessage()}
            style={({ pressed }) => [
              styles.sendButton,
              (!input.trim() || isGenerating) && styles.sendDisabled,
              pressed && styles.sendPressed,
            ]}>
            <Text style={styles.sendText}>↑</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: palette.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: 8, paddingBottom: 12 },
  eyebrow: { color: palette.indigo, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  title: { color: palette.ink, fontSize: 24, fontWeight: '800', marginTop: 1 },
  providerBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: palette.surface, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: palette.border },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: palette.mint },
  providerText: { color: palette.muted, fontSize: 10, fontWeight: '700' },
  topicStrip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 9, backgroundColor: palette.surfaceSoft, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#E2E4F8' },
  topicLabel: { color: palette.purple, fontSize: 10, fontWeight: '800', marginRight: 8 },
  topicText: { color: palette.ink, fontSize: 12, fontWeight: '700', flex: 1 },
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
});
