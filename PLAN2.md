# PLAN 2: docflu CLI - Docusaurus to Google Docs Sync

> **🎯 STATUS**: ⚠️ Phase 1 PARTIAL - Basic text sync completed, advanced features pending  
> **📅 Updated**: 2025-01-27  
> **🚀 Next**: Phase 2 - Image processing, table support, and content organization

## 1. Specific Requirements Analysis

### 1.1 Goals

- **CLI Tool**: `docflu` - command line interface (extend existing)
- **Command**: `docflu sync --gdocs` - sync Docusaurus to Google Docs
- **Direction**: 1-way sync (Markdown → Google Docs)
- **Auth**: OAuth2 Desktop App flow with browser approval for Google Docs API
- **Config**: `.env` file in project root for Google OAuth credentials
- **State**: `.docusaurus/` folder to store sync information (compatible with existing)
- **Auto-detect**: Automatically detect Docusaurus project structure (reuse existing)
- **Incremental Sync**: Only sync changed files (reuse existing mechanism)
- **Dry Run**: Preview changes without applying (reuse existing)

### 1.2 Input/Output

- **Input**: Docusaurus project (`docs/` folder only)
- **Output**: Google Docs document with formatted content
- **State Management**: Track sync status, timestamps, document IDs in `.docusaurus/`

## 2. Architecture and Design

### 2.1 Extended CLI Structure

```
docflu/                        # Global CLI package
├── bin/
│   └── docflu.js             # CLI entry point (extend with --gdocs)
├── lib/
│   ├── commands/
│   │   ├── sync.js           # Existing Confluence sync command
│   │   ├── sync_gdocs.js     # Google Docs sync command
│   │   └── init.js           # docflu init command (extend with Google OAuth)
│   ├── core/
│   │   ├── gdocs/
│   │   │   ├── google-docs-converter.js   # Markdown → Google Docs conversion
│   │   │   ├── google-docs-state.js       # State management
│   │   │   ├── google-docs-sync.js        # Sync orchestrator
│   │   │   └── google-docs-client.js      # Google Docs API client
│   │   └── config.js              # Extend for Google OAuth config
│   ├── test/
│   │   └── gdocs/
│   │       ├── test-converter.js      # Converter testing
│   │       ├── test-sync.js           # Sync engine testing
│   │       └── test-all-gdocs.js      # Comprehensive test suite
│   └── utils/
│       └── validators.js      # Extend for Google Docs validation
└── package.json               # Add Google APIs dependencies
```

### 2.2 Project Structure (User's Docusaurus)

```
my-docusaurus-site/
├── .env                       # Extended config (Google + Confluence)
├── .docusaurus/               # Docusaurus build & sync state directory
│   ├── sync-state.json       # Extended: Confluence + Google Docs state
│   ├── google-tokens.json    # ❌ NEW: OAuth2 tokens storage
│   ├── cache/                # Cached data (Docusaurus build cache)
│   └── logs/                 # Sync logs (extend for Google Docs)
├── docs/                     # Docusaurus docs
├── blog/                     # Docusaurus blog
├── docusaurus.config.ts      # Docusaurus config
└── package.json
```

### 2.3 Data Flow

```
docflu sync --gdocs → Load .env → OAuth2 Auth → Scan Docusaurus → Parse Markdown → Google Docs API → Update .docusaurus/
```

## 3. Technical Implementation

### 3.1 Dependencies ✅ COMPLETED

```json
{
  "dependencies": {
    // Existing dependencies
    "axios": "^1.6.0",
    "markdown-it": "^13.0.1",
    "gray-matter": "^4.0.3",
    "fs-extra": "^11.1.1",
    "commander": "^9.4.1",
    "chalk": "^4.1.2",
    "dotenv": "^16.3.1",
    "ora": "^5.4.1",

    // NEW: Google APIs dependencies ✅ INSTALLED
    "googleapis": "^128.0.0",
    "google-auth-library": "^9.4.0",
    "open": "^8.4.0"
  }
}
```

### 3.2 Core Features ✅ 8/20 IMPLEMENTED

#### 3.2.1 Extended CLI Commands ⚠️ PARTIAL

- ✅ `docflu init` - Setup Google OAuth credentials (COMPLETED)
- ⚠️ `docflu sync --gdocs` - Basic text sync only (PARTIAL)
- ⚠️ `docflu sync --gdocs --docs` - Basic text sync only (PARTIAL)
- ✅ `docflu sync --gdocs --dry-run` - Preview changes (COMPLETED)

#### 3.2.2 Google OAuth2 Authentication ✅ COMPLETED

- ✅ OAuth2 Authorization Code flow implementation
- ✅ Browser-based user consent flow
- ✅ Token storage and refresh mechanism
- ✅ Credential validation and error handling
- ✅ Scope management for Google Docs API

#### 3.2.3 Google Docs API Client ⚠️ PARTIAL

- ✅ Basic text content insertion
- ✅ Document creation and management
- ✅ Batch operations for performance
- ❌ Image upload and processing (PENDING)
- ❌ Table support (PENDING)
- ❌ Internal link processing (NOT FEASIBLE - Google Docs limitation)

#### 3.2.4 Content Organization ❌ NOT IMPLEMENTED

- ❌ Tab-based hierarchy (CANCELLED - Google Docs API limitation)
- ⚠️ All content in single document (CURRENT APPROACH)
- ❌ Content separation strategy needed

#### 3.2.5 Markdown to Google Docs Converter ⚠️ PARTIAL

- ✅ Basic text conversion
- ✅ Headings with proper formatting
- ✅ Lists (ordered and unordered)
- ✅ Basic inline formatting (bold, italic, code)
- ❌ Table conversion (PENDING)
- ❌ Image processing (PENDING)
- ❌ Mermaid/chart processing (PENDING - depends on image support)
- ❌ Internal links (NOT FEASIBLE - Google Docs limitation)

#### 3.2.6 State Management ✅ COMPLETED

- ✅ Track Google Docs document ID
- ✅ Store sync timestamps
- ✅ Change detection for incremental sync
- ✅ Sync statistics and reporting
- ✅ Error tracking and recovery

### 3.3 Configuration

#### 3.3.1 Extended .env File

```bash
# Google Docs Configuration
GOOGLE_CLIENT_ID=your-oauth2-client-id.googleusercontent.com
GOOGLE_DOCUMENT_TITLE=Documentation

# Optional Settings
docflu_EXCLUDE_PATTERNS=*.draft.md,private/**
docflu_CONCURRENT_UPLOADS=5
docflu_RETRY_COUNT=3
docflu_GOOGLE_SCOPES=https://www.googleapis.com/auth/documents
```

## 4. Current Status and Limitations

### ✅ Completed Features
1. **Authentication**: 
   - OAuth2 flow with browser consent
   - Token storage and refresh
   - Scope management
   - Error handling

2. **Basic Text Sync**: 
   - Headings with proper formatting
   - Paragraphs with inline styles
   - Lists (ordered/unordered)
   - Code blocks with language support
   - Basic text formatting (bold, italic)
   - Batch operations for performance

3. **State Management**:
   - Document tracking
   - Incremental sync
   - Change detection
   - Sync statistics
   - Error tracking

4. **Error Handling**:
   - Retry mechanism
   - Validation checks
   - Error recovery
   - Detailed logging
   - Graceful degradation

5. **Performance**:
   - Batch operations
   - Incremental sync
   - File change detection
   - Resource optimization

### ❌ Known Limitations
1. **Image Support**:
   - No image upload capability yet
   - ImageProcessor structure ready but not implemented
   - Affects Mermaid/chart rendering
   - Planned for next phase

2. **Table Support**:
   - Complex markdown tables not supported
   - No table conversion logic yet
   - Requires special handling
   - Will be implemented separately

3. **Internal Links**:
   - Not feasible with current approach
   - Google Docs API limitations
   - All content in single document
   - No viable workaround identified

4. **Content Organization**:
   - Tab-based hierarchy cancelled
   - Google Docs API limitations
   - Single document approach
   - Need alternative organization strategy

## 5. Error Handling & Recovery

### 5.1 Common Scenarios
- Network connectivity issues
- Authentication failures
- API rate limiting
- Invalid markdown syntax
- Missing files/assets

### 5.2 Recovery Strategies
- Retry logic with exponential backoff
- Automatic token refresh
- Validation before sync
- Detailed error logging
- Graceful degradation

## 6. Next Steps

### Phase 2: Enhanced Content Support
1. **Image Processing**:
   - Implement image upload
   - Handle local and remote images
   - Support for diagrams/charts

2. **Table Support**:
   - Develop table conversion logic
   - Handle complex markdown tables
   - Preserve formatting

3. **Content Organization**:
   - Develop alternative to tab hierarchy
   - Improve document structure
   - Better content separation

### Phase 3: Polish & Optimization
1. **Performance Improvements**:
   - Batch processing
   - Concurrent operations
   - Resource optimization

2. **Error Handling**:
   - Enhanced recovery
   - Better error messages
   - Validation improvements

## 7. OAuth2 Implementation

### 7.1 OAuth2 PKCE Flow
- **Security**: PKCE (Proof Key for Code Exchange) recommended by Google
- **Browser Flow**: Automatic browser opening for consent
- **Token Management**: Secure storage in `.docusaurus/`
- **Cross-Platform**: Works on Windows, macOS, Linux

### 7.2 Dependencies
```json
{
  "googleapis": "^128.0.0",      // Google APIs client
  "google-auth-library": "^9.4.0", // OAuth2 + PKCE
  "open": "^8.4.0"              // Browser opener
}
```

## 8. Testing Strategy

### 8.1 Unit Tests
- OAuth2 flow testing
- Content conversion testing
- State management testing

### 8.2 Integration Tests
- End-to-end sync testing
- Real Google Docs API testing

## 9. Success Criteria

### 9.1 Functional Requirements
- ✅ OAuth2 authentication working
- ⚠️ Basic text sync working
- ❌ Image support pending
- ❌ Table support pending
- ❌ Content organization needs improvement

### 9.2 Performance Requirements
- Sync 50+ documents within 2 minutes
- Memory usage under 200MB
- Successful OAuth2 flow within 30 seconds
- API rate limiting compliance

## 10. Future Enhancements (Phase 8+)

### 10.1 Advanced Features

- ❌ Bi-directional sync (Google Docs → Markdown)
- ❌ Real-time collaboration support
- ❌ Comment and suggestion handling
- ❌ Version history integration
- ❌ Multiple document support
- ❌ Template-based document creation

### 10.2 Integration Features

- ❌ Google Drive integration for assets
- ❌ Google Sheets integration for data
- ❌ CI/CD pipeline integration
- ❌ Webhook support for real-time sync
- ❌ API for third-party integrations

**🎯 GOAL**: Comprehensive Docusaurus → Google Docs sync tool with OAuth2 authentication, full tabs hierarchy support, rich content conversion, and seamless multi-platform synchronization alongside existing Confluence functionality!

## 11. OAuth2 PKCE Feasibility Analysis ✅ HIGHLY RECOMMENDED

### 11.1 Why PKCE is Perfect for CLI Apps

OAuth2 with PKCE (Proof Key for Code Exchange) is the **officially recommended method by Google** for CLI/Desktop applications for the following reasons:

#### ✅ **Security Advantages**

- **No Client Secret**: No need to store client_secret in code (public client)
- **Dynamic Security**: New code_verifier and code_challenge generated for each auth
- **MITM Protection**: Code challenge protects against man-in-the-middle attacks
- **Replay Attack Prevention**: Code verifier can only be used once

#### ✅ **CLI-Friendly Features**

- **Localhost Redirect**: Uses http://127.0.0.1:port for callback
- **Browser Integration**: Automatically opens browser for user consent
- **No Manual Copy/Paste**: No need for user to copy/paste authorization code
- **Cross-Platform**: Works on Windows, macOS, Linux

### 11.2 Technical Implementation Details

#### 11.2.1 PKCE Flow for CLI App

```javascript
// 1. Generate code verifier (43-128 characters)
const codeVerifier = generateRandomString(128);

// 2. Create code challenge (SHA256 hash)
const codeChallenge = base64URLEncode(sha256(codeVerifier));

// 3. Start localhost server
const server = http.createServer();
server.listen(8080);

// 4. Build authorization URL
const authUrl =
  `https://accounts.google.com/o/oauth2/v2/auth?` +
  `client_id=${clientId}&` +
  `response_type=code&` +
  `scope=${scopes}&` +
  `redirect_uri=http://127.0.0.1:8080&` +
  `code_challenge=${codeChallenge}&` +
  `code_challenge_method=S256&` +
  `state=${randomState}`;

// 5. Open browser
open(authUrl);

// 6. Handle callback and exchange code
const tokenResponse = await exchangeCodeForTokens({
  code: authorizationCode,
  code_verifier: codeVerifier, // No client_secret needed!
  client_id: clientId,
  redirect_uri: "http://127.0.0.1:8080",
});
```

#### 11.2.2 Google's Official Support

According to [Google's OAuth 2.0 for Mobile & Desktop Apps](https://developers.google.com/identity/protocols/oauth2/native-app):

- ✅ **Supported**: "Google supports the Proof Key for Code Exchange (PKCE) protocol"
- ✅ **Recommended**: "We recommend using the latest version of Google Identity Services"
- ✅ **Localhost**: "Loopback IP address http://127.0.0.1:port" officially supported
- ✅ **No Client Secret**: "The client secret is obviously not treated as a secret"

### 11.3 Real-World Examples

#### 11.3.1 Existing CLI Tools Using PKCE

- **[oktadev/pkce-cli](https://github.com/oktadev/pkce-cli)**: Production-ready PKCE CLI implementation
- **[x-color/google-oauth-cli](https://github.com/x-color/google-oauth-cli)**: Google-specific PKCE CLI tool
- **[aneshas/oauth](https://github.com/aneshas/oauth)**: Generic OAuth2 PKCE CLI authenticator

#### 11.3.2 Success Stories

- **Google Cloud SDK**: Uses PKCE for `gcloud auth login`
- **GitHub CLI**: Uses similar OAuth2 with device flow
- **AWS CLI**: Uses OAuth2 for SSO authentication
- **Azure CLI**: Uses OAuth2 for `az login`

### 11.4 Implementation Advantages for docflu

#### ✅ **User Experience**

```bash
$ docflu auth --gdocs
🔐 Starting Google OAuth2 PKCE authentication...
🌐 Opening browser for consent...
# Browser opens automatically → User clicks Allow → Automatically returns to CLI
✅ Authentication successful!
```

#### ✅ **Security Best Practices**

- **No Secrets in Code**: Public Client ID, no client_secret needed
- **Temporary Server**: Localhost server only runs during auth process
- **Token Storage**: Secure storage in `.docusaurus/google-tokens.json`
- **Auto Refresh**: Automatic token refresh when expired

#### ✅ **Cross-Platform Compatibility**

- **Windows**: `start` command to open browser
- **macOS**: `open` command to open browser
- **Linux**: `xdg-open` command to open browser
- **Universal**: `open` npm package handles all platforms

### 11.5 Dependencies and Libraries

#### 11.5.1 Required Dependencies

```json
{
  "googleapis": "^128.0.0", // Google APIs client
  "google-auth-library": "^9.4.0", // OAuth2 + PKCE support
  "open": "^8.4.0", // Cross-platform browser opener
  "http": "built-in", // Node.js built-in HTTP server
  "crypto": "built-in" // Node.js built-in crypto for PKCE
}
```

#### 11.5.2 No Additional Setup Required

- ❌ **No SSL certificates** needed (unlike custom URI schemes)
- ❌ **No app registration** in OS (unlike deep links)
- ❌ **No manual copy/paste** (unlike out-of-band flow)
- ❌ **No client_secret management** (unlike confidential clients)

### 11.6 Potential Challenges & Solutions

#### 🔧 **Challenge 1**: Port Conflicts

**Solution**: Dynamic port allocation with fallback ports

```javascript
const availablePorts = [8080, 8081, 8082, 3000, 5000];
const port = await findAvailablePort(availablePorts);
```

#### 🔧 **Challenge 2**: Firewall Issues

**Solution**: Use loopback IP (127.0.0.1) instead of localhost

```javascript
const redirectUri = `http://127.0.0.1:${port}/callback`;
```

#### 🔧 **Challenge 3**: Browser Not Available

**Solution**: Fallback to manual URL with clear instructions

```javascript
if (!browserAvailable) {
  console.log("Please open this URL in your browser:");
  console.log(authUrl);
}
```
