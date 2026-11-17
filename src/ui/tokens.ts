export const colors = {
  ink: '#0B0B0F',
  surface: '#14141A',
  surfaceRaised: '#1B1B22',
  hairline: '#23232B',
  text: '#F4F1EA',
  textMuted: '#9A97A3',
  textFaint: '#6B6875',
  accent: '#E4A853',
  accentMuted: '#8A6530',
  success: '#4FA77B',
  danger: '#D96565',
  overlay: 'rgba(5, 5, 8, 0.72)',
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
  sm: 8,
  md: 12,
  lg: 24,
  pill: 999,
} as const;

export const fontFamily = {
  display: 'Fraunces_600SemiBold',
  displayBold: 'Fraunces_700Bold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemibold: 'Inter_600SemiBold',
} as const;

export const typeScale = {
  display: { fontSize: 40, lineHeight: 44, fontFamily: fontFamily.displayBold },
  title: { fontSize: 24, lineHeight: 30, fontFamily: fontFamily.display },
  heading: { fontSize: 18, lineHeight: 24, fontFamily: fontFamily.bodySemibold },
  body: { fontSize: 16, lineHeight: 24, fontFamily: fontFamily.body },
  bodyMedium: { fontSize: 16, lineHeight: 24, fontFamily: fontFamily.bodyMedium },
  caption: { fontSize: 12, lineHeight: 16, fontFamily: fontFamily.body },
  label: { fontSize: 13, lineHeight: 18, fontFamily: fontFamily.bodySemibold },
} as const;

export type TextVariant = keyof typeof typeScale;

export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 } as const;
