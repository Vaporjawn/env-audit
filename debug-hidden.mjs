import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import fastGlob from 'fast-glob';

async function debugHiddenDirectories() {
  // Create temp directory
  const tempDir = await mkdtemp(join(tmpdir(), 'envaudit-debug-hidden-'));
  console.log('Created temp dir:', tempDir);

  try {
    // Create regular directory structure
    const regularDir = join(tempDir, 'workflows');
    await mkdir(regularDir, { recursive: true });

    const regularFile = join(regularDir, 'ci.yml');
    await writeFile(regularFile, 'name: CI\nenv:\n  NODE_ENV: test');

    // Create hidden directory structure
    const hiddenDir = join(tempDir, '.github', 'workflows');
    await mkdir(hiddenDir, { recursive: true });

    const hiddenFile = join(hiddenDir, 'ci.yml');
    await writeFile(hiddenFile, 'name: CI\nenv:\n  NODE_ENV: test');

    console.log('Created regular file:', regularFile);
    console.log('Created hidden file:', hiddenFile);

    // Test different patterns
    console.log('\n=== Testing **/*.yml pattern ===');
    const yamlFiles = await fastGlob.glob('**/*.yml', {
      cwd: tempDir,
      absolute: true,
      followSymbolicLinks: false,
      suppressErrors: true,
      onlyFiles: true,
    });
    console.log('Found files:', yamlFiles);

    console.log('\n=== Testing **/*.yml pattern with dot:true ===');
    const yamlFilesDot = await fastGlob.glob('**/*.yml', {
      cwd: tempDir,
      absolute: true,
      followSymbolicLinks: false,
      suppressErrors: true,
      onlyFiles: true,
      dot: true,
    });
    console.log('Found files with dot:true:', yamlFilesDot);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Clean up
    await rm(tempDir, { recursive: true, force: true });
    console.log('Cleaned up temp dir');
  }
}

debugHiddenDirectories().catch(console.error);