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
          DEFAULT: '#6c5af7',
          hover:   '#5b4adc',
          light:   '#ede9fe',
          dark:    '#7c6aff',
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
