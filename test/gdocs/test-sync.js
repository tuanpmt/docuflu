const GoogleDocsSync = require('../../lib/core/gdocs/google-docs-sync');
const GoogleDocsState = require('../../lib/core/gdocs/google-docs-state');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs-extra');

// Mock Google Docs Client
class MockGoogleDocsClient {
  constructor() {
    this.documents = new Map();
    this.nextDocId = 1;
  }

  async initialize() {
    console.log(chalk.gray('   📱 Mock Google Docs client initialized'));
    return true;
  }

  async createDocument(title = 'Documentation') {
    const documentId = `mock-doc-${this.nextDocId++}`;
    const document = {
      documentId,
      title,
      url: `https://docs.google.com/document/d/${documentId}`,
      revisionId: 'mock-revision-1',
      content: ''
    };
    
    this.documents.set(documentId, document);
    console.log(chalk.gray(`   📄 Mock document created: ${title} (${documentId})`));
    
    return document;
  }

  async getDocument(documentId) {
    const document = this.documents.get(documentId);
    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }
    return document;
  }

  // Mock docs API
  get docs() {
    return {
      documents: {
        batchUpdate: async ({ documentId, requestBody }) => {
          const document = this.documents.get(documentId);
          if (!document) {
            throw new Error(`Document ${documentId} not found`);
          }
          
          console.log(chalk.gray(`   📝 Mock batch update: ${requestBody.requests.length} requests`));
          return { data: { replies: [] } };
        }
      }
    };
  }
}

async function testGoogleDocsSync() {
  console.log(chalk.blue('🧪 Testing Google Docs Sync Engine'));
  console.log(chalk.gray('===================================='));

  let testsPassed = 0;
  let totalTests = 0;

  // Setup test environment
  const testProjectRoot = path.join(__dirname, '..', 'sample-docs');
  const mockClient = new MockGoogleDocsClient();
  const syncEngine = new GoogleDocsSync(mockClient, testProjectRoot);

  // Test 1: Initialize sync engine
  totalTests++;
  try {
    console.log(chalk.blue('\n1. Testing sync engine initialization...'));
    await syncEngine.initialize();
    
    console.log(chalk.green('   ✅ Sync engine initialization test passed'));
    testsPassed++;
  } catch (error) {
    console.log(chalk.red('   ❌ Sync engine initialization test error:', error.message));
  }

  // Test 2: Test state management
  totalTests++;
  try {
    console.log(chalk.blue('\n2. Testing state management...'));
    
    const state = syncEngine.state;
    const summary = state.getSummary();
    
    console.log(chalk.gray(`   State file: ${state.stateFile}`));
    console.log(chalk.gray(`   Total documents: ${summary.totalDocuments}`));
    
    console.log(chalk.green('   ✅ State management test passed'));
    testsPassed++;
  } catch (error) {
    console.log(chalk.red('   ❌ State management test error:', error.message));
  }

  // Test 3: Test root document creation
  totalTests++;
  try {
    console.log(chalk.blue('\n3. Testing root document creation...'));
    
    const rootDocument = await syncEngine.ensureRootDocument();
    
    console.log(chalk.gray(`   Document ID: ${rootDocument.documentId}`));
    console.log(chalk.gray(`   Document URL: ${rootDocument.url}`));
    
    if (rootDocument.documentId && rootDocument.url) {
      console.log(chalk.green('   ✅ Root document creation test passed'));
      testsPassed++;
    } else {
      console.log(chalk.red('   ❌ Root document creation test failed'));
    }
  } catch (error) {
    console.log(chalk.red('   ❌ Root document creation test error:', error.message));
  }

  // Test 4: Test content detection
  totalTests++;
  try {
    console.log(chalk.blue('\n4. Testing content detection...'));
    
    const diagramContent = '```mermaid\ngraph TD;\n  A-->B;\n```';
    const imageContent = '![Image](test.png)';
    const normalContent = 'This is normal text.';
    
    const hasDiagrams = syncEngine.containsDiagrams(diagramContent);
    const hasImages = syncEngine.containsImages(imageContent);
    const hasNormalOnly = !syncEngine.containsDiagrams(normalContent) && !syncEngine.containsImages(normalContent);
    
    console.log(chalk.gray(`   Diagram detection: ${hasDiagrams}`));
    console.log(chalk.gray(`   Image detection: ${hasImages}`));
    console.log(chalk.gray(`   Normal content: ${hasNormalOnly}`));
    
    if (hasDiagrams && hasImages && hasNormalOnly) {
      console.log(chalk.green('   ✅ Content detection test passed'));
      testsPassed++;
    } else {
      console.log(chalk.red('   ❌ Content detection test failed'));
    }
  } catch (error) {
    console.log(chalk.red('   ❌ Content detection test error:', error.message));
  }

  // Test 5: Test dry run mode
  totalTests++;
  try {
    console.log(chalk.blue('\n5. Testing dry run mode...'));
    
    // Create a test markdown file
    const testFile = path.join(testProjectRoot, 'test-sync.md');
    await fs.ensureDir(testProjectRoot);
    await fs.writeFile(testFile, '# Test Document\n\nThis is a test document for sync.');
    
    const result = await syncEngine.syncFile(testFile, { dryRun: true });
    
    console.log(chalk.gray(`   Dry run result: ${result.success}`));
    console.log(chalk.gray(`   Document: ${result.document?.title || 'N/A'}`));
    
    // Clean up
    await fs.remove(testFile);
    
    if (result.success && result.dryRun) {
      console.log(chalk.green('   ✅ Dry run mode test passed'));
      testsPassed++;
    } else {
      console.log(chalk.red('   ❌ Dry run mode test failed'));
    }
  } catch (error) {
    console.log(chalk.red('   ❌ Dry run mode test error:', error.message));
  }

  // Test 6: Test sync status
  totalTests++;
  try {
    console.log(chalk.blue('\n6. Testing sync status...'));
    
    const status = await syncEngine.getStatus();
    
    console.log(chalk.gray(`   Root document: ${status.rootDocument.title}`));
    console.log(chalk.gray(`   Total documents: ${status.totalDocuments}`));
    console.log(chalk.gray(`   Last sync: ${status.lastSync || 'Never'}`));
    
    console.log(chalk.green('   ✅ Sync status test passed'));
    testsPassed++;
  } catch (error) {
    console.log(chalk.red('   ❌ Sync status test error:', error.message));
  }

  // Test 7: Test cleanup
  totalTests++;
  try {
    console.log(chalk.blue('\n7. Testing cleanup...'));
    
    await syncEngine.cleanup();
    
    console.log(chalk.green('   ✅ Cleanup test passed'));
    testsPassed++;
  } catch (error) {
    console.log(chalk.red('   ❌ Cleanup test error:', error.message));
  }

  // Test 8: Test state persistence
  totalTests++;
  try {
    console.log(chalk.blue('\n8. Testing state persistence...'));
    
    const state = new GoogleDocsState(testProjectRoot);
    await state.init();
    
    // Set some test data
    state.setRootDocument('test-doc-123', 'https://test.com', 'Test Doc');
    state.updateStats('created');
    await state.save();
    
    // Create new instance and load
    const newState = new GoogleDocsState(testProjectRoot);
    await newState.init();
    
    const rootDoc = newState.getRootDocument();
    const stats = newState.getStats();
    
    console.log(chalk.gray(`   Loaded document ID: ${rootDoc.documentId}`));
    console.log(chalk.gray(`   Created count: ${stats.created}`));
    
    if (rootDoc.documentId === 'test-doc-123' && stats.created === 1) {
      console.log(chalk.green('   ✅ State persistence test passed'));
      testsPassed++;
    } else {
      console.log(chalk.red('   ❌ State persistence test failed'));
    }
    
    // Clean up test state
    await fs.remove(newState.stateFile);
  } catch (error) {
    console.log(chalk.red('   ❌ State persistence test error:', error.message));
  }

  // Summary
  console.log(chalk.blue('\n📊 Test Results'));
  console.log(chalk.gray('================'));
  console.log(chalk.cyan(`Tests passed: ${testsPassed}/${totalTests}`));
  
  if (testsPassed === totalTests) {
    console.log(chalk.green('🎉 All tests passed!'));
    return true;
  } else {
    console.log(chalk.red(`❌ ${totalTests - testsPassed} tests failed`));
    return false;
  }
}

// Run test if called directly
if (require.main === module) {
  testGoogleDocsSync()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error(chalk.red('Test runner error:', error.message));
      process.exit(1);
    });
}

module.exports = { testGoogleDocsSync }; 