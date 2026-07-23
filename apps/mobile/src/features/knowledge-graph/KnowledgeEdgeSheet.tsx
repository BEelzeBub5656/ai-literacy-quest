// 关系边详情 Bottom Sheet（设计文档第 5.3 / 12.4 节）。
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { KnowledgeEdge, KnowledgeNode } from './contracts';
import { relationLabel } from './visualEncoding';
import { palette, radii, spacing } from '@/src/ui/theme';

type Props = {
  edge: KnowledgeEdge | null;
  sourceNode?: KnowledgeNode;
  targetNode?: KnowledgeNode;
  onClose: () => void;
};

export function KnowledgeEdgeSheet({ edge, sourceNode, targetNode, onClose }: Props) {
  return (
    <Modal visible={!!edge} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          {edge && (
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
              <View style={styles.handle} />
              <View style={styles.relRow}>
                <Text style={styles.nodeName}>{sourceNode?.title ?? edge.source}</Text>
                <View style={styles.relChip}>
                  <Text style={styles.relChipText}>
                    {edge.directed ? '─→ ' : '— '}
                    {relationLabel[edge.relation]}
                  </Text>
                </View>
                <Text style={styles.nodeName}>{targetNode?.title ?? edge.target}</Text>
              </View>

              <View style={styles.statRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{edge.directed ? '有方向' : '双向'}</Text>
                  <Text style={styles.statLabel}>关系方向</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{Math.round(edge.confidence * 100)}%</Text>
                  <Text style={styles.statLabel}>置信度</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{edge.weight}</Text>
                  <Text style={styles.statLabel}>验证次数</Text>
                </View>
              </View>

              <Text style={styles.sectionTitle}>证据来源</Text>
              {edge.sourceRefs.length === 0 && <Text style={styles.emptyText}>暂无来源证据</Text>}
              {edge.sourceRefs.map((ref, i) => (
                <View key={`${ref.id}-${i}`} style={styles.sourceRow}>
                  <Text style={styles.sourceLabel}>{ref.label ?? ref.id}</Text>
                  {ref.selectedText && (
                    <Text style={styles.sourceQuote}>“{ref.selectedText}”</Text>
                  )}
                </View>
              ))}

              <Pressable accessibilityRole="button" style={styles.closeBtn} onPress={onClose}>
                <Text style={styles.closeText}>关闭</Text>
              </Pressable>
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(24,32,51,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    maxHeight: '70%',
  },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 4,
    backgroundColor: palette.border,
    marginBottom: spacing.md,
  },
  relRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  nodeName: { color: palette.ink, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  relChip: { backgroundColor: palette.surfaceSoft, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5 },
  relChipText: { color: palette.indigo, fontSize: 13, fontWeight: '800' },
  statRow: { flexDirection: 'row', gap: 10, marginTop: spacing.lg },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: radii.lg,
    backgroundColor: palette.surfaceSoft,
    borderWidth: 1,
    borderColor: palette.border,
  },
  statValue: { color: palette.indigo, fontSize: 18, fontWeight: '800' },
  statLabel: { color: palette.muted, fontSize: 11.5, marginTop: 4 },
  sectionTitle: { color: palette.ink, fontSize: 15, fontWeight: '800', marginTop: spacing.lg, marginBottom: 8 },
  emptyText: { color: palette.faint, fontSize: 13 },
  sourceRow: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: palette.background,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: 8,
  },
  sourceLabel: { color: palette.ink, fontSize: 13.5, fontWeight: '600' },
  sourceQuote: { color: palette.muted, fontSize: 12.5, lineHeight: 18, marginTop: 3, fontStyle: 'italic' },
  closeBtn: {
    marginTop: spacing.lg,
    paddingVertical: 13,
    borderRadius: radii.md,
    backgroundColor: palette.surfaceSoft,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
  },
  closeText: { color: palette.ink, fontSize: 14, fontWeight: '800' },
});
