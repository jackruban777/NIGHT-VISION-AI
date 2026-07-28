/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'background': '#141313',
        'surface': '#141313',
        'surface-dim': '#141313',
        'surface-bright': '#3a3939',
        'surface-container-lowest': '#0e0e0e',
        'surface-container-low': '#1c1b1b',
        'surface-container': '#201f1f',
        'surface-container-high': '#2b2a2a',
        'surface-container-highest': '#353434',
        'surface-variant': '#353434',
        'on-surface': '#e5e2e1',
        'on-surface-variant': '#c4c7c7',
        'primary': '#c9c6c5',
        'primary-container': '#0b0b0b',
        'on-primary': '#313030',
        'secondary': '#c8c6c8',
        'secondary-container': '#474649',
        'tertiary': '#c7c6ca',
        'tertiary-container': '#0a0b0e',
        'error': '#ffb4ab',
        'error-container': '#93000a',
        'on-error': '#690005',
        'on-error-container': '#ffdad6',
        'outline': '#8e9192',
        'outline-variant': '#444748',
        'accent-electric': '#00E5FF',
        'accent-amber': '#FFB300',
        'cyan-glow': '#00FFFF',
        'electric-blue': '#00E5FF',
        'card-bg': '#1B1B1D',
        'card-border': '#202124'
      },
      borderRadius: {
        'DEFAULT': '0.25rem',
        'lg': '0.5rem',
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
        'full': '9999px'
      },
      spacing: {
        'container-max': '1440px',
        'gutter': '24px',
        'unit': '4px',
        'margin-mobile': '16px',
        'margin-desktop': '48px'
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['Inter', 'monospace'],
        'data-mono': ['Inter', 'monospace'],
        'body-base': ['Inter', 'sans-serif'],
        'headline-md': ['Inter', 'sans-serif'],
        'label-caps': ['Inter', 'sans-serif'],
        'display-lg': ['Inter', 'sans-serif']
      }
    },
  },
  plugins: [],
};
