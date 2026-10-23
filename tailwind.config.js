/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        studio: {
          950: '#0a0b0e',
          900: '#111317',
          850: '#16191f',
          800: '#1d212a',
          700: '#2a303c',
          600: '#3d4556',
        },
        neon: {
          amber: '#f59e0b',
          cyan: '#06b6d4',
          violet: '#a855f7',
          emerald: '#10b981',
          rose: '#f43f5e',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
