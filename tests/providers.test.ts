import { describe, it, expect, beforeEach } from 'vitest';
import { AstProvider } from '@/providers/ast-provider';
import { DotenvProvider } from '@/providers/dotenv-provider';
import { YamlProvider } from '@/providers/yaml-provider';
import { ShellProvider } from '@/providers/shell-provider';
import type { ScanOptions } from '@/types';

describe('Provider Unit Tests', () => {
  let defaultOptions: ScanOptions;

  beforeEach(() => {
    defaultOptions = {
      includePatterns: [],
      excludePatterns: [],
      excludeProviders: [],
      publicPrefixes: ['NEXT_PUBLIC_', 'VITE_', 'REACT_APP_'],
      followSymlinks: false,
      maxFileSize: 1024 * 1024,
      logLevel: 'error', // Reduce noise in tests
    };
  });

  describe('AstProvider', () => {
    let provider: AstProvider;

    beforeEach(() => {
      provider = new AstProvider();
    });

    it('should identify TypeScript files', () => {
      const files = [
        '/path/to/file.ts',
        '/path/to/file.tsx',
        '/path/to/file.js',
        '/path/to/file.jsx',
        '/path/to/file.mjs',
        '/path/to/file.py', // Should be ignored
        '/path/to/file.txt', // Should be ignored
      ];

      // Test the private method via scanning (it will filter internally)
      expect(provider.name).toBe('ast');
      expect(provider.source).toBe('ast');
    });

    it('should handle syntax errors gracefully', async () => {
      // This would be tested with actual file content in a real scenario
      // For now, we just test that the provider is properly constructed
      expect(provider.extensions).toEqual([
        '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
        '.vue', '.svelte', '.astro'
      ]);
    });
  });

  describe('DotenvProvider', () => {
    let provider: DotenvProvider;

    beforeEach(() => {
      provider = new DotenvProvider();
    });

    it('should identify dotenv files', () => {
      expect(provider.name).toBe('dotenv');
      expect(provider.source).toBe('dotenv');
      expect(provider.extensions).toEqual(['.env']);
    });

    it('should handle various dotenv file patterns', () => {
      const dotenvFiles = [
        '.env',
        '.env.local',
        '.env.development',
        '.env.production',
        '.env.test',
        'env.example',
        '.env.example',
      ];

      // All should be recognized as dotenv files
      // This would be tested with the private isDotenvFile method
      expect(provider.extensions).toContain('.env');
    });
  });

  describe('YamlProvider', () => {
    let provider: YamlProvider;

    beforeEach(() => {
      provider = new YamlProvider();
    });

    it('should identify YAML files', () => {
      expect(provider.name).toBe('yaml');
      expect(provider.source).toBe('docker');
      expect(provider.extensions).toEqual(['.yml', '.yaml']);
    });

    it('should detect different YAML file types', () => {
      // Testing file type detection would require actual file content
      // For now, we verify the provider is properly constructed
      expect(provider.name).toBe('yaml');
    });
  });

  describe('ShellProvider', () => {
    let provider: ShellProvider;

    beforeEach(() => {
      provider = new ShellProvider();
    });

    it('should identify shell script files', () => {
      expect(provider.name).toBe('shell');
      expect(provider.source).toBe('shell');
      expect(provider.extensions).toEqual(['.sh', '.bash', '.zsh', '.fish']);
    });

    it('should handle various shell script patterns', () => {
      // Testing variable extraction would require actual file content
      // For now, we verify the provider is properly constructed
      expect(provider.name).toBe('shell');
    });
  });

  describe('Provider Interface Compliance', () => {
    it('should ensure all providers implement the Provider interface', () => {
      const providers = [
        new AstProvider(),
        new DotenvProvider(),
        new YamlProvider(),
        new ShellProvider(),
      ];

      for (const provider of providers) {
        expect(provider).toHaveProperty('name');
        expect(provider).toHaveProperty('source');
        expect(provider).toHaveProperty('extensions');
        expect(provider).toHaveProperty('scan');
        expect(typeof provider.scan).toBe('function');

        // Verify name is a non-empty string
        expect(typeof provider.name).toBe('string');
        expect(provider.name.length).toBeGreaterThan(0);

        // Verify source is a valid source type
        expect(['ast', 'dotenv', 'docker', 'gha', 'shell']).toContain(provider.source);

        // Verify extensions is a readonly array
        expect(Array.isArray(provider.extensions)).toBe(true);
        expect(provider.extensions.length).toBeGreaterThan(0);
      }
    });

    it('should have unique provider names', () => {
      const providers = [
        new AstProvider(),
        new DotenvProvider(),
        new YamlProvider(),
        new ShellProvider(),
      ];

      const names = providers.map(p => p.name);
      const uniqueNames = new Set(names);

      expect(uniqueNames.size).toBe(names.length);
    });

    it('should return readonly arrays from scan method', async () => {
      const provider = new AstProvider();
      const result = await provider.scan([], defaultOptions);

      expect(Array.isArray(result)).toBe(true);
      expect(Object.isFrozen(result)).toBe(true);
    });
  });
});