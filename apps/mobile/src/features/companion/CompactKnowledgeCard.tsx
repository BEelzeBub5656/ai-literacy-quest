import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { KnowledgeCard } from './contracts';
import { palette, radii, shadows, spacing } from '@/src/ui/theme';

type Props = {
  card: KnowledgeCard | null;
  onClose: () => void;
  onLearnMore: (card: KnowledgeCard) => void;
};

export function CompactKnowledgeCard({ card, onClose, onLearnMore }: Props) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={card !== null}>
      <View style={styles.backdrop}>
        <Pressable accessibilityLabel="关闭知识卡片" onPress={onClose} style={StyleSheet.absoluteFill} />
        {card && (
          <View accessibilityViewIsModal style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.badge}>知识卡片</Text>
              <Pressable accessibilityLabel="关闭" hitSlop={12} onPress={onClose}>
                <Text style={styles.close}>×</Text>
              </Pressable>
            </View>

            <Text numberOfLines={1} style={styles.title}>{card.title}</Text>
            <Text numberOfLines={3} style={styles.summary}>{card.plain_explanation}</Text>

            <View style={styles.points}>
              {card.key_points.slice(0, 2).map((point) => (
                <View key={point} style={styles.pointRow}>
                  <View style={styles.pointDot} />
                  <Text numberOfLines={1} style={styles.pointText}>{point}</Text>
                </View>
              ))}
            </View>

            <View style={styles.actions}>
              <Pressable onPress={onClose} style={styles.secondaryButton}>
                <Text style={styles.secondaryText}>稍后再看</Text>
              </Pressable>
              <Pressable onPress={() => onLearnMore(card)} style={styles.primaryButton}>
                <Text style={styles.primaryText}>详细了解</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { color: '#237D68', fontSize: 10, fontWeight: '800', backgroundColor: palette.mintSoft, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99 },
  close: { color: palette.faint, fontSize: 24, lineHeight: 24 },
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
});
