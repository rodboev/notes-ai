/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './node_modules/react-tailwindcss-datepicker/dist/index.esm.js',
  ],
  theme: {
    fontFamily: {
      sans: 'Helvetica, Arial, sans-serif',
    },
    extend: {
      spacing: { full: '100%' },
      flex: {
        1.4: '1.4 1.4 0%',
      },
      colors: {
        teal: 'rgb(23,72, 77)',
        'teal-500': 'rgb(23, 72, 77)',
        'teal-100': 'rgba(23, 72, 77, 0.25)',
        'teal-90': 'rgba(23, 72, 77, 0.9)',
        'teal-80': 'rgba(23, 72, 77, 0.8)',
        'teal-70': 'rgba(23, 72, 77, 0.7)',
        'teal-60': 'rgba(23, 72, 77, 0.6)',
        'teal-50': 'rgba(23, 72, 77, 0.5)',
        'light-teal': '#D3E4EC',
      },
    },
  },
  corePlugins: {
    divideStyle: true,
  },
  plugins: [require('tailwindcss-safe-area')],
}
