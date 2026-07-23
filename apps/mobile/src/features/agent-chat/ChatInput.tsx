import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { palette, radii, spacing } from '@/src/ui/theme';

type Props = {
  onSend: (text: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  /** 外部预填内容，例如从知识图谱「围绕它提问」带入的提问。 */
  initialValue?: string;
};

export function ChatInput({ onSend, onStop, isStreaming, initialValue }: Props) {
  const [value, setValue] = useState(initialValue ?? '');

  useEffect(() => {
    if (initialValue) setValue(initialValue);
  }, [initialValue]);

  const submit = () => {
    const text = value.trim();
    if (!text || isStreaming) return;
    onSend(text);
    setValue('');
  };

  return (
    <View style={styles.composer}>
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder="输入你的问题…"
        placeholderTextColor={palette.faint}
        multiline
        maxLength={2000}
        style={styles.input}
        editable={!isStreaming}
      />
      {isStreaming ? (
        <Pressable
          accessibilityRole="button"
          onPress={onStop}
          style={({ pressed }) => [styles.actionButton, styles.stopButton, pressed && styles.actionPressed]}>
          <Text style={styles.stopText}>停止</Text>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          disabled={!value.trim()}
          onPress={submit}
          style={({ pressed }) => [
            styles.actionButton,
            styles.sendButton,
            !value.trim() && styles.sendDisabled,
            pressed && styles.actionPressed,
          ]}>
          <Text style={styles.sendArrow}>→</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    padding: spacing.md,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    backgroundColor: palette.surface,
  },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 112,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: palette.background,
    color: palette.ink,
    fontSize: 15,
    lineHeight: 21,
  },
  actionButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButton: { backgroundColor: palette.indigo },
  sendDisabled: { backgroundColor: '#B8BDD3' },
  sendArrow: { color: '#FFFFFF', fontSize: 24, fontWeight: '600', marginTop: -2 },
  stopButton: { backgroundColor: palette.danger },
  stopText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  actionPressed: { transform: [{ scale: 0.94 }] },
});
