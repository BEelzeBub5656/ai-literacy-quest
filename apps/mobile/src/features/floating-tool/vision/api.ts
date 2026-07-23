import { fetch } from 'expo/fetch';
import { Platform } from 'react-native';

import {
  visionRecognizeResponseSchema,
  type VisionRecognizeResponse,
} from './contracts';

const fallbackHost = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL ?? `http://${fallbackHost}:8010/api/v1`;
const REQUEST_TIMEOUT_MS = 65_000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function estimatedDecodedBytes(base64: string): number {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

export async function recognizeObject(
  imageBase64: string,
  mimeType: 'image/jpeg' = 'image/jpeg',
): Promise<VisionRecognizeResponse> {
  if (estimatedDecodedBytes(imageBase64) > MAX_IMAGE_BYTES) {
    throw new Error('裁剪后的图片超过 8 MiB，请减小输出尺寸后重试。');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${apiBase}/vision/recognize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageBase64, mime_type: mimeType }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = payload && typeof payload === 'object' && 'detail' in payload
        ? JSON.stringify(payload.detail)
        : `HTTP ${response.status}`;
      throw new Error(`识物服务请求失败：${detail}`);
    }
    return visionRecognizeResponseSchema.parse(payload);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('识物请求超时，请检查网络后重试。');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export { apiBase };
