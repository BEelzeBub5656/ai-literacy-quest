import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import type { KnowledgeCard } from './contracts';
import { palette, radii } from '@/src/ui/theme';

type Props = {
  cards: KnowledgeCard[];
  onRestore: (cardId: string) => void;
};

export function StashedCardRail({ cards, onRestore }: Props) {
  if (cards.length === 0) return null;
  return (
    <View pointerEvents="box-none" style={styles.rail}>
      {cards.slice(-5).map((card, index) => (
        <Pressable
          key={card.card_id}
          accessibilityRole="button"
          accessibilityLabel={`恢复知识卡片 ${card.title}`}
          onPress={() => onRestore(card.card_id)}
          style={({ pressed }) => [
            styles.tab,
            { top: index * 34, zIndex: index + 1 },
            pressed && styles.pressed,
          ]}>
          <View style={styles.accent} />
          <Text numberOfLines={1} style={styles.title}>{card.title}</Text>
        </Pressable>
      ))}
      <View style={[styles.count, { top: Math.min(cards.length, 5) * 34 + 8 }]}>
        <Text style={styles.countText}>{cards.length} 张暂存</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { position: 'absolute', left: -116, top: 86, width: 170, height: 260, zIndex: 100 },
  tab: {
    position: 'absolute',
    left: 0,
    width: 164,
    height: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 118,
    paddingRight: 8,
    borderRadius: radii.md,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    ...Platform.select({
      ios: {
        shadowColor: '#26305C',
        shadowOpacity: 0.12,
        shadowRadius: 8,
        shadowOffset: { width: 2, height: 2 },
      },
      android: { elevation: 3 },
      default: { boxShadow: '2px 2px 12px rgba(38,48,92,0.12)' },
    }),
  },
  accent: { width: 4, height: 38, borderRadius: 3, backgroundColor: palette.purple },
  title: { width: 31, color: palette.ink, fontSize: 9, fontWeight: '700' },
  pressed: { transform: [{ translateX: 6 }] },
  count: { position: 'absolute', left: 117, backgroundColor: palette.indigo, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4 },
  countText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
});
