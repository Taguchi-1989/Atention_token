/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#050510',
        surface: '#0f1525',
        'surface-highlight': '#1a2238',
        border: '#2a3550',
        primary: {
          DEFAULT: '#00f2ff',
          glow: 'rgba(0, 242, 255, 0.3)',
        },
        secondary: {
          DEFAULT: '#7000ff',
          glow: 'rgba(112, 0, 255, 0.3)',
        },
        success: '#00ff9d',
        error: '#ff0055',
        text: {
          main: '#ffffff',
          muted: '#94a3b8',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
