import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Scanner, createScanner } from '@/core/scanner';
import type { ScanOptions, Finding } from '@/types';

describe('Scanner Integration Tests', () => {
  let tempDir: string;
  let scanner: Scanner;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'envaudit-test-'));
    scanner = createScanner();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('TypeScript/JavaScript scanning', () => {
    it('should find process.env variables', async () => {
      const tsFile = join(tempDir, 'app.ts');
      await writeFile(
        tsFile,
        `
const dbUrl = process.env.DATABASE_URL;
const apiKey = process.env.API_KEY || 'default-key';
const port = parseInt(process.env.PORT || '3000');
        `.trim()
      );

      const result = await scanner.scan(tempDir);

      expect(result.findings).toHaveLength(3);

      const dbUrl = result.findings.find(f => f.name === 'DATABASE_URL');
      expect(dbUrl).toBeDefined();
      expect(dbUrl?.required).toBe(true);
      expect(dbUrl?.source).toBe('ast');

      const apiKey = result.findings.find(f => f.name === 'API_KEY');
      expect(apiKey).toBeDefined();
      expect(apiKey?.required).toBe(false);
      expect(apiKey?.defaultValue).toBe('default-key');

      const port = result.findings.find(f => f.name === 'PORT');
      expect(port).toBeDefined();
      expect(port?.required).toBe(false);
      expect(port?.defaultValue).toBe('3000');
    });

    it('should find import.meta.env variables in Vite projects', async () => {
      const tsFile = join(tempDir, 'vite-app.ts');
      await writeFile(
        tsFile,
        `
const publicUrl = import.meta.env.VITE_PUBLIC_URL;
const mode = import.meta.env.MODE;
        `.trim()
      );

      const result = await scanner.scan(tempDir);

      expect(result.findings).toHaveLength(2);

      const publicUrl = result.findings.find(f => f.name === 'VITE_PUBLIC_URL');
      expect(publicUrl).toBeDefined();
      expect(publicUrl?.isPublic).toBe(true);

      const mode = result.findings.find(f => f.name === 'MODE');
      expect(mode).toBeDefined();
    });

    it('should handle destructuring patterns', async () => {
      const tsFile = join(tempDir, 'destructure.ts');
      await writeFile(
        tsFile,
        `
const { DATABASE_URL, API_KEY = 'default' } = process.env;
const { VITE_APP_TITLE } = import.meta.env;
        `.trim()
      );

      const result = await scanner.scan(tempDir);

      expect(result.findings).toHaveLength(3);

      const dbUrl = result.findings.find(f => f.name === 'DATABASE_URL');
      expect(dbUrl?.required).toBe(true);

      const apiKey = result.findings.find(f => f.name === 'API_KEY');
      expect(apiKey?.required).toBe(false);
      expect(apiKey?.defaultValue).toBe('default');
    });
  });

  describe('.env file scanning', () => {
    it('should parse .env files correctly', async () => {
      const envFile = join(tempDir, '.env');
      await writeFile(
        envFile,
        `
# Database configuration
DATABASE_URL=postgresql://localhost:5432/app

# API keys
API_KEY=secret-key
PUBLIC_KEY= # No default value

# Feature flags
ENABLE_FEATURE=true
        `.trim()
      );

      const result = await scanner.scan(tempDir);

      expect(result.findings).toHaveLength(4);

      const dbUrl = result.findings.find(f => f.name === 'DATABASE_URL');
      expect(dbUrl?.defaultValue).toBe('postgresql://localhost:5432/app');

      const publicKey = result.findings.find(f => f.name === 'PUBLIC_KEY');
      expect(publicKey?.required).toBe(true);
    });

    it('should handle quoted values and special characters', async () => {
      const envFile = join(tempDir, '.env');
      await writeFile(
        envFile,
        `
QUOTED_VALUE="hello world"
SINGLE_QUOTED='single quotes'
SPECIAL_CHARS=\$pecial@ch@rs!
EMPTY_VALUE=
        `.trim()
      );

      const result = await scanner.scan(tempDir);

      expect(result.findings).toHaveLength(4);

      const quoted = result.findings.find(f => f.name === 'QUOTED_VALUE');
      expect(quoted?.defaultValue).toBe('hello world');

      const singleQuoted = result.findings.find(f => f.name === 'SINGLE_QUOTED');
      expect(singleQuoted?.defaultValue).toBe('single quotes');
    });
  });

  describe('Docker Compose scanning', () => {
    it('should find environment variables in docker-compose.yml', async () => {
      const dockerFile = join(tempDir, 'docker-compose.yml');
      await writeFile(
        dockerFile,
        `version: '3.8'
services:
  web:
    image: node:18
    environment:
      - DATABASE_URL
      - API_KEY=default-api-key
      - NODE_ENV=production
      - PORT=3000
  db:
    image: postgres:14
    environment:
      POSTGRES_DB: app
      POSTGRES_USER: \${DB_USER}
      POSTGRES_PASSWORD: # Required
        `.trim()
      );

      const result = await scanner.scan(tempDir);

      const findings = result.findings.filter(f => f.source === 'docker');
      expect(findings.length).toBeGreaterThan(0);

      const dbUrl = findings.find(f => f.name === 'DATABASE_URL');
      expect(dbUrl?.required).toBe(true);

      const apiKey = findings.find(f => f.name === 'API_KEY');
      expect(apiKey?.defaultValue).toBe('default-api-key');
    });
  });

  describe('GitHub Actions scanning', () => {
    it('should find environment variables in workflow files', async () => {
      const workflowDir = join(tempDir, '.github', 'workflows');
      const workflowFile = join(workflowDir, 'ci.yml');

      // Create directory first
      await rm(workflowDir, { recursive: true, force: true });
      const { mkdir } = await import('node:fs/promises');
      await mkdir(workflowDir, { recursive: true });

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

      const result = await scanner.scan(tempDir);

      const ghaFindings = result.findings.filter(f => f.source === 'gha');
      expect(ghaFindings.length).toBeGreaterThan(0);
    });
  });

  describe('Shell script scanning', () => {
    it('should find environment variables in shell scripts', async () => {
      const shellFile = join(tempDir, 'deploy.sh');
      await writeFile(
        shellFile,
        `
#!/bin/bash

echo "Deploying with API key: $API_KEY"
export DATABASE_URL=\${DATABASE_URL:-"postgresql://localhost:5432/app"}

if [ -z "$REQUIRED_TOKEN" ]; then
  echo "REQUIRED_TOKEN is required"
  exit 1
fi

echo "Environment: \${NODE_ENV:-development}"
        `.trim(),
        { mode: 0o755 }
      );

      const result = await scanner.scan(tempDir);

      const shellFindings = result.findings.filter(f => f.source === 'shell');
      expect(shellFindings.length).toBeGreaterThan(0);

      const dbUrl = shellFindings.find(f => f.name === 'DATABASE_URL');
      expect(dbUrl?.defaultValue).toBe('postgresql://localhost:5432/app');

      const nodeEnv = shellFindings.find(f => f.name === 'NODE_ENV');
      expect(nodeEnv?.defaultValue).toBe('development');
    });
  });

  describe('Framework detection', () => {
    it('should detect Next.js projects', async () => {
      const packageJson = join(tempDir, 'package.json');
      await writeFile(
        packageJson,
        JSON.stringify({
          name: 'my-app',
          dependencies: {
            next: '^13.0.0',
            react: '^18.0.0'
          }
        }, null, 2)
      );

      const nextConfig = join(tempDir, 'next.config.js');
      await writeFile(nextConfig, 'module.exports = {};');

      const result = await scanner.scan(tempDir);

      expect(result.framework).toBe('nextjs');
    });

    it('should detect Vite projects', async () => {
      const packageJson = join(tempDir, 'package.json');
      await writeFile(
        packageJson,
        JSON.stringify({
          name: 'my-app',
          devDependencies: {
            vite: '^4.0.0'
          }
        }, null, 2)
      );

      const viteConfig = join(tempDir, 'vite.config.ts');
      await writeFile(viteConfig, 'export default {};');

      const result = await scanner.scan(tempDir);

      expect(result.framework).toBe('vite');
    });
  });

  describe('Public variable detection', () => {
    it('should correctly identify public variables', async () => {
      const tsFile = join(tempDir, 'public-vars.ts');
      await writeFile(
        tsFile,
        `
const nextPublic = process.env.NEXT_PUBLIC_API_URL;
const vitePublic = import.meta.env.VITE_PUBLIC_KEY;
const reactApp = process.env.REACT_APP_TITLE;
const secretKey = process.env.SECRET_KEY;
        `.trim()
      );

      const result = await scanner.scan(tempDir);

      const nextPublic = result.findings.find(f => f.name === 'NEXT_PUBLIC_API_URL');
      expect(nextPublic?.isPublic).toBe(true);

      const vitePublic = result.findings.find(f => f.name === 'VITE_PUBLIC_KEY');
      expect(vitePublic?.isPublic).toBe(true);

      const reactApp = result.findings.find(f => f.name === 'REACT_APP_TITLE');
      expect(reactApp?.isPublic).toBe(true);

      const secretKey = result.findings.find(f => f.name === 'SECRET_KEY');
      expect(secretKey?.isPublic).toBe(false);
    });
  });

  describe('Scan options', () => {
    it('should respect include/exclude patterns', async () => {
      // Create directories first
      const { mkdir } = await import('node:fs/promises');
      await mkdir(join(tempDir, 'src'), { recursive: true });
      await mkdir(join(tempDir, 'tests'), { recursive: true });

      // Create files in different directories
      await writeFile(
        join(tempDir, 'src', 'app.ts'),
        'const key = process.env.APP_KEY;'
      );

      await writeFile(
        join(tempDir, 'tests', 'test.ts'),
        'const key = process.env.TEST_KEY;'
      );

      const options: Partial<ScanOptions> = {
        include: ['src/**/*'],
        exclude: ['tests/**/*']
      };

      const result = await scanner.scan(tempDir, options);

      const appKey = result.findings.find(f => f.name === 'APP_KEY');
      expect(appKey).toBeDefined();

      const testKey = result.findings.find(f => f.name === 'TEST_KEY');
      expect(testKey).toBeUndefined();
    });

    it('should respect provider filters', async () => {
      const tsFile = join(tempDir, 'app.ts');
      await writeFile(tsFile, 'const key = process.env.APP_KEY;');

      const envFile = join(tempDir, '.env');
      await writeFile(envFile, 'ENV_KEY=value');

      // Only run AST provider
      const options: Partial<ScanOptions> = {
        includeProviders: ['ast']
      };

      const result = await scanner.scan(tempDir, options);

      const appKey = result.findings.find(f => f.name === 'APP_KEY');
      expect(appKey?.source).toBe('ast');

      const envKey = result.findings.find(f => f.name === 'ENV_KEY');
      expect(envKey).toBeUndefined();
    });
  });

  describe('Finding merging', () => {
    it('should merge findings from multiple sources', async () => {
      // Same variable in multiple files
      const tsFile = join(tempDir, 'app.ts');
      await writeFile(tsFile, 'const key = process.env.DATABASE_URL;');

      const envFile = join(tempDir, '.env');
      await writeFile(envFile, 'DATABASE_URL=postgresql://localhost:5432/app');

      const result = await scanner.scan(tempDir);

      const dbUrl = result.findings.find(f => f.name === 'DATABASE_URL');
      expect(dbUrl).toBeDefined();
      expect(dbUrl?.files).toHaveLength(2);

      // Should have file references from both sources
      const filePaths = dbUrl?.files.map(f => f.filePath) || [];
      expect(filePaths.some(p => p.endsWith('app.ts'))).toBe(true);
      expect(filePaths.some(p => p.endsWith('.env'))).toBe(true);
    });
  });
});