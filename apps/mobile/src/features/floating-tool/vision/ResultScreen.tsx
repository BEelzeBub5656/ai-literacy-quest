import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { generateKnowledgeCard } from '@/src/features/companion/api';
import type { KnowledgeCard } from '@/src/features/companion/contracts';
import { useKnowledgeWorkspace } from '@/src/features/knowledge-workspace';
import { useFloatingTool } from '../FloatingToolProvider';
import type { VisionRecognizeResponse } from './contracts';

type Props = {
  base64: string;
  recognition: VisionRecognizeResponse;
  resultId: string;
};

export function ResultScreen({ base64, recognition, resultId }: Props) {
  const { reset, backToCrop } = useFloatingTool();
  const { addCard } = useKnowledgeWorkspace();
  const insets = useSafeAreaInsets();
  const detections = useMemo(
    () => [...recognition.detections].sort((a, b) => b.confidence - a.confidence),
    [recognition.detections],
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedCard, setGeneratedCard] = useState<KnowledgeCard | null>(null);
  const selected = detections[selectedIndex];

  const createCard = async () => {
    if (!selected || busy) return;
    setBusy(true);
    setError(null);
    try {
      const allLabels = detections
        .map((item) => `${item.label}（${Math.round(item.confidence * 100)}%）`)
        .join('、');
      const sourceContent = (
        `用户主动拍摄并裁剪图片。${recognition.provider} 的 ${recognition.model} `
        + `识别到：${allLabels}。用户选择“${selected.label}”继续学习。`
      );
      const response = await generateKnowledgeCard({
        selectedText: selected.label,
        sourceMessageId: resultId,
        sourceMessageContent: sourceContent,
        keywordContext: `置信度 ${Math.round(selected.confidence * 100)}%`,
        relation: 'associate',
        sourceType: 'vision-result',
      });
      addCard(response.card, {
        sourceMessageContent: sourceContent,
        vision: {
          label: selected.label,
          confidence: selected.confidence,
          provider: recognition.provider,
          model: recognition.model,
          fallbackUsed: recognition.fallback_used,
        },
      });
      setGeneratedCard(response.card);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '知识卡生成失败，请重试。');
    } finally {
      setBusy(false);
    }
  };

  const openGraph = () => {
    reset();
    router.push('/knowledge-graph' as Href);
  };

  return (
    <View style={styles.full}>
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={backToCrop} hitSlop={10}><Text style={styles.topButton}>‹</Text></Pressable>
        <Text style={styles.title}>识物结果</Text>
        <Pressable onPress={reset} hitSlop={10}><Text style={styles.topButton}>×</Text></Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 62 }]}>
        <Image source={{ uri: `data:image/jpeg;base64,${base64}` }} style={styles.preview} />
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{recognition.provider} · {recognition.model}</Text>
          {recognition.fallback_used && <Text style={styles.fallback}>演示兜底</Text>}
        </View>
        <Text style={styles.hint}>选择一个识别结果，再生成对应知识卡</Text>

        <View style={styles.list}>
          {detections.map((detection, index) => {
            const active = selectedIndex === index;
            return (
              <Pressable
                key={`${detection.label}-${index}`}
                onPress={() => {
                  setSelectedIndex(index);
                  setGeneratedCard(null);
                }}
                style={[styles.item, active && styles.itemActive]}>
                <View style={styles.itemHead}>
                  <View style={[styles.radio, active && styles.radioActive]} />
                  <Text style={[styles.label, active && styles.labelActive]}>{detection.label}</Text>
                  <Text style={styles.confidence}>{Math.round(detection.confidence * 100)}%</Text>
                </View>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${Math.round(detection.confidence * 100)}%` }]} />
                </View>
              </Pressable>
            );
          })}
        </View>

        {error && <Text style={styles.error}>{error}</Text>}
        {generatedCard && (
          <View style={styles.cardPreview}>
            <Text style={styles.cardEyebrow}>已加入知识空间</Text>
            <Text style={styles.cardTitle}>{generatedCard.title}</Text>
            <Text style={styles.cardSummary}>{generatedCard.plain_explanation}</Text>
            <Pressable onPress={openGraph} style={styles.graphButton}>
              <Text style={styles.graphButtonText}>在知识图谱中查看</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 14 }]}>
        <Pressable
          disabled={!selected || busy || Boolean(generatedCard)}
          onPress={createCard}
          style={[styles.primary, (!selected || generatedCard) && styles.primaryDisabled]}>
          {busy
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={styles.primaryText}>{generatedCard ? '知识卡已生成' : '生成知识卡'}</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  full: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#F5F6FB' },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingBottom: 10, backgroundColor: 'rgba(245,246,251,0.96)',
  },
  topButton: { color: '#182033', fontSize: 30, lineHeight: 32 },
  title: { color: '#182033', fontSize: 17, fontWeight: '800' },
  content: { paddingHorizontal: 18, paddingBottom: 118 },
  preview: { width: '100%', height: 230, borderRadius: 18, backgroundColor: '#E2E5EF' },
  metaRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 10 },
  meta: { color: '#6D758A', fontSize: 11 },
  fallback: { color: '#9A681C', backgroundColor: '#FFF3D8', borderRadius: 99, paddingHorizontal: 7, paddingVertical: 3, fontSize: 10, fontWeight: '700' },
  hint: { color: '#182033', fontSize: 15, fontWeight: '800', marginTop: 18, marginBottom: 10 },
  list: { gap: 9 },
  item: { padding: 13, borderRadius: 14, borderWidth: 1, borderColor: '#E2E5EF', backgroundColor: '#FFFFFF' },
  itemActive: { borderColor: '#4E57C8', backgroundColor: '#F0F2FF' },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  radio: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#B8BDD3' },
  radioActive: { borderWidth: 5, borderColor: '#4E57C8' },
  label: { flex: 1, color: '#182033', fontSize: 15, fontWeight: '700' },
  labelActive: { color: '#323A9E' },
  confidence: { color: '#4E57C8', fontSize: 14, fontWeight: '800' },
  track: { height: 5, marginTop: 9, borderRadius: 3, overflow: 'hidden', backgroundColor: '#E2E5EF' },
  fill: { height: 5, borderRadius: 3, backgroundColor: '#7B5CD6' },
  error: { color: '#D84C62', textAlign: 'center', marginTop: 14, fontSize: 12 },
  cardPreview: { marginTop: 16, padding: 15, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CDEDE4' },
  cardEyebrow: { color: '#237D68', fontSize: 11, fontWeight: '800' },
  cardTitle: { color: '#182033', fontSize: 18, fontWeight: '800', marginTop: 5 },
  cardSummary: { color: '#6D758A', fontSize: 13, lineHeight: 20, marginTop: 6 },
  graphButton: { alignSelf: 'flex-start', marginTop: 11, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F0F2FF' },
  graphButtonText: { color: '#4E57C8', fontSize: 12, fontWeight: '800' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: 'rgba(255,255,255,0.96)' },
  primary: { minHeight: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#4E57C8' },
  primaryDisabled: { backgroundColor: '#AEB4C8' },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
