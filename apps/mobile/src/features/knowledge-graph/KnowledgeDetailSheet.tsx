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
              <View style={styles.titleRow}>
                <Text style={styles.title}>{node.title}</Text>
                <View style={[styles.pill, { backgroundColor: masteryMeta[node.mastery].ring }]}>
                  <Text style={styles.pillText}>{masteryMeta[node.mastery].label}</Text>
                </View>
              </View>

              <View style={styles.categoryRow}>
                <View style={[styles.catDot, { backgroundColor: categoryMeta[node.category].color }]} />
                <Text style={styles.catText}>{categoryMeta[node.category].label}</Text>
                <Text style={styles.dot}>·</Text>
                <Text style={styles.metaText}>关联知识 {relatedCount}</Text>
                <Text style={styles.dot}>·</Text>
                <Text style={styles.metaText}>来源记录 {node.sourceRefs.length}</Text>
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
                      <Text style={styles.sourceQuote}>“{ref.selectedText}”</Text>
                    )}
                  </View>
                </View>
              ))}

              <View style={styles.actions}>
                <Pressable accessibilityRole="button" style={styles.actionBtn} onPress={() => setShowCard((v) => !v)}>
                  <Text style={styles.actionText}>{showCard ? '收起知识卡' : '查看知识卡'}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" style={styles.actionBtn} onPress={() => onContinue(node)}>
                  <Text style={styles.actionText}>继续学习</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  style={[styles.actionBtn, styles.actionPrimary]}
                  onPress={() => onAsk(node)}>
                  <Text style={[styles.actionText, styles.actionPrimaryText]}>围绕它提问</Text>
                </Pressable>
              </View>
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
    maxHeight: '82%',
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
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { flex: 1, color: palette.ink, fontSize: 22, fontWeight: '800' },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 },
  pillText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, flexWrap: 'wrap' },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  catText: { color: palette.muted, fontSize: 13, fontWeight: '700' },
  dot: { color: palette.faint, fontSize: 13 },
  metaText: { color: palette.muted, fontSize: 13 },
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
  actionPrimary: { backgroundColor: palette.indigo, borderColor: palette.indigo },
  actionText: { color: palette.ink, fontSize: 13, fontWeight: '800' },
  actionPrimaryText: { color: '#FFFFFF' },
});
