/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        roadtrip: {
          50: '#f0f7ff',
          100: '#e0f0ff',
          200: '#baddff',
          300: '#7ec2ff',
          400: '#3aa3ff',
          500: '#0f83f0',
          600: '#0066cc',
          700: '#0051a4',
          800: '#004587',
          900: '#063a70',
        },
      },
    },
  },
  plugins: [],
};
