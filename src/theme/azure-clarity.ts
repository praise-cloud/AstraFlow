import { createConfig, createComponents } from '@gluestack-style/react';

export const azureClarityConfig = createConfig({
  aliases: {
    bg: 'backgroundColor',
    bgColor: 'backgroundColor',
    p: 'padding',
    px: 'paddingHorizontal',
    py: 'paddingVertical',
    pt: 'paddingTop',
    pb: 'paddingBottom',
    pl: 'paddingLeft',
    pr: 'paddingRight',
    m: 'margin',
    mx: 'marginHorizontal',
    my: 'marginVertical',
    mt: 'marginTop',
    mb: 'marginBottom',
    ml: 'marginLeft',
    mr: 'marginRight',
  },
  tokens: {
    colors: {
      primary: '#003087',
      'primary-container': '#003087',
      'on-primary': '#ffffff',
      'on-primary-container': '#7f9df8',
      'primary-fixed': '#dbe1ff',
      'primary-fixed-dim': '#b4c5ff',
      'on-primary-fixed': '#00174b',
      'on-primary-fixed-variant': '#1c4197',
      'inverse-primary': '#b4c5ff',

      secondary: '#5a5f64',
      'on-secondary': '#ffffff',
      'secondary-container': '#dce0e6',
      'on-secondary-container': '#5e6368',
      'secondary-fixed': '#dfe3e9',
      'secondary-fixed-dim': '#c2c7cd',
      'on-secondary-fixed': '#171c20',
      'on-secondary-fixed-variant': '#42474c',

      surface: '#f9f9fc',
      'surface-dim': '#dadadc',
      'surface-bright': '#f9f9fc',
      'surface-container-lowest': '#ffffff',
      'surface-container-low': '#f3f3f6',
      'surface-container': '#eeeef0',
      'surface-container-high': '#e8e8ea',
      'surface-container-highest': '#e2e2e5',
      'on-surface': '#1a1c1e',
      'on-surface-variant': '#444652',
      'inverse-surface': '#2f3133',
      'inverse-on-surface': '#f0f0f3',

      background: '#f9f9fc',
      'on-background': '#1a1c1e',
      outline: '#747683',
      'outline-variant': '#c4c6d4',
      'surface-tint': '#3959b0',

      error: '#ba1a1a',
      'on-error': '#ffffff',
      'error-container': '#ffdad6',
      'on-error-container': '#93000a',

      tertiary: '#440f00',
      'on-tertiary': '#ffffff',
      'tertiary-container': '#691c00',
      'on-tertiary-container': '#f1815c',
      'tertiary-fixed': '#ffdbd0',
      'tertiary-fixed-dim': '#ffb59d',
      'on-tertiary-fixed': '#390b00',
      'on-tertiary-fixed-variant': '#7e2b0d',

      'fuel-card-bg': '#f0f4fa',
      'price-increase': '#d32f2f',
      'price-decrease': '#2e7d32',
      white: '#ffffff',
      black: '#000000',
    },
    space: {
      base: 4,
      xs: 8,
      sm: 12,
      md: 16,
      lg: 24,
      xl: 32,
      '2xl': 48,
      '3xl': 64,
      'container-margin': 16,
      gutter: 12,
    },
    radii: {
      sm: 4,
      md: 8,
      lg: 12,
      xl: 16,
      full: 9999,
    },
    fontSizes: {
      xs: 10,
      sm: 12,
      md: 14,
      lg: 16,
      xl: 20,
      '2xl': 26,
      '3xl': 32,
    },
    lineHeights: {
      sm: 16,
      md: 20,
      lg: 24,
      xl: 28,
      '2xl': 32,
      '3xl': 40,
    },
    fontWeights: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      extrabold: '800',
    },
    fonts: {
      heading: 'Work Sans',
      body: 'Inter',
      mono: 'monospace',
    },
    breakpoints: {
      base: 0,
      sm: 480,
      md: 768,
      lg: 992,
      xl: 1200,
    },
  },
  globalStyle: {
    variants: {
      colorMode: {
        light: {},
        dark: {},
      },
    },
  },
});

export const azureClarityComponents = createComponents({});

type ConfigType = typeof azureClarityConfig;

declare module '@gluestack-style/react' {
  interface ICustomConfig extends ConfigType {}
  interface ICustomComponents {}
}
