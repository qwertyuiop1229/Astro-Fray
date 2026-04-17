import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  // 開発用エントリは src/index.html（既存の public/index.html とは独立）
  root: 'src',

  // ライブラリビルド時は public/ のコピーを無効化（開発サーバーでは別途提供）
  publicDir: false,

  resolve: {
    alias: {
      '@core': path.resolve(__dirname, 'src/core'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@systems': path.resolve(__dirname, 'src/systems'),
      '@modes': path.resolve(__dirname, 'src/modes'),
      '@utils': path.resolve(__dirname, 'src/utils'),
    },
  },

  server: {
    port: 5173,
    open: false, // ブラウザ自動起動はユーザー側で行う
  },

  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    lib: {
      entry: path.resolve(__dirname, 'src/ecs_export.js'),
      name: 'AstroECS',
      fileName: 'ecs',
      formats: ['iife'],
    },
  },
});
