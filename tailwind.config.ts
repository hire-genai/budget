import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0B0D12',
          soft: '#11141B',
          card: '#141822',
          border: '#1E232E',
          hover: '#1B2029',
        },
        brand: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
          800: '#3730A3',
          900: '#312E81',
        },
        accent: {
          green: '#10B981',
          red: '#EF4444',
          amber: '#F59E0B',
          blue: '#3B82F6',
          purple: '#8B5CF6',
          pink: '#EC4899',
          teal: '#14B8A6',
        },
        text: {
          primary: '#F3F4F6',
          secondary: '#9CA3AF',
          muted: '#6B7280',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.05)',
        pop: '0 8px 30px rgba(0,0,0,0.3)',
      },
      borderRadius: {
        xl: '0.9rem',
      },
    },
  },
  plugins: [],
}
export default config
