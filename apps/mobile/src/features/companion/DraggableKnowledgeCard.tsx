import { useMemo } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { KeywordItem, KnowledgeCard } from './contracts';
import { HighlightedText } from './HighlightedText';
import { palette, radii, shadows, spacing } from '@/src/ui/theme';

const STASH_RATIO = 0.25;
const DELETE_RATIO = 0.25;

type Props = {
  card: KnowledgeCard;
  stackIndex: number;
  onStash: (cardId: string) => void;
  onRequestDelete: (cardId: string) => void;
  onKeywordPress: (card: KnowledgeCard, keyword: KeywordItem) => void;
};

export function DraggableKnowledgeCard({
  card,
  stackIndex,
  onStash,
  onRequestDelete,
  onKeywordPress,
}: Props) {
  const { width } = useWindowDimensions();
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const inlineKeywords = card.keywords.map((keyword) => ({
    id: keyword.id,
    text: keyword.text,
    normalized_text: keyword.normalized_text,
    importance: keyword.confidence >= 0.94 ? 3 : keyword.confidence >= 0.88 ? 2 : 1,
  }));

  const pan = useMemo(
    () => Gesture.Pan()
      .minDistance(4)
      .onBegin(() => {
        startX.value = offsetX.value;
        startY.value = offsetY.value;
      })
      .onUpdate((event) => {
        offsetX.value = startX.value + event.translationX;
        offsetY.value = startY.value + event.translationY;
      })
      .onEnd(() => {
        if (offsetX.value < -width * STASH_RATIO) {
          offsetX.value = withTiming(-width, { duration: 220 }, (finished) => {
            if (finished) runOnJS(onStash)(card.card_id);
          });
          return;
        }
        if (offsetX.value > width * DELETE_RATIO) {
          offsetX.value = withSpring(0);
          offsetY.value = withSpring(0);
          runOnJS(onRequestDelete)(card.card_id);
        }
      }),
    [card.card_id, offsetX, offsetY, onRequestDelete, onStash, startX, startY, width],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: offsetX.value },
      { translateY: offsetY.value },
      { rotate: `${Math.max(-2.5, Math.min(2.5, offsetX.value / 120))}deg` },
    ],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[
          styles.card,
          { top: 20 + Math.min(stackIndex, 4) * 14, zIndex: 50 + stackIndex },
          animatedStyle,
        ]}>
        <View style={styles.dragHandle} />
        <View style={styles.headerRow}>
          <View style={styles.cardBadge}>
            <Text style={styles.cardBadgeText}>知识卡片</Text>
          </View>
          <Text style={styles.dragHint}>← 暂存 · 删除 →</Text>
        </View>
        <Text style={styles.title}>{card.title}</Text>
        <View style={styles.quote}>
          <Text style={styles.quoteLabel}>原文摘录</Text>
          <Text numberOfLines={2} style={styles.quoteText}>“{card.selected_text}”</Text>
        </View>
        <Text style={styles.sectionLabel}>核心解释</Text>
        <Text numberOfLines={4} style={styles.explanation}>{card.plain_explanation}</Text>
        <Text style={styles.sectionLabel}>AI 推演过程</Text>
        <Text style={styles.summary}>{card.reasoning_summary}</Text>
        <View style={styles.steps}>
          {card.reasoning_steps.slice(0, 3).map((step) => (
            <View key={step.step} style={styles.stepRow}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{step.step}</Text>
              </View>
              <View style={styles.stepBody}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text numberOfLines={2} style={styles.stepText}>{step.explanation}</Text>
              </View>
            </View>
          ))}
        </View>
        <View style={styles.keywordArea}>
          <Text style={styles.keywordLabel}>继续探索</Text>
          <HighlightedText
            selectable={false}
            text={card.keywords.map((keyword) => keyword.text).join('  ·  ')}
            keywords={inlineKeywords}
            style={styles.keywordText}
            onKeywordPress={(selected) => {
              const original = card.keywords.find((keyword) => keyword.id === selected.id);
              if (original) onKeywordPress(card, original);
            }}
          />
        </View>
        {(card.assumptions.length > 0 || card.uncertainties.length > 0) && (
          <Text numberOfLines={2} style={styles.auditText}>
            依据说明：{card.assumptions[0] ?? card.uncertainties[0]}
          </Text>
        )}
        {card.parent_card_id && <Text style={styles.parentText}>↳ 由上一张知识卡片继续生长</Text>}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    maxHeight: 560,
    padding: spacing.md,
    borderRadius: radii.xl,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: '#D9DDF2',
    ...shadows.card,
  },
  dragHandle: { width: 48, height: 5, borderRadius: 3, backgroundColor: palette.border, alignSelf: 'center', marginBottom: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardBadge: { backgroundColor: palette.mintSoft, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 4 },
  cardBadgeText: { color: '#237D68', fontSize: 10, fontWeight: '800' },
  dragHint: { color: palette.faint, fontSize: 10 },
  title: { color: palette.ink, fontSize: 20, lineHeight: 27, fontWeight: '800', marginTop: 10 },
  quote: { padding: 10, borderRadius: radii.md, backgroundColor: palette.background, marginTop: 10 },
  quoteLabel: { color: palette.purple, fontSize: 10, fontWeight: '800' },
  quoteText: { color: palette.muted, fontSize: 13, lineHeight: 19, marginTop: 3 },
  sectionLabel: { color: palette.indigo, fontSize: 11, fontWeight: '800', marginTop: 12, marginBottom: 4 },
  explanation: { color: palette.ink, fontSize: 14, lineHeight: 21 },
  summary: { color: palette.muted, fontSize: 12, lineHeight: 18 },
  steps: { gap: 7, marginTop: 8 },
  stepRow: { flexDirection: 'row', gap: 8 },
  stepNumber: { width: 21, height: 21, borderRadius: 11, backgroundColor: palette.surfaceSoft, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { color: palette.indigo, fontSize: 10, fontWeight: '800' },
  stepBody: { flex: 1 },
  stepTitle: { color: palette.ink, fontSize: 12, fontWeight: '700' },
  stepText: { color: palette.muted, fontSize: 11, lineHeight: 16, marginTop: 2 },
  keywordArea: { marginTop: 12, paddingTop: 9, borderTopWidth: 1, borderTopColor: palette.border },
  keywordLabel: { color: palette.faint, fontSize: 10, fontWeight: '700', marginBottom: 4 },
  keywordText: { color: palette.muted, fontSize: 13, lineHeight: 23 },
  auditText: { color: palette.faint, fontSize: 10, lineHeight: 15, marginTop: 9 },
  parentText: { color: palette.purple, fontSize: 10, fontWeight: '700', marginTop: 8 },
});
