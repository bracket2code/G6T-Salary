/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#121628', // Very dark navy blue (background)
          800: '#1E2235', // Dark navy blue (card background)
          700: '#2A2F45', // Dark navy blue (input background)
          600: '#3D4258', // Medium dark navy blue
          500: '#4E5471', // Medium navy blue
          400: '#6E748C', // Light navy blue
          300: '#9095A8', // Very light navy blue
          200: '#B2B7C6', // Super light navy blue
          100: '#D4D7DF', // Nearly white navy blue
        }
      }
    },
  },
  plugins: [],
};