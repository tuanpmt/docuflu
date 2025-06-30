const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');

/**
 * Initialize DocFlu in current directory
 * Creates .env file with template configuration
 * @param {string} projectRoot - project root directory (optional, defaults to process.cwd())
 */
async function initProject(projectRoot = null) {
  const spinner = ora('Initializing DocFlu...').start();

  try {
    // Determine project root
    const resolvedProjectRoot = projectRoot || process.cwd();
    const envPath = path.join(resolvedProjectRoot, '.env');
    const envExamplePath = path.join(__dirname, '../../env.example');

    // Check if already initialized
    if (await fs.pathExists(envPath)) {
      spinner.warn('Project already initialized');
      console.log(chalk.yellow('⚠️ .env file already exists'));
      console.log(chalk.blue('💡 Edit .env to update your configuration'));
      return { success: true, action: 'already_exists' };
    }

    // Check if Docusaurus project
    const docusaurusConfig = path.join(resolvedProjectRoot, 'docusaurus.config.ts');
    const docusaurusConfigJs = path.join(resolvedProjectRoot, 'docusaurus.config.js');
    const isDocusaurus = await fs.pathExists(docusaurusConfig) || await fs.pathExists(docusaurusConfigJs);

    if (!isDocusaurus) {
      spinner.warn('Not a Docusaurus project');
      console.log(chalk.yellow('⚠️ This doesn\'t appear to be a Docusaurus project'));
      console.log(chalk.blue('💡 DocFlu works best with Docusaurus projects that have:'));
      console.log(chalk.gray('   - docusaurus.config.ts or docusaurus.config.js'));
      console.log(chalk.gray('   - docs/ directory'));
      console.log(chalk.blue('🤔 Continue anyway? The .env file will still be created.'));
    }

    // Copy env.example to .env
    spinner.text = 'Creating .env configuration file...';

    if (await fs.pathExists(envExamplePath)) {
      await fs.copy(envExamplePath, envPath);
    } else {
      // Fallback: create .env template manually
      const envTemplate = `# Confluence Configuration
CONFLUENCE_BASE_URL=https://your-domain.atlassian.net
CONFLUENCE_USERNAME=your-email@domain.com
CONFLUENCE_API_TOKEN=your-api-token
CONFLUENCE_SPACE_KEY=DOC
CONFLUENCE_ROOT_PAGE_TITLE=Documentation

# Optional Settings
DOCFLU_EXCLUDE_PATTERNS=*.draft.md,private/**
DOCFLU_CONCURRENT_UPLOADS=5
DOCFLU_RETRY_COUNT=3
`;
      await fs.writeFile(envPath, envTemplate, 'utf8');
    }

    spinner.succeed('DocFlu initialized successfully');

    console.log(chalk.green('\n✅ SUCCESS:'));
    console.log(chalk.white('Created:'), '.env configuration file');

    console.log(chalk.cyan('\n📋 NEXT STEPS:'));
    
    console.log(chalk.white('1. For Confluence sync - Edit .env file with your Confluence credentials:'));
    console.log(chalk.gray('   - CONFLUENCE_BASE_URL: Your Atlassian domain'));
    console.log(chalk.gray('   - CONFLUENCE_USERNAME: Your email address'));
    console.log(chalk.gray('   - CONFLUENCE_API_TOKEN: Generate at https://id.atlassian.com/manage-profile/security/api-tokens'));
    console.log(chalk.gray('   - CONFLUENCE_SPACE_KEY: Target space key'));

    console.log(chalk.white('\n2. For Google Docs sync - Setup OAuth2 credentials:'));
    console.log(chalk.gray('   - Go to Google Cloud Console: https://console.cloud.google.com/'));
    console.log(chalk.gray('   - Create project → Enable Google Docs API → Create OAuth2 credentials'));
    console.log(chalk.gray('   - Add GOOGLE_CLIENT_ID to .env file'));
    console.log(chalk.gray('   - No client secret needed (PKCE flow)'));

    console.log(chalk.white('\n3. Test your configuration:'));
    console.log(chalk.blue('   docflu sync --conflu --docs --dry-run  # Test Confluence'));
    console.log(chalk.blue('   docflu sync --gdocs --docs --dry-run   # Test Google Docs'));

    console.log(chalk.white('\n4. Perform your first sync:'));
    console.log(chalk.blue('   docflu sync --docs                     # Default: Confluence'));
    console.log(chalk.blue('   docflu sync --gdocs --docs             # Google Docs'));

    console.log(chalk.yellow('\n💡 TIP: Use --dry-run flag to preview changes before syncing'));

    return {
      success: true,
      action: 'created',
      envPath: envPath
    };

  } catch (error) {
    spinner.fail('Initialization failed');

    console.error(chalk.red('\n❌ ERROR:'));
    console.error(chalk.white('Message:'), error.message);

    if (error.code === 'EACCES') {
      console.log(chalk.yellow('\n💡 Permission denied. Try running with sudo or check directory permissions.'));
    }

    throw error;
  }
}

module.exports = { initProject };
