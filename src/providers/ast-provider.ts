import { parse } from '@babel/parser';
import traverse, { type NodePath } from '@babel/traverse';
import type {
  Node,
  MemberExpression,
  Identifier,
  StringLiteral,
  CallExpression,
  ObjectExpression,
  Property,
  VariableDeclarator,
  AssignmentExpression,
} from '@babel/types';
import * as t from '@babel/types';
import type {
  Provider,
  Finding,
  ScanOptions,
  EnvVarNode,
  Source,
} from '@/types';
import { ParseError } from '@/types';
import {
  createFinding,
  createFileRef,
  isPublicVariable,
  extractEnvVarName,
  createLogger,
  getRelativePath,
  readFileSafe
} from '@/utils';

/**
 * AST-based provider for JavaScript/TypeScript files
 */
export class AstProvider implements Provider {
  readonly name = 'ast';
  readonly source: Source = 'ast';
  readonly extensions = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.vue', '.svelte', '.astro'] as const;

  private readonly logger = createLogger();

  async scan(files: readonly string[], options: ScanOptions): Promise<readonly Finding[]> {
    const findings: Finding[] = [];
    const mergedOptions = options; // Already merged in the caller

    // Filter files by supported extensions
    const supportedFiles = files.filter(file =>
      this.extensions.some(ext => file.endsWith(ext))
    );

    this.logger.debug(`AST provider scanning ${supportedFiles.length} files (filtered from ${files.length} total)`);

    for (const file of supportedFiles) {
      try {
        const fileFindings = await this.scanFile(file, mergedOptions);
        findings.push(...fileFindings);
      } catch (error) {
        this.logger.debug(`Error scanning file ${file}: ${error}`);

        if (error instanceof ParseError) {
          // Continue with other files on parse errors
          continue;
        }

        // Re-throw other types of errors
        throw error;
      }
    }

    this.logger.info(`AST provider found ${findings.length} environment variables`);
    return Object.freeze(findings);
  }

  private async scanFile(filePath: string, options: ScanOptions): Promise<readonly Finding[]> {
    const content = await readFileSafe(filePath, options.maxFileSize ?? 1024 * 1024);
    if (!content) {
      this.logger.debug(`Skipping file (empty or too large): ${filePath}`);
      return [];
    }

    try {
      const ast = this.parseCode(content, filePath);
      const envNodes = this.extractEnvVariables(ast, filePath);
      const findings = this.convertNodesToFindings(envNodes, filePath, options);
      return findings;
    } catch (error) {
      throw new ParseError(
        `Failed to parse file: ${error}`,
        filePath,
        this.extractLineNumber(error)
      );
    }
  }

  private parseCode(content: string, filePath: string): Node {
    const isTypeScript = /\.tsx?$/.test(filePath);
    const isJSX = /\.(jsx|tsx)$/.test(filePath);

    return parse(content, {
      sourceType: 'module',
      allowImportExportEverywhere: true,
      allowReturnOutsideFunction: true,
      plugins: [
        'asyncGenerators',
        'bigInt',
        'classProperties',
        'decorators-legacy',
        'doExpressions',
        'dynamicImport',
        'exportDefaultFrom',
        'exportNamespaceFrom',
        'functionBind',
        'functionSent',
        'importMeta',
        'nullishCoalescingOperator',
        'numericSeparator',
        'objectRestSpread',
        'optionalCatchBinding',
        'optionalChaining',
        'throwExpressions',
        'topLevelAwait',
        ...(isTypeScript ? ['typescript' as const] : []),
        ...(isJSX ? ['jsx' as const] : []),
      ],
    });
  }

  private extractEnvVariables(ast: Node, filePath: string): EnvVarNode[] {
    const envNodes: EnvVarNode[] = [];

    try {
      const traverseFunction = (traverse as any).default || traverse;

      traverseFunction(ast, {
        // Handle process.env.VAR_NAME and import.meta.env.VAR_NAME
        MemberExpression: (path: NodePath<MemberExpression>) => {
          const processNode = this.analyzeProcessEnvAccess(path);
          if (processNode) {
            envNodes.push(processNode);
            return;
          }

          const importMetaNode = this.analyzeImportMetaEnvAccess(path);
          if (importMetaNode) {
            envNodes.push(importMetaNode);
          }
        },

        // Handle destructuring: const { VAR_NAME } = process.env
        VariableDeclarator: (path: NodePath<VariableDeclarator>) => {
          const nodes = this.analyzeDestructuring(path);
          envNodes.push(...nodes);
        },
      });
    } catch (error) {
      throw error;
    }

    return envNodes;
  }

  private analyzeProcessEnvAccess(path: NodePath<MemberExpression>): EnvVarNode | null {
    const { node } = path;

    // Check for process.env.VARIABLE (direct property access)
    if (
      t.isMemberExpression(node.object) &&
      t.isIdentifier(node.object.object) &&
      node.object.object.name === 'process' &&
      t.isIdentifier(node.object.property) &&
      node.object.property.name === 'env'
    ) {
      if (t.isIdentifier(node.property)) {
        return this.createEnvVarNode(
          node.property.name,
          'ast',
          path,
          this.analyzeUsageContext(path)
        );
      }

      if (t.isStringLiteral(node.property)) {
        return this.createEnvVarNode(
          node.property.value,
          'ast',
          path,
          this.analyzeUsageContext(path)
        );
      }
    }

    // Check for process.env['VARIABLE'] (bracket notation)
    if (
      t.isMemberExpression(node.object) &&
      t.isIdentifier(node.object.object) &&
      node.object.object.name === 'process' &&
      t.isIdentifier(node.object.property) &&
      node.object.property.name === 'env' &&
      t.isStringLiteral(node.property)
    ) {
      return this.createEnvVarNode(
        node.property.value,
        'ast',
        path,
        this.analyzeUsageContext(path)
      );
    }

    return null;
  }

  private analyzeImportMetaEnvAccess(path: NodePath<MemberExpression>): EnvVarNode | null {
    const { node } = path;

    // Look for import.meta.env.VARIABLE pattern
    if (
      t.isMemberExpression(node.object) &&
      t.isMetaProperty(node.object.object) &&
      t.isIdentifier(node.object.property) &&
      node.object.property.name === 'env'
    ) {
      const metaProperty = node.object.object;
      if (
        t.isIdentifier(metaProperty.meta) &&
        metaProperty.meta.name === 'import' &&
        t.isIdentifier(metaProperty.property) &&
        metaProperty.property.name === 'meta'
      ) {
        if (t.isIdentifier(node.property)) {
          return this.createEnvVarNode(
            node.property.name,
            'importmeta',
            path,
            this.analyzeUsageContext(path)
          );
        }

        if (t.isStringLiteral(node.property)) {
          return this.createEnvVarNode(
            node.property.value,
            'importmeta',
            path,
            this.analyzeUsageContext(path)
          );
        }
      }
    }

    return null;
  }

  private analyzeDestructuring(path: NodePath<VariableDeclarator>): EnvVarNode[] {
    const { node } = path;
    const nodes: EnvVarNode[] = [];

    if (!t.isObjectPattern(node.id)) {
      return nodes;
    }

    // Check if destructuring from process.env
    let source: Source | null = null;
    if (
      t.isMemberExpression(node.init) &&
      t.isIdentifier(node.init.object) &&
      node.init.object.name === 'process' &&
      t.isIdentifier(node.init.property) &&
      node.init.property.name === 'env'
    ) {
      source = 'ast';
    }

    // Check if destructuring from import.meta.env
    if (
      t.isMemberExpression(node.init) &&
      t.isMetaProperty(node.init.object) &&
      node.init.object.meta.name === 'import' &&
      node.init.object.property.name === 'meta' &&
      t.isIdentifier(node.init.property) &&
      node.init.property.name === 'env'
    ) {
      source = 'importmeta';
    }

    if (!source) {
      return nodes;
    }

    // Extract destructured variables
    for (const prop of node.id.properties) {
      if (t.isObjectProperty(prop) && t.isAssignmentPattern(prop.value) && t.isIdentifier(prop.key)) {
        // Destructuring with default: { VAR_NAME = 'default' }
        const defaultValue = t.isStringLiteral(prop.value.right) ? prop.value.right.value : undefined;
        const contextOptions = defaultValue ?
          { hasGuards: true, defaultValue } :
          { hasGuards: false };
        nodes.push(this.createEnvVarNode(
          prop.key.name,
          source,
          path,
          contextOptions
        ));
      } else if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
        // Regular destructuring: { VAR_NAME }
        nodes.push(this.createEnvVarNode(
          prop.key.name,
          source,
          path,
          { hasGuards: false }
        ));
      }
    }

    return nodes;
  }

  private analyzeUsageContext(path: NodePath): { hasGuards: boolean; defaultValue?: string } {
    // Check for guards like process.env.VAR || 'default'
    let hasGuards = false;
    let defaultValue: string | undefined;

    // Ensure path has a parent before accessing it
    if (!path.parent) {
      return { hasGuards: false };
    }

    // Look for logical OR expressions
    if (t.isLogicalExpression(path.parent) && path.parent.operator === '||') {
      hasGuards = true;
      if (t.isStringLiteral(path.parent.right)) {
        defaultValue = path.parent.right.value;
      }
    }

    // Look for conditional expressions (ternary)
    if (t.isConditionalExpression(path.parent)) {
      hasGuards = true;
    }

    // Look for nullish coalescing
    if (t.isLogicalExpression(path.parent) && path.parent.operator === '??') {
      hasGuards = true;
      if (t.isStringLiteral(path.parent.right)) {
        defaultValue = path.parent.right.value;
      }
    }

    // Look for if statements
    let currentPath = path;
    while (currentPath.parent && currentPath.parentPath) {
      if (t.isIfStatement(currentPath.parent) && currentPath.parent.test === currentPath.node) {
        hasGuards = true;
        break;
      }
      currentPath = currentPath.parentPath as NodePath;
    }

    return {
      hasGuards,
      ...(defaultValue && { defaultValue })
    };
  }

  private createEnvVarNode(
    name: string,
    source: Source,
    path: NodePath,
    context: { hasGuards: boolean; defaultValue?: string }
  ): EnvVarNode {
    const location = path.node.loc || {
      start: { line: 1, column: 0 },
      end: { line: 1, column: 0 }
    };

    return {
      name,
      source,
      location: {
        start: { line: location.start.line, column: location.start.column },
        end: { line: location.end.line, column: location.end.column }
      },
      hasGuards: context.hasGuards,
      ...(context.defaultValue && { defaultValue: context.defaultValue }),
    };
  }

  private convertNodesToFindings(
    nodes: EnvVarNode[],
    filePath: string,
    options: ScanOptions
  ): readonly Finding[] {
    const findingsMap = new Map<string, Finding>();

    // Get framework config for public prefixes
    const publicPrefixes = options.publicPrefixes ?? [];

    for (const node of nodes) {
      const key = `${node.source}:${node.name}`;
      const existing = findingsMap.get(key);

      const fileRef = createFileRef(
        filePath,
        node.location.start.line,
        node.location.start.column,
        node.context
      );

      if (existing) {
        // Merge with existing finding
        const updatedFinding = createFinding(
          node.name,
          node.source,
          [...existing.files, fileRef],
          {
            required: existing.required && !node.hasGuards,
            ...(existing.defaultValue || node.defaultValue ? {
              defaultValue: existing.defaultValue ?? node.defaultValue
            } : {}),
            isPublic: existing.isPublic || isPublicVariable(node.name, publicPrefixes),
          }
        );
        findingsMap.set(key, updatedFinding);
      } else {
        // Create new finding
        const finding = createFinding(
          node.name,
          node.source,
          [fileRef],
          {
            required: !node.hasGuards,
            ...(node.defaultValue ? { defaultValue: node.defaultValue } : {}),
            isPublic: isPublicVariable(node.name, publicPrefixes),
          }
        );
        findingsMap.set(key, finding);
      }
    }

    return Object.freeze([...findingsMap.values()]);
  }

  private extractLineNumber(error: unknown): number | undefined {
    if (error && typeof error === 'object' && 'loc' in error) {
      const loc = (error as any).loc;
      if (loc && typeof loc.line === 'number') {
        return loc.line;
      }
    }
    return undefined;
  }
}

/**
 * Create an AST provider instance
 */
export const createAstProvider = (): Provider => {
  return new AstProvider();
};