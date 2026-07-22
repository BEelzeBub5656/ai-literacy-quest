import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { CardNode, KnowledgeCard } from './contracts';
import { palette, radii, shadows, spacing } from '@/src/ui/theme';

type Props = {
  card: KnowledgeCard | null;
  node?: CardNode;
  expandedCardIds?: Set<string>;
  onClose?: () => void;
  onToggleExpand?: (cardId: string) => void;
  onLearnMore?: (card: KnowledgeCard) => void;
  onStash: (cardId: string) => void;
  onRequestDelete: (cardId: string) => void;
  onCreateChildCard?: (parentCard: KnowledgeCard, text: string) => void;
  inline?: boolean;
};

const SWIPE_THRESHOLD_RATIO = 0.22;

export function CompactKnowledgeCard({
  card, node, expandedCardIds, onClose, onToggleExpand,
  onLearnMore, onStash, onRequestDelete, onCreateChildCard, inline = false,
}: Props) {
  const { width } = useWindowDimensions();
  const offsetX = useSharedValue(0);
  const cardId = card?.card_id ?? '';
  const [childInput, setChildInput] = useState('');

  if (!card) return null;

  const pan = inline ? null : Gesture.Pan()
    .enabled(Boolean(cardId))
    .activeOffsetX([-10, 10]).failOffsetY([-18, 18])
    .onUpdate((event) => { offsetX.value = event.translationX; })
    .onEnd(() => {
      const threshold = width * SWIPE_THRESHOLD_RATIO;
      if (offsetX.value < -threshold) {
        offsetX.value = withTiming(-width, { duration: 180 }, (finished) => {
          if (finished) runOnJS(onStash)(cardId);
        });
        return;
      }
      if (offsetX.value > threshold) {
        offsetX.value = withSpring(0);
        runOnJS(onRequestDelete)(cardId);
        return;
      }
      offsetX.value = withSpring(0);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0.72, 1 - Math.abs(offsetX.value) / width),
    transform: [
      { translateX: offsetX.value },
      { rotate: `${Math.max(-2.5, Math.min(2.5, offsetX.value / 120))}deg` },
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
        <Text style={styles.badge}>知识卡片</Text>
        {!inline && <Text style={styles.dragHint}>← 暂存 · 删除 →</Text>}
        <View style={{ flex: 1 }} />
        {inline && <Pressable onPress={() => onStash(card.card_id)} hitSlop={8} style={styles.inlineAction}><Text style={styles.inlineActionText}>暂存</Text></Pressable>}
        {inline && onClose && <Pressable hitSlop={12} onPress={onClose}><Text style={styles.close}>▴</Text></Pressable>}
        {!inline && onClose && <Pressable hitSlop={12} onPress={onClose}><Text style={styles.close}>×</Text></Pressable>}
      </View>

      <Text numberOfLines={inline ? undefined : 1} style={styles.title}>{card.title}</Text>
      <Text numberOfLines={inline ? undefined : 3} style={styles.summary}>{card.plain_explanation}</Text>

      {card.key_points.length > 0 && (
        <View style={styles.points}>
          {card.key_points.slice(0, inline ? 3 : 2).map((point) => (
            <View key={point} style={styles.pointRow}>
              <View style={styles.pointDot} />
              <Text numberOfLines={inline ? undefined : 1} style={styles.pointText}>{point}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.actions}>
        <Pressable onPress={() => onStash(card.card_id)} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>暂存</Text>
        </Pressable>
        {onLearnMore && (
          <Pressable onPress={() => onLearnMore(card)} style={[styles.primaryButton, inline && { flex: 1 }]}>
            <Text style={styles.primaryText}>{inline ? '深入会话' : '详细了解'}</Text>
          </Pressable>
        )}
      </View>

      {inline && onCreateChildCard && (
        <View style={styles.childComposer}>
          <Text style={styles.childComposerLabel}>对这张卡片继续追问</Text>
          <View style={styles.childComposerRow}>
            <TextInput
              value={childInput} onChangeText={setChildInput}
              placeholder="输入关键词生成子卡片…" placeholderTextColor={palette.faint}
              style={styles.childInput}
              onSubmitEditing={submitChildCard} returnKeyType="send"
            />
            <Pressable disabled={!childInput.trim()} onPress={submitChildCard}
              style={({ pressed }) => [styles.childSendButton, !childInput.trim() && styles.childSendDisabled, pressed && { opacity: 0.7 }]}>
              <Text style={styles.childSendText}>+</Text>
            </Pressable>
          </View>
        </View>
      )}

      {inline && node && node.children.length > 0 && (
        <View style={styles.childList}>
          <Text style={styles.childListLabel}>已派生 {node.children.length} 张子卡片</Text>
        </View>
      )}
    </View>
  );

  if (inline) return content;

  return (
    <Modal animationType="fade" onRequestClose={onClose} statusBarTranslucent transparent visible={card !== null}>
      <View style={styles.backdrop}>
        <Pressable accessibilityLabel="关闭知识卡片" onPress={onClose} style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={[styles.swipeCue, styles.stashCue]}><Text style={styles.stashCueText}>暂存</Text></View>
        <View pointerEvents="none" style={[styles.swipeCue, styles.deleteCue]}><Text style={styles.deleteCueText}>删除</Text></View>
        <GestureDetector gesture={pan!}>
          <Animated.View accessibilityViewIsModal style={animatedStyle}>{content}</Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, backgroundColor: 'rgba(18,24,43,0.35)' },
  card: { width: '100%', maxWidth: 360, padding: spacing.md, borderRadius: radii.lg, borderWidth: 1, borderColor: '#D9DDF2', backgroundColor: palette.surface, ...shadows.card },
  cardInline: { maxWidth: '100%', marginTop: 0, marginBottom: 4 },
  dragHandle: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 9, backgroundColor: palette.border },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { color: '#237D68', fontSize: 10, fontWeight: '800', backgroundColor: palette.mintSoft, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99 },
  dragHint: { flex: 1, textAlign: 'center', color: palette.faint, fontSize: 9, fontWeight: '700' },
  close: { color: palette.faint, fontSize: 24, lineHeight: 24, fontWeight: '600' },
  inlineAction: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, backgroundColor: palette.surfaceSoft },
  inlineActionText: { color: palette.indigo, fontSize: 10, fontWeight: '700' },
  title: { color: palette.ink, fontSize: 18, lineHeight: 24, fontWeight: '800', marginTop: 10 },
  summary: { color: palette.muted, fontSize: 13, lineHeight: 20, marginTop: 7 },
  points: { gap: 6, marginTop: 10 },
  pointRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pointDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: palette.purple },
  pointText: { flex: 1, color: palette.ink, fontSize: 12, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 15 },
  secondaryButton: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radii.md, backgroundColor: palette.background },
  secondaryText: { color: palette.muted, fontSize: 12, fontWeight: '700' },
  primaryButton: { flex: 1.35, alignItems: 'center', paddingVertical: 10, borderRadius: radii.md, backgroundColor: palette.indigo },
  primaryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  swipeCue: { position: 'absolute', top: '50%', marginTop: -18, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 99 },
  stashCue: { left: 18, backgroundColor: palette.mintSoft },
  deleteCue: { right: 18, backgroundColor: '#FCE8EC' },
  stashCueText: { color: '#237D68', fontSize: 11, fontWeight: '800' },
  deleteCueText: { color: palette.danger, fontSize: 11, fontWeight: '800' },
  childComposer: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: palette.border },
  childComposerLabel: { color: palette.purple, fontSize: 10, fontWeight: '800', marginBottom: 8 },
  childComposerRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  childInput: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radii.md, backgroundColor: palette.background, color: palette.ink, fontSize: 13, borderWidth: 1, borderColor: palette.border },
  childSendButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.purple },
  childSendDisabled: { backgroundColor: '#B8BDD3' },
  childSendText: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginTop: -1 },
  childList: { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: palette.border },
  childListLabel: { color: palette.muted, fontSize: 10, fontWeight: '700' },
});
