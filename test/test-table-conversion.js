const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');
const TableConverter = require('../lib/core/gdocs/table-converter');
const GoogleDocsConverter = require('../lib/core/gdocs/google-docs-converter');

describe('Table Conversion Tests', () => {
  let tableConverter;
  let googleDocsConverter;

  before(() => {
    process.env.DEBUG_GDOCS_CONVERTER = 'true';
    tableConverter = new TableConverter();
    googleDocsConverter = new GoogleDocsConverter();
  });

  describe('TableConverter', () => {
    it('should parse simple table correctly', () => {
      const markdown = `
| Header 1 | Header 2 |
| -------- | -------- |
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |
`.trim();

      const { requests } = tableConverter.convertTable(markdown, 1);
      
      assert(Array.isArray(requests), 'Requests should be an array');
      assert(requests.length > 0, 'Should have at least one request');
      
      // Verify table creation request
      const tableRequest = requests[0];
      assert.strictEqual(tableRequest.insertTable.rows, 3);
      assert.strictEqual(tableRequest.insertTable.columns, 2);
      
      // Verify text insertion requests exist
      const textRequests = requests.filter(r => r.insertText);
      assert(textRequests.length >= 6, 'Should have text requests for all cells');
    });

    it('should handle table with alignments', () => {
      const markdown = `
| Left | Center | Right |
|:-----|:------:|------:|
| 1    | 2      | 3     |
`.trim();

      const { requests } = tableConverter.convertTable(markdown, 1);
      
      // Verify alignment requests
      const alignmentRequests = requests.filter(r => r.updateParagraphStyle);
      assert(alignmentRequests.length > 0, 'Should have alignment requests');
      
      // Verify specific alignments
      const alignments = alignmentRequests.map(r => r.updateParagraphStyle.paragraphStyle.alignment);
      assert(alignments.includes('START'), 'Should have left alignment');
      assert(alignments.includes('CENTER'), 'Should have center alignment');
      assert(alignments.includes('END'), 'Should have right alignment');
    });

    it('should handle empty cells', () => {
      const markdown = `
| Header 1 | Header 2 |
| -------- | -------- |
|          | Cell 2   |
| Cell 3   |          |
`.trim();

      const { requests } = tableConverter.convertTable(markdown, 1);
      
      // Verify text requests for empty cells
      const textRequests = requests.filter(r => r.insertText);
      const emptyTexts = textRequests.filter(r => r.insertText.text.trim() === '');
      assert(emptyTexts.length > 0, 'Should handle empty cells');
    });
  });

  describe('GoogleDocsConverter Integration', () => {
    it('should convert document with table', async () => {
      const markdown = `
# Test Document

This is a test paragraph.

| Column 1 | Column 2 |
|----------|----------|
| Value 1  | Value 2  |
| Value 3  | Value 4  |

Another paragraph.
`.trim();

      const requests = await googleDocsConverter.convertFromMarkdown(markdown);
      
      // Verify requests array
      assert(Array.isArray(requests), 'Should return array of requests');
      
      // Find table-related requests
      const tableRequests = requests.filter(r => 
        r.insertTable || 
        (r.insertText && r.insertText.text.includes('Column')) ||
        (r.insertText && r.insertText.text.includes('Value'))
      );
      
      assert(tableRequests.length > 0, 'Should have table-related requests');
    });

    it('should handle multiple tables in document', async () => {
      const markdown = `
# Multiple Tables

Table 1:
| A | B |
|---|---|
| 1 | 2 |

Some text between tables.

Table 2:
| X | Y |
|---|---|
| 3 | 4 |
`.trim();

      const requests = await googleDocsConverter.convertFromMarkdown(markdown);
      
      // Count table creation requests
      const tableCreations = requests.filter(r => r.insertTable);
      assert.strictEqual(tableCreations.length, 2, 'Should create two tables');
    });

    it('should handle invalid table gracefully', async () => {
      const markdown = `
| Invalid | Table |
| No separator row |
| Missing | Columns |
`.trim();

      const requests = await googleDocsConverter.convertFromMarkdown(markdown);
      
      // Should not create a table, but handle as text
      const tableRequests = requests.filter(r => r.insertTable);
      assert.strictEqual(tableRequests.length, 0, 'Should not create table for invalid format');
      
      // Should have text content
      const textRequests = requests.filter(r => r.insertText);
      assert(textRequests.length > 0, 'Should handle invalid table as text');
    });
  });

  describe('Debug Output', () => {
    const debugDir = path.join(process.cwd(), '.docusaurus', 'debug');
    
    before(async () => {
      // Clean debug directory
      await fs.emptyDir(debugDir);
    });

    it('should generate debug files for table conversion', async () => {
      const markdown = `
| Debug | Test |
|-------|------|
| Data  | Row  |
`.trim();

      await googleDocsConverter.convertFromMarkdown(markdown);
      
      // Check for debug files
      const files = await fs.readdir(debugDir);
      const debugFiles = files.filter(f => f.includes('debug'));
      assert(debugFiles.length > 0, 'Should create debug files');
      
      // Verify debug file content
      const latestDebug = debugFiles[debugFiles.length - 1];
      const debugContent = await fs.readJson(path.join(debugDir, latestDebug));
      
      assert(debugContent.processing.elements.some(e => e.type === 'table'),
        'Debug info should include table element');
    });
  });
}); 