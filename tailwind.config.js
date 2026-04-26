module.exports = {
  darkMode: 'class',
  content: [
    './index.html', './admin.html', './guides.html', './usuario.html', './user.html',
    './src/**/*.{js,jsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      lineHeight: {
        'body': '1.6',
        'tight': '1.2',
      },
      spacing: {
        'section': '6rem',      // 96px - consistent section spacing
        'section-sm': '4rem',   // 64px - smaller sections
        'card': '1.5rem',       // 24px - card padding
        'card-sm': '1rem',      // 16px - smaller card padding
      },
      colors: {
        accent: {
          DEFAULT: '#06b6d4', // cyan-500
          hover:   '#0891b2', // cyan-600
          light:   '#cffafe', // cyan-50
          dark:    '#22d3ee', // cyan-400
        },
      },
      borderRadius: {
        card:  '12px',
        chip:  '8px',
        input: '10px',
      },
    },
  },
  plugins: [],
}
