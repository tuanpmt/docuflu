# Google OAuth2 Setup Guide for docflu CLI

## 🎯 Overview

To use Google Docs sync functionality, you need to setup OAuth2 credentials in Google Cloud Console. docflu uses **OAuth2 with PKCE flow** - a secure method for CLI applications.

**⚠️ Important Note**: Although OAuth2 PKCE spec doesn't require `client_secret` for Desktop applications, Google's implementation still requires both `client_id` and `client_secret` even for Desktop apps.

## 📋 Prerequisites

- Google account
- Project to sync (Docusaurus or markdown files)
- docflu CLI installed

## 🔧 Step-by-Step Setup

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **"Select a project"** → **"New Project"**
3. Enter project name: `docflu-sync` (or your preferred name)
4. Click **"Create"**

### 2. Enable Google Docs API

1. In the newly created project, go to **"APIs & Services"** → **"Library"**
2. Search **"Google Docs API"**
3. Click on **"Google Docs API"**
4. Click **"Enable"**

### 3. Create OAuth2 Credentials

1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
3. If you don't have OAuth consent screen yet:
   - Click **"CONFIGURE CONSENT SCREEN"**
   - Select **"External"** → **"Create"**
   - Fill in basic information:
     - App name: `docflu CLI`
     - User support email: your-email@gmail.com
     - Developer contact: your-email@gmail.com
   - Click **"Save and Continue"** through the steps
   - Return to **"Credentials"**

4. Create OAuth client ID:
   - Application type: **"Desktop application"**
   - Name: `docflu CLI Client`
   - Click **"Create"**

### 4. Get Credentials

**⚠️ IMPORTANT**: Desktop applications do NOT need to configure redirect URIs manually. Google automatically allows loopback addresses.

1. In the credentials list, click on **"docflu CLI Client"**
2. Copy **Client ID**: Format `123456789-abc123.apps.googleusercontent.com`
3. Copy **Client Secret**: Format `GOCSPX-...` 
4. **Note**: Even though it's a Desktop app, Google still requires client secret

## 🔑 Configure docflu

### 1. Setup .env file

```bash
# In project directory
docflu init

# Or create .env manually
cp env.example .env
```

### 2. Update Google OAuth2 Credentials

Edit `.env` file:

```bash
# Google Docs Configuration (OAuth2 with PKCE)
GOOGLE_CLIENT_ID=123456789-abc123.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx
GOOGLE_DOCUMENT_TITLE=Documentation
```

**🔒 Security Note**: Client secret for Desktop apps is not truly "secret" as it can be reverse engineered. Google still requires it to validate client identity.

### 3. Test Configuration

```bash
# Test client setup
npm run test:google-docs

# Test OAuth2 flow (dry-run)
docflu sync --gdocs --docs --dry-run
```

## 🚀 First Sync

```bash
# Sync to Google Docs
docflu sync --gdocs --docs
```

OAuth2 Flow will:
1. 🔐 Open browser for authentication
2. ✅ User approve docflu CLI access
3. 🔄 Exchange authorization code + PKCE verifier
4. 🔑 Save tokens to `.docusaurus/google-tokens.json`
5. 📄 Create Google Docs document
6. 📝 Add dummy content with formatting
7. ✅ Display results and URL

## 🔍 Troubleshooting

### Error: "OAuth client was not found"

- ✅ Check GOOGLE_CLIENT_ID in .env
- ✅ Verify client ID format: `*-*.apps.googleusercontent.com`
- ✅ Ensure OAuth client type is "Desktop application"

### Error: "client_secret is missing"

- ✅ Add GOOGLE_CLIENT_SECRET to .env file
- ✅ Verify client secret format: `GOCSPX-...`
- ✅ Copy exactly from Google Cloud Console

### Error: "invalid_request"

- ✅ Check Google Docs API is enabled
- ✅ Port 8080 is not blocked
- ✅ Verify both client_id and client_secret are correct

### Error: "access_denied"

- ✅ Approve application in browser
- ✅ Check Google account permissions
- ✅ Try authenticating again

### Error: "redirect_uri_mismatch"

- ✅ Desktop apps don't need to configure redirect URIs
- ✅ Google automatically accepts `http://127.0.0.1:8080/callback`
- ✅ Ensure port 8080 is available

## 📊 Expected Results

When successful, you will see:

```bash
🚀 Syncing all docs/ to google-docs
📂 Project root: /Users/your-user/project
🔐 Starting Google OAuth2 PKCE authentication...
🔑 Generated code verifier and challenge (SHA256)
🖥️ Started localhost server on http://127.0.0.1:8080
🌐 Opening browser for consent...
✅ Please approve the application in your browser
⏳ Waiting for authorization callback...
🔍 Callback received:
   Code: 4/0AVMBsJj7zSrC4B5Lt...
   State: 5c2b6d1f6c...
   Error: null
🔄 Exchanging authorization code for tokens (PKCE)...
✅ Authentication successful!
🔑 Tokens saved to .docusaurus/google-tokens.json
✅ Google Docs client initialized successfully
📄 Creating new Google Docs document: "docflu API Test"
✅ Document created successfully!
📄 Document ID: 1znjTFaguiVUSCZx8h56X5kac4Q5Jin3qRGfFTHNZdck
🔗 URL: https://docs.google.com/document/d/1znjTFaguiVUSCZx8h56X5kac4Q5Jin3qRGfFTHNZdck
📝 Adding dummy content...
✅ Dummy content added successfully!
📊 Applied 3 formatting requests
✅ Google Docs sync completed successfully!
```

## 🔒 Security Notes

- **PKCE + Client Secret**: Google requires both for Desktop apps
- **Local Tokens**: Tokens are saved in `.docusaurus/google-tokens.json`
- **Auto Refresh**: Tokens automatically refresh when expired
- **Localhost Only**: OAuth callback only works on localhost:8080
- **No Redirect URI Config**: Desktop apps don't need manual redirect URI setup

## 🎯 Implementation Details

### OAuth2 Flow with Google

1. **Authorization Request**: Generate PKCE code_verifier + code_challenge
2. **User Consent**: Open browser for user approval
3. **Authorization Code**: Receive code from Google callback
4. **Token Exchange**: Send code + code_verifier + client_secret
5. **Access Token**: Receive tokens and save locally
6. **API Calls**: Use access token for Google Docs API

### File Structure

```
your-project/
├── .env                              # OAuth2 credentials
├── .docusaurus/
│   ├── google-tokens.json           # OAuth2 tokens (auto-generated)
│   └── sync-state.json              # Sync state (future)
└── docs/                            # Markdown files to sync
```

## 🆘 Support

If you encounter issues:

1. **Check Credentials**:
   ```bash
   grep GOOGLE_ .env
   # Must have both CLIENT_ID and CLIENT_SECRET
   ```

2. **Test Client Setup**:
   ```bash
   npm run test:google-docs
   ```

3. **Check Google Cloud Console**:
   - Google Docs API enabled
   - OAuth client type = Desktop application
   - Credentials are correct

4. **Network Issues**:
   - Port 8080 available
   - Firewall doesn't block localhost
   - Internet connection stable

5. **Resources**:
   - [Google OAuth2 Documentation](https://developers.google.com/identity/protocols/oauth2/native-app)
   - [Google Docs API Reference](https://developers.google.com/docs/api)
   - [OAuth2 PKCE RFC](https://tools.ietf.org/html/rfc7636)

---

**🎯 Status**: ✅ OAuth2 authentication successful → ✅ Google Docs API working → 🚀 Ready for markdown parsing!

**Next Phase**: Implement markdown parsing, tab hierarchy, and content conversion for Google Docs format. 