// Vite configuration with enterprise-grade optimizations
// @vitejs/plugin-react v4.0.0
// vite-plugin-compression v0.5.1
// vite-plugin-imagemin v0.6.1

import { defineConfig } from 'vite'; // v4.4.0
import react from '@vitejs/plugin-react';
import path from 'path';
import compression from 'vite-plugin-compression';
import imagemin from 'vite-plugin-imagemin';

export default defineConfig(({ mode }) => {
  const isDevelopment = mode === 'development';

  return {
    plugins: [
      // React plugin with Fast Refresh for optimal development experience
      react({
        fastRefresh: true,
        // Enable runtime optimization features
        babel: {
          plugins: [
            ['@babel/plugin-transform-runtime'],
            // Enable emotion for MUI styling optimization
            ['@emotion/babel-plugin', { sourceMap: true, autoLabel: 'dev-only' }],
          ],
        },
      }),

      // Production-only plugins
      ...(!isDevelopment ? [
        // Brotli compression for better compression ratios
        compression({
          algorithm: 'brotli',
          ext: '.br',
          threshold: 10240, // Only compress files > 10KB
          deleteOriginFile: false,
        }),
        // Fallback gzip compression for broader compatibility
        compression({
          algorithm: 'gzip',
          ext: '.gz',
          threshold: 10240,
          deleteOriginFile: false,
        }),
        // Image optimization for production builds
        imagemin({
          gifsicle: {
            optimizationLevel: 7,
            interlaced: false,
          },
          mozjpeg: {
            quality: 80,
            progressive: true,
          },
          pngquant: {
            quality: [0.8, 0.9],
            speed: 4,
          },
          svgo: {
            plugins: [
              { name: 'removeViewBox', active: false },
              { name: 'removeEmptyAttrs', active: true },
            ],
          },
          webp: {
            quality: 80,
          },
        }),
      ] : []),
    ],

    // Path resolution configuration aligned with tsconfig.json
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@components': path.resolve(__dirname, 'src/components'),
        '@pages': path.resolve(__dirname, 'src/pages'),
        '@hooks': path.resolve(__dirname, 'src/hooks'),
        '@utils': path.resolve(__dirname, 'src/utils'),
        '@api': path.resolve(__dirname, 'src/api'),
        '@redux': path.resolve(__dirname, 'src/redux'),
        '@styles': path.resolve(__dirname, 'src/styles'),
        '@assets': path.resolve(__dirname, 'src/assets'),
        '@types': path.resolve(__dirname, 'src/types'),
        '@constants': path.resolve(__dirname, 'src/constants'),
        '@config': path.resolve(__dirname, 'src/config'),
        '@features': path.resolve(__dirname, 'src/features'),
        '@layouts': path.resolve(__dirname, 'src/layouts'),
        '@services': path.resolve(__dirname, 'src/services'),
      },
    },

    // Development server configuration
    server: {
      port: 3000,
      host: true, // Listen on all addresses
      strictPort: true,
      cors: true,
      hmr: {
        overlay: true,
        clientPort: 3000,
      },
      watch: {
        usePolling: true, // Ensure file changes are detected
      },
    },

    // Production build optimization configuration
    build: {
      outDir: 'dist',
      sourcemap: true, // Enable source maps for debugging
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: !isDevelopment,
          drop_debugger: !isDevelopment,
          pure_funcs: !isDevelopment ? ['console.log', 'console.info'] : [],
        },
      },
      chunkSizeWarningLimit: 1000, // KB
      rollupOptions: {
        output: {
          // Optimize chunk splitting for better caching
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            ui: ['@mui/material', '@emotion/react', '@emotion/styled'],
            state: ['@reduxjs/toolkit', 'react-redux'],
            forms: ['react-hook-form', 'yup'],
            utils: ['lodash', 'date-fns'],
            charts: ['recharts', 'd3'],
            editor: ['draft-js', 'react-draft-wysiwyg'],
          },
          // Asset naming strategy for optimal caching
          assetFileNames: 'assets/[hash][extname]',
          chunkFileNames: 'js/[hash].js',
          entryFileNames: 'js/[hash].js',
        },
      },
      cssCodeSplit: true, // Enable CSS code splitting
      assetsInlineLimit: 4096, // 4KB - inline small assets
      modulePreload: true,
      reportCompressedSize: true,
    },

    // Preview server configuration (for production builds)
    preview: {
      port: 3000,
      strictPort: true,
      cors: true,
      headers: {
        'Cache-Control': 'public, max-age=31536000', // 1 year cache for static assets
      },
    },

    // Dependency optimization configuration
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        '@mui/material',
        '@reduxjs/toolkit',
      ],
      exclude: ['@fscomponents'], // Exclude internal components
    },

    // Environment variable handling
    envPrefix: 'VITE_',
    envDir: process.cwd(),
  };
});