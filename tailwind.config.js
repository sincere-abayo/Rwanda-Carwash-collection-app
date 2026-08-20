// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#155EEF',
          dark: '#0B3B8F',
          success: '#16A34A',
          warning: '#F59E0B',
          danger: '#DC2626',
          info: '#06B6D4',
        },
        background: '#F8FAFC',
        surface: '#FFFFFF',
      },
      borderRadius: {
        DEFAULT: '12px',
      }
    },
  },
  plugins: [],
}
