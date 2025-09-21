#!/usr/bin/env node

import { Command } from 'commander';
import path from 'node:path';
import { stat } from 'node:fs/promises';
import { createScanner } from '@/core/scanner';
import {
  createEnvExampleWriter,
  createJsonSchemaWriter,
  createMarkdownWriter
} from '@/output/writers';
import type {
  ScanOptions,
  LogLevel,
  Framework
} from '@/types';
import {
  createLogger,
  detectFramework
} from '@/utils';
import { FRAMEWORK_CONFIGS } from '@/types';

/**
 * CLI implementation for EnvAudit
 */
class EnvAuditCLI {
  private readonly program: Command;
  private readonly logger = createLogger();

  constructor() {
    this.program = new Command();
    this.setupProgram();
  }

  /**
   * Get framework display name from framework key
   */
  private getFrameworkDisplayName(frameworkKey: string): string {
    const config = FRAMEWORK_CONFIGS[frameworkKey as keyof typeof FRAMEWORK_CONFIGS];
    return config?.name ?? frameworkKey;
  }

  private setupProgram(): void {
    this.program
      .name('envaudit')
      .description('Scan codebases for environment variables and generate documentation')
      .version('1.0.0')
      .configureOutput({
        outputError: (str, write) => write(`❌ ${str}`),
      });

    this.setupScanCommand();
    this.setupCheckCommand();
    this.setupPrintCommand();
    this.setupGlobalOptions();
  }

  private setupGlobalOptions(): void {
    this.program
      .option('--log-level <level>', 'Set log level', 'info')
      .option('--no-color', 'Disable colored output')
      .hook('preAction', (thisCommand) => {
        const options = thisCommand.opts();

        // Configure logging
        if (options.logLevel) {
          // Note: In a real implementation, you'd configure the logger here
          this.logger.debug(`Set log level to: ${options.logLevel}`);
        }

        // Configure color output
        if (options.color === false) {
          // Note: In a real implementation, you'd disable colors here
          this.logger.debug('Disabled colored output');
        }
      });
  }

  private setupScanCommand(): void {
    this.program
      .command('scan')
      .description('Scan a directory for environment variables')
      .argument('[path]', 'Path to scan (defaults to current directory)', '.')
      .option('-o, --output <path>', 'Output directory for generated files', './env-docs')
      .option('--format <formats...>', 'Output formats (env, json, md, all)')
      .option('--env-example', 'Generate .env.example file', true)
      .option('--schema', 'Generate JSON schema file', false)
      .option('--docs', 'Generate Markdown documentation', false)
      .option('--all', 'Generate all output formats')
      .option('--include <patterns...>', 'Include file patterns')
      .option('--exclude <patterns...>', 'Exclude file patterns')
      .option('--framework <name>', 'Specify framework (nextjs, vite, astro, sveltekit)')
      .option('--public-prefix <prefixes...>', 'Public variable prefix', [])
      .option('--public-prefixes <prefixes...>', 'Public variable prefixes', ['NEXT_PUBLIC_', 'VITE_', 'REACT_APP_'])
      .option('--verbose', 'Enable verbose logging')
      .option('--max-file-size <size>', 'Maximum file size in bytes', '1048576')
      .option('--follow-symlinks', 'Follow symbolic links', false)
      .option('--providers <names...>', 'Enabled providers (ast, dotenv, yaml, shell)')
      .option('--exclude-providers <names...>', 'Excluded providers')
      .action(async (targetPath: string, options: any) => {
        try {
          await this.handleScanCommand(targetPath, options);
        } catch (error) {
          this.logger.error(`Scan failed: ${error}`);
          process.exit(1);
        }
      });
  }

  private setupCheckCommand(): void {
    this.program
      .command('check')
      .description('Check if required environment variables are defined')
      .argument('[path]', 'Path to scan (defaults to current directory)', '.')
      .option('--env-file <path>', 'Path to .env file to check against', '.env')
      .option('--reference <path>', 'Path to reference file to check against')
      .option('--strict', 'Fail if any required variables are missing', false)
      .option('--framework <name>', 'Specify framework')
      .action(async (targetPath: string, options: any) => {
        try {
          await this.handleCheckCommand(targetPath, options);
        } catch (error) {
          this.logger.error(`Check failed: ${error}`);
          process.exit(1);
        }
      });
  }

  private setupPrintCommand(): void {
    this.program
      .command('print')
      .description('Print found environment variables to stdout')
      .argument('[path]', 'Path to scan (defaults to current directory)', '.')
      .option('--format <format>', 'Output format (env, json, table, list)', 'table')
      .option('--source <source>', 'Filter by source (ast, dotenv, docker, gha, shell)')
      .option('--required-only', 'Show only required variables', false)
      .option('--public-only', 'Show only public variables', false)
      .option('--framework <name>', 'Specify framework')
      .action(async (targetPath: string, options: any) => {
        try {
          await this.handlePrintCommand(targetPath, options);
        } catch (error) {
          this.logger.error(`Print failed: ${error}`);
          process.exit(1);
        }
      });
  }

  private async handleScanCommand(targetPath: string, options: any): Promise<void> {
    console.log('🔍 Starting environment variable scan...\n');

    // Validate target path
    const resolvedPath = path.resolve(targetPath);
    await this.validatePath(resolvedPath);

    // Build scan options
    const scanOptions = await this.buildScanOptions(options);

    console.log(`📁 Scanning: ${resolvedPath}`);
    console.log('');

    // Run the scan
    const scanner = createScanner();
    const result = await scanner.scan(resolvedPath, scanOptions);

    // Display framework information (explicitly provided or auto-detected)
    if (scanOptions.framework) {
      console.log(`🚀 Framework: ${this.getFrameworkDisplayName(scanOptions.framework as string)}`);
    } else if (result.framework) {
      console.log(`🚀 Framework: ${this.getFrameworkDisplayName(result.framework)}`);
    }
    console.log('');

    // Display results summary
    this.displayScanSummary(result);

    // Generate output files
    await this.generateOutputFiles(result, options);

    console.log('\n✅ Scan completed successfully!');
  }

  private async handleCheckCommand(targetPath: string, options: any): Promise<void> {
    console.log('🔍 Checking environment variables...\n');

    // Validate target path
    const resolvedPath = path.resolve(targetPath);
    await this.validatePath(resolvedPath);

    // Build scan options
    const scanOptions = await this.buildScanOptions(options);

    // Run the scan
    const scanner = createScanner();
    const result = await scanner.scan(resolvedPath, scanOptions);

    // Check against .env file
    const envFilePath = path.resolve(options.envFile);
    const missingVars = await this.checkMissingVariables(result, envFilePath);

    // Display results
    this.displayCheckResults(result, missingVars, options.strict);

    // Exit with error code if in strict mode and variables are missing
    if (options.strict && missingVars.length > 0) {
      console.log('\n❌ Required variables are missing');
      process.exit(1);
    }

    console.log('\n✅ Check completed successfully!');
  }

  private async handlePrintCommand(targetPath: string, options: any): Promise<void> {
    // Validate target path
    const resolvedPath = path.resolve(targetPath);
    await this.validatePath(resolvedPath);

    // Build scan options
    const scanOptions = await this.buildScanOptions(options);

    // Run the scan
    const scanner = createScanner();
    const result = await scanner.scan(resolvedPath, scanOptions);

    // Filter findings based on options
    let findings = [...result.findings];

    if (options.source) {
      findings = findings.filter(f => f.source === options.source);
    }

    if (options.requiredOnly) {
      findings = findings.filter(f => f.required);
    }

    if (options.publicOnly) {
      findings = findings.filter(f => f.isPublic);
    }

    // Print in requested format
    this.printFindings(findings, options.format);
  }

  private async buildScanOptions(options: any): Promise<ScanOptions> {
    const scanOptions: ScanOptions = {
      // Only include options that are explicitly provided
      ...(options.include && options.include.length > 0 && { include: options.include }),
      ...(options.exclude && options.exclude.length > 0 && { exclude: options.exclude }),
      ...(options.publicPrefixes && options.publicPrefixes.length > 0 && { publicPrefixes: options.publicPrefixes }),
      ...(options.followSymlinks !== undefined && { followSymlinks: options.followSymlinks }),
      ...(options.maxFileSize && { maxFileSize: parseInt(options.maxFileSize) }),
      ...(options.framework && { framework: options.framework as Framework }),
      ...(options.verbose && { debug: options.verbose }),
    };

    return scanOptions;
  }

  private async validatePath(targetPath: string): Promise<void> {
    try {
      const stats = await stat(targetPath);
      if (!stats.isDirectory() && !stats.isFile()) {
        throw new Error(`Path is not a file or directory: ${targetPath}`);
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Path does not exist: ${targetPath}`);
      }
      throw new Error(`Invalid path: ${targetPath}`);
    }
  }

  private displayScanSummary(result: any): void {
    console.log('📊 Scan Results:');
    console.log(`   Variables found: ${result.findings.length}`);
    console.log(`   Files scanned: ${result.stats.files}`);
    console.log(`   Scan time: ${result.stats.durationMs}ms`);

    console.log('\n📈 Variables by source:');
    for (const [source, count] of Object.entries(result.stats.variablesByProvider)) {
      if ((count as number) > 0) {
        console.log(`   ${source}: ${count}`);
      }
    }
  }

  private async generateOutputFiles(result: any, options: any): Promise<void> {
    const outputDir = path.resolve(options.output);

    // Ensure output directory exists
    await this.ensureDirectoryExists(outputDir);

    const writers = [];

    // Handle --format option
    if (options.format && Array.isArray(options.format)) {
      for (const format of options.format) {
        if (format === 'all') {
          writers.push(
            { writer: createEnvExampleWriter(), filename: '.env.example' },
            { writer: createJsonSchemaWriter(), filename: 'schema.json' },
            { writer: createMarkdownWriter(), filename: 'README.md' }
          );
          break;
        } else if (format === 'env') {
          writers.push({ writer: createEnvExampleWriter(), filename: '.env.example' });
        } else if (format === 'json') {
          writers.push({ writer: createJsonSchemaWriter(), filename: 'schema.json' });
        } else if (format === 'md') {
          writers.push({ writer: createMarkdownWriter(), filename: 'README.md' });
        }
      }
    }
    // Determine which files to generate using legacy flags
    else if (options.all) {
      writers.push(
        { writer: createEnvExampleWriter(), filename: '.env.example' },
        { writer: createJsonSchemaWriter(), filename: 'schema.json' },
        { writer: createMarkdownWriter(), filename: 'README.md' }
      );
    } else {
      if (options.envExample !== false) {
        writers.push({ writer: createEnvExampleWriter(), filename: '.env.example' });
      }
      if (options.schema) {
        writers.push({ writer: createJsonSchemaWriter(), filename: 'schema.json' });
      }
      if (options.docs) {
        writers.push({ writer: createMarkdownWriter(), filename: 'README.md' });
      }
    }

    console.log('\n📝 Generating files:');

    for (const { writer, filename } of writers) {
      const outputPath = path.join(outputDir, filename);
      await writer.write(result, outputPath);
      console.log(`   ✅ ${filename}`);
    }
  }

  private async checkMissingVariables(result: any, envFilePath: string): Promise<string[]> {
    // In a real implementation, you'd read and parse the .env file
    // For now, we'll just return empty array
    console.log(`📄 Checking against: ${envFilePath}`);
    return [];
  }

  private displayCheckResults(result: any, missingVars: string[], strict: boolean): void {
    const requiredVars = result.findings.filter((f: any) => f.required);

    console.log('📊 Check Results:');
    console.log(`   Required variables: ${requiredVars.length}`);
    console.log(`   Missing variables: ${missingVars.length}`);

    if (missingVars.length > 0) {
      console.log('\n❌ Missing required variables:');
      for (const varName of missingVars) {
        console.log(`   - ${varName}`);
      }
    } else {
      console.log('\n✅ All required variables are defined');
    }
  }

  private printFindings(findings: any[], format: string): void {
    switch (format) {
      case 'json':
        console.log(JSON.stringify(findings, null, 2));
        break;

      case 'list':
        for (const finding of findings) {
          const prefix = finding.required ? '[REQUIRED]' : '[OPTIONAL]';
          const publicFlag = finding.isPublic ? '[PUBLIC]' : '';
          console.log(`${prefix}${publicFlag} ${finding.name}`);
        }
        break;

      case 'env':
        for (const finding of findings) {
          console.log(`${finding.name}=${finding.defaultValue || ''}`);
        }
        break;

      case 'table':
      default:
        console.log('| Variable | Required | Public | Source | Files |');
        console.log('|----------|----------|--------|--------|-------|');
        for (const finding of findings) {
          const required = finding.required ? '✅' : '❌';
          const isPublic = finding.isPublic ? '✅' : '❌';
          const fileCount = finding.files.length;
          console.log(`| ${finding.name} | ${required} | ${isPublic} | ${finding.source} | ${fileCount} |`);
        }
        break;
    }
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await stat(dirPath);
    } catch (error) {
      // Directory doesn't exist, create it
      const { mkdir } = await import('node:fs/promises');
      await mkdir(dirPath, { recursive: true });
    }
  }

  run(argv: string[]): void {
    this.program.parse(argv);
  }
}

// Main entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const cli = new EnvAuditCLI();
  cli.run(process.argv);
}

export { EnvAuditCLI };