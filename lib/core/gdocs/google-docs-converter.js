const MarkdownIt = require('markdown-it');
const fs = require('fs-extra');
const path = require('path');
const TableConverter = require('./table-converter');

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
    
    this.tableConverter = new TableConverter();
    
    // Debug configuration
    this.debug = process.env.DEBUG_GDOCS_CONVERTER === 'true';
    this.debugDir = path.join(process.cwd(), '.docusaurus', 'debug', 'gdocs-converter');
  }

  /**
   * Convert markdown content to Google Docs requests
   * @param {string} markdown - Markdown content
   * @param {Object} options - Conversion options
   * @returns {Object} - { requests, tablesForStep2, formattingForStep2 }
   */
  convertFromMarkdown(markdown, options = {}) {
    const debugInfo = {
      timestamp: new Date().toISOString(),
      input: { markdown, options },
      processing: { lines: [], elements: [] },
      output: null,
      errors: []
    };

    try {
      // Handle empty content
      if (!markdown || markdown.trim() === '') {
        const result = { requests: [], tablesForStep2: [], formattingForStep2: [] };
        debugInfo.output = {
          requestCount: 0,
          tablesForStep2Count: 0,
          formattingForStep2Count: 0,
          summary: { totalElements: 0, elementTypes: {} }
        };
        if (this.debug) {
          this.saveDebugInfo(debugInfo);
        }
        return result;
      }

      const lines = markdown.split('\n');
      const requests = [];
      const tablesForStep2 = []; // Tables that need cell population
      const formattingForStep2 = []; // Text formatting that needs actual indices
      
      // Process each line
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();
        
        debugInfo.processing.lines.push({
          lineNumber: i + 1,
          content: line,
          type: this.getLineType(trimmedLine)
        });

        if (trimmedLine === '') {
          // Empty line
          requests.push({
            insertText: {
              text: '\n',
              endOfSegmentLocation: { segmentId: '' }
            }
          });
          
          debugInfo.processing.elements.push({
            lineNumber: i + 1,
            type: 'paragraph_break'
          });
          
        } else if (trimmedLine.startsWith('#')) {
          // Heading - insert text first, format later
          const level = (trimmedLine.match(/^#+/) || [''])[0].length;
          const text = trimmedLine.replace(/^#+\s*/, '').trim();
          
          requests.push({
            insertText: {
              text: text + '\n\n',
              endOfSegmentLocation: { segmentId: '' }
            }
          });
          
          // Store formatting for step 2
          formattingForStep2.push({
            type: 'heading',
            level: level,
            text: text,
            textLength: text.length,
            requestIndex: requests.length - 1
          });
          
          debugInfo.processing.elements.push({
            lineNumber: i + 1,
            type: 'heading',
            level: level,
            content: text,
            needsFormatting: true
          });
          
        } else if (trimmedLine.startsWith('```')) {
          // Code block - extract and insert text first, format later
          const codeBlockResult = this.extractCodeBlock(lines, i);
          if (codeBlockResult) {
            const { content, language, endIndex } = codeBlockResult;
            
            // Insert language label if present
            let totalText = '';
            if (language) {
              const label = `[${language}]\n`;
              totalText += label;
            }
            totalText += content + '\n\n';
            
            requests.push({
              insertText: {
                text: totalText,
                endOfSegmentLocation: { segmentId: '' }
              }
            });
            
            // Store formatting for step 2
            formattingForStep2.push({
              type: 'code_block',
              language: language,
              content: content,
              totalText: totalText,
              requestIndex: requests.length - 1
            });
            
            debugInfo.processing.elements.push({
              lineNumber: i + 1,
              type: 'code_block',
              language: language,
              content: content,
              linesSpanned: endIndex - i + 1,
              needsFormatting: true
            });
            
            i = endIndex; // Skip processed lines
            continue;
          }
        } else if (trimmedLine.match(/^[\*\-\+]\s/) || trimmedLine.match(/^\d+\.\s/)) {
          // Lists - extract and insert text
          const listResult = this.extractList(lines, i);
          const { items, ordered, endIndex } = listResult;
          
          let listText = '';
          items.forEach((item, index) => {
            const prefix = ordered ? `${index + 1}. ` : '• ';
            listText += prefix + item + '\n';
          });
          listText += '\n'; // Extra line break after list
          
          requests.push({
            insertText: {
              text: listText,
              endOfSegmentLocation: { segmentId: '' }
            }
          });
          
          debugInfo.processing.elements.push({
            lineNumber: i + 1,
            type: 'list',
            ordered: ordered,
            items: items,
            linesSpanned: endIndex - i + 1
          });
          
          i = endIndex; // Skip processed lines
          continue;
        } else {
          // Check for table
          const tableResult = this.extractTable(lines, i);
          if (tableResult) {
            const tableData = this.tableConverter.parseTable(tableResult.content);
            if (tableData) {
              // Step 1: Create empty table structure only
              requests.push({
                insertTable: {
                  rows: tableData.rows.length + 1,
                  columns: tableData.headers.length,
                  endOfSegmentLocation: { segmentId: '' }
                }
              });
              
              // Store table data for step 2 population
              tablesForStep2.push({
                tableData: tableData,
                requestIndex: requests.length - 1
              });
              
              debugInfo.processing.elements.push({
                type: 'table',
                startLine: i,
                endLine: tableResult.endIndex,
                headers: tableData.headers,
                rowCount: tableData.rows.length,
                needsPopulation: true
              });
              
              i = tableResult.endIndex; // Skip processed lines
              continue;
            }
          }
          
          // Regular paragraph - check for inline formatting
          const inlineFormats = this.detectInlineFormatting(trimmedLine);
          
          if (inlineFormats.formats && inlineFormats.formats.length > 0) {
            // Has inline formatting - insert text first, format later
            requests.push({
              insertText: {
                text: inlineFormats.processedText + '\n',
                endOfSegmentLocation: { segmentId: '' }
              }
            });
            
            // Store formatting for step 2
            formattingForStep2.push({
              type: 'paragraph',
              originalText: trimmedLine,
              processedText: inlineFormats.processedText,
              formats: inlineFormats.formats,
              requestIndex: requests.length - 1
            });
            
            debugInfo.processing.elements.push({
              lineNumber: i + 1,
              type: 'paragraph',
              content: trimmedLine,
              needsFormatting: true,
              inlineFormats: inlineFormats.formats.length
            });
          } else {
            // No formatting - simple text
            requests.push({
              insertText: {
                text: trimmedLine + '\n',
                endOfSegmentLocation: { segmentId: '' }
              }
            });
            
            debugInfo.processing.elements.push({
              lineNumber: i + 1,
              type: 'paragraph',
              content: trimmedLine
            });
          }
        }
      }

      const result = { requests, tablesForStep2, formattingForStep2 };
      
      debugInfo.output = {
        requestCount: requests.length,
        tablesForStep2Count: tablesForStep2.length,
        formattingForStep2Count: formattingForStep2.length,
        summary: {
          totalElements: debugInfo.processing.elements.length,
          elementTypes: this.countElementTypes(debugInfo.processing.elements)
        }
      };

      if (this.debug) {
        this.saveDebugInfo(debugInfo);
      }

      return result;
      
    } catch (error) {
      debugInfo.errors.push({
        message: error.message,
        stack: error.stack
      });
      
      if (this.debug) {
        this.saveDebugInfo(debugInfo);
      }
      
      throw error;
    }
  }

  /**
   * Extract code block from lines
   */
  extractCodeBlock(lines, startIndex) {
    const startLine = lines[startIndex].trim();
    const language = startLine.replace('```', '').trim();
    
    let content = '';
    let endIndex = startIndex + 1;
    
    // Find the closing ```
    while (endIndex < lines.length) {
      const line = lines[endIndex];
      if (line.trim() === '```') {
        break;
      }
      content += line + '\n';
      endIndex++;
    }
    
    // Remove trailing newline
    content = content.replace(/\n$/, '');
    
    return {
      content,
      language,
      endIndex
    };
  }

  /**
   * Extract list from lines
   */
  extractList(lines, startIndex) {
    const items = [];
    let currentIndex = startIndex;
    const firstLine = lines[startIndex].trim();
    const ordered = /^\d+\./.test(firstLine);
    
    // Extract list items
    while (currentIndex < lines.length) {
      const line = lines[currentIndex].trim();
      
      if (ordered && /^\d+\.\s/.test(line)) {
        items.push(line.replace(/^\d+\.\s/, ''));
      } else if (!ordered && /^[\*\-\+]\s/.test(line)) {
        items.push(line.replace(/^[\*\-\+]\s/, ''));
      } else if (line === '') {
        // Empty line - continue but don't add to items
      } else {
        // Not a list item anymore
        break;
      }
      
      currentIndex++;
    }
    
    return {
      items,
      ordered,
      endIndex: currentIndex - 1
    };
  }

  /**
   * Detect inline formatting in text
   */
  detectInlineFormatting(text) {
    const formats = [];
    let processedText = text;
    
    // Find **bold**, *italic*, and `code` patterns
    const allMatches = [];
    
    // Find **bold** and __bold__ patterns
    let match;
    const boldRegex = /(\*\*|__)(.*?)\1/g;
    while ((match = boldRegex.exec(text)) !== null) {
      allMatches.push({
        start: match.index,
        end: match.index + match[0].length,
        content: match[2],
        markerLength: match[1].length,
        style: { bold: true },
        priority: 1
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
        content: match[1],
        markerLength: 1,
        style: { 
          backgroundColor: { color: { rgbColor: { red: 0.95, green: 0.95, blue: 0.95 } } },
          foregroundColor: { color: { rgbColor: { red: 0.8, green: 0.1, blue: 0.1 } } } // Red text for code
        },
        priority: 3
      });
    }
    
    // Sort by position and remove overlaps
    allMatches.sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start;
      return a.priority - b.priority;
    });
    
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
    
    // Process matches from end to start
    validMatches.sort((a, b) => b.start - a.start);
    
    for (const match of validMatches) {
      // Replace full match with content
      processedText = processedText.substring(0, match.start) + 
                    match.content + 
                    processedText.substring(match.end);
      
      // Calculate adjusted position
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
    
    // Sort formats by position
    formats.sort((a, b) => a.start - b.start);

    return {
      processedText,
      formats
    };
  }

  /**
   * Count element types for debugging
   */
  countElementTypes(elements) {
    const counts = {};
    elements.forEach(element => {
      counts[element.type] = (counts[element.type] || 0) + 1;
    });
    return counts;
  }

  /**
   * Detect line type for debugging
   */
  getLineType(line) {
    if (!line) return 'empty';
    if (line.startsWith('#')) return 'heading';
    if (line.startsWith('|')) return 'table';
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
    if (!this.debug) return;
    
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
          debugEnabled: this.debug,
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
   * Extract table content from lines starting at startIndex
   * @param {string[]} lines - Array of markdown lines
   * @param {number} startIndex - Starting line index
   * @returns {Object|null} - Table extraction result or null if invalid
   */
  extractTable(lines, startIndex) {
    let tableLines = [];
    let currentIndex = startIndex;

    // Collect table lines
    while (currentIndex < lines.length && lines[currentIndex].trim().startsWith('|')) {
      tableLines.push(lines[currentIndex]);
      currentIndex++;
    }

    // Validate minimum table structure (header + separator + at least one row)
    if (tableLines.length < 3) return null;

    return {
      content: tableLines.join('\n'),
      endIndex: currentIndex - 1
    };
  }

  /**
   * Create table as formatted text (fallback approach)
   */
  createTableAsText(tableData) {
    const { headers, rows } = tableData;
    let tableText = '\n';
    
    // Add headers
    tableText += '| ' + headers.join(' | ') + ' |\n';
    
    // Add separator
    tableText += '|' + headers.map(() => '---').join('|') + '|\n';
    
    // Add rows
    rows.forEach(row => {
      tableText += '| ' + row.join(' | ') + ' |\n';
    });
    
    return tableText;
  }
}

module.exports = GoogleDocsConverter; 