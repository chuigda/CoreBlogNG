import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
   base: '',
   plugins: [viteSingleFile()],
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
