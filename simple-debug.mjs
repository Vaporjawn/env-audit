import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';

// Fix ESM import for traverse
const traverseFunction = traverse.default || traverse;

const code = 'const dbUrl = process.env.DATABASE_URL;';

console.log('Code:', code);

try {
  const ast = parse(code, {
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
      'typescript',
    ],
  });

  console.log('AST parsed successfully');
  console.log('AST type:', ast.type);

  let memberCount = 0;
  let variableCount = 0;

  traverseFunction(ast, {
    MemberExpression: (path) => {
      memberCount++;
      const { node } = path;
      console.log(`MemberExpression ${memberCount}:`);
      console.log('  object type:', node.object.type);
      console.log('  property type:', node.property.type);

      if (t.isIdentifier(node.object)) {
        console.log('  object.name:', node.object.name);
      }
      if (t.isMemberExpression(node.object)) {
        console.log('  object is MemberExpression');
        if (t.isIdentifier(node.object.object)) {
          console.log('    object.object.name:', node.object.object.name);
        }
        if (t.isIdentifier(node.object.property)) {
          console.log('    object.property.name:', node.object.property.name);
        }
      }

      if (t.isIdentifier(node.property)) {
        console.log('  property.name:', node.property.name);
      }
    },

    VariableDeclarator: (path) => {
      variableCount++;
      console.log(`VariableDeclarator ${variableCount}:`);
      console.log('  id type:', path.node.id.type);
      console.log('  init type:', path.node.init?.type);
    },
  });

  console.log(`\nTotal MemberExpressions: ${memberCount}`);
  console.log(`Total VariableDeclarators: ${variableCount}`);

} catch (error) {
  console.error('Parse error:', error);
}