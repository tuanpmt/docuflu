const fs = require('fs-extra');
const path = require('path');
const matter = require('gray-matter');
const chalk = require('chalk');

class DocusaurusScanner {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.docsDir = null;
    this.blogDir = null;
    this.staticDir = null;
  }

  /**
   * Auto-detect Docusaurus project structure
   */
  async detectProject() {
    // Find docusaurus.config.ts/js
    const configFiles = ['docusaurus.config.ts', 'docusaurus.config.js'];
    let configFound = false;

    for (const configFile of configFiles) {
      if (await fs.pathExists(path.join(this.projectRoot, configFile))) {
        configFound = true;
        break;
      }
    }

    if (!configFound) {
      throw new Error('No Docusaurus config file found. This does not appear to be a Docusaurus project.');
    }

    // Set default directories
    this.docsDir = path.join(this.projectRoot, 'docs');
    this.blogDir = path.join(this.projectRoot, 'blog');
    this.staticDir = path.join(this.projectRoot, 'static');

    console.log(chalk.green('✓ Detected Docusaurus project'));
    return true;
  }

  /**
   * Scan docs directory và build hierarchy
   * @param {Object} options - {includePatterns, excludePatterns}
   * @returns {Array} - Array of document objects with hierarchy
   */
  async scanDocs(options = {}) {
    if (!await fs.pathExists(this.docsDir)) {
      throw new Error(`Docs directory not found: ${this.docsDir}`);
    }

    const { excludePatterns = [] } = options;
    const documents = [];

    await this._scanDirectory(this.docsDir, documents, '', excludePatterns);

    // Sort by sidebar position and path
    documents.sort((a, b) => {
      if (a.sidebarPosition !== b.sidebarPosition) {
        return (a.sidebarPosition || 999) - (b.sidebarPosition || 999);
      }
      return a.relativePath.localeCompare(b.relativePath);
    });

    console.log(chalk.blue(`📁 Found ${documents.length} documents in docs/`));
    return documents;
  }

  /**
   * Scan blog directory
   */
  async scanBlog(options = {}) {
    if (!await fs.pathExists(this.blogDir)) {
      console.warn(chalk.yellow('⚠️ Blog directory not found, skipping'));
      return [];
    }

    const { excludePatterns = [] } = options;
    const posts = [];

    await this._scanDirectory(this.blogDir, posts, '', excludePatterns);

    // Sort by date (newest first)
    posts.sort((a, b) => {
      const dateA = a.frontmatter.date ? new Date(a.frontmatter.date) : new Date(0);
      const dateB = b.frontmatter.date ? new Date(b.frontmatter.date) : new Date(0);
      return dateB - dateA;
    });

    console.log(chalk.blue(`📝 Found ${posts.length} blog posts`));
    return posts;
  }

  /**
   * Recursively scan directory for markdown files
   */
  async _scanDirectory(dirPath, documents, relativePath, excludePatterns) {
    const items = await fs.readdir(dirPath);

    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const itemRelativePath = path.join(relativePath, item);
      const stat = await fs.stat(itemPath);

      // Skip excluded patterns
      if (this._isExcluded(itemRelativePath, excludePatterns)) {
        continue;
      }

      if (stat.isDirectory()) {
        // Recursively scan subdirectories
        await this._scanDirectory(itemPath, documents, itemRelativePath, excludePatterns);
      } else if (this._isMarkdownFile(item)) {
        // Parse markdown file
        const document = await this._parseMarkdownFile(itemPath, itemRelativePath);
        if (document) {
          documents.push(document);
        }
      }
    }
  }

  /**
   * Parse single markdown file
   */
  async _parseMarkdownFile(filePath, relativePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const { data: frontmatter, content: markdown } = matter(content);

      // Extract title
      const title = this._extractTitle(frontmatter, markdown, relativePath);

      // Build document object
      const document = {
        filePath,
        relativePath,
        title,
        frontmatter,
        content: markdown,
        sidebarPosition: frontmatter.sidebar_position || frontmatter.position,
        category: this._extractCategory(relativePath),
        slug: this._generateSlug(relativePath, frontmatter),
        lastModified: (await fs.stat(filePath)).mtime,
        hasImages: this._hasImages(markdown),
        hasMermaid: this._hasMermaid(markdown)
      };

      return document;
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Failed to parse ${relativePath}: ${error.message}`));
      return null;
    }
  }

  /**
   * Parse single file (public method)
   */
  async parseFile(filePath) {
    const relativePath = path.relative(this.projectRoot, filePath);
    return await this._parseMarkdownFile(filePath, relativePath);
  }

  /**
   * Extract title từ frontmatter hoặc content
   */
  _extractTitle(frontmatter, markdown, relativePath) {
    // Priority: frontmatter.title > first heading > filename
    if (frontmatter.title) {
      return frontmatter.title;
    }

    const headingMatch = markdown.match(/^#\s+(.+)$/m);
    if (headingMatch) {
      return headingMatch[1].trim();
    }

    // Use filename as fallback
    const filename = path.basename(relativePath, path.extname(relativePath));
    return filename.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Extract category từ directory structure
   */
  _extractCategory(relativePath) {
    const dir = path.dirname(relativePath);
    return dir === '.' ? null : dir;
  }

  /**
   * Generate slug for page
   */
  _generateSlug(relativePath, frontmatter) {
    if (frontmatter.slug) {
      return frontmatter.slug;
    }

    // Convert file path to slug
    return relativePath
      .replace(/\.(md|mdx)$/, '')
      .replace(/[\\\/]/g, '/')
      .replace(/\s+/g, '-')
      .toLowerCase();
  }

  /**
   * Check if markdown contains images
   */
  _hasImages(markdown) {
    return /!\[.*?\]\([^)]+\)/.test(markdown);
  }

  /**
   * Check if markdown contains Mermaid diagrams
   */
  _hasMermaid(markdown) {
    return /```mermaid\n[\s\S]*?\n```/.test(markdown);
  }

  /**
   * Check if file is markdown
   */
  _isMarkdownFile(filename) {
    return /\.(md|mdx)$/i.test(filename);
  }

  /**
   * Check if path should be excluded
   */
  _isExcluded(relativePath, excludePatterns) {
    return excludePatterns.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(relativePath);
    });
  }

  /**
   * Build parent-child hierarchy map
   */
  buildHierarchy(documents) {
    const hierarchy = new Map();

    for (const doc of documents) {
      const category = doc.category;
      
      if (!hierarchy.has(category)) {
        hierarchy.set(category, []);
      }
      
      hierarchy.get(category).push(doc);
    }

    return hierarchy;
  }

  /**
   * Get summary statistics
   */
  getStats(documents) {
    const stats = {
      total: documents.length,
      categories: new Set(documents.map(d => d.category).filter(Boolean)).size,
      withImages: documents.filter(d => d.hasImages).length,
      withFrontmatter: documents.filter(d => Object.keys(d.frontmatter).length > 0).length
    };

    return stats;
  }
}

module.exports = DocusaurusScanner; 