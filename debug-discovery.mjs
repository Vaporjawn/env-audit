import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DefaultFileDiscovery } from './dist/index.js';

async function testFileDiscovery() {
  // Create temp directory
  const tempDir = await mkdtemp(join(tmpdir(), 'envaudit-debug-'));
  console.log('Created temp dir:', tempDir);

  try {
    // Create a test file
    const tsFile = join(tempDir, 'app.ts');
    await writeFile(
      tsFile,
      `
const dbUrl = process.env.DATABASE_URL;
const apiKey = process.env.API_KEY || 'default-key';
const port = parseInt(process.env.PORT || '3000');
      `.trim()
    );

    console.log('Created test file:', tsFile);

    // Test file discovery directly
    const discovery = new DefaultFileDiscovery();
    console.log('Created file discovery instance');

    const files = await discovery.discoverFiles({
      dir: tempDir,
      include: [
        '**/*.{js,jsx,ts,tsx,mjs,cjs}',
        '**/*.{yml,yaml}',
        '**/*.{sh,bash,zsh}',
        '.env*',
      ],
      exclude: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/.next/**',
        '**/.nuxt/**',
        '**/.svelte-kit/**',
        '**/coverage/**',
        '**/*.d.ts',
      ],
      publicPrefixes: [],
      maxFileSize: 1024 * 1024, // 1MB
      followSymlinks: false,
      cacheDir: '.env-audit-cache',
      cache: true,
      respectGitignore: true,
      debug: true,
    });
    console.log('Discovered files:', files);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Clean up
    await rm(tempDir, { recursive: true, force: true });
    console.log('Cleaned up temp dir');
  }
}

testFileDiscovery();