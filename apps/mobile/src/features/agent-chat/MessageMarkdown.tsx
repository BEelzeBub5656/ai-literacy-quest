import { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { palette, radii } from '@/src/ui/theme';

/**
 * 零依赖的轻量 Markdown 渲染器（覆盖常见子集：标题 / 列表 / 代码块 / 引用 / 粗体 / 斜体 / 行内代码）。
 * 仅用 react-native 原语，因此在 Expo 原生端与 Web 端（react-native-web）表现一致，
 * 后续复用该组件到 web 端时无需替换渲染层。
 */

type Segment =
  | { type: 'text'; value: string }
  | { type: 'bold'; value: string }
  | { type: 'italic'; value: string }
  | { type: 'code'; value: string };

function parseInline(text: string): Segment[] {
  const segments: Segment[] = [];
  const pattern = /(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\*([^*]+)\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    if (match[2] !== undefined) segments.push({ type: 'bold', value: match[2] });
    else if (match[4] !== undefined) segments.push({ type: 'code', value: match[4] });
    else if (match[6] !== undefined) segments.push({ type: 'italic', value: match[6] });
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }
  return segments;
}

function InlineText({ text }: { text: string }) {
  const segments = parseInline(text);
  return (
    <Text style={styles.paragraph}>
      {segments.map((segment, index) => {
        if (segment.type === 'bold') return <Text key={index} style={styles.bold}>{segment.value}</Text>;
        if (segment.type === 'italic') return <Text key={index} style={styles.italic}>{segment.value}</Text>;
        if (segment.type === 'code') return <Text key={index} style={styles.inlineCode}>{segment.value}</Text>;
        return <Text key={index}>{segment.value}</Text>;
      })}
    </Text>
  );
}

export function MessageMarkdown({ content }: { content: string }) {
  const lines = content.split('\n');
  const blocks: ReactNode[] = [];
  let index = 0;
  let key = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (line.trim().startsWith('```')) {
      const codeLines: string[] = [];
      index++;
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index]);
        index++;
      }
      index++;
      blocks.push(
        <View key={key++} style={styles.codeBlock}>
          <Text style={styles.codeText}>{codeLines.join('\n')}</Text>
        </View>,
      );
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      blocks.push(
        <Text key={key++} style={level === 1 ? styles.h1 : level === 2 ? styles.h2 : styles.h3}>
          {heading[2]}
        </Text>,
      );
      index++;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^[-*]\s+/, ''));
        index++;
      }
      blocks.push(
        <View key={key++} style={styles.list}>
          {items.map((item, itemIndex) => (
            <View key={itemIndex} style={styles.listItem}>
              <Text style={styles.bullet}>•</Text>
              <InlineText text={item} />
            </View>
          ))}
        </View>,
      );
      continue;
    }

    if (line.trim().startsWith('>')) {
      blocks.push(<Text key={key++} style={styles.quote}>{line.trim().replace(/^>\s?/, '')}</Text>);
      index++;
      continue;
    }

    if (line.trim() === '') {
      index++;
      continue;
    }

    const paraLines: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() !== '' &&
      !/^(#{1,3})\s+|[-*]\s+|```/.test(lines[index]) &&
      !lines[index].trim().startsWith('>')
    ) {
      paraLines.push(lines[index]);
      index++;
    }
    blocks.push(<InlineText key={key++} text={paraLines.join(' ')} />);
  }

  return <View>{blocks}</View>;
}

const styles = StyleSheet.create({
  paragraph: { color: palette.ink, fontSize: 15, lineHeight: 24 },
  bold: { fontWeight: '800' },
  italic: { fontStyle: 'italic' },
  inlineCode: {
    fontFamily: 'monospace',
    backgroundColor: palette.surfaceSoft,
    color: palette.indigoDark,
    borderRadius: 4,
    paddingHorizontal: 4,
    fontSize: 13,
  },
  codeBlock: {
    backgroundColor: '#1E2233',
    borderRadius: radii.md,
    padding: 12,
    marginVertical: 6,
  },
  codeText: { color: '#E6E9F5', fontFamily: 'monospace', fontSize: 13, lineHeight: 20 },
  h1: { color: palette.ink, fontSize: 20, fontWeight: '800', marginVertical: 8 },
  h2: { color: palette.ink, fontSize: 17, fontWeight: '800', marginVertical: 6 },
  h3: { color: palette.ink, fontSize: 15, fontWeight: '800', marginVertical: 4 },
  list: { marginVertical: 4 },
  listItem: { flexDirection: 'row', gap: 8, marginBottom: 4, alignItems: 'flex-start' },
  bullet: { color: palette.purple, fontSize: 16, lineHeight: 22, width: 14 },
  quote: {
    color: palette.muted,
    fontSize: 14,
    fontStyle: 'italic',
    borderLeftWidth: 3,
    borderLeftColor: palette.border,
    paddingLeft: 10,
    marginVertical: 4,
  },
});
