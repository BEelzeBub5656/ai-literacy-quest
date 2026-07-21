import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { CompanionMessage } from './contracts';
import { palette, radii, spacing } from '@/src/ui/theme';

type Selection = { start: number; end: number };

type Props = {
  message: CompanionMessage | null;
  visible: boolean;
  onClose: () => void;
  onConfirm: (message: CompanionMessage, selectedText: string) => void;
};

export function TextSelectionModal({ message, visible, onClose, onConfirm }: Props) {
  const [selection, setSelection] = useState<Selection>({ start: 0, end: 0 });

  useEffect(() => {
    const initialEnd = Math.min(message?.content.length ?? 0, 18);
    setSelection({ start: 0, end: initialEnd });
  }, [message]);

  const selectedText = useMemo(() => {
    if (!message) return '';
    const start = Math.min(selection.start, selection.end);
    const end = Math.max(selection.start, selection.end);
    return message.content.slice(start, end).trim();
  }, [message, selection]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.sheet} edges={['bottom']}>
          <View style={styles.handle} />
          <Text style={styles.title}>选取知识片段</Text>
          <Text style={styles.description}>拖动系统选区手柄，选择想沉淀为知识卡片的文字。</Text>
          <TextInput
            multiline
            readOnly
            value={message?.content ?? ''}
            selection={selection}
            onSelectionChange={(event) => setSelection(event.nativeEvent.selection)}
            style={styles.textArea}
          />
          <View style={styles.preview}>
            <Text style={styles.previewLabel}>已选择</Text>
            <Text style={styles.previewText}>{selectedText || '请至少选择一个字符'}</Text>
          </View>
          <View style={styles.actions}>
            <Pressable onPress={onClose} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>取消</Text>
            </Pressable>
            <Pressable
              disabled={!message || !selectedText}
              onPress={() => message && selectedText && onConfirm(message, selectedText)}
              style={[styles.primaryButton, !selectedText && styles.disabledButton]}>
              <Text style={styles.primaryText}>生成知识卡片</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(19,24,42,0.42)' },
  sheet: { backgroundColor: palette.surface, padding: spacing.lg, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  handle: { width: 44, height: 5, borderRadius: 4, backgroundColor: palette.border, alignSelf: 'center', marginBottom: 20 },
  title: { color: palette.ink, fontSize: 21, fontWeight: '800' },
  description: { color: palette.muted, fontSize: 13, lineHeight: 20, marginTop: 7 },
  textArea: {
    minHeight: 150,
    maxHeight: 220,
    marginTop: 16,
    padding: 14,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.background,
    color: palette.ink,
    fontSize: 15,
    lineHeight: 23,
    textAlignVertical: 'top',
  },
  preview: { marginTop: 14, padding: 12, borderRadius: radii.md, backgroundColor: palette.amberSoft },
  previewLabel: { color: palette.amber, fontSize: 11, fontWeight: '800' },
  previewText: { color: palette.ink, fontSize: 14, lineHeight: 20, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 18 },
  secondaryButton: { flex: 1, alignItems: 'center', padding: 14, borderRadius: radii.md, backgroundColor: palette.background },
  secondaryText: { color: palette.muted, fontWeight: '700' },
  primaryButton: { flex: 2, alignItems: 'center', padding: 14, borderRadius: radii.md, backgroundColor: palette.indigo },
  disabledButton: { opacity: 0.4 },
  primaryText: { color: '#FFFFFF', fontWeight: '800' },
});

