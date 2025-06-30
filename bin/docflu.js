#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');
const { syncFile, syncDocs, syncBlog } = require('../lib/commands/sync');
const { syncGoogleDocs } = require('../lib/commands/sync_gdocs');
const { initProject } = require('../lib/commands/init');

const program = new Command();

// Read version from package.json
const packageJson = require('../package.json');

program
  .name('docflu')
  .description('CLI tool to sync Docusaurus documentation to Confluence and Google Docs with hierarchy, internal links, and diagram support')
  .version(packageJson.version);

program
  .command('sync [projectPath]')
  .description('Sync markdown content to Confluence or Google Docs')
  .option('-f, --file <path>', 'specific file to sync')
  .option('--docs', 'sync all documents in docs/ directory')
  .option('--blog', 'sync all blog posts in blog/ directory')
  .option('--gdocs', 'sync to Google Docs (requires OAuth2 authentication)')
  .option('--conflu', 'sync to Confluence (default)')
  .option('--dry-run', 'preview changes without syncing')
  .action(async (projectPath, options) => {
    try {
      let projectRoot;
      let filePath = options.file;

      // Handle different scenarios for project root and file path
      if (options.file) {
        if (projectPath) {
          // Case: docflu sync /project/path --file relative/file.md
          projectRoot = path.resolve(projectPath);
          // filePath is already set from options.file
        } else {
          // Case: docflu sync --file /absolute/path/to/file.md
          // Need to determine project root from file path
          const absoluteFilePath = path.resolve(options.file);
          
          // Try to find project root by looking for docusaurus.config.* or .env
          let currentDir = path.dirname(absoluteFilePath);
          let foundProjectRoot = null;
          
          while (currentDir !== path.dirname(currentDir)) { // Until we reach filesystem root
            const hasDocusaurusConfig = require('fs-extra').pathExistsSync(path.join(currentDir, 'docusaurus.config.ts')) ||
                                       require('fs-extra').pathExistsSync(path.join(currentDir, 'docusaurus.config.js'));
            const hasEnvFile = require('fs-extra').pathExistsSync(path.join(currentDir, '.env'));
            
            if (hasDocusaurusConfig || hasEnvFile) {
              foundProjectRoot = currentDir;
              break;
            }
            currentDir = path.dirname(currentDir);
          }
          
          projectRoot = foundProjectRoot || path.dirname(absoluteFilePath);
          filePath = path.relative(projectRoot, absoluteFilePath);
        }
      } else {
        // Case: docflu sync /project/path --docs/--blog
        projectRoot = projectPath ? path.resolve(projectPath) : process.cwd();
      }

      // Determine platform - default to Confluence for backward compatibility
      const platform = options.gdocs ? 'google-docs' : 'confluence';
      
      // Validate platform options
      if (options.gdocs && options.conflu) {
        console.log(chalk.red('❌ Cannot specify both --gdocs and --conflu. Choose one platform.'));
        process.exit(1);
      }

      if (options.file) {
        console.log(chalk.blue(`🚀 Syncing single file to ${platform}:`, filePath));
        console.log(chalk.gray('📂 Project root:', projectRoot));
        
        if (platform === 'google-docs') {
          await syncGoogleDocs('file', filePath, options.dryRun, projectRoot);
        } else {
          await syncFile(filePath, options.dryRun, projectRoot);
        }
      } else if (options.docs) {
        console.log(chalk.blue(`🚀 Syncing all docs/ to ${platform}`));
        console.log(chalk.gray('📂 Project root:', projectRoot));
        
        if (platform === 'google-docs') {
          await syncGoogleDocs('docs', null, options.dryRun, projectRoot);
        } else {
          await syncDocs(options.dryRun, projectRoot);
        }
      } else if (options.blog) {
        console.log(chalk.blue(`🚀 Syncing all blog/ to ${platform}`));
        console.log(chalk.gray('📂 Project root:', projectRoot));
        
        if (platform === 'google-docs') {
          await syncGoogleDocs('blog', null, options.dryRun, projectRoot);
        } else {
          await syncBlog(options.dryRun, projectRoot);
        }
      } else {
        console.log(chalk.red('❌ Please specify --file, --docs, or --blog option'));
        console.log('Examples:');
        console.log('  docflu sync --file docs/intro.md');
        console.log('  docflu sync --docs');
        console.log('  docflu sync --blog');
        console.log('  docflu sync --gdocs --docs  # Sync to Google Docs');
        console.log('  docflu sync --conflu --docs  # Sync to Confluence');
        console.log('  docflu sync ../docusaurus-exam --docs');
        console.log('  docflu sync /path/to/project --gdocs --blog');
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('❌ Error:', error.message));
      process.exit(1);
    }
  });

program
  .command('init [projectPath]')
  .description('Initialize DocFlu in current directory')
  .action(async (projectPath) => {
    try {
      // Determine project root - use provided path or current directory
      const projectRoot = projectPath ? path.resolve(projectPath) : process.cwd();
      console.log(chalk.gray('📂 Project root:', projectRoot));
      await initProject(projectRoot);
    } catch (error) {
      console.error(chalk.red('❌ Error:', error.message));
      process.exit(1);
    }
  });

program.parse(); 