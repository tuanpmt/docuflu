# Google Docs Converter Debug Guide

> Debug functionality for troubleshooting markdown to Google Docs conversion issues

## 🐛 Enable Debug Mode

Set the environment variable to enable detailed debug logging:

```bash
export DEBUG_GDOCS_CONVERTER=true
# or
DEBUG_GDOCS_CONVERTER=true docflu sync --gdocs
```

## 📁 Debug Output Location

Debug files are saved to:
```
.docusaurus/debug/gdocs-converter/
├── conversion-debug-2024-01-27T10-30-45-123Z.json    # Detailed debug info
├── summary-2024-01-27T10-30-45-123Z.json             # Quick summary
├── conversion-debug-empty-content-2024-01-27.json    # Special cases
└── ...
```

## 📄 Debug File Structure

### Main Debug File (`conversion-debug-*.json`)

```json
{
  "timestamp": "2024-01-27T10:30:45.123Z",
  "input": {
    "markdown": "# Hello\n\nThis is **bold** text with `code`.",
    "options": { "filePath": "docs/intro.md", "title": "Introduction" }
  },
  "processing": {
    "lines": [
      {
        "lineNumber": 1,
        "content": "# Hello",
        "trimmed": "# Hello",
        "type": "heading"
      },
      {
        "lineNumber": 2,
        "content": "",
        "trimmed": "",
        "type": "empty"
      },
      {
        "lineNumber": 3,
        "content": "This is **bold** text with `code`.",
        "trimmed": "This is **bold** text with `code`.",
        "type": "paragraph"
      }
    ],
    "elements": [
      {
        "lineNumber": 1,
        "type": "heading",
        "level": 1,
        "content": "Hello",
        "startIndex": 1,
        "endIndex": 7,
        "length": 6,
        "requests": [
          {
            "insertText": {
              "text": "Hello\n",
              "location": { "index": 1 }
            }
          },
          {
            "updateTextStyle": {
              "range": { "startIndex": 1, "endIndex": 6 },
              "textStyle": { "bold": true, "fontSize": { "magnitude": 20, "unit": "PT" } },
              "fields": "bold,fontSize"
            }
          }
        ]
      },
      {
        "lineNumber": 2,
        "type": "paragraph_break",
        "startIndex": 7,
        "endIndex": 8,
        "length": 1,
        "requests": [
          {
            "insertText": {
              "text": "\n",
              "location": { "index": 7 }
            }
          }
        ]
      },
      {
        "lineNumber": 3,
        "type": "paragraph",
        "content": "This is **bold** text with `code`.",
        "startIndex": 8,
        "endIndex": 38,
        "length": 30,
        "inlineFormatting": {
          "originalText": "This is **bold** text with `code`.",
          "processedText": "This is bold text with code.",
          "formattingCount": 2,
          "details": [
            {
              "type": "bold",
              "textContent": "bold",
              "absoluteStart": 16,
              "absoluteEnd": 20,
              "relativeStart": 8,
              "relativeEnd": 12,
              "style": { "bold": true },
              "request": { "updateTextStyle": { ... } }
            },
            {
              "type": "code",
              "textContent": "code",
              "absoluteStart": 31,
              "absoluteEnd": 35,
              "relativeStart": 23,
              "relativeEnd": 27,
              "style": {
                "backgroundColor": { "color": { "rgbColor": { "red": 0.95, "green": 0.95, "blue": 0.95 } } },
                "foregroundColor": { "color": { "rgbColor": { "red": 0.8, "green": 0.2, "blue": 0.2 } } }
              },
              "request": { "updateTextStyle": { ... } }
            }
          ]
        },
        "requests": [ ... ]
      }
    ],
    "indexTracking": [
      {
        "lineNumber": 1,
        "startIndex": 1,
        "lineContent": "# Hello",
        "lineType": "heading"
      },
      {
        "lineNumber": 2,
        "startIndex": 7,
        "lineContent": "",
        "lineType": "empty"
      },
      {
        "lineNumber": 3,
        "startIndex": 8,
        "lineContent": "This is **bold** text with `code`.",
        "lineType": "paragraph"
      }
    ]
  },
  "output": {
    "requests": [ ... ],
    "totalLength": 37,
    "requestCount": 6,
    "summary": {
      "totalElements": 3,
      "elementTypes": {
        "heading": 1,
        "paragraph_break": 1,
        "paragraph": 1
      },
      "indexRange": {
        "start": 1,
        "end": 37
      }
    }
  },
  "errors": [],
  "metadata": {
    "converterVersion": "1.0.0",
    "nodeVersion": "v18.17.0",
    "debugEnabled": true,
    "debugDir": ".docusaurus/debug/gdocs-converter",
    "filename": "conversion-debug-2024-01-27T10-30-45-123Z.json"
  }
}
```

### Summary File (`summary-*.json`)

```json
{
  "timestamp": "2024-01-27T10:30:45.123Z",
  "inputLength": 42,
  "outputRequests": 6,
  "totalElements": 3,
  "elementTypes": {
    "heading": 1,
    "paragraph_break": 1,
    "paragraph": 1
  },
  "indexRange": {
    "start": 1,
    "end": 37
  },
  "errors": [],
  "filename": "conversion-debug-2024-01-27T10-30-45-123Z.json"
}
```

## 🔍 Debugging Common Issues

### 1. **Index Positioning Errors**

**Problem**: Formatting applied to wrong text positions

**Debug Steps**:
1. Check `indexTracking` array for start positions
2. Compare `absoluteStart/absoluteEnd` vs `relativeStart/relativeEnd`
3. Verify `endIndex` calculations in elements

**Example**:
```json
{
  "type": "code",
  "textContent": "code",           // ← Should match the actual text
  "absoluteStart": 31,             // ← Position in final document
  "absoluteEnd": 35,               // ← End position in final document
  "relativeStart": 23,             // ← Position in processed paragraph
  "relativeEnd": 27                // ← End position in processed paragraph
}
```

### 2. **Overlapping Format Ranges**

**Problem**: Multiple formats applied to same text range

**Debug Steps**:
1. Check `inlineFormatting.details` for overlapping ranges
2. Look for `absoluteStart/absoluteEnd` conflicts
3. Verify format order in requests

### 3. **Missing Content**

**Problem**: Text not appearing in Google Docs

**Debug Steps**:
1. Check if element appears in `elements` array
2. Verify `insertText` requests have correct indices
3. Check `requests` array for missing insertText operations

### 4. **Code Block Issues**

**Problem**: Code blocks not formatted correctly

**Debug Steps**:
1. Look for `code_block` elements
2. Check `language` field and `linesSpanned`
3. Verify `createCodeBlock` requests structure

## 🛠️ Debug Analysis Tools

### Quick Analysis Script

```javascript
// analyze-debug.js
const fs = require('fs');

function analyzeDebugFile(filepath) {
  const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  
  console.log('=== CONVERSION ANALYSIS ===');
  console.log(`Input Length: ${data.input.markdown.length} chars`);
  console.log(`Output Requests: ${data.output.requestCount}`);
  console.log(`Total Elements: ${data.output.summary.totalElements}`);
  console.log(`Index Range: ${data.output.summary.indexRange.start} → ${data.output.summary.indexRange.end}`);
  
  console.log('\n=== ELEMENT BREAKDOWN ===');
  data.processing.elements.forEach((element, i) => {
    console.log(`${i + 1}. ${element.type} (Line ${element.lineNumber})`);
    console.log(`   Index: ${element.startIndex} → ${element.endIndex} (${element.length} chars)`);
    if (element.inlineFormatting) {
      console.log(`   Inline Formats: ${element.inlineFormatting.formattingCount}`);
      element.inlineFormatting.details.forEach(format => {
        console.log(`     - ${format.type}: "${format.textContent}" @ ${format.absoluteStart}-${format.absoluteEnd}`);
      });
    }
  });
  
  if (data.errors.length > 0) {
    console.log('\n=== ERRORS ===');
    data.errors.forEach(error => console.log(`❌ ${error}`));
  }
}

// Usage: node analyze-debug.js path/to/debug-file.json
```

### Index Validation

```javascript
function validateIndices(debugData) {
  const elements = debugData.processing.elements;
  let expectedIndex = 1;
  
  for (const element of elements) {
    if (element.startIndex !== expectedIndex) {
      console.error(`❌ Index gap at element ${element.type}: expected ${expectedIndex}, got ${element.startIndex}`);
    }
    expectedIndex = element.endIndex;
  }
  
  console.log(`✅ Final index: ${expectedIndex}, Expected total: ${debugData.output.totalLength + 1}`);
}
```

## 📊 Performance Analysis

Debug files also help analyze conversion performance:

- **Large documents**: Check element count vs processing time
- **Complex formatting**: Count inline formatting operations
- **Request optimization**: Analyze request count vs content length

## 🧹 Cleanup Debug Files

```bash
# Remove old debug files (older than 7 days)
find .docusaurus/debug/gdocs-converter -name "*.json" -mtime +7 -delete

# Remove all debug files
rm -rf .docusaurus/debug/gdocs-converter
```

## 💡 Tips

1. **Enable debug for specific files**: Use single file sync to debug specific documents
2. **Compare before/after**: Save debug files before and after fixes
3. **Use summary files**: Quick overview without full details
4. **Check metadata**: Verify converter version and environment
5. **Validate indices**: Ensure no gaps or overlaps in text ranges 