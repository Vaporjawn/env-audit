import { createScanner } from './dist/index.js';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Create test project directory like in the test
const tempDir = await mkdtemp(join(tmpdir(), 'envaudit-debug-detect-'));
const projectDir = join(tempDir, 'project');
await mkdir(projectDir, { recursive: true });

// Create src directory
await mkdir(join(projectDir, 'src'), { recursive: true });

// Create sample project files
await writeFile(
  join(projectDir, 'src', 'app.ts'),
  `
import { config } from 'dotenv';
config();

const dbUrl = process.env.DATABASE_URL;
const port = Number(process.env.PORT || 3000);
const nodeEnv = process.env.NODE_ENV || 'development';
  `,
  { flag: 'w' }
);

await writeFile(
  join(projectDir, 'src', 'client.ts'),
  `
const apiUrl = import.meta.env.VITE_API_URL;
const publicKey = import.meta.env.VITE_PUBLIC_KEY;
  `,
  { flag: 'w' }
);

await writeFile(
  join(projectDir, 'package.json'),
  JSON.stringify({
    name: 'test-project',
    version: '1.0.0',
    type: 'module',
    scripts: {
      build: 'vite build',
      dev: 'vite dev'
    },
    dependencies: {
      vite: '^4.0.0'
    }
  }, null, 2)
);

console.log('Testing detectFramework method directly...');
console.log('Project dir:', projectDir);

try {
  // Test the detectFramework method directly from utils
  const { detectFramework } = await import('./dist/index.js');
  const frameworkResult = await detectFramework(projectDir);
  console.log('Direct detectFramework result:', frameworkResult);

  // Now test through scanner
  const scanner = createScanner();

  // Let's manually test the scanner detectFramework method by accessing the private files
  const discoveredFiles = ['package.json', 'src/app.ts', 'src/client.ts'];
  console.log('Simulated discovered files:', discoveredFiles);

  const result = await scanner.scan(projectDir, {});
  console.log('Scanner framework result:', result.framework);
} catch (error) {
  console.error('Error:', error);
}

// Clean up
import { rm } from 'node:fs/promises';
await rm(tempDir, { recursive: true, force: true });