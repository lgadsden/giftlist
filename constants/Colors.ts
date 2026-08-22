/** Giftlist design tokens — Variant C (sage + pink), polished for Stitch-inspired UI */
export const theme = {
  colors: {
    sage: '#3D6B5A',
    sageSoft: '#E8F0EC',
    pink: '#D81B60',
    pinkSoft: '#F8E7EE',
    background: '#F3F6F5',
    ink: '#1A1A1F',
    muted: '#6B6B76',
    line: '#E4E8E6',
    white: '#FFFFFF',
    danger: '#A33333',
  },
  radius: {
    sm: 10,
    md: 14,
    lg: 18,
    xl: 22,
    pill: 999,
  },
  shadow: {
    card: {
      shadowColor: '#1A1A1F',
      shadowOpacity: 0.06,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 3,
    },
    soft: {
      shadowColor: '#1A1A1F',
      shadowOpacity: 0.04,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
  },
} as const;

export const Colors = {
  light: {
    text: theme.colors.ink,
    background: theme.colors.background,
    tint: theme.colors.sage,
    tabIconDefault: theme.colors.muted,
    tabIconSelected: theme.colors.sage,
  },
  dark: {
    text: '#F5F5F7',
    background: '#121416',
    tint: theme.colors.pink,
    tabIconDefault: '#9A9AA3',
    tabIconSelected: theme.colors.pink,
  },
};

export default Colors;
