const GoogleDocsClient = require('../lib/core/gdocs/google-docs-client');
const chalk = require('chalk');
const path = require('path');

async function testGoogleDocsClient() {
  console.log(chalk.blue('🧪 Testing Google Docs Client'));
  console.log(chalk.gray('================================'));

  try {
    // Test project root
    const projectRoot = path.join(__dirname, '..');
    console.log(chalk.gray(`📂 Project root: ${projectRoot}`));

    // Initialize client
    console.log(chalk.blue('\n1. Initializing Google Docs client...'));
    const client = new GoogleDocsClient(projectRoot);

    // Test configuration loading
    console.log(chalk.blue('\n2. Testing configuration loading...'));
    try {
      await client.loadConfig();
      console.log(chalk.green('✅ Configuration loaded successfully'));
      console.log(chalk.gray(`   Client ID: ${client.clientId ? client.clientId.substr(0, 20) + '...' : 'Not set'}`));
    } catch (error) {
      console.log(chalk.yellow('⚠️ Configuration not found:'), error.message);
      console.log(chalk.blue('💡 Run "docflu init" to create .env file'));
      return;
    }

    // Test PKCE generation
    console.log(chalk.blue('\n3. Testing PKCE generation...'));
    const pkce = client.generatePKCE();
    console.log(chalk.green('✅ PKCE parameters generated'));
    console.log(chalk.gray(`   Code verifier length: ${pkce.codeVerifier.length}`));
    console.log(chalk.gray(`   Code challenge length: ${pkce.codeChallenge.length}`));

    // Test token file paths
    console.log(chalk.blue('\n4. Testing file paths...'));
    console.log(chalk.gray(`   Tokens path: ${client.tokensPath}`));
    console.log(chalk.gray(`   Redirect URI: ${client.redirectUri}`));
    console.log(chalk.gray(`   Scopes: ${client.scopes.join(', ')}`));

    console.log(chalk.green('\n✅ Google Docs Client test completed successfully!'));
    console.log(chalk.blue('\n🚀 Next: Run "docflu sync --gdocs --docs --dry-run" to test OAuth2 flow'));

  } catch (error) {
    console.error(chalk.red('\n❌ Test failed:'), error.message);
    console.error(chalk.gray('Stack trace:'), error.stack);
  }
}

// Run test if called directly
if (require.main === module) {
  testGoogleDocsClient();
}

module.exports = { testGoogleDocsClient }; 