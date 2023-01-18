import { defineConfig } from 'vite'

export default defineConfig({
   base: '',
   build: {
      target: 'es2018',
      cssCodeSplit: false,
      copyPublicDir: false,
      rollupOptions: {
         output: {
            entryFileNames: 'index.js',
            assetFileNames: 'index.css',
         }
      }
   }
})