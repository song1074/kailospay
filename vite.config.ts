// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// 개발:  http://localhost:5174  에서  /api  →  http://localhost:4000  프록시
// 운영:  Nginx가 /api 를 백엔드(4000)로 프록시하므로 프론트에서는 그대로 /api 사용

export default defineConfig({
  plugins: [react()],
  base: '/', // 배포 루트가 도메인 루트(/)일 때

  resolve: {
    alias: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
    },
    dedupe: ['react', 'react-dom'], // 중복 번들 방지
  },

  server: {
    port: 5174,
    strictPort: true,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        // pathRewrite 불필요: /api 그대로 백엔드에 전달
      },
    },
  },

  // 로컬 디버깅 편의용. 필요 없으면 false로
  build: {
    sourcemap: true,
    outDir: 'dist',
    manifest: true,
  },
});
