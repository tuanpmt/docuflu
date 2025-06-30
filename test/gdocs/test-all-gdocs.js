const chalk = require('chalk');
const { testGoogleDocsConverter } = require('./test-converter');
const { testGoogleDocsSync } = require('./test-sync');

async function runAllGoogleDocsTests() {
  console.log(chalk.blue('🧪 Running All Google Docs Tests'));
  console.log(chalk.gray('====================================='));
  
  let totalTestSuites = 0;
  let passedTestSuites = 0;
  
  // Test 1: Google Docs Converter
  totalTestSuites++;
  console.log(chalk.blue('\n📝 Test Suite 1: Google Docs Converter'));
  console.log(chalk.gray('---------------------------------------'));
  try {
    const converterResult = await testGoogleDocsConverter();
    if (converterResult) {
      passedTestSuites++;
      console.log(chalk.green('✅ Google Docs Converter tests passed'));
    } else {
      console.log(chalk.red('❌ Google Docs Converter tests failed'));
    }
  } catch (error) {
    console.log(chalk.red('❌ Google Docs Converter tests error:', error.message));
  }
  
  // Test 2: Google Docs Sync Engine
  totalTestSuites++;
  console.log(chalk.blue('\n🔄 Test Suite 2: Google Docs Sync Engine'));
  console.log(chalk.gray('------------------------------------------'));
  try {
    const syncResult = await testGoogleDocsSync();
    if (syncResult) {
      passedTestSuites++;
      console.log(chalk.green('✅ Google Docs Sync Engine tests passed'));
    } else {
      console.log(chalk.red('❌ Google Docs Sync Engine tests failed'));
    }
  } catch (error) {
    console.log(chalk.red('❌ Google Docs Sync Engine tests error:', error.message));
  }
  
  // Summary
  console.log(chalk.blue('\n📊 Overall Test Results'));
  console.log(chalk.gray('========================'));
  console.log(chalk.cyan(`Test suites passed: ${passedTestSuites}/${totalTestSuites}`));
  
  if (passedTestSuites === totalTestSuites) {
    console.log(chalk.green('🎉 All Google Docs test suites passed!'));
    console.log(chalk.blue('\n✅ Google Docs Phase 2 Implementation Status:'));
    console.log(chalk.green('• ✅ Markdown to Google Docs conversion'));
    console.log(chalk.green('• ✅ State management for incremental sync'));
    console.log(chalk.green('• ✅ Docusaurus project scanning'));
    console.log(chalk.green('• ✅ Content processing (text, code, lists)'));
    console.log(chalk.green('• ✅ Dry run mode support'));
    console.log(chalk.green('• ✅ Error handling and cleanup'));
    console.log(chalk.yellow('• ⚠️  Image/diagram upload (placeholder implementation)'));
    console.log(chalk.yellow('• ⚠️  Tab hierarchy (planned for Phase 3)'));
    
    return true;
  } else {
    console.log(chalk.red(`❌ ${totalTestSuites - passedTestSuites} test suites failed`));
    return false;
  }
}

// Run if called directly
if (require.main === module) {
  runAllGoogleDocsTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error(chalk.red('Test runner error:', error.message));
      process.exit(1);
    });
}

module.exports = { runAllGoogleDocsTests }; 