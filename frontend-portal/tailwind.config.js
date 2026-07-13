/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0059B3',
        accent:  '#88cc35',
        muted:   '#9d9d9d',
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        script:  ['"Dancing Script"', 'cursive'],
        friendly: ['"Baloo 2"', 'cursive'],
      },
    },
  },
  plugins: [],
}