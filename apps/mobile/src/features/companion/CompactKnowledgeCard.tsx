import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { CardNode, InlineKeywordItem, KnowledgeCard } from './contracts';
import { knowledgeCardKeywords } from './conversation';
import { HighlightedText } from './HighlightedText';
import { palette, radii, shadows, spacing } from '@/src/ui/theme';

type Props = {
  card: KnowledgeCard | null;
  modelLabel?: string;
  node?: CardNode;
  expandedCardIds?: Set<string>;
  onClose?: () => void;
  onToggleExpand?: (cardId: string) => void;
  onExtend?: (card: KnowledgeCard) => void;
  onStash: (cardId: string) => void;
  onRequestDelete: (cardId: string) => void;
  onCreateChildCard?: (parentCard: KnowledgeCard, text: string) => void;
  onKeywordPress?: (card: KnowledgeCard, keyword: InlineKeywordItem) => void;
  inline?: boolean;
  temporary?: boolean;
};

const SWIPE_THRESHOLD_RATIO = 0.22;
const CARD_ESTIMATED_HEIGHT = 300;
const EDGE_GUARD = 28;
const MIN_CARD_SCALE = 0.65;
const MAX_CARD_SCALE = 1.5;

export function CompactKnowledgeCard({
  card,
  modelLabel,
  node,
  expandedCardIds,
  onClose,
  onToggleExpand,
  onExtend,
  onStash,
  onRequestDelete,
  onCreateChildCard,
  onKeywordPress,
  inline = false,
  temporary = false,
}: Props) {
  const { width, height } = useWindowDimensions();
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const actionX = useSharedValue(0);
  const cardScale = useSharedValue(1);
  const startScale = useSharedValue(1);
  const cardId = card?.card_id ?? '';
  const [childInput, setChildInput] = useState('');
  const maxRestingX = Math.max(0, width / 2 - EDGE_GUARD);
  const maxRestingY = Math.max(0, (height - CARD_ESTIMATED_HEIGHT) / 2 - EDGE_GUARD);

  if (!card) return null;
  const inlineKeywords = knowledgeCardKeywords(card);

  const pan = inline
    ? null
    : Gesture.Pan()
        .enabled(Boolean(cardId))
        .maxPointers(1)
        .minDistance(4)
        .onBegin(() => {
          startX.value = offsetX.value;
          startY.value = offsetY.value;
          actionX.value = 0;
        })
        .onUpdate((event) => {
          actionX.value = event.translationX;
          offsetX.value = Math.max(
            -maxRestingX,
            Math.min(maxRestingX, startX.value + event.translationX),
          );
          offsetY.value = Math.max(
            -maxRestingY,
            Math.min(maxRestingY, startY.value + event.translationY),
          );
        })
        .onEnd(() => {
          const threshold = width * SWIPE_THRESHOLD_RATIO;
          if (actionX.value < -threshold) {
            offsetX.value = withTiming(-width, { duration: 180 }, (finished) => {
              if (finished) runOnJS(onStash)(cardId);
            });
            return;
          }
          if (actionX.value > threshold) {
            offsetX.value = withSpring(startX.value, { damping: 18, stiffness: 190 });
            actionX.value = withSpring(0);
            runOnJS(onRequestDelete)(cardId);
            return;
          }
          startX.value = offsetX.value;
          startY.value = offsetY.value;
          actionX.value = withSpring(0, { damping: 18, stiffness: 190 });
        });

  const pinch = inline
    ? null
    : Gesture.Pinch()
        .enabled(Boolean(cardId))
        .onBegin(() => {
          startScale.value = cardScale.value;
        })
        .onUpdate((event) => {
          cardScale.value = Math.max(
            MIN_CARD_SCALE,
            Math.min(MAX_CARD_SCALE, startScale.value * event.scale),
          );
        })
        .onEnd(() => {
          startScale.value = cardScale.value;
        });

  const cardGesture = inline ? null : Gesture.Simultaneous(pan!, pinch!);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0.72, 1 - Math.abs(actionX.value) / width),
    transform: [
      { translateX: offsetX.value },
      { translateY: offsetY.value },
      { scale: cardScale.value },
      { rotate: `${Math.max(-2.5, Math.min(2.5, actionX.value / 120))}deg` },
    ],
  }));

  function submitChildCard() {
    const text = childInput.trim();
    if (!text || !onCreateChildCard) return;
    onCreateChildCard(card!, text);
    setChildInput('');
  }

  const content = (
    <View style={[styles.card, inline && styles.cardInline]}>
      {!inline && <View style={styles.dragHandle} />}

      <View style={styles.header}>
        <Text style={[styles.badge, temporary && styles.temporaryBadge]}>
          {temporary ? '即时解释' : '知识卡片'}
        </Text>
        {!inline && (
          <Text numberOfLines={1} style={styles.dragHint}>
            {modelLabel ? `${modelLabel} · 双指缩放` : '拖动位置 · 双指缩放'}
          </Text>
        )}
        <View style={{ flex: 1 }} />
        {inline && onStash && (
          <Pressable
            onPress={() => onStash(card.card_id)}
            hitSlop={8}
            style={styles.inlineAction}>
            <Text style={styles.inlineActionText}>暂存</Text>
          </Pressable>
        )}
        {onExtend && (
          <Pressable
            accessibilityLabel={`引申知识卡片 ${card.title}`}
            hitSlop={8}
            onPress={() => onExtend(card)}
            style={({ pressed }) => [
              styles.extendButton,
              pressed && styles.extendButtonPressed,
            ]}>
            <Text style={styles.extendButtonText}>引申</Text>
          </Pressable>
        )}
        {inline && onClose && (
          <Pressable accessibilityLabel="折叠卡片" hitSlop={12} onPress={onClose}>
            <Text style={styles.close}>▴</Text>
          </Pressable>
        )}
        {!inline && onClose && (
          <Pressable accessibilityLabel="关闭" hitSlop={12} onPress={onClose}>
            <Text style={styles.close}>×</Text>
          </Pressable>
        )}
      </View>

      <Text numberOfLines={inline ? undefined : 1} style={styles.title}>{card.title}</Text>
      <HighlightedText
        text={card.plain_explanation}
        keywords={inlineKeywords}
        selectable
        style={styles.summary}
        onKeywordPress={(keyword) => onKeywordPress?.(card, keyword)}
      />

      {card.key_points.length > 0 && (
        <View style={styles.points}>
          {card.key_points.slice(0, inline ? 3 : 2).map((point) => (
            <View key={point} style={styles.pointRow}>
              <View style={styles.pointDot} />
              <HighlightedText
                text={point}
                keywords={inlineKeywords}
                selectable
                style={styles.pointText}
                onKeywordPress={(keyword) => onKeywordPress?.(card, keyword)}
              />
            </View>
          ))}
        </View>
      )}

      {inlineKeywords.length > 0 && (
        <View style={styles.relatedTerms}>
          <Text style={styles.relatedTermsLabel}>继续探索</Text>
          <HighlightedText
            text={inlineKeywords.map((keyword) => keyword.text).join(' · ')}
            keywords={inlineKeywords}
            selectable={false}
            style={styles.relatedTermsText}
            onKeywordPress={(keyword) => onKeywordPress?.(card, keyword)}
          />
        </View>
      )}

      <View style={styles.actions}>
        <Pressable onPress={() => onStash(card.card_id)} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>暂存</Text>
        </Pressable>
      </View>
      {temporary && (
        <Text style={styles.temporaryHint}>
          关闭后不会保存；点击“引申”才会加入当前知识分支。
        </Text>
      )}

      {inline && onCreateChildCard && (
        <View style={styles.childComposer}>
          <Text style={styles.childComposerLabel}>对这张卡片继续追问</Text>
          <View style={styles.childComposerRow}>
            <TextInput
              value={childInput}
              onChangeText={setChildInput}
              placeholder="输入关键词生成子卡片…"
              placeholderTextColor={palette.faint}
              style={styles.childInput}
              onSubmitEditing={submitChildCard}
              returnKeyType="send"
            />
            <Pressable
              disabled={!childInput.trim()}
              onPress={submitChildCard}
              style={({ pressed }) => [
                styles.childSendButton,
                !childInput.trim() && styles.childSendDisabled,
                pressed && { opacity: 0.7 },
              ]}>
              <Text style={styles.childSendText}>+</Text>
            </Pressable>
          </View>
        </View>
      )}

      {inline && node && node.children.length > 0 && (
        <View style={styles.childList}>
          <Text style={styles.childListLabel}>
            已派生 {node.children.length} 张子卡片
          </Text>
        </View>
      )}
    </View>
  );

  if (inline) return content;

  // Modal mode
  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={card !== null}>
      <GestureHandlerRootView style={styles.modalRoot}>
        <View style={styles.backdrop}>
          <Pressable accessibilityLabel="关闭知识卡片" onPress={onClose} style={StyleSheet.absoluteFill} />
          <View pointerEvents="none" style={[styles.swipeCue, styles.stashCue]}>
            <Text style={styles.stashCueText}>← 暂存</Text>
          </View>
          <View pointerEvents="none" style={[styles.swipeCue, styles.deleteCue]}>
            <Text style={styles.deleteCueText}>删除 →</Text>
          </View>
          <GestureDetector gesture={cardGesture!}>
            <Animated.View accessibilityViewIsModal style={animatedStyle}>
              {content}
            </Animated.View>
          </GestureDetector>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, backgroundColor: 'transparent' },
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(18,24,43,0.35)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#D9DDF2',
    backgroundColor: palette.surface,
    ...shadows.card,
  },
  cardInline: {
    maxWidth: '100%',
    marginTop: 0,
    marginBottom: 4,
    ...shadows.card,
  },
  dragHandle: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 9, backgroundColor: palette.border },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { color: '#237D68', fontSize: 10, fontWeight: '800', backgroundColor: palette.mintSoft, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99 },
  temporaryBadge: { color: palette.indigo, backgroundColor: palette.surfaceSoft },
  dragHint: { flex: 1, textAlign: 'center', color: palette.faint, fontSize: 9, fontWeight: '700' },
  close: { color: palette.faint, fontSize: 24, lineHeight: 24, fontWeight: '600' },
  inlineAction: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, backgroundColor: palette.surfaceSoft },
  inlineActionText: { color: palette.indigo, fontSize: 10, fontWeight: '700' },
  extendButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
    backgroundColor: palette.indigo,
  },
  extendButtonPressed: { opacity: 0.72 },
  extendButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  title: { color: palette.ink, fontSize: 18, lineHeight: 24, fontWeight: '800', marginTop: 10 },
  summary: { color: palette.muted, fontSize: 13, lineHeight: 20, marginTop: 7 },
  points: { gap: 6, marginTop: 10 },
  pointRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pointDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: palette.purple },
  pointText: { flex: 1, color: palette.ink, fontSize: 12, lineHeight: 18 },
  relatedTerms: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  relatedTermsLabel: {
    color: palette.faint,
    fontSize: 9,
    fontWeight: '800',
    marginBottom: 5,
  },
  relatedTermsText: { color: palette.ink, fontSize: 12, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 15 },
  secondaryButton: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radii.md, backgroundColor: palette.background },
  secondaryText: { color: palette.muted, fontSize: 12, fontWeight: '700' },
  temporaryHint: {
    color: palette.faint,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 8,
    textAlign: 'center',
  },
  primaryButton: { flex: 1.35, alignItems: 'center', paddingVertical: 10, borderRadius: radii.md, backgroundColor: palette.indigo },
  primaryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  swipeCue: { position: 'absolute', top: '50%', marginTop: -18, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 99 },
  stashCue: { left: 18, backgroundColor: palette.mintSoft },
  deleteCue: { right: 18, backgroundColor: '#FCE8EC' },
  stashCueText: { color: '#237D68', fontSize: 11, fontWeight: '800' },
  deleteCueText: { color: palette.danger, fontSize: 11, fontWeight: '800' },
  childComposer: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  childComposerLabel: { color: palette.purple, fontSize: 10, fontWeight: '800', marginBottom: 8 },
  childComposerRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  childInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.md,
    backgroundColor: palette.background,
    color: palette.ink,
    fontSize: 13,
    borderWidth: 1,
    borderColor: palette.border,
  },
  childSendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.purple,
  },
  childSendDisabled: { backgroundColor: '#B8BDD3' },
  childSendText: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginTop: -1 },
  childList: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  childListLabel: { color: palette.muted, fontSize: 10, fontWeight: '700' },
});
