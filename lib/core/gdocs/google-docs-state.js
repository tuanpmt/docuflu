const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

/**
 * Google Docs State Manager
 * Manages sync state for Google Docs integration
 * Reuses and extends existing state-manager.js for Google Docs specific needs
 */
class GoogleDocsState {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.stateDir = path.join(projectRoot, '.docusaurus');
    this.stateFile = path.join(this.stateDir, 'google-docs-state.json');
    this.state = {
      lastSync: null,
      rootDocumentId: null,
      rootDocumentUrl: null,
      documents: {},
      tabs: {},
      stats: {
        totalProcessed: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        failed: 0
      }
    };
  }

  /**
   * Initialize state manager
   */
  async init() {
    try {
      await fs.ensureDir(this.stateDir);
      
      if (await fs.pathExists(this.stateFile)) {
        const savedState = await fs.readJson(this.stateFile);
        this.state = { ...this.state, ...savedState };
        console.log(chalk.gray('📊 Loaded Google Docs state'));
      } else {
        console.log(chalk.gray('📊 Initializing new Google Docs state'));
      }
      
      return this.state;
    } catch (error) {
      console.warn(chalk.yellow('⚠️ Could not initialize Google Docs state:', error.message));
      return this.state;
    }
  }

  /**
   * Save state to file
   */
  async save() {
    try {
      await fs.ensureDir(this.stateDir);
      await fs.writeJson(this.stateFile, this.state, { spaces: 2 });
    } catch (error) {
      console.warn(chalk.yellow('⚠️ Could not save Google Docs state:', error.message));
    }
  }

  /**
   * Set root document information
   */
  setRootDocument(documentId, documentUrl, title = 'Documentation') {
    this.state.rootDocumentId = documentId;
    this.state.rootDocumentUrl = documentUrl;
    this.state.rootDocumentTitle = title;
  }

  /**
   * Get root document information
   */
  getRootDocument() {
    return {
      documentId: this.state.rootDocumentId,
      documentUrl: this.state.rootDocumentUrl,
      title: this.state.rootDocumentTitle
    };
  }

  /**
   * Check if document needs sync (based on file modification time)
   */
  async needsSync(filePath, documentId = null) {
    try {
      const stats = await fs.stat(filePath);
      const lastModified = stats.mtime.toISOString();
      
      const stateKey = documentId || filePath;
      const docState = this.state.documents[stateKey];
      
      if (!docState) {
        return true; // New document
      }
      
      return docState.lastModified !== lastModified;
    } catch (error) {
      return true; // If we can't check, assume it needs sync
    }
  }

  /**
   * Update document state
   */
  async updateDocument(filePath, documentData) {
    try {
      const stats = await fs.stat(filePath);
      const lastModified = stats.mtime.toISOString();
      
      const { documentId, title, tabId, parentTabId } = documentData;
      
      const stateKey = documentId || filePath;
      this.state.documents[stateKey] = {
        filePath,
        documentId,
        title,
        tabId,
        parentTabId,
        lastModified,
        lastSync: new Date().toISOString()
      };
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Could not update document state for ${filePath}:`, error.message));
    }
  }

  /**
   * Update tab state
   */
  updateTab(tabId, tabData) {
    this.state.tabs[tabId] = {
      ...tabData,
      lastSync: new Date().toISOString()
    };
  }

  /**
   * Get document by file path
   */
  getDocument(filePath) {
    return Object.values(this.state.documents).find(doc => doc.filePath === filePath);
  }

  /**
   * Get document by document ID
   */
  getDocumentById(documentId) {
    return this.state.documents[documentId];
  }

  /**
   * Get tab by title or path
   */
  getTab(identifier) {
    return Object.values(this.state.tabs).find(tab => 
      tab.title === identifier || tab.path === identifier
    );
  }

  /**
   * Get tab by ID
   */
  getTabById(tabId) {
    return this.state.tabs[tabId];
  }

  /**
   * Get all pages (for compatibility with ReferenceProcessor)
   * Maps documents to page-like objects
   */
  getAllPages() {
    const pages = {};
    
    for (const [key, doc] of Object.entries(this.state.documents)) {
      pages[doc.filePath] = {
        title: doc.title,
        confluenceId: doc.documentId, // Use documentId as confluenceId
        filePath: doc.filePath,
        spaceKey: 'GDOCS' // Default space key for Google Docs
      };
    }
    
    return pages;
  }

  /**
   * Update sync statistics
   */
  updateStats(operation) {
    this.state.stats.totalProcessed++;
    
    switch (operation) {
      case 'created':
        this.state.stats.created++;
        break;
      case 'updated':
        this.state.stats.updated++;
        break;
      case 'skipped':
        this.state.stats.skipped++;
        break;
      case 'failed':
        this.state.stats.failed++;
        break;
    }
    
    this.state.lastSync = new Date().toISOString();
  }

  /**
   * Get sync statistics
   */
  getStats() {
    return { ...this.state.stats };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.state.stats = {
      totalProcessed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0
    };
  }

  /**
   * Clean up orphaned entries
   */
  async cleanup() {
    const validDocuments = {};
    
    for (const [key, doc] of Object.entries(this.state.documents)) {
      try {
        if (await fs.pathExists(doc.filePath)) {
          validDocuments[key] = doc;
        } else {
          console.log(chalk.gray(`🗑️ Removing orphaned document: ${doc.title}`));
        }
      } catch (error) {
        // Keep document if we can't check
        validDocuments[key] = doc;
      }
    }
    
    this.state.documents = validDocuments;
  }

  /**
   * Get files that need sync
   */
  async getFilesToSync(allFiles) {
    const filesToSync = [];
    
    for (const file of allFiles) {
      const needsSync = await this.needsSync(file.filePath);
      if (needsSync) {
        filesToSync.push(file);
      }
    }
    
    return filesToSync;
  }

  /**
   * Get state summary for reporting
   */
  getSummary() {
    return {
      rootDocument: this.getRootDocument(),
      totalDocuments: Object.keys(this.state.documents).length,
      totalTabs: Object.keys(this.state.tabs).length,
      lastSync: this.state.lastSync,
      stats: this.state.stats
    };
  }

  /**
   * Export state for debugging
   */
  exportState() {
    return JSON.stringify(this.state, null, 2);
  }

  /**
   * Import state from backup
   */
  async importState(stateData) {
    try {
      this.state = { ...this.state, ...stateData };
      await this.save();
      console.log(chalk.green('✅ State imported successfully'));
    } catch (error) {
      console.error(chalk.red('❌ Failed to import state:', error.message));
      throw error;
    }
  }
}

module.exports = GoogleDocsState; 