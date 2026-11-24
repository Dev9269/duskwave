export const colors = {
  ink: '#000000',
  surface: '#121212',
  surfaceRaised: '#1F1F1F',
  elevated: '#242424',
  hairline: '#2A2A2A',
  text: '#FFFFFF',
  textMuted: '#B3B3B3',
  textFaint: '#7A7A7A',
  accent: '#1DB954',
  accentMuted: '#14833B',
  success: '#1DB954',
  danger: '#F15E6C',
  overlay: 'rgba(0, 0, 0, 0.7)',
  transparent: 'transparent',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 4,
  md: 8,
  lg: 12,
  pill: 999,
} as const;

export const fontFamily = {
  display: 'Inter_700Bold',
  displayBold: 'Inter_700Bold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemibold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
} as const;

export const typeScale = {
  display: {
    fontSize: 32,
    lineHeight: 38,
    fontFamily: fontFamily.displayBold,
    letterSpacing: -1,
  },
  title: {
    fontSize: 24,
    lineHeight: 29,
    fontFamily: fontFamily.displayBold,
    letterSpacing: -0.6,
  },
  heading: {
    fontSize: 20,
    lineHeight: 26,
    fontFamily: fontFamily.displayBold,
    letterSpacing: -0.3,
  },
  body: { fontSize: 16, lineHeight: 24, fontFamily: fontFamily.body },
  bodyMedium: { fontSize: 16, lineHeight: 24, fontFamily: fontFamily.bodyMedium },
  caption: { fontSize: 12, lineHeight: 16, fontFamily: fontFamily.body },
  label: { fontSize: 13, lineHeight: 18, fontFamily: fontFamily.bodySemibold },
} as const;

export type TextVariant = keyof typeof typeScale;

export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 } as const;
