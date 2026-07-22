import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canopy: {
          bg: '#0B0F0C',
          panel: '#121913',
          card: '#182119',
          border: '#26362A',
          green: '#39FF6A',
          greendark: '#22C55E',
          lime: '#C8FF3D',
          purple: '#B14CFF',
          pink: '#FF4CC8',
          gold: '#FFC93D',
          text: '#EFFFF3',
          muted: '#8FA396',
        },
      },
      fontFamily: {
        groovy: ['"Righteous"', 'cursive'],
      },
      boxShadow: {
        glow: '0 0 25px rgba(57, 255, 106, 0.45), 0 0 60px rgba(177, 76, 255, 0.25)',
        glowsm: '0 0 12px rgba(57, 255, 106, 0.55)',
      },
      keyframes: {
        blobfloat: {
          '0%, 100%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(30px, -40px) scale(1.1)' },
          '66%': { transform: 'translate(-20px, 20px) scale(0.95)' },
        },
        pulseglow: {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '0.9' },
        },
      },
      animation: {
        blobfloat: 'blobfloat 14s ease-in-out infinite',
        blobfloatslow: 'blobfloat 20s ease-in-out infinite reverse',
        pulseglow: 'pulseglow 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
export default config;
