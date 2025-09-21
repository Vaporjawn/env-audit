import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import fastGlob from 'fast-glob';

async function debugGitHubActions() {
  // Create temp directory
  const tempDir = await mkdtemp(join(tmpdir(), 'envaudit-debug-gha-'));
  console.log('Created temp dir:', tempDir);

  try {
    // Create .github/workflows directory structure
    const workflowDir = join(tempDir, '.github', 'workflows');
    console.log('Creating workflow dir:', workflowDir);

    await mkdir(workflowDir, { recursive: true });

    // Create a test workflow file
    const workflowFile = join(workflowDir, 'ci.yml');
    await writeFile(
      workflowFile,
      `
name: CI
on: [push]
env:
  NODE_ENV: test
jobs:
  test:
    runs-on: ubuntu-latest
    env:
      DATABASE_URL: \${{ secrets.DATABASE_URL }}
      API_KEY: \${{ secrets.API_KEY }}
    steps:
      - uses: actions/checkout@v3
      - name: Run tests
        env:
          TEST_TOKEN: \${{ secrets.TEST_TOKEN }}
        run: npm test
      `.trim()
    );

    console.log('Created workflow file:', workflowFile);

    // Test file discovery with different patterns
    console.log('\n=== Testing file discovery ===');

    const includePatterns = [
      '**/*.{js,jsx,ts,tsx,mjs,cjs}',
      '**/*.{yml,yaml}',
      '**/*.{sh,bash,zsh}',
      '.env*',
      'package.json',
    ];

    const excludePatterns = [
      '**/node_modules/**',
      '.git/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/.nuxt/**',
      '**/.svelte-kit/**',
      '**/coverage/**',
      '**/*.d.ts',
    ];

    console.log('Include patterns:', includePatterns);
    console.log('Exclude patterns:', excludePatterns);

    // Test with fast-glob directly
    const files = await fastGlob.glob(includePatterns, {
      cwd: tempDir,
      ignore: excludePatterns,
      absolute: true,
      followSymbolicLinks: false,
      suppressErrors: true,
      onlyFiles: true,
    });

    console.log('Found files:', files);

    // Also test without exclude patterns
    console.log('\n=== Testing without exclude patterns ===');
    const filesNoExclude = await fastGlob.glob(includePatterns, {
      cwd: tempDir,
      absolute: true,
      followSymbolicLinks: false,
      suppressErrors: true,
      onlyFiles: true,
    });

    console.log('Found files (no exclude):', filesNoExclude);

    // Test specific yaml pattern
    console.log('\n=== Testing specific yaml pattern ===');
    const yamlFiles = await fastGlob.glob('**/*.{yml,yaml}', {
      cwd: tempDir,
      absolute: true,
      followSymbolicLinks: false,
      suppressErrors: true,
      onlyFiles: true,
    });

    console.log('Found YAML files:', yamlFiles);

    // Test github pattern specifically
    console.log('\n=== Testing .github pattern specifically ===');
    const githubFiles = await fastGlob.glob('.github/**/*.{yml,yaml}', {
      cwd: tempDir,
      absolute: true,
      followSymbolicLinks: false,
      suppressErrors: true,
      onlyFiles: true,
    });

    console.log('Found .github files:', githubFiles);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Clean up
    await rm(tempDir, { recursive: true, force: true });
    console.log('Cleaned up temp dir');
  }
}

debugGitHubActions().catch(console.error);