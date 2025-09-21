import { createScanner } from './dist/index.js';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Create test project directory like in the test
const tempDir = await mkdtemp(join(tmpdir(), 'envaudit-files-test-'));
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

console.log('Testing file discovery...');
console.log('Project dir:', projectDir);

try {
  // Let's monkey patch the scanner to log the discovered files
  const scanner = createScanner();
  const originalScan = scanner.scan.bind(scanner);
  scanner.scan = async function(path, options) {
    console.log('Scanning path:', path);
    console.log('Options:', options);

    // Access the private method (hacky but for debugging)
    const files = await this.discoverFiles(path, options);
    console.log('Discovered files:', files);

    // Check for package.json files specifically
    const packageJsonFiles = files.filter(file => file.endsWith('package.json'));
    console.log('Package.json files found:', packageJsonFiles);

    return originalScan(path, options);
  };

  const result = await scanner.scan(projectDir, {});
  console.log('Final framework result:', result.framework);
} catch (error) {
  console.error('Scanner error:', error);
}

// Clean up
import { rm } from 'node:fs/promises';
await rm(tempDir, { recursive: true, force: true });