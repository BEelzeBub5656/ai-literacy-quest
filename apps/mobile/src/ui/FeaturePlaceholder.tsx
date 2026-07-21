import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radii, spacing } from './theme';

type Props = {
  eyebrow: string;
  title: string;
  description: string;
  badge: string;
};

export function FeaturePlaceholder({ eyebrow, title, description, badge }: Props) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        <View style={styles.panel}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
          <Text style={styles.panelMark}>✦</Text>
          <Text style={styles.panelTitle}>模块边界已经预留</Text>
          <Text style={styles.panelText}>后续功能将沿用同一设计系统、路由与后端数据合同，不需要重建 App 骨架。</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  content: { flex: 1, padding: spacing.lg, paddingTop: spacing.xl },
  eyebrow: { color: palette.indigo, fontWeight: '700', fontSize: 13 },
  title: { color: palette.ink, fontWeight: '800', fontSize: 28, lineHeight: 37, marginTop: 10 },
  description: { color: palette.muted, fontSize: 15, lineHeight: 24, marginTop: 12 },
  panel: {
    marginTop: 34,
    padding: spacing.lg,
    minHeight: 250,
    justifyContent: 'center',
    borderRadius: radii.xl,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  badge: { alignSelf: 'flex-start', backgroundColor: palette.surfaceSoft, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6 },
  badgeText: { color: palette.indigo, fontSize: 12, fontWeight: '700' },
  panelMark: { color: palette.purple, fontSize: 42, marginTop: 24 },
  panelTitle: { color: palette.ink, fontSize: 20, fontWeight: '800', marginTop: 12 },
  panelText: { color: palette.muted, fontSize: 14, lineHeight: 22, marginTop: 9 },
});
