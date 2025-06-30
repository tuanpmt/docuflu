const MarkdownIt = require('markdown-it');
const fs = require('fs-extra');
const path = require('path');

/**
 * Google Docs Content Converter
 * Converts markdown content to Google Docs Document Resource format
 */
class GoogleDocsConverter {
  constructor() {
    this.md = new MarkdownIt({
      html: true,
      linkify: true,
      typographer: true
    });
    
    // Debug configuration
    this.debugEnabled = process.env.DEBUG_GDOCS_CONVERTER === 'true';
    this.debugDir = path.join(process.cwd(), '.docusaurus', 'debug', 'gdocs-converter');
  }

  /**
   * Convert markdown to Google Docs batch requests
   * @param {string} markdown - Markdown content
   * @param {Object} options - Conversion options
   * @returns {Array} - Array of Google Docs API requests
   */
  async convertFromMarkdown(markdown, options = {}) {
    const debugInfo = {
      timestamp: new Date().toISOString(),
      input: {
        markdown: markdown,
        options: options
      },
      processing: {
        lines: [],
        elements: [],
        indexTracking: []
      },
      output: {
        requests: [],
        totalLength: 0
      },
      errors: []
    };

    const requests = [];
    let currentIndex = 1;

    // Handle empty content
    if (!markdown || markdown.trim() === '') {
      if (this.debugEnabled) {
        debugInfo.processing.note = "Empty markdown content";
        await this.saveDebugInfo(debugInfo, 'empty-content');
      }
      return requests;
    }

    // Parse markdown line by line
    const lines = markdown.split('\n');
    debugInfo.processing.lines = lines.map((line, index) => ({
      lineNumber: index + 1,
      content: line,
      trimmed: line.trim(),
      type: this.detectLineType(line.trim())
    }));
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      const startIndex = currentIndex;

      debugInfo.processing.indexTracking.push({
        lineNumber: i + 1,
        startIndex: startIndex,
        lineContent: line,
        lineType: this.detectLineType(trimmedLine)
      });

      if (!trimmedLine) {
        // Empty line - add paragraph break
        const breakRequest = this.createParagraphBreak(currentIndex);
        requests.push(breakRequest);
        
        debugInfo.processing.elements.push({
          lineNumber: i + 1,
          type: 'paragraph_break',
          startIndex: startIndex,
          endIndex: currentIndex + 1,
          length: 1,
          requests: [breakRequest]
        });
        
        currentIndex += 1;
        continue;
      }

      // Handle headings
      if (trimmedLine.startsWith('#')) {
        const headingResult = this.createHeading(trimmedLine, currentIndex);
        requests.push(...headingResult.requests);
        
        debugInfo.processing.elements.push({
          lineNumber: i + 1,
          type: 'heading',
          level: (trimmedLine.match(/^#+/) || [''])[0].length,
          content: trimmedLine.replace(/^#+\s*/, '').trim(),
          startIndex: startIndex,
          endIndex: currentIndex + headingResult.length,
          length: headingResult.length,
          requests: headingResult.requests
        });
        
        currentIndex += headingResult.length;
        continue;
      }

      // Handle code blocks
      if (trimmedLine.startsWith('```')) {
        const codeBlockResult = this.extractCodeBlock(lines, i);
        if (codeBlockResult) {
          const codeRequest = this.createCodeBlock(codeBlockResult.content, codeBlockResult.language, currentIndex);
          requests.push(...codeRequest.requests);
          
          debugInfo.processing.elements.push({
            lineNumber: i + 1,
            type: 'code_block',
            language: codeBlockResult.language,
            content: codeBlockResult.content,
            startIndex: startIndex,
            endIndex: currentIndex + codeRequest.length,
            length: codeRequest.length,
            linesSpanned: codeBlockResult.endIndex - i + 1,
            requests: codeRequest.requests
          });
          
          currentIndex += codeRequest.length;
          i = codeBlockResult.endIndex; // Skip processed lines
          continue;
        }
      }

      // Handle lists
      if (trimmedLine.match(/^[\*\-\+]\s/) || trimmedLine.match(/^\d+\.\s/)) {
        const listResult = this.extractList(lines, i);
        const listRequest = this.createList(listResult.items, listResult.ordered, currentIndex);
        requests.push(...listRequest.requests);
        
        debugInfo.processing.elements.push({
          lineNumber: i + 1,
          type: 'list',
          ordered: listResult.ordered,
          items: listResult.items,
          startIndex: startIndex,
          endIndex: currentIndex + listRequest.length,
          length: listRequest.length,
          linesSpanned: listResult.endIndex - i + 1,
          requests: listRequest.requests
        });
        
        currentIndex += listRequest.length;
        i = listResult.endIndex; // Skip processed lines
        continue;
      }

      // Handle regular paragraphs
      const paragraphResult = this.createParagraph(trimmedLine, currentIndex);
      requests.push(...paragraphResult.requests);
      
      debugInfo.processing.elements.push({
        lineNumber: i + 1,
        type: 'paragraph',
        content: trimmedLine,
        startIndex: startIndex,
        endIndex: currentIndex + paragraphResult.length,
        length: paragraphResult.length,
        inlineFormatting: paragraphResult.inlineFormatting || [],
        requests: paragraphResult.requests
      });
      
      currentIndex += paragraphResult.length;
    }

    // Finalize debug info
    debugInfo.output.requests = requests;
    debugInfo.output.totalLength = currentIndex - 1;
    debugInfo.output.requestCount = requests.length;
    debugInfo.output.summary = {
      totalElements: debugInfo.processing.elements.length,
      elementTypes: this.summarizeElementTypes(debugInfo.processing.elements),
      indexRange: {
        start: 1,
        end: currentIndex - 1
      }
    };

    // Save debug info if enabled
    if (this.debugEnabled) {
      await this.saveDebugInfo(debugInfo);
    }

    return requests;
  }

  /**
   * Detect line type for debugging
   */
  detectLineType(line) {
    if (!line) return 'empty';
    if (line.startsWith('#')) return 'heading';
    if (line.startsWith('```')) return 'code_block_delimiter';
    if (line.match(/^[\*\-\+]\s/)) return 'unordered_list';
    if (line.match(/^\d+\.\s/)) return 'ordered_list';
    return 'paragraph';
  }

  /**
   * Summarize element types for debug summary
   */
  summarizeElementTypes(elements) {
    const summary = {};
    elements.forEach(element => {
      summary[element.type] = (summary[element.type] || 0) + 1;
    });
    return summary;
  }

  /**
   * Save debug information to JSON file
   */
  async saveDebugInfo(debugInfo, suffix = '') {
    if (!this.debugEnabled) return;
    
    try {
      await fs.ensureDir(this.debugDir);
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = suffix 
        ? `conversion-debug-${suffix}-${timestamp}.json`
        : `conversion-debug-${timestamp}.json`;
      
      const filepath = path.join(this.debugDir, filename);
      
      // Add additional debug metadata
      const debugOutput = {
        ...debugInfo,
        metadata: {
          converterVersion: '1.0.0',
          nodeVersion: process.version,
          debugEnabled: this.debugEnabled,
          debugDir: this.debugDir,
          filename: filename
        }
      };
      
      await fs.writeJson(filepath, debugOutput, { spaces: 2 });
      
      console.log(`🐛 Debug info saved: ${filepath}`);
      
      // Also save a simplified summary for quick overview
      const summaryPath = path.join(this.debugDir, `summary-${timestamp}.json`);
      const summary = {
        timestamp: debugInfo.timestamp,
        inputLength: debugInfo.input.markdown.length,
        outputRequests: debugInfo.output.requestCount,
        totalElements: debugInfo.output.summary.totalElements,
        elementTypes: debugInfo.output.summary.elementTypes,
        indexRange: debugInfo.output.summary.indexRange,
        errors: debugInfo.errors,
        filename: filename
      };
      
      await fs.writeJson(summaryPath, summary, { spaces: 2 });
      
    } catch (error) {
      console.warn('⚠️ Failed to save debug info:', error.message);
    }
  }

  /**
   * Create heading requests
   */
  createHeading(line, startIndex) {
    const level = (line.match(/^#+/) || [''])[0].length;
    const text = line.replace(/^#+\s*/, '').trim();
    
    const requests = [
      {
        insertText: {
          text: text + '\n',
          location: { index: startIndex }
        }
      },
      {
        updateTextStyle: {
          range: {
            startIndex: startIndex,
            endIndex: startIndex + text.length
          },
          textStyle: {
            bold: true,
            fontSize: {
              magnitude: this.getHeadingSize(level),
              unit: 'PT'
            }
          },
          fields: 'bold,fontSize'
        }
      }
    ];

    return {
      requests,
      length: text.length + 1
    };
  }

  /**
   * Get heading font size based on level
   */
  getHeadingSize(level) {
    const sizes = {
      1: 20,
      2: 18,
      3: 16,
      4: 14,
      5: 12,
      6: 11
    };
    return sizes[level] || 11;
  }

  /**
   * Create paragraph requests
   */
  createParagraph(text, startIndex) {
    // Process inline formatting (bold, italic, code)
    const processedText = this.processInlineFormatting(text);
    
    const requests = [
      {
        insertText: {
          text: processedText.text + '\n',
          location: { index: startIndex }
        }
      }
    ];

    // Add formatting requests
    let currentPos = startIndex;
    const formattingDetails = [];
    
    for (const format of processedText.formats) {
      const formatRequest = {
        updateTextStyle: {
          range: {
            startIndex: currentPos + format.start,
            endIndex: currentPos + format.end
          },
          textStyle: format.style,
          fields: Object.keys(format.style).join(',')
        }
      };
      
      requests.push(formatRequest);
      
      // Store formatting details for debug
      formattingDetails.push({
        type: this.getFormattingType(format.style),
        textContent: processedText.text.substring(format.start, format.end),
        absoluteStart: currentPos + format.start,
        absoluteEnd: currentPos + format.end,
        relativeStart: format.start,
        relativeEnd: format.end,
        style: format.style,
        request: formatRequest
      });
    }

    return {
      requests,
      length: processedText.text.length + 1,
      inlineFormatting: {
        originalText: text,
        processedText: processedText.text,
        formattingCount: processedText.formats.length,
        details: formattingDetails
      }
    };
  }

  /**
   * Get formatting type from style object for debugging
   */
  getFormattingType(style) {
    if (style.bold) return 'bold';
    if (style.italic) return 'italic';
    if (style.backgroundColor) return 'code';
    return 'unknown';
  }

  /**
   * Process inline formatting (bold, italic, code)
   */
  processInlineFormatting(text) {
    const formats = [];
    let processedText = text;
    
    // Collect all matches first, then sort by position
    const allMatches = [];
    
    // Find **bold** and __bold__ patterns
    let match;
    const boldRegex = /(\*\*|__)(.*?)\1/g;
    while ((match = boldRegex.exec(text)) !== null) {
      allMatches.push({
        start: match.index,
        end: match.index + match[0].length,
        contentStart: match.index + match[1].length,
        contentEnd: match.index + match[1].length + match[2].length,
        content: match[2],
        markerLength: match[1].length,
        style: { bold: true },
        priority: 1 // Higher priority for bold
      });
    }
    
    // Find *italic* and _italic_ patterns (but not inside bold)
    const italicRegex = /(\*|_)(.*?)\1/g;
    while ((match = italicRegex.exec(text)) !== null) {
      // Skip if this is part of a bold pattern
      const isBoldMarker = text.substring(match.index - 1, match.index + 2) === '**' ||
                          text.substring(match.index - 1, match.index + 2) === '__' ||
                          text.substring(match.index + match[0].length - 1, match.index + match[0].length + 1) === '**' ||
                          text.substring(match.index + match[0].length - 1, match.index + match[0].length + 1) === '__';
      
      if (!isBoldMarker) {
        allMatches.push({
          start: match.index,
          end: match.index + match[0].length,
          contentStart: match.index + match[1].length,
          contentEnd: match.index + match[1].length + match[2].length,
          content: match[2],
          markerLength: match[1].length,
          style: { italic: true },
          priority: 2
        });
      }
    }
    
    // Find `code` patterns
    const codeRegex = /`(.*?)`/g;
    while ((match = codeRegex.exec(text)) !== null) {
      allMatches.push({
        start: match.index,
        end: match.index + match[0].length,
        contentStart: match.index + 1,
        contentEnd: match.index + 1 + match[1].length,
        content: match[1],
        markerLength: 1,
        style: { 
          backgroundColor: { color: { rgbColor: { red: 0.95, green: 0.95, blue: 0.95 } } },
          foregroundColor: { color: { rgbColor: { red: 0.8, green: 0.2, blue: 0.2 } } }
        },
        priority: 3
      });
    }
    
    // Sort matches by start position, then by priority
    allMatches.sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start;
      return a.priority - b.priority;
    });
    
    // Remove overlapping matches (keep higher priority ones)
    const validMatches = [];
    for (const match of allMatches) {
      const hasOverlap = validMatches.some(existing => 
        (match.start >= existing.start && match.start < existing.end) ||
        (match.end > existing.start && match.end <= existing.end) ||
        (match.start <= existing.start && match.end >= existing.end)
      );
      
      if (!hasOverlap) {
        validMatches.push(match);
      }
    }
    
    // Process matches from end to start to maintain correct indices
    validMatches.sort((a, b) => b.start - a.start);
    
    processedText = text;
    for (const match of validMatches) {
      // Replace the full match with just the content
      processedText = processedText.substring(0, match.start) + 
                    match.content + 
                    processedText.substring(match.end);
      
      // Calculate the position in the processed text
      const totalMarkersRemoved = validMatches
        .filter(m => m.start < match.start)
        .reduce((sum, m) => sum + (m.markerLength * 2), 0);
      
      const adjustedStart = match.start - totalMarkersRemoved;
      const adjustedEnd = adjustedStart + match.content.length;
      
      formats.push({
        start: adjustedStart,
        end: adjustedEnd,
        style: match.style
      });
    }
    
    // Sort formats by start position for consistent output
    formats.sort((a, b) => a.start - b.start);

    return {
      text: processedText,
      formats
    };
  }

  /**
   * Extract code block from lines
   */
  extractCodeBlock(lines, startIndex) {
    const startLine = lines[startIndex];
    const language = startLine.replace('```', '').trim();
    
    let endIndex = -1;
    let content = '';
    
    for (let i = startIndex + 1; i < lines.length; i++) {
      if (lines[i].trim() === '```') {
        endIndex = i;
        break;
      }
      content += lines[i] + '\n';
    }

    if (endIndex === -1) {
      return null; // No closing ```
    }

    return {
      content: content.trim(),
      language,
      endIndex
    };
  }

  /**
   * Create code block requests
   */
  createCodeBlock(content, language, startIndex) {
    const requests = [];
    let currentIndex = startIndex;

    // Add language label if specified
    if (language) {
      const label = `[${language}]\n`;
      
      // Insert language label
      requests.push({
        insertText: {
          text: label,
          location: { index: currentIndex }
        }
      });
      
      // Style language label
      requests.push({
        updateTextStyle: {
          range: {
            startIndex: currentIndex,
            endIndex: currentIndex + label.length - 1 // Exclude the newline
          },
          textStyle: {
            bold: true,
            fontSize: { magnitude: 9, unit: 'PT' },
            foregroundColor: { color: { rgbColor: { red: 0.5, green: 0.5, blue: 0.5 } } }
          },
          fields: 'bold,fontSize,foregroundColor'
        }
      });
      
      currentIndex += label.length;
    }

    // Insert code content
    requests.push({
      insertText: {
        text: content + '\n',
        location: { index: currentIndex }
      }
    });
    
    // Style code content
    requests.push({
      updateTextStyle: {
        range: {
          startIndex: currentIndex,
          endIndex: currentIndex + content.length
        },
        textStyle: {
          backgroundColor: { color: { rgbColor: { red: 0.95, green: 0.95, blue: 0.95 } } },
          fontSize: { magnitude: 10, unit: 'PT' }
        },
        fields: 'backgroundColor,fontSize'
      }
    });

    const totalLength = (language ? language.length + 3 : 0) + content.length + 1; // [lang]\n + content + \n
    
    return {
      requests,
      length: totalLength
    };
  }

  /**
   * Extract list from lines
   */
  extractList(lines, startIndex) {
    const items = [];
    let endIndex = startIndex;
    const firstLine = lines[startIndex];
    const isOrdered = /^\d+\.\s/.test(firstLine.trim());
    
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!line) {
        endIndex = i - 1;
        break;
      }

      const listMatch = line.match(/^([\*\-\+]|\d+\.)\s(.*)$/);
      if (listMatch) {
        items.push(listMatch[2]);
        endIndex = i;
      } else {
        endIndex = i - 1;
        break;
      }
    }

    return {
      items,
      ordered: isOrdered,
      endIndex
    };
  }

  /**
   * Create list requests
   */
  createList(items, ordered, startIndex) {
    const requests = [];
    let currentIndex = startIndex;

    for (let i = 0; i < items.length; i++) {
      const bullet = ordered ? `${i + 1}. ` : '• ';
      const text = bullet + items[i] + '\n';
      
      requests.push({
        insertText: {
          text: text,
          location: { index: currentIndex }
        }
      });

      currentIndex += text.length;
    }

    return {
      requests,
      length: currentIndex - startIndex
    };
  }

  /**
   * Create paragraph break
   */
  createParagraphBreak(startIndex) {
    return {
      insertText: {
        text: '\n',
        location: { index: startIndex }
      }
    };
  }

  /**
   * Convert internal links to proper format
   * @param {string} content - Content with links
   * @param {Object} linkMap - Map of internal links to Google Docs URLs
   * @returns {string} - Content with converted links
   */
  convertLinks(content, linkMap = {}) {
    // Convert markdown links [text](url) to Google Docs format
    return content.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
      // Check if it's an internal link
      if (linkMap[url]) {
        return text; // For now, just return text. Google Docs links need special handling
      }
      return text; // External links also need special handling
    });
  }
}

module.exports = GoogleDocsConverter; 