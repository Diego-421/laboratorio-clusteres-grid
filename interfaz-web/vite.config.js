import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' permite publicar en GitHub Pages, Vercel o Netlify sin cambiar nada
export default defineConfig({ plugins: [react()], base: './' })
