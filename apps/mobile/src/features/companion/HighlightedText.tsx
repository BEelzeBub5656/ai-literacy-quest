import type { ReactNode } from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

import type { InlineKeywordItem } from './contracts';
import { palette } from '@/src/ui/theme';

type Segment = { text: string; keyword?: InlineKeywordItem };

type Props = {
  text: string;
  keywords?: InlineKeywordItem[];
  style?: StyleProp<TextStyle>;
  selectable?: boolean;
  onKeywordPress?: (keyword: InlineKeywordItem) => void;
};

function splitByKeywords(text: string, keywords: InlineKeywordItem[]): Segment[] {
  const matches: { start: number; end: number; keyword: InlineKeywordItem }[] = [];
  const lowerText = text.toLocaleLowerCase();

  for (const keyword of [...keywords].sort((a, b) => b.text.length - a.text.length)) {
    const needle = keyword.text.toLocaleLowerCase();
    if (!needle) continue;
    let from = 0;
    while (from < text.length) {
      const start = lowerText.indexOf(needle, from);
      if (start < 0) break;
      matches.push({ start, end: start + needle.length, keyword });
      from = start + needle.length;
    }
  }

  matches.sort((a, b) => a.start - b.start || b.keyword.importance - a.keyword.importance);
  const accepted = matches.filter((match, index, all) =>
    !all.slice(0, index).some((previous) => match.start < previous.end && match.end > previous.start),
  );

  const segments: Segment[] = [];
  let cursor = 0;
  for (const match of accepted) {
    if (match.start < cursor) continue;
    if (match.start > cursor) segments.push({ text: text.slice(cursor, match.start) });
    segments.push({ text: text.slice(match.start, match.end), keyword: match.keyword });
    cursor = match.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments.length ? segments : [{ text }];
}

export function HighlightedText({
  text,
  keywords = [],
  style,
  selectable = true,
  onKeywordPress,
}: Props) {
  const displayText = text
    .replace(/\*\*/g, '')
    .replace(/^#{1,6}\s+/gm, '');
  const segments = splitByKeywords(displayText, keywords);
  return (
    <Text selectable={selectable} style={style}>
      {segments.map((segment, index): ReactNode => {
        if (!segment.keyword) return segment.text;
        const keyword = segment.keyword;
        return (
          <Text
            key={`${keyword.id}-${index}`}
            onPress={() => onKeywordPress?.(keyword)}
            style={[
              styles.keyword,
              keyword.importance === 2 && styles.keywordMedium,
              keyword.importance === 3 && styles.keywordHigh,
            ]}>
            {segment.text}
          </Text>
        );
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  keyword: {
    color: palette.indigoDark,
    fontSize: 15,
    fontWeight: '700',
    textDecorationLine: 'underline',
    textDecorationColor: palette.purple,
    textDecorationStyle: 'solid',
  },
  keywordMedium: { fontSize: 16.5, fontWeight: '800' },
  keywordHigh: { fontSize: 18, fontWeight: '900' },
});
