export interface FloatingTool {
  id: 'camera' | 'translate' | 'scan';
  label: string;
  enabled: boolean;
  description?: string;
}

export const TOOLS: FloatingTool[] = [
  { id: 'camera', label: '拍照识物', enabled: true, description: '拍照、裁剪并识别物体' },
  { id: 'translate', label: '拍照翻译', enabled: false, description: '规划中' },
  { id: 'scan', label: '拍题讲解', enabled: false, description: '规划中' },
];
