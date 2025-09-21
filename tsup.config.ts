import { defineConfig } from 'tsup';

export default defineConfig({
  // Entry points
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli.ts',
  },

  // Output formats
  format: ['esm', 'cjs'],

  // Code splitting
  splitting: false,

  // Source maps
  sourcemap: true,

  // Clean output directory
  clean: true,

  // Generate declaration files
  dts: true,

  // Minification
  minify: false,

  // Bundle external dependencies
  external: [
    // Keep external dependencies as peer dependencies
    '@babel/generator',
    '@babel/parser',
    '@babel/traverse',
    '@babel/types',
    'commander',
    'fast-glob',
    'picocolors',
    'yaml'
  ],

  // Target environment
  target: 'node18',

  // Platform
  platform: 'node',

  // Shims for node built-ins
  shims: true,

  // Make CLI executable
  onSuccess: async () => {
    // Add shebang and make CLI file executable on Unix systems
    const { readFile, writeFile, chmod } = await import('fs/promises');
    const { join } = await import('path');
    try {
      const cliPath = join('dist', 'cli.js');
      const content = await readFile(cliPath, 'utf8');
      if (!content.startsWith('#!/usr/bin/env node')) {
        await writeFile(cliPath, '#!/usr/bin/env node\n' + content);
      }
      await chmod(cliPath, 0o755);
      console.log('✅ CLI binary made executable');
    } catch (error) {
      console.warn('⚠️  Could not make CLI executable:', error);
    }
  },

  // Output directory
  outDir: 'dist',

  // Preserve directory structure
  keepNames: true,

  // Tree shaking
  treeshake: true,

  // TypeScript options
  tsconfig: 'tsconfig.json',
});