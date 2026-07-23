import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { BackHandler, StyleSheet, View, useWindowDimensions } from 'react-native';
import { clamp, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CameraScreen } from './camera/CameraScreen';
import { CropScreen } from './crop/CropScreen';
import { FloatingBall } from './FloatingBall';
import { ResultScreen } from './vision/ResultScreen';
import type { VisionRecognizeResponse } from './vision/contracts';
import { BALL_SIZE, EDGE_MARGIN } from './config';

export type FloatingStage = 'idle' | 'menu' | 'camera' | 'crop' | 'result';

type FloatingToolContextValue = {
  stage: FloatingStage;
  capturedUri: string | null;
  croppedBase64: string | null;
  resultId: string | null;
  recognition: VisionRecognizeResponse | null;
  ballX: SharedValue<number>;
  ballY: SharedValue<number>;
  openMenu: () => void;
  closeMenu: () => void;
  startCamera: () => void;
  backToCamera: () => void;
  backToCrop: () => void;
  handleCaptured: (uri: string) => void;
  handleCropped: (base64: string, response: VisionRecognizeResponse) => void;
  reset: () => void;
};

const FloatingToolContext = createContext<FloatingToolContextValue | null>(null);

export function useFloatingTool(): FloatingToolContextValue {
  const value = useContext(FloatingToolContext);
  if (!value) throw new Error('useFloatingTool must be used inside FloatingToolProvider');
  return value;
}

export function FloatingToolProvider({ children }: { children: ReactNode }) {
  const [stage, setStage] = useState<FloatingStage>('idle');
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [croppedBase64, setCroppedBase64] = useState<string | null>(null);
  const [resultId, setResultId] = useState<string | null>(null);
  const [recognition, setRecognition] = useState<VisionRecognizeResponse | null>(null);

  // 悬浮球位置（提升到 Provider，跨 idle<->menu 及相机流程重挂后保持）
  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const ballX = useSharedValue(0);
  const ballY = useSharedValue(0);
  const positioned = useRef(false);

  useLayoutEffect(() => {
    const targetX = screenW - BALL_SIZE - EDGE_MARGIN;
    const targetY = screenH - BALL_SIZE - (insets.bottom + 76);
    if (!positioned.current) {
      ballX.value = targetX;
      ballY.value = targetY;
      positioned.current = true;
    } else {
      // 旋转屏/尺寸变化：重新夹取到可达范围
      ballX.value = clamp(ballX.value, -BALL_SIZE / 2, screenW - BALL_SIZE / 2);
      ballY.value = clamp(ballY.value, insets.top, screenH - BALL_SIZE - insets.bottom);
    }
  }, [screenW, screenH, insets.top, insets.bottom, ballX, ballY]);

  const openMenu = useCallback(() => setStage('menu'), []);
  const closeMenu = useCallback(() => setStage((value) => value === 'menu' ? 'idle' : value), []);
  const startCamera = useCallback(() => setStage('camera'), []);
  const backToCamera = useCallback(() => {
    setCroppedBase64(null);
    setRecognition(null);
    setResultId(null);
    setStage('camera');
  }, []);
  const backToCrop = useCallback(() => {
    setCroppedBase64(null);
    setRecognition(null);
    setResultId(null);
    setStage('crop');
  }, []);
  const handleCaptured = useCallback((uri: string) => {
    setCapturedUri(uri);
    setStage('crop');
  }, []);
  const handleCropped = useCallback((base64: string, response: VisionRecognizeResponse) => {
    setCroppedBase64(base64);
    setRecognition(response);
    setResultId(`vision-${Date.now()}`);
    setStage('result');
  }, []);
  const reset = useCallback(() => {
    setStage('idle');
    setCapturedUri(null);
    setCroppedBase64(null);
    setRecognition(null);
    setResultId(null);
  }, []);

  useEffect(() => {
    if (stage === 'idle') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stage === 'menu') closeMenu();
      else if (stage === 'crop') backToCamera();
      else if (stage === 'result') backToCrop();
      else reset();
      return true;
    });
    return () => subscription.remove();
  }, [stage, closeMenu, backToCamera, backToCrop, reset]);

  const value = useMemo<FloatingToolContextValue>(() => ({
    stage,
    capturedUri,
    croppedBase64,
    resultId,
    recognition,
    openMenu,
    closeMenu,
    startCamera,
    backToCamera,
    backToCrop,
    handleCaptured,
    handleCropped,
    reset,
  }), [
    stage,
    capturedUri,
    croppedBase64,
    resultId,
    recognition,
    openMenu,
    closeMenu,
    startCamera,
    backToCamera,
    backToCrop,
    handleCaptured,
    handleCropped,
    reset,
  ]);

  return (
    <FloatingToolContext.Provider value={value}>
      <View style={styles.host}>
        {children}
        {(stage === 'idle' || stage === 'menu') && <FloatingBall />}
        {stage === 'camera' && <CameraScreen />}
        {stage === 'crop' && capturedUri && <CropScreen uri={capturedUri} />}
        {stage === 'result' && croppedBase64 && recognition && resultId && (
          <ResultScreen
            base64={croppedBase64}
            recognition={recognition}
            resultId={resultId}
          />
        )}
      </View>
    </FloatingToolContext.Provider>
  );
}

const styles = StyleSheet.create({ host: { flex: 1 } });
