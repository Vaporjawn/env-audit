/**
 * Test setup file for Vitest
 */

import { beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';

// Global test timeout
const TEST_TIMEOUT = 10000;

// Setup global test environment
beforeEach(async () => {
  // Ensure test fixtures directory exists
  const fixturesDir = path.join(__dirname, 'fixtures');
  try {
    await fs.access(fixturesDir);
  } catch {
    await fs.mkdir(fixturesDir, { recursive: true });
  }
});

// Cleanup after each test
afterEach(async () => {
  // Clean up any temporary test files if needed
  // This can be expanded as needed for specific test cleanup
});

// Extend expect with custom matchers if needed
declare global {
  namespace Vi {
    interface JestAssertion<T = any> {
      // Custom matchers can be added here
    }
  }
}

export {};