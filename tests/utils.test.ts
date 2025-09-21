import { describe, it, expect } from 'vitest';
import {
  createFinding,
  createFileRef,
  mergeFindings,
  isPublicVariable,
  isValidEnvVarName,
  getRelativePath,
} from '@/utils';
import type { Finding } from '@/types';

describe('Utility Functions', () => {
  describe('createFinding', () => {
    it('should create a finding with required properties', () => {
      const fileRef = createFileRef('/path/to/file.ts', 10, 5, 'Test context');
      const finding = createFinding('TEST_VAR', 'ast', [fileRef]);

      expect(finding.name).toBe('TEST_VAR');
      expect(finding.source).toBe('ast');
      expect(finding.files).toHaveLength(1);
      expect(finding.files[0]).toBe(fileRef);
      expect(finding.required).toBe(true); // Default
      expect(finding.isPublic).toBe(false); // Default
    });

    it('should create a finding with custom options', () => {
      const fileRef = createFileRef('/path/to/file.ts', 10, 5, 'Test context');
      const finding = createFinding('TEST_VAR', 'ast', [fileRef], {
        required: false,
        defaultValue: 'default-value',
        isPublic: true,
      });

      expect(finding.required).toBe(false);
      expect(finding.defaultValue).toBe('default-value');
      expect(finding.isPublic).toBe(true);
    });

    it('should freeze the finding object', () => {
      const fileRef = createFileRef('/path/to/file.ts', 10, 5);
      const finding = createFinding('TEST_VAR', 'ast', [fileRef]);

      expect(Object.isFrozen(finding)).toBe(true);
      expect(Object.isFrozen(finding.files)).toBe(true);
    });
  });

  describe('createFileRef', () => {
    it('should create a file reference with required properties', () => {
      const fileRef = createFileRef('/path/to/file.ts', 10, 5);

      expect(fileRef.filePath).toBe('/path/to/file.ts');
      expect(fileRef.line).toBe(10);
      expect(fileRef.column).toBe(5);
      expect(fileRef.context).toBeUndefined();
    });

    it('should create a file reference with context', () => {
      const fileRef = createFileRef('/path/to/file.ts', 10, 5, 'Function: main');

      expect(fileRef.context).toBe('Function: main');
    });

    it('should freeze the file reference object', () => {
      const fileRef = createFileRef('/path/to/file.ts', 10, 5);

      expect(Object.isFrozen(fileRef)).toBe(true);
    });
  });

  describe('mergeFindings', () => {
    it('should merge findings with the same name', () => {
      const fileRef1 = createFileRef('/path/to/file1.ts', 10, 5);
      const fileRef2 = createFileRef('/path/to/file2.ts', 20, 10);

      const finding1 = createFinding('TEST_VAR', 'ast', [fileRef1], {
        required: true,
      });

      const finding2 = createFinding('TEST_VAR', 'dotenv', [fileRef2], {
        required: false,
        defaultValue: 'default-value',
      });

      const merged = mergeFindings([finding1, finding2]);

      expect(merged.name).toBe('TEST_VAR');
      expect(merged.files).toHaveLength(2);
      expect(merged.files).toContain(fileRef1);
      expect(merged.files).toContain(fileRef2);

      // Should preserve the most permissive/informative values
      expect(merged.defaultValue).toBe('default-value');
      // Required should be true if any finding requires it
      expect(merged.required).toBe(true);
    });

    it('should handle empty findings array', () => {
      expect(() => mergeFindings([])).toThrow();
    });

    it('should handle single finding', () => {
      const fileRef = createFileRef('/path/to/file.ts', 10, 5);
      const finding = createFinding('TEST_VAR', 'ast', [fileRef]);

      const merged = mergeFindings([finding]);

      expect(merged).toEqual(finding);
    });

    it('should deduplicate file references', () => {
      const fileRef = createFileRef('/path/to/file.ts', 10, 5);

      const finding1 = createFinding('TEST_VAR', 'ast', [fileRef]);
      const finding2 = createFinding('TEST_VAR', 'ast', [fileRef]); // Same file ref

      const merged = mergeFindings([finding1, finding2]);

      expect(merged.files).toHaveLength(1);
    });
  });

  describe('isPublicVariable', () => {
    it('should identify public variables by prefix', () => {
      const publicPrefixes = ['NEXT_PUBLIC_', 'VITE_', 'REACT_APP_'];

      expect(isPublicVariable('NEXT_PUBLIC_API_URL', publicPrefixes)).toBe(true);
      expect(isPublicVariable('VITE_APP_TITLE', publicPrefixes)).toBe(true);
      expect(isPublicVariable('REACT_APP_VERSION', publicPrefixes)).toBe(true);
      expect(isPublicVariable('SECRET_KEY', publicPrefixes)).toBe(false);
      expect(isPublicVariable('DATABASE_URL', publicPrefixes)).toBe(false);
    });

    it('should handle empty prefixes array', () => {
      expect(isPublicVariable('NEXT_PUBLIC_API_URL', [])).toBe(false);
    });

    it('should be case sensitive', () => {
      const publicPrefixes = ['NEXT_PUBLIC_'];

      expect(isPublicVariable('next_public_api_url', publicPrefixes)).toBe(false);
      expect(isPublicVariable('NEXT_PUBLIC_API_URL', publicPrefixes)).toBe(true);
    });
  });

  describe('isValidEnvVarName', () => {
    it('should validate correct environment variable names', () => {
      expect(isValidEnvVarName('VALID_NAME')).toBe(true);
      expect(isValidEnvVarName('VALID123')).toBe(true);
      expect(isValidEnvVarName('_VALID')).toBe(true);
      expect(isValidEnvVarName('V')).toBe(true); // Single character
    });

    it('should reject invalid environment variable names', () => {
      expect(isValidEnvVarName('123INVALID')).toBe(false); // Starts with number
      expect(isValidEnvVarName('INVALID-NAME')).toBe(false); // Contains hyphen
      expect(isValidEnvVarName('INVALID.NAME')).toBe(false); // Contains dot
      expect(isValidEnvVarName('INVALID NAME')).toBe(false); // Contains space
      expect(isValidEnvVarName('')).toBe(false); // Empty string
      expect(isValidEnvVarName('INVALID@NAME')).toBe(false); // Contains special char
    });

    it('should handle edge cases', () => {
      expect(isValidEnvVarName('A_B_C_123')).toBe(true);
      expect(isValidEnvVarName('__VALID__')).toBe(true);
      expect(isValidEnvVarName('VALID___NAME')).toBe(true);
    });
  });

  describe('getRelativePath', () => {
    it('should return relative path from current working directory', () => {
      const absolutePath = process.cwd() + '/src/index.ts';
      const relativePath = getRelativePath(absolutePath);

      expect(relativePath).toBe('src/index.ts');
    });

    it('should handle paths outside current directory', () => {
      const absolutePath = '/some/other/path/file.ts';
      const relativePath = getRelativePath(absolutePath);

      // Should return the absolute path if not relative to cwd
      expect(relativePath).toContain('file.ts');
    });

    it('should handle current directory path', () => {
      const currentPath = process.cwd();
      const relativePath = getRelativePath(currentPath);

      expect(relativePath).toBe('.');
    });

    it('should normalize path separators', () => {
      const pathWithBackslashes = process.cwd() + '\\src\\index.ts';
      const relativePath = getRelativePath(pathWithBackslashes);

      // Should work on all platforms
      expect(relativePath.includes('src')).toBe(true);
      expect(relativePath.includes('index.ts')).toBe(true);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle undefined and null inputs gracefully', () => {
      expect(() => isValidEnvVarName(null as any)).not.toThrow();
      expect(() => isValidEnvVarName(undefined as any)).not.toThrow();
      expect(() => isPublicVariable(null as any, [])).not.toThrow();
      expect(() => getRelativePath(null as any)).not.toThrow();
    });

    it('should handle very long variable names', () => {
      const longName = 'A'.repeat(1000);
      expect(isValidEnvVarName(longName)).toBe(true);
    });

    it('should handle unicode characters in variable names', () => {
      expect(isValidEnvVarName('VALID_名前')).toBe(false); // Non-ASCII
      expect(isValidEnvVarName('VALID_émoji')).toBe(false); // Accented characters
    });
  });
});