import { router, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useKnowledgeWorkspace } from '@/src/features/knowledge-workspace';
import { palette, radii, shadows, spacing } from '@/src/ui/theme';

export default function ProfileScreen() {
  const { cards, nodes, edges, stashedCardIds } = useKnowledgeWorkspace();
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>我的学习空间</Text>
        <Text style={styles.title}>知识会留下生长轨迹</Text>
        <Text style={styles.subtitle}>伴学对话、拍照识物与知识图谱已经连接到同一份本地知识数据。</Text>

        <View style={styles.stats}>
          <View style={styles.stat}><Text style={styles.statValue}>{cards.length}</Text><Text style={styles.statLabel}>知识卡</Text></View>
          <View style={styles.stat}><Text style={styles.statValue}>{nodes.length}</Text><Text style={styles.statLabel}>知识点</Text></View>
          <View style={styles.stat}><Text style={styles.statValue}>{edges.length}</Text><Text style={styles.statLabel}>关系</Text></View>
        </View>

        <Pressable
          onPress={() => router.push('/knowledge-graph' as Href)}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
          <View style={styles.rowIcon}><Text style={styles.rowIconText}>◎</Text></View>
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>知识关系图谱</Text>
            <Text style={styles.rowSubtitle}>查看课程、卡片与识物结果之间的节点和关系</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </Pressable>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>暂存卡片</Text>
          <Text style={styles.infoValue}>{stashedCardIds.length} 张</Text>
          <Text style={styles.infoText}>卡片顺序会保存在本机；拖动时父卡始终位于子卡之前。</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  eyebrow: { color: palette.indigo, fontSize: 13, fontWeight: '800' },
  title: { color: palette.ink, fontSize: 28, fontWeight: '900', marginTop: 5 },
  subtitle: { color: palette.muted, fontSize: 14, lineHeight: 22, marginTop: 9 },
  stats: { flexDirection: 'row', gap: 10, marginTop: spacing.lg },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 15, borderRadius: radii.lg, backgroundColor: palette.surface, ...shadows.card },
  statValue: { color: palette.ink, fontSize: 22, fontWeight: '900' },
  statLabel: { color: palette.muted, fontSize: 11, marginTop: 3 },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg, padding: spacing.md, borderRadius: radii.lg, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  rowIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.surfaceSoft },
  rowIconText: { color: palette.indigo, fontSize: 24, fontWeight: '800' },
  rowBody: { flex: 1, marginLeft: 12 },
  rowTitle: { color: palette.ink, fontSize: 16, fontWeight: '800' },
  rowSubtitle: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  arrow: { color: palette.faint, fontSize: 28 },
  pressed: { opacity: 0.78 },
  infoCard: { marginTop: 14, padding: spacing.md, borderRadius: radii.lg, backgroundColor: palette.mintSoft },
  infoTitle: { color: '#237D68', fontSize: 12, fontWeight: '800' },
  infoValue: { color: palette.ink, fontSize: 20, fontWeight: '900', marginTop: 5 },
  infoText: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
});
