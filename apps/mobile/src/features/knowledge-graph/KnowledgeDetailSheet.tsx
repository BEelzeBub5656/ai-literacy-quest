// 节点详情 Bottom Sheet（设计文档第 5.3 / 12.2 节）。
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { KnowledgeNode } from './contracts';
import { categoryMeta, masteryMeta } from './visualEncoding';
import { palette, radii, spacing } from '@/src/ui/theme';

type Props = {
  node: KnowledgeNode | null;
  relatedCount: number;
  onClose: () => void;
  onAsk: (node: KnowledgeNode) => void;
  onContinue: (node: KnowledgeNode) => void;
};

const TYPE_LABEL: Record<string, string> = {
  course: '课程',
  lesson: '微课',
  conversation: 'AI 对话',
  message: '对话消息',
  'knowledge-card': '知识卡',
  experiment: '实验',
  manual: '手动',
  'vision-result': '识物',
};

export function KnowledgeDetailSheet({ node, relatedCount, onClose, onAsk, onContinue }: Props) {
  const [showCard, setShowCard] = useState(false);

  return (
    <Modal visible={!!node} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          {node && (
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
              <View style={styles.handle} />
              <View style={styles.headerRow}>
                <View style={[styles.catIndicator, { backgroundColor: categoryMeta[node.category].color }]} />
                <Text style={styles.title}>{node.title}</Text>
                <View style={[styles.masteryPill, { backgroundColor: masteryMeta[node.mastery].ring }]}>
                  <Text style={styles.masteryText}>{masteryMeta[node.mastery].label}</Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <View style={styles.metaChip}>
                  <View style={[styles.metaDot, { backgroundColor: categoryMeta[node.category].color }]} />
                  <Text style={styles.metaText}>{categoryMeta[node.category].label}</Text>
                </View>
                <View style={styles.metaChip}>
                  <Text style={styles.metaText}>关联 {relatedCount}</Text>
                </View>
                <View style={styles.metaChip}>
                  <Text style={styles.metaText}>来源 {node.sourceRefs.length}</Text>
                </View>
              </View>

              <Text style={styles.summary}>{node.summary}</Text>

              {showCard && (
                <View style={styles.cardPreview}>
                  <Text style={styles.cardLabel}>知识卡预览</Text>
                  <Text style={styles.cardBody}>{node.summary}</Text>
                  <Text style={styles.cardFoot}>重要度 {'★'.repeat(node.importance)}</Text>
                </View>
              )}

              <Text style={styles.sectionTitle}>来源记录</Text>
              {node.sourceRefs.length === 0 && (
                <Text style={styles.emptyText}>暂无来源记录</Text>
              )}
              {node.sourceRefs.map((ref, i) => (
                <View key={`${ref.id}-${i}`} style={styles.sourceRow}>
                  <View style={styles.sourceTag}>
                    <Text style={styles.sourceTagText}>{TYPE_LABEL[ref.type] ?? '来源'}</Text>
                  </View>
                  <View style={styles.sourceBody}>
                    <Text style={styles.sourceLabel}>{ref.label ?? ref.id}</Text>
                    {ref.selectedText && (
                      <Text style={styles.sourceQuote}>{"\u201c"}{ref.selectedText}{"\u201d"}</Text>
                    )}
                  </View>
                </View>
              ))}

              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.actionBtn, pressed && styles.actionPressed]}
                  onPress={() => setShowCard((v) => !v)}>
                  <Text style={styles.actionText}>{showCard ? '收起卡片' : '查看卡片'}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.actionBtn, pressed && styles.actionPressed]}
                  onPress={() => onContinue(node)}>
                  <Text style={styles.actionText}>继续学习</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.actionBtn, styles.actionPrimary, pressed && styles.actionPressed]}
                  onPress={() => onAsk(node)}>
                  <Text style={[styles.actionText, styles.actionPrimaryText]}>围绕提问</Text>
                </Pressable>
              </View>
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const sheetShadow = {
  shadowColor: '#26305C',
  shadowOpacity: 0.15,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: -4 },
  elevation: 8,
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(24,32,51,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    maxHeight: '82%',
    ...sheetShadow,
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
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catIndicator: { width: 4, height: 28, borderRadius: 2 },
  title: { flex: 1, color: palette.ink, fontSize: 21, fontWeight: '800' },
  masteryPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 },
  masteryText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  metaRow: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: palette.surfaceSoft,
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  metaDot: { width: 8, height: 8, borderRadius: 4 },
  metaText: { color: palette.muted, fontSize: 12, fontWeight: '600' },
  summary: { color: palette.ink, fontSize: 15, lineHeight: 23, marginTop: spacing.md },
  cardPreview: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: palette.surfaceSoft,
    borderWidth: 1,
    borderColor: palette.border,
  },
  cardLabel: { color: palette.indigo, fontSize: 12, fontWeight: '800' },
  cardBody: { color: palette.ink, fontSize: 14, lineHeight: 21, marginTop: 6 },
  cardFoot: { color: palette.amber, fontSize: 13, marginTop: 8, fontWeight: '800' },
  sectionTitle: { color: palette.ink, fontSize: 15, fontWeight: '800', marginTop: spacing.lg, marginBottom: 8 },
  emptyText: { color: palette.faint, fontSize: 13 },
  sourceRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  sourceTag: {
    backgroundColor: palette.surfaceSoft,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  sourceTagText: { color: palette.indigo, fontSize: 11, fontWeight: '700' },
  sourceBody: { flex: 1 },
  sourceLabel: { color: palette.ink, fontSize: 13.5, fontWeight: '600' },
  sourceQuote: { color: palette.muted, fontSize: 12.5, lineHeight: 18, marginTop: 3, fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: 8, marginTop: spacing.lg },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radii.md,
    backgroundColor: palette.surfaceSoft,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
  },
  actionPressed: { opacity: 0.7 },
  actionPrimary: { backgroundColor: palette.indigo, borderColor: palette.indigo },
  actionText: { color: palette.ink, fontSize: 13, fontWeight: '800' },
  actionPrimaryText: { color: '#FFFFFF' },
});
