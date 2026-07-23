import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedValue } from 'react-native-reanimated';

import { useFloatingTool } from '../FloatingToolProvider';
import { recognizeObject } from '../vision/api';
import { CropFrame, type CropBounds } from './CropFrame';

const MIN_OUTPUT = 64;
const MAX_OUTPUT = 2048;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function outputDimension(value: string): number {
  return clamp(Number.parseInt(value, 10) || 512, MIN_OUTPUT, MAX_OUTPUT);
}

type DisplayRect = {
  scale: number;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
};

export function CropScreen({ uri }: { uri: string }) {
  const { handleCropped, backToCamera, reset } = useFloatingTool();
  const insets = useSafeAreaInsets();
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const [outWidth, setOutWidth] = useState('512');
  const [outHeight, setOutHeight] = useState('512');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);

  const frameX = useSharedValue(0);
  const frameY = useSharedValue(0);
  const frameW = useSharedValue(0);
  const frameH = useSharedValue(0);

  useEffect(() => {
    Image.getSize(
      uri,
      (width, height) => setNatural({ width, height }),
      () => setError('无法读取照片尺寸，请重新拍摄。'),
    );
  }, [uri]);

  const display: DisplayRect | null = natural && stage.width > 0 && stage.height > 0
    ? (() => {
        const scale = Math.min(stage.width / natural.width, stage.height / natural.height);
        const width = natural.width * scale;
        const height = natural.height * scale;
        return {
          scale,
          width,
          height,
          offsetX: (stage.width - width) / 2,
          offsetY: (stage.height - height) / 2,
        };
      })()
    : null;

  useEffect(() => {
    if (!display || initialized.current) return;
    initialized.current = true;
    frameX.value = display.offsetX + display.width * 0.2;
    frameY.value = display.offsetY + display.height * 0.2;
    frameW.value = display.width * 0.6;
    frameH.value = display.height * 0.6;
  }, [display, frameH, frameW, frameX, frameY]);

  const bounds: CropBounds | null = display ? {
    left: display.offsetX,
    top: display.offsetY,
    right: display.offsetX + display.width,
    bottom: display.offsetY + display.height,
  } : null;

  const normalizeDimensions = () => {
    setOutWidth(String(outputDimension(outWidth)));
    setOutHeight(String(outputDimension(outHeight)));
  };

  const confirm = async () => {
    if (!display || !natural || busy) return;
    setBusy(true);
    setError(null);
    try {
      const sourceX = clamp(
        (frameX.value - display.offsetX) / display.scale,
        0,
        natural.width - 1,
      );
      const sourceY = clamp(
        (frameY.value - display.offsetY) / display.scale,
        0,
        natural.height - 1,
      );
      const sourceWidth = clamp(
        frameW.value / display.scale,
        1,
        natural.width - sourceX,
      );
      const sourceHeight = clamp(
        frameH.value / display.scale,
        1,
        natural.height - sourceY,
      );
      const width = outputDimension(outWidth);
      const height = outputDimension(outHeight);
      setOutWidth(String(width));
      setOutHeight(String(height));

      const result = await manipulateAsync(
        uri,
        [
          {
            crop: {
              originX: Math.round(sourceX),
              originY: Math.round(sourceY),
              width: Math.max(1, Math.round(sourceWidth)),
              height: Math.max(1, Math.round(sourceHeight)),
            },
          },
          { resize: { width, height } },
        ],
        { compress: 0.82, format: SaveFormat.JPEG, base64: true },
      );
      if (!result.base64) throw new Error('裁剪失败，没有获取到图片数据。');
      const recognition = await recognizeObject(result.base64);
      handleCropped(result.base64, recognition);
    } catch (caught) {
      setBusy(false);
      setError(caught instanceof Error ? caught.message : '识物失败，请重试。');
    }
  };

  return (
    <View style={styles.full}>
      <View
        style={styles.stage}
        onLayout={(event) => setStage({
          width: event.nativeEvent.layout.width,
          height: event.nativeEvent.layout.height,
        })}>
        {display && (
          <Image
            source={{ uri }}
            resizeMode="cover"
            style={{
              position: 'absolute',
              left: display.offsetX,
              top: display.offsetY,
              width: display.width,
              height: display.height,
            }}
          />
        )}
        {display && bounds && (
          <CropFrame
            frameX={frameX}
            frameY={frameY}
            frameW={frameW}
            frameH={frameH}
            bounds={bounds}
          />
        )}
      </View>

      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={backToCamera} hitSlop={10}><Text style={styles.topAction}>‹</Text></Pressable>
        <Text style={styles.topTitle}>裁剪识别区域</Text>
        <Pressable onPress={reset} hitSlop={10}><Text style={styles.topAction}>×</Text></Pressable>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 14 }]}>
        {error && <Text style={styles.error}>{error}</Text>}
        <View style={styles.sizeRow}>
          <Text style={styles.label}>输出尺寸</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={outWidth}
            onChangeText={setOutWidth}
            onBlur={normalizeDimensions}
            maxLength={4}
          />
          <Text style={styles.multiply}>×</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={outHeight}
            onChangeText={setOutHeight}
            onBlur={normalizeDimensions}
            maxLength={4}
          />
          <Text style={styles.unit}>px</Text>
        </View>
        <Text style={styles.limit}>范围 {MIN_OUTPUT}–{MAX_OUTPUT}px，仅上传当前裁剪区域</Text>
        <Pressable style={styles.primary} onPress={confirm} disabled={busy || !display}>
          {busy
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={styles.primaryText}>确认裁剪并识物</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  full: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#050507' },
  stage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 178 },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingBottom: 10, backgroundColor: 'rgba(0,0,0,0.34)',
  },
  topTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  topAction: { color: '#FFFFFF', fontSize: 30, lineHeight: 32 },
  bottom: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 16, paddingTop: 13, backgroundColor: 'rgba(20,20,27,0.96)',
  },
  error: { color: '#FFB4C0', fontSize: 12, textAlign: 'center', marginBottom: 8 },
  sizeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  label: { color: '#FFFFFF', fontSize: 14, marginRight: 10 },
  input: {
    width: 66, height: 38, borderRadius: 8,
    backgroundColor: '#2A2A35', color: '#FFFFFF', textAlign: 'center', fontSize: 15,
  },
  multiply: { color: '#FFFFFF', fontSize: 16, marginHorizontal: 9 },
  unit: { color: '#AEB4C8', fontSize: 13, marginLeft: 7 },
  limit: { color: '#8D94A9', fontSize: 11, textAlign: 'center', marginTop: 7 },
  primary: {
    marginTop: 11, minHeight: 46, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#4E57C8',
  },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
