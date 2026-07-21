import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radii, shadows, spacing } from '@/src/ui/theme';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>知芽校园 · 可生长知识 DAG</Text>
        <Text style={styles.title}>早上好，继续让知识生长吧</Text>
        <View style={styles.heroCard}>
          <Text style={styles.heroMeta}>最近学习</Text>
          <Text style={styles.heroTitle}>AI Agent 工程基础</Text>
          <Text style={styles.heroText}>从连续对话中提炼关键词，把理解沉淀为可继续探索的知识卡片。</Text>
          <View style={styles.progressTrack}>
            <View style={styles.progressValue} />
          </View>
          <Text style={styles.progressLabel}>本周探索进度 42%</Text>
        </View>
        <Text style={styles.sectionTitle}>今日建议</Text>
        <View style={styles.suggestionRow}>
          <View style={styles.suggestionCard}>
            <Text style={styles.suggestionIcon}>✦</Text>
            <Text style={styles.suggestionTitle}>继续伴学</Text>
            <Text style={styles.suggestionText}>深入理解 Middleware</Text>
          </View>
          <View style={styles.suggestionCard}>
            <Text style={styles.suggestionIcon}>◎</Text>
            <Text style={styles.suggestionTitle}>复习卡片</Text>
            <Text style={styles.suggestionText}>3 张卡片待回顾</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.lg, gap: spacing.md },
  eyebrow: { color: palette.indigo, fontSize: 13, fontWeight: '700' },
  title: { color: palette.ink, fontSize: 28, lineHeight: 36, fontWeight: '800' },
  heroCard: {
    marginTop: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.xl,
    backgroundColor: palette.indigo,
    ...shadows.card,
  },
  heroMeta: { color: '#C8CEFF', fontSize: 13, fontWeight: '600' },
  heroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 8 },
  heroText: { color: '#E6E8FF', fontSize: 14, lineHeight: 22, marginTop: 10 },
  progressTrack: { height: 7, borderRadius: 8, backgroundColor: '#666DDD', marginTop: 20 },
  progressValue: { width: '42%', height: 7, borderRadius: 8, backgroundColor: palette.mint },
  progressLabel: { color: '#E6E8FF', fontSize: 12, marginTop: 8 },
  sectionTitle: { color: palette.ink, fontSize: 18, fontWeight: '800', marginTop: spacing.md },
  suggestionRow: { flexDirection: 'row', gap: spacing.md },
  suggestionCard: {
    flex: 1,
    minHeight: 132,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  suggestionIcon: { color: palette.purple, fontSize: 24 },
  suggestionTitle: { color: palette.ink, fontSize: 16, fontWeight: '700', marginTop: 10 },
  suggestionText: { color: palette.muted, fontSize: 13, lineHeight: 19, marginTop: 5 },
});
