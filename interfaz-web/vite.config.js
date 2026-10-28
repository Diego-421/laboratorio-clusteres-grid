import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' permite publicar en GitHub Pages, Vercel o Netlify sin cambiar nada.
// El proxy envía /api al servidor Flask (python app.py) mientras desarrollas con "npm run dev".
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { proxy: { '/api': 'http://127.0.0.1:5000' } },
})
