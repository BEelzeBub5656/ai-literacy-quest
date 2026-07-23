import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import type { KnowledgeCard } from './contracts';
import { palette, radii } from '@/src/ui/theme';

type Props = {
  cards: KnowledgeCard[];
  onRestore: (cardId: string) => void;
  onReorder: (cardId: string, targetIndex: number) => void;
};

const STEP = 30;
const MAX_VISIBLE = 6;

function StashedTab({
  card,
  index,
  onRestore,
  onReorder,
}: {
  card: KnowledgeCard;
  index: number;
  onRestore: (cardId: string) => void;
  onReorder: (cardId: string, targetIndex: number) => void;
}) {
  const translationY = useSharedValue(0);
  const dragging = useSharedValue(0);

  const finishReorder = (delta: number) => {
    onReorder(card.card_id, Math.max(0, index + Math.round(delta / STEP)));
  };

  const pan = Gesture.Pan()
    .minDistance(6)
    .onBegin(() => {
      dragging.value = 1;
    })
    .onUpdate((event) => {
      translationY.value = event.translationY;
    })
    .onEnd((event) => {
      runOnJS(finishReorder)(event.translationY);
      translationY.value = withSpring(0, { damping: 18, stiffness: 220 });
      dragging.value = 0;
    })
    .onFinalize(() => {
      translationY.value = withSpring(0, { damping: 18, stiffness: 220 });
      dragging.value = 0;
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translationY.value },
      { scale: dragging.value ? 1.04 : 1 },
    ],
    zIndex: dragging.value ? 30 : index + 1,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.tabSlot, { top: index * STEP }, animatedStyle]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`恢复知识卡片 ${card.title}`}
          onPress={() => onRestore(card.card_id)}
          style={({ pressed }) => [styles.tab, pressed && styles.pressed]}>
          <View style={styles.accent} />
          <Text numberOfLines={1} style={styles.title}>{card.title}</Text>
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

export function StashedCardRail({ cards, onRestore, onReorder }: Props) {
  if (cards.length === 0) return null;
  const visibleCards = cards.slice(0, MAX_VISIBLE);
  return (
    <View pointerEvents="box-none" style={styles.rail}>
      {visibleCards.map((card, index) => (
        <StashedTab
          key={card.card_id}
          card={card}
          index={index}
          onRestore={onRestore}
          onReorder={onReorder}
        />
      ))}
      <View style={[styles.count, { top: visibleCards.length * STEP + 8 }]}>
        <Text style={styles.countText}>{cards.length} 张暂存</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    position: 'absolute',
    left: -104,
    top: 86,
    width: 136,
    height: 250,
    zIndex: 100,
  },
  tabSlot: { position: 'absolute', left: 0, width: 132, height: 62 },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingLeft: 108,
    paddingRight: 5,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,255,255,0.58)',
    borderWidth: 1,
    borderColor: 'rgba(226,229,239,0.68)',
    ...Platform.select({
      ios: {
        shadowColor: '#26305C',
        shadowOpacity: 0.1,
        shadowRadius: 7,
        shadowOffset: { width: 2, height: 2 },
      },
      android: { elevation: 2 },
      default: { boxShadow: '2px 2px 10px rgba(38,48,92,0.10)' },
    }),
  },
  accent: { width: 3, height: 32, borderRadius: 3, backgroundColor: 'rgba(117,87,214,0.68)' },
  title: { width: 17, color: palette.ink, fontSize: 8, fontWeight: '700' },
  pressed: { opacity: 0.82 },
  count: {
    position: 'absolute',
    left: 106,
    backgroundColor: 'rgba(75,86,190,0.72)',
    borderRadius: 99,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  countText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
});
