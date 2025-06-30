const chalk = require('chalk');
const GoogleDocsClient = require('../core/gdocs/google-docs-client');
const GoogleDocsSync = require('../core/gdocs/google-docs-sync');

/**
 * Main Google Docs sync function
 * @param {string} type - 'file', 'docs', or 'blog'
 * @param {string} filePath - Path to specific file (for type='file')
 * @param {boolean} dryRun - Preview mode
 * @param {string} projectRoot - Project root directory
 */
async function syncGoogleDocs(type, filePath, dryRun = false, projectRoot = process.cwd()) {
  try {
    // Initialize Google Docs client
    console.log(chalk.blue('🚀 Setting up Google Docs client...'));
    const client = new GoogleDocsClient(projectRoot);
    
    // Initialize sync engine
    const syncEngine = new GoogleDocsSync(client, projectRoot);
    await syncEngine.initialize();
    
    let result;
    
    switch (type) {
      case 'file':
        if (!filePath) {
          throw new Error('File path is required for file sync');
        }
        result = await syncEngine.syncFile(filePath, { dryRun });
        break;
        
      case 'docs':
        result = await syncEngine.syncDocs({ dryRun });
        break;
        
      case 'blog':
        // Blog sync not implemented yet
        console.log(chalk.yellow('⚠️ Blog sync not yet implemented'));
        result = { success: false, message: 'Blog sync not implemented' };
        break;
        
      default:
        throw new Error(`Unknown sync type: ${type}`);
    }
    
    // Clean up resources
    await syncEngine.cleanup();
    
    return {
      success: result.success,
      platform: 'google-docs',
      type: type,
      stats: result.stats,
      url: result.url,
      dryRun: result.dryRun || false
    };
    
  } catch (error) {
    console.error(chalk.red('❌ Google Docs sync failed:', error.message));
    
    // Provide helpful error messages
    if (error.message.includes('GOOGLE_CLIENT_ID')) {
      console.log(chalk.yellow('\n💡 Setup Instructions:'));
      console.log('1. Go to Google Cloud Console: https://console.cloud.google.com/');
      console.log('2. Create a new project or select existing one');
      console.log('3. Enable Google Docs API');
      console.log('4. Create OAuth2 credentials (Desktop Application)');
      console.log('5. Add GOOGLE_CLIENT_ID to your .env file');
      console.log('6. Run: docflu init --gdocs');
    } else if (error.message.includes('OAuth2')) {
      console.log(chalk.yellow('\n💡 Authentication Help:'));
      console.log('• Make sure you have a valid Google account');
      console.log('• Check if port 8080 is available');
      console.log('• Try running: docflu auth --gdocs');
    } else if (error.message.includes('API')) {
      console.log(chalk.yellow('\n💡 API Help:'));
      console.log('• Check your internet connection');
      console.log('• Verify Google Docs API is enabled');
      console.log('• Check API quotas and limits');
    }
    
    throw error;
  }
}

/**
 * Sync specific file to Google Docs
 * @param {string} filePath - Path to markdown file
 * @param {boolean} dryRun - Preview mode
 * @param {string} projectRoot - Project root directory
 */
async function syncFileToGoogleDocs(filePath, dryRun = false, projectRoot = process.cwd()) {
  console.log(chalk.blue(`📄 Syncing file to Google Docs: ${filePath}`));
  
  // For now, delegate to main sync function
  return await syncGoogleDocs('file', filePath, dryRun, projectRoot);
}

/**
 * Sync all docs/ to Google Docs
 * @param {boolean} dryRun - Preview mode
 * @param {string} projectRoot - Project root directory
 */
async function syncDocsToGoogleDocs(dryRun = false, projectRoot = process.cwd()) {
  console.log(chalk.blue('📁 Syncing all docs/ to Google Docs'));
  
  // For now, delegate to main sync function
  return await syncGoogleDocs('docs', null, dryRun, projectRoot);
}

/**
 * Sync all blog/ to Google Docs
 * @param {boolean} dryRun - Preview mode
 * @param {string} projectRoot - Project root directory
 */
async function syncBlogToGoogleDocs(dryRun = false, projectRoot = process.cwd()) {
  console.log(chalk.blue('📝 Syncing all blog/ to Google Docs'));
  
  // For now, delegate to main sync function
  return await syncGoogleDocs('blog', null, dryRun, projectRoot);
}

module.exports = {
  syncGoogleDocs,
  syncFileToGoogleDocs,
  syncDocsToGoogleDocs,
  syncBlogToGoogleDocs,
}; 