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
        border: '#1a2238',
        primary: '#00f2ff',
        secondary: '#7000ff',
        success: '#00ff88',
        error: '#ff4466',
        warning: '#ffaa00',
        'text-muted': '#8892b0',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 20px rgba(0, 242, 255, 0.3)',
        'glow-secondary': '0 0 20px rgba(112, 0, 255, 0.3)',
      },
    },
  },
  plugins: [],
}
