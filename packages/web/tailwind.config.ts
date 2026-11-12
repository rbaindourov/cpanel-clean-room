import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        jupiter: {
          base: '#1B1E2B',       // Deep Charcoal Page Background
          card: '#232736',       // Panel & Card Surface
          hover: '#2A2F42',      // Hover / Input Background
          border: '#343B52',     // Subtle Borders
          divider: '#2B3145',    // Inner Separators
          gold: '#F59E0B',       // Classic HostGator / cPanel Brand Accent
          goldHover: '#D97706',
          text: '#F1F5F9',       // High Contrast Typography
          muted: '#94A3B8',      // Secondary Text
          subtle: '#64748B',     // Tertiary / Timestamp Text
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
