import { detectFramework } from './dist/index.js';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Create test project directory like in the test
const tempDir = await mkdtemp(join(tmpdir(), 'envaudit-framework-test-'));
const projectDir = join(tempDir, 'project');
await mkdir(projectDir, { recursive: true });

// Create package.json with vite dependency
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

console.log('Testing framework detection...');
console.log('Project dir:', projectDir);

try {
  const result = await detectFramework(projectDir);
  console.log('Framework detection result:', result);
} catch (error) {
  console.error('Framework detection error:', error);
}

// Clean up
import { rm } from 'node:fs/promises';
await rm(tempDir, { recursive: true, force: true });