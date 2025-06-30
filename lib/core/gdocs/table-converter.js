const fs = require('fs-extra');
const path = require('path');

/**
 * Handles conversion of Markdown tables to Google Docs native tables
 */
class TableConverter {
  constructor(options = {}) {
    this.debug = process.env.DEBUG_GDOCS_CONVERTER === 'true';
    this.debugData = {
      tables: []
    };
  }

  /**
   * Parse a markdown table string into structured data
   * @param {string} tableStr Markdown table string
   * @returns {Object} Parsed table data with headers and rows
   */
  parseTable(tableStr) {
    const lines = tableStr.trim().split('\n');
    if (lines.length < 2) return null;

    // Parse header row
    const headerRow = this._parseRow(lines[0]);
    if (!headerRow) return null;

    // Skip alignment row
    const dataRows = lines.slice(2).map(line => this._parseRow(line)).filter(row => row);

    if (this.debug) {
      this.debugData.tables.push({
        type: 'parse',
        headers: headerRow,
        rows: dataRows
      });
    }

    return {
      headers: headerRow,
      rows: dataRows
    };
  }

  /**
   * Parse a single table row
   * @param {string} rowStr Table row string
   * @returns {string[]|null} Array of cell contents or null if invalid
   */
  _parseRow(rowStr) {
    const cells = rowStr.split('|').map(cell => cell.trim());
    
    // Remove empty cells from start/end due to leading/trailing |
    if (cells[0] === '') cells.shift();
    if (cells[cells.length - 1] === '') cells.pop();

    return cells.length > 0 ? cells : null;
  }

  /**
   * Create table structure only (step 1)
   * @param {Object} tableData Parsed table data
   * @param {number} startIndex Document index to insert table
   * @returns {Object} Table creation request
   */
  createTableStructure(tableData, startIndex) {
    const { headers, rows } = tableData;
    const numRows = rows.length + 1; // Add 1 for header row
    const numColumns = headers.length;

    return {
      insertTable: {
        location: {
          index: startIndex
        },
        rows: numRows,
        columns: numColumns
      }
    };
  }

  /**
   * Create cell content requests using the GitHub Gist approach
   * @param {Object} tableData - Table data with headers and rows
   * @param {number} tableStartIndex - Starting index of the table in document
   * @returns {Array} Array of insert text requests
   */
  createCellContentRequests(tableData, tableStartIndex) {
    const requests = [];
    
    // Flatten all table data (headers + rows)
    const allRows = [tableData.headers, ...tableData.rows];
    const maxColumns = Math.max(...allRows.map(row => row.length));
    
    // Calculate cell positions based on GitHub Gist pattern
    let index = tableStartIndex + 5; // Start position after table structure
    const cellValues = [];
    
    allRows.forEach((row, rowIndex) => {
      const rowIndexAdjustment = rowIndex === 0 ? 0 : 3; // First row no adjustment, others +3
      const rowStartIndex = index + rowIndexAdjustment - 1;
      
      row.forEach((cellText, colIndex) => {
        const cellIndex = rowStartIndex + colIndex * 2;
        cellValues.push({
          text: cellText,
          index: cellIndex
        });
        index = cellIndex + 1;
      });
      
      // Adjust for missing cells in row
      if (row.length < maxColumns) {
        index += (maxColumns - row.length) * 2;
      }
    });
    
    // Insert in reverse order to maintain correct indices
    cellValues.reverse().forEach(({ text, index }) => {
      requests.push({
        insertText: {
          text: text,
          location: {
            index: index
          }
        }
      });
    });
    
    if (this.debug) {
      this.debugData.tables.push({
        type: 'cell_content_gist_approach',
        tableStartIndex,
        cellRequests: requests.length,
        totalCells: cellValues.length,
        maxColumns,
        allRowsCount: allRows.length
      });
    }
    
    return requests;
  }

  /**
   * Legacy method for backward compatibility
   * Now returns only table structure creation
   * @param {Object} tableData Parsed table data
   * @param {number} startIndex Document index to insert table
   * @returns {Object[]} Array containing only table creation request
   */
  createTableRequests(tableData, startIndex) {
    const tableStructure = this.createTableStructure(tableData, startIndex);
    
    if (this.debug) {
      this.debugData.tables.push({
        type: 'legacy_structure_only',
        startIndex,
        tableStructure
      });
    }

    return [tableStructure];
  }

  /**
   * Save debug information to JSON file
   * @param {Object} debugInfo - Debug information to save
   */
  async saveDebugInfo(debugInfo) {
    try {
      await fs.ensureDir(this.debugDir);
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `table-conversion-debug-${timestamp}.json`;
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
      
      console.log(`🐛 Table conversion debug info saved: ${filepath}`);
      
      // Save a simplified summary
      const summaryPath = path.join(this.debugDir, `table-summary-${timestamp}.json`);
      const summary = {
        timestamp: debugInfo.timestamp,
        input: {
          markdownLength: debugInfo.input.markdown.length,
          startIndex: debugInfo.input.startIndex
        },
        processing: {
          headerCount: debugInfo.processing.headers?.length || 0,
          rowCount: debugInfo.processing.rows?.length || 0,
          totalCells: (debugInfo.processing.headers?.length || 0) * 
                     ((debugInfo.processing.rows?.length || 0) + 1)
        },
        output: {
          requestCount: debugInfo.output.requests.length,
          endIndex: debugInfo.output.endIndex
        },
        errors: debugInfo.errors
      };
      
      await fs.writeJson(summaryPath, summary, { spaces: 2 });
      
    } catch (error) {
      console.warn('⚠️ Failed to save table conversion debug info:', error.message);
    }
  }
}

module.exports = TableConverter; 