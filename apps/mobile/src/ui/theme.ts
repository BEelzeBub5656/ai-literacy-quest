import { Platform } from 'react-native';

export const palette = {
  background: '#F5F6FB',
  surface: '#FFFFFF',
  surfaceSoft: '#F0F2FF',
  ink: '#182033',
  muted: '#6D758A',
  faint: '#98A0B4',
  border: '#E2E5EF',
  indigo: '#4E57C8',
  indigoDark: '#323A9E',
  purple: '#7B5CD6',
  mint: '#59D1AF',
  mintSoft: '#DFF8F0',
  amber: '#E6A83C',
  amberSoft: '#FFF3D8',
  danger: '#D84C62',
  dangerSoft: '#FFE8EC',
};

export const spacing = { xs: 6, sm: 10, md: 16, lg: 22, xl: 30 } as const;
export const radii = { sm: 10, md: 14, lg: 18, xl: 24 } as const;

export const shadows = {
  card: Platform.select({
    ios: {
      shadowColor: '#26305C',
      shadowOpacity: 0.12,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
    },
    android: { elevation: 5 },
    default: { boxShadow: '0 8px 24px rgba(38,48,92,0.12)' },
  }),
};

