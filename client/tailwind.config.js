/** Colors come from CSS variables so admins can re-theme the app at runtime. */
const c = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: c('primary'), // Parrot green #7ED957
        secondary: c('secondary'), // Deep green #1B5E20
        light: c('light'), // #F5FAF2
        ink: c('text'), // #17251A
        paper: c('bg'),
      },
      fontFamily: { sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'] },
      boxShadow: {
        card: '0 6px 24px -8px rgb(27 94 32 / 0.18)',
        glow: '0 10px 36px -6px rgb(126 217 87 / 0.65)',
      },
      borderRadius: { '4xl': '2rem' },
      keyframes: {
        'page-in': { '0%': { opacity: 0, transform: 'translateY(10px)' }, '100%': { opacity: 1, transform: 'none' } },
        'sheet-in': { '0%': { transform: 'translateY(100%)' }, '100%': { transform: 'none' } },
        'fade-in': { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        ripple: { '0%': { transform: 'scale(0.6)', opacity: 0.55 }, '100%': { transform: 'scale(2.4)', opacity: 0 } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
        pulseSoft: { '0%,100%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.04)' } },
        dots: { '0%,20%': { opacity: 0.2 }, '50%': { opacity: 1 }, '100%': { opacity: 0.2 } },
        spin: { to: { transform: 'rotate(360deg)' } },
        ring: { '0%': { boxShadow: '0 0 0 0 rgb(var(--c-primary) / 0.6)' }, '100%': { boxShadow: '0 0 0 22px rgb(var(--c-primary) / 0)' } },
        shake: { '0%,100%': { transform: 'translateX(0)' }, '25%': { transform: 'translateX(-4px)' }, '75%': { transform: 'translateX(4px)' } },
      },
      animation: {
        'page-in': 'page-in .35s cubic-bezier(.2,.8,.2,1) both',
        'sheet-in': 'sheet-in .3s cubic-bezier(.2,.8,.2,1) both',
        'fade-in': 'fade-in .25s ease both',
        ripple: 'ripple 2.4s cubic-bezier(.2,.6,.3,1) infinite',
        float: 'float 4s ease-in-out infinite',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        dots: 'dots 1.2s infinite',
        ring: 'ring 1.4s ease-out infinite',
        shake: 'shake .4s ease',
      },
    },
  },
  plugins: [],
};
