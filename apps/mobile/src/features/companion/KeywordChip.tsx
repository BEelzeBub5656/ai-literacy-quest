import { Pressable, StyleSheet, Text } from 'react-native';

import type { KeywordItem } from './contracts';
import { palette } from '@/src/ui/theme';

type Props = {
  keyword: KeywordItem;
  onPress: (keyword: KeywordItem) => void;
  compact?: boolean;
};

export function KeywordChip({ keyword, onPress, compact = false }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`生成 ${keyword.text} 知识卡片`}
      onPress={() => onPress(keyword)}
      style={({ pressed }) => [styles.chip, compact && styles.compact, pressed && styles.pressed]}>
      <Text style={[styles.text, compact && styles.compactText]}>#{keyword.text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: palette.surfaceSoft,
    borderWidth: 1,
    borderColor: '#D9DCFA',
  },
  compact: { paddingHorizontal: 8, paddingVertical: 5 },
  pressed: { opacity: 0.65, transform: [{ scale: 0.97 }] },
  text: { color: palette.indigoDark, fontSize: 12, fontWeight: '700' },
  compactText: { fontSize: 11 },
});

