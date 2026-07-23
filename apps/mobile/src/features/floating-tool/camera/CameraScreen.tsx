import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useFloatingTool } from '../FloatingToolProvider';

export function CameraScreen() {
  const { handleCaptured, reset } = useFloatingTool();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  if (!permission) return <View style={styles.full} />;
  if (!permission.granted) {
    return (
      <View style={styles.full}>
        <View style={[styles.bar, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.title}>拍照识物</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.centerText}>需要相机权限才能拍摄用于识别的图片。</Text>
          <Pressable style={styles.primary} onPress={requestPermission}>
            <Text style={styles.primaryText}>授权相机</Text>
          </Pressable>
          <Pressable style={styles.ghost} onPress={reset}>
            <Text style={styles.ghostText}>取消</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const takePhoto = async () => {
    if (busy || !cameraRef.current) return;
    setBusy(true);
    setError(null);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.82 });
      if (!photo?.uri) throw new Error('没有获取到照片，请重试。');
      handleCaptured(photo.uri);
    } catch (caught) {
      setBusy(false);
      setError(caught instanceof Error ? caught.message : '拍照失败，请重试。');
    }
  };

  return (
    <View style={styles.full}>
      <CameraView ref={cameraRef} style={styles.full} facing="back" />
      <View style={[styles.bar, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={reset} hitSlop={10}><Text style={styles.topBtn}>×</Text></Pressable>
        <Text style={styles.title}>拍照识物</Text>
        <View style={{ width: 28 }} />
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 28 }]}>
        <Pressable style={styles.cancelWrap} onPress={reset}>
          <Text style={styles.cancel}>取消</Text>
        </Pressable>
        <Pressable style={styles.shutter} onPress={takePhoto} disabled={busy}>
          {busy ? <ActivityIndicator color="#4E57C8" /> : <View style={styles.shutterInner} />}
        </Pressable>
        <View style={styles.cancelWrap} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  full: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000000' },
  bar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  title: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  topBtn: { color: '#FFFFFF', fontSize: 28 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  centerText: { color: '#FFFFFF', fontSize: 15, lineHeight: 23, marginBottom: 20, textAlign: 'center' },
  primary: { backgroundColor: '#4E57C8', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28 },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  ghost: { marginTop: 14 },
  ghostText: { color: '#D7DAFF', fontSize: 14 },
  error: {
    position: 'absolute', left: 24, right: 24, bottom: 132,
    color: '#FFD6DC', textAlign: 'center', fontSize: 13,
  },
  bottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 2,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 36,
  },
  cancelWrap: { width: 64, alignItems: 'center' },
  cancel: { color: '#FFFFFF', fontSize: 15 },
  shutter: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
  },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#4E57C8' },
});
