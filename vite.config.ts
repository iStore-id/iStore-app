import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { gzipSync } from 'node:zlib';
import {defineConfig} from 'vite';

function reportBundleComposition() {
  return {
    name: 'report-bundle-composition',
    apply: 'build',
    generateBundle(_options: unknown, bundle: Record<string, any>) {
      const chunks = Object.values(bundle)
        .filter((item: any) => item.type === 'chunk')
        .map((chunk: any) => ({
          file: chunk.fileName,
          bytes: Buffer.byteLength(chunk.code, 'utf8'),
          gzipBytes: gzipSync(Buffer.from(chunk.code)).byteLength,
          isEntry: chunk.isEntry,
          isDynamicEntry: chunk.isDynamicEntry,
          imports: chunk.imports,
          dynamicImports: chunk.dynamicImports,
          modules: Object.entries(chunk.modules).map(([id, module]: [string, any]) => ({
            id: id.replace(process.cwd() + '/', ''),
            renderedBytes: module.renderedLength,
            originalBytes: module.originalLength,
          })).sort((a, b) => b.renderedBytes - a.renderedBytes),
        }))
        .sort((a: any, b: any) => b.bytes - a.bytes);

      console.log('\\n[BUNDLE AUDIT] JavaScript chunk composition (raw/gzip bytes)');
      for (const chunk of chunks) {
        console.log(
          `[BUNDLE AUDIT] ${chunk.file} | raw=${chunk.bytes} | gzip=${chunk.gzipBytes} | entry=${chunk.isEntry} | dynamic=${chunk.isDynamicEntry}`
        );
        console.log(`[BUNDLE AUDIT]   imports: ${chunk.imports.join(', ') || '(none)'}`);
        console.log(`[BUNDLE AUDIT]   dynamic imports: ${chunk.dynamicImports.join(', ') || '(none)'}`);
        for (const module of chunk.modules.slice(0, 8)) {
          console.log(`[BUNDLE AUDIT]   module: ${module.id} | rendered=${module.renderedBytes} | original=${module.originalBytes}`);
        }
      }
      console.log('[BUNDLE AUDIT] End of report\\n');
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), reportBundleComposition()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
