tailwind.config = {
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#060608',
          card: '#0E0E12',
          surface: '#16161C',
          primary: '#FFFFFF',
          secondary: '#A1A1AA',
          text: '#F8FAFC',
          muted: '#A1A1AA',
          green: '#22C55E',
        },
      },
      boxShadow: {
        glow: '0 0 24px rgba(255, 255, 255, 0.12)',
        neon: '0 0 30px rgba(255, 255, 255, 0.1)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
      },
    },
  },
};
