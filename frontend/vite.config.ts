import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
    base: '/execution-tracker/',
    plugins: [
        react(),
        tailwindcss(),
    ],
    server: {
        port: 3001,
        proxy: {
            '^/execution-tracker/api': {
                target: 'http://localhost:3121',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/execution-tracker\/api/, '/api')
            },
        },
    },
})
