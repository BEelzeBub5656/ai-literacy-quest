import { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { KnowledgeCard } from './contracts';
import { palette, radii, shadows, spacing } from '@/src/ui/theme';

const ACTION_RATIO = 0.25;
const CARD_MAX_WIDTH = 430;
const CARD_MAX_HEIGHT = 226;
const EDGE_GUARD = 28;

type Props = {
  card: KnowledgeCard;
  modelLabel?: string;
  onStash: (cardId: string) => void;
  onRequestDelete: (cardId: string) => void;
  onLearnMore: (card: KnowledgeCard) => void;
};

export function DraggableKnowledgeCard({
  card,
  modelLabel,
  onStash,
  onRequestDelete,
  onLearnMore,
}: Props) {
  const { width, height } = useWindowDimensions();
  const cardWidth = Math.min(width - spacing.md * 2, CARD_MAX_WIDTH);
  const threshold = cardWidth * ACTION_RATIO;
  const maxRestingX = Math.max(0, width / 2 - EDGE_GUARD);
  const maxRestingY = Math.max(0, (height - CARD_MAX_HEIGHT) / 2 - EDGE_GUARD);
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const actionX = useSharedValue(0);

  const pan = useMemo(
    () => Gesture.Pan()
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
        if (actionX.value < -threshold) {
          offsetX.value = withTiming(-width, { duration: 220 }, (finished) => {
            if (finished) runOnJS(onStash)(card.card_id);
          });
          return;
        }
        if (actionX.value > threshold) {
          offsetX.value = withSpring(startX.value, { damping: 18, stiffness: 190 });
          actionX.value = withSpring(0);
          runOnJS(onRequestDelete)(card.card_id);
          return;
        }
        startX.value = offsetX.value;
        startY.value = offsetY.value;
        actionX.value = withSpring(0, { damping: 18, stiffness: 190 });
      }),
    [
      actionX,
      card.card_id,
      maxRestingX,
      maxRestingY,
      offsetX,
      offsetY,
      onRequestDelete,
      onStash,
      startX,
      startY,
      threshold,
      width,
    ],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      actionX.value,
      [-threshold, 0, threshold],
      ['#EEF0FF', palette.surface, '#FFF0F1'],
    ),
    transform: [
      { translateX: offsetX.value },
      { translateY: offsetY.value },
      { rotate: `${Math.max(-2, Math.min(2, actionX.value / 150))}deg` },
    ],
  }));

  return (
    <Modal
      animationType="fade"
      hardwareAccelerated
      onRequestClose={() => onStash(card.card_id)}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible>
      <GestureHandlerRootView style={styles.modalRoot}>
        <View pointerEvents="box-none" style={styles.overlay}>
          <View pointerEvents="none" style={styles.actionBackdrop}>
            <Text style={styles.stashAction}>← 暂存</Text>
            <Text style={styles.deleteAction}>删除 →</Text>
          </View>
          <GestureDetector gesture={pan}>
            <Animated.View
              accessibilityLabel={`知识卡片：${card.title}`}
              style={[styles.card, { width: cardWidth }, animatedStyle]}>
              <View style={styles.headerRow}>
                <View style={styles.cardBadge}>
                  <Text style={styles.cardBadgeText}>知识卡片</Text>
                </View>
                <Text numberOfLines={1} style={styles.modelText}>
                  {modelLabel ? `${modelLabel} · 已提炼` : '已提炼'}
                </Text>
              </View>

              <Text numberOfLines={1} style={styles.title}>{card.title}</Text>
              <Text numberOfLines={3} style={styles.explanation}>{card.plain_explanation}</Text>

              <View style={styles.points}>
                {card.key_points.slice(0, 2).map((point) => (
                  <View key={point} style={styles.pointRow}>
                    <View style={styles.pointDot} />
                    <Text numberOfLines={1} style={styles.pointText}>{point}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.footer}>
                <Text style={styles.dragHint}>上下自由拖动 · 左拖暂存 · 右拖删除</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`详细了解 ${card.title}`}
                  onPress={() => onLearnMore(card)}
                  style={({ pressed }) => [styles.detailButton, pressed && styles.detailPressed]}>
                  <Text style={styles.detailText}>详细了解</Text>
                  <Text style={styles.detailArrow}>→</Text>
                </Pressable>
              </View>
            </Animated.View>
          </GestureDetector>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  actionBackdrop: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    height: 196,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  stashAction: { color: palette.indigo, fontSize: 12, fontWeight: '800' },
  deleteAction: { color: palette.danger, fontSize: 12, fontWeight: '800' },
  card: {
    minHeight: 196,
    maxHeight: 226,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderRadius: radii.xl,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: '#D9DDF2',
    elevation: 18,
    ...shadows.card,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  cardBadge: { backgroundColor: palette.mintSoft, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 4 },
  cardBadgeText: { color: '#237D68', fontSize: 10, fontWeight: '800' },
  modelText: { flexShrink: 1, color: palette.faint, fontSize: 9, fontWeight: '700' },
  title: { color: palette.ink, fontSize: 18, lineHeight: 24, fontWeight: '800', marginTop: 10 },
  explanation: { color: palette.muted, fontSize: 13, lineHeight: 19, marginTop: 5 },
  points: { gap: 5, marginTop: 9 },
  pointRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  pointDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: palette.purple },
  pointText: { flex: 1, color: palette.ink, fontSize: 11, lineHeight: 16 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 12 },
  dragHint: { flex: 1, color: palette.faint, fontSize: 9, fontWeight: '700' },
  detailButton: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 99, backgroundColor: palette.indigo, paddingHorizontal: 13, paddingVertical: 8 },
  detailPressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  detailText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  detailArrow: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
