import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import {
  explanationPreviewKeywords,
  type ExplanationPreview,
  type InlineKeywordItem,
} from './contracts';
import { HighlightedText } from './HighlightedText';
import { palette, radii, shadows, spacing } from '@/src/ui/theme';

type Props = {
  preview: ExplanationPreview;
  modelLabel?: string;
  onClose: () => void;
  onExtend: (preview: ExplanationPreview) => void;
  onStash: (previewId: string) => void;
  onRequestDelete: (previewId: string) => void;
  onKeywordPress: (preview: ExplanationPreview, keyword: InlineKeywordItem) => void;
  onScaleChange?: (scale: number) => void;
  onCardTouchStart?: () => void;
};

const MIN_SCALE = 0.58;
const MAX_SCALE = 1.5;
const SWIPE_THRESHOLD_RATIO = 0.22;
const EDGE_GUARD = 22;
const CARD_ESTIMATED_HEIGHT = 230;

export function ExplanationPreviewCard({
  preview,
  modelLabel,
  onClose,
  onExtend,
  onStash,
  onRequestDelete,
  onKeywordPress,
  onScaleChange,
  onCardTouchStart,
}: Props) {
  const { width, height } = useWindowDimensions();
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const actionX = useSharedValue(0);
  const scale = useSharedValue(1);
  const startScale = useSharedValue(1);
  const maxX = Math.max(0, width / 2 - EDGE_GUARD);
  const maxY = Math.max(0, (height - CARD_ESTIMATED_HEIGHT) / 2 - EDGE_GUARD);
  const keywords = explanationPreviewKeywords(preview);

  const pan = Gesture.Pan()
    .maxPointers(1)
    .minDistance(4)
    .onBegin(() => {
      startX.value = offsetX.value;
      startY.value = offsetY.value;
      actionX.value = 0;
    })
    .onUpdate((event) => {
      actionX.value = event.translationX;
      offsetX.value = Math.max(-maxX, Math.min(maxX, startX.value + event.translationX));
      offsetY.value = Math.max(-maxY, Math.min(maxY, startY.value + event.translationY));
    })
    .onEnd(() => {
      const threshold = width * SWIPE_THRESHOLD_RATIO;
      if (actionX.value < -threshold) {
        offsetX.value = withTiming(-width, { duration: 180 }, (finished) => {
          if (finished) runOnJS(onStash)(preview.preview_id);
        });
        return;
      }
      if (actionX.value > threshold) {
        offsetX.value = withSpring(startX.value);
        actionX.value = withSpring(0);
        runOnJS(onRequestDelete)(preview.preview_id);
        return;
      }
      startX.value = offsetX.value;
      startY.value = offsetY.value;
      actionX.value = withSpring(0);
    });

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      startScale.value = scale.value;
    })
    .onUpdate((event) => {
      scale.value = Math.max(MIN_SCALE, Math.min(MAX_SCALE, startScale.value * event.scale));
    })
    .onEnd(() => {
      startScale.value = scale.value;
      if (onScaleChange) runOnJS(onScaleChange)(scale.value);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0.74, 1 - Math.abs(actionX.value) / width),
    transform: [
      { translateX: offsetX.value },
      { translateY: offsetY.value },
      { scale: scale.value },
      { rotate: `${Math.max(-2.5, Math.min(2.5, actionX.value / 120))}deg` },
    ],
  }));

  return (
    <GestureHandlerRootView pointerEvents="box-none" style={styles.overlay}>
      <GestureDetector gesture={Gesture.Simultaneous(pan, pinch)}>
        <Animated.View
          onTouchStart={onCardTouchStart}
          style={[styles.card, animatedStyle]}>
          <View style={styles.dragHandle} />
          <View style={styles.header}>
            <Text style={styles.badge}>即时解释</Text>
            <Text numberOfLines={1} style={styles.dragHint}>
              {modelLabel ? `${modelLabel} · 拖动 / 双指缩放` : '拖动 / 双指缩放'}
            </Text>
            <Pressable
              accessibilityLabel={`将 ${preview.title} 保存并引申`}
              hitSlop={8}
              onPress={() => onExtend(preview)}
              style={styles.extendButton}>
              <Text style={styles.extendButtonText}>引申</Text>
            </Pressable>
            <Pressable accessibilityLabel="关闭即时解释" hitSlop={10} onPress={onClose}>
              <Text style={styles.close}>×</Text>
            </Pressable>
          </View>

          <Text numberOfLines={2} style={styles.title}>{preview.title}</Text>
          <HighlightedText
            text={preview.explanation}
            keywords={keywords}
            selectable
            style={styles.explanation}
            onKeywordPress={(keyword) => onKeywordPress(preview, keyword)}
          />

          {keywords.length > 0 && (
            <View style={styles.related}>
              <Text style={styles.relatedLabel}>继续探索</Text>
              <HighlightedText
                text={keywords.map((keyword) => keyword.text).join(' · ')}
                keywords={keywords}
                selectable={false}
                style={styles.relatedText}
                onKeywordPress={(keyword) => onKeywordPress(preview, keyword)}
              />
            </View>
          )}

          <Pressable
            onPress={() => onStash(preview.preview_id)}
            style={styles.stashButton}>
            <Text style={styles.stashText}>暂存为知识成果</Text>
          </Pressable>
          <Text style={styles.hint}>缩小后可继续滑动后方对话；轻点后方会自动暂存。</Text>
        </Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 350,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#D9DDF2',
    backgroundColor: 'rgba(255,255,255,0.96)',
    ...shadows.card,
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 9,
    backgroundColor: palette.border,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  badge: {
    color: palette.indigo,
    fontSize: 10,
    fontWeight: '800',
    backgroundColor: palette.surfaceSoft,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 99,
  },
  dragHint: { flex: 1, color: palette.faint, fontSize: 9, fontWeight: '700' },
  extendButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
    backgroundColor: palette.indigo,
  },
  extendButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  close: { color: palette.faint, fontSize: 22, lineHeight: 22, fontWeight: '600' },
  title: { color: palette.ink, fontSize: 18, lineHeight: 24, fontWeight: '800', marginTop: 10 },
  explanation: { color: palette.muted, fontSize: 13, lineHeight: 20, marginTop: 7 },
  related: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  relatedLabel: { color: palette.faint, fontSize: 9, fontWeight: '800', marginBottom: 5 },
  relatedText: { color: palette.ink, fontSize: 12, lineHeight: 20 },
  stashButton: {
    alignItems: 'center',
    marginTop: 14,
    paddingVertical: 10,
    borderRadius: radii.md,
    backgroundColor: palette.background,
  },
  stashText: { color: palette.muted, fontSize: 12, fontWeight: '700' },
  hint: { color: palette.faint, fontSize: 9, lineHeight: 14, marginTop: 7, textAlign: 'center' },
});
