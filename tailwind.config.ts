import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Deep mosque green — primary brand color
        brand: {
          50: '#eef4f1',
          100: '#d6e5dd',
          200: '#adcabb',
          300: '#7ea996',
          400: '#4e8570',
          500: '#356b57',
          600: '#27523f',
          700: '#1f3d33',
          800: '#1a332b',
          900: '#132720',
          950: '#0c1914',
        },
        // Soft gold — accent
        gold: {
          50: '#faf6ec',
          100: '#f4ecd6',
          200: '#ecdcb0',
          300: '#e0c07a',
          400: '#d9b060',
          500: '#cd9b44',
          600: '#b47f33',
          700: '#8f612b',
          800: '#754e28',
          900: '#634124',
        },
        // Ivory / paper background
        ivory: {
          50: '#faf8f2',
          100: '#f5f1e8',
          200: '#efe9da',
          300: '#e6ddc7',
        },
        ink: '#2b2b2b',
        muted: '#6b6b6b',
        // Semantic
        success: '#2f8f5b',
        warning: '#d98324',
        danger: '#c0554e',
      },
      fontFamily: {
        sans: ['var(--font-arabic)', 'Cairo', 'Tajawal', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-arabic)', 'serif'],
      },
      boxShadow: {
        card: '0 4px 20px -6px rgba(31, 61, 51, 0.12)',
        'card-hover': '0 10px 30px -8px rgba(31, 61, 51, 0.22)',
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
    },
  },
  plugins: [],
};

export default config;
