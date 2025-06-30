const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const fs = require('fs-extra');
const path = require('path');
const http = require('http');
const url = require('url');
const crypto = require('crypto');
const open = require('open');
const chalk = require('chalk');
const axios = require('axios');

class GoogleDocsClient {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.tokensPath = path.join(projectRoot, '.docusaurus', 'google-tokens.json');
    this.oauth2Client = null;
    this.docs = null;
    
    // OAuth2 PKCE configuration
    this.clientId = null;
    this.redirectUri = 'http://127.0.0.1:8080/callback';
    this.scopes = ['https://www.googleapis.com/auth/documents'];
  }

  /**
   * Initialize Google Docs client with OAuth2 PKCE authentication
   */
  async initialize() {
    try {
      // Load client ID from environment
      await this.loadConfig();
      
      // Setup OAuth2 client with client secret (Google's requirement even for Desktop apps)
      this.oauth2Client = new OAuth2Client({
        clientId: this.clientId,
        clientSecret: this.clientSecret,
        redirectUri: this.redirectUri,
      });

      // Try to load existing tokens
      const tokens = await this.loadTokens();
      if (tokens) {
        this.oauth2Client.setCredentials(tokens);
        
        // Verify tokens are still valid
        try {
          await this.oauth2Client.getAccessToken();
          console.log(chalk.green('✅ Using existing Google OAuth2 tokens'));
        } catch (error) {
          console.log(chalk.yellow('⚠️ Existing tokens expired, re-authenticating...'));
          await this.authenticate();
        }
      } else {
        // No existing tokens, start authentication
        await this.authenticate();
      }

      // Initialize Google Docs API
      this.docs = google.docs({ version: 'v1', auth: this.oauth2Client });
      
      console.log(chalk.green('✅ Google Docs client initialized successfully'));
      return true;
    } catch (error) {
      console.error(chalk.red('❌ Failed to initialize Google Docs client:'), error.message);
      throw error;
    }
  }

  /**
   * Load configuration from environment variables
   */
  async loadConfig() {
    const envPath = path.join(this.projectRoot, '.env');
    
    if (await fs.pathExists(envPath)) {
      const dotenv = require('dotenv');
      dotenv.config({ path: envPath });
    }

    this.clientId = process.env.GOOGLE_CLIENT_ID;
    this.clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    
    if (!this.clientId) {
      throw new Error(
        'GOOGLE_CLIENT_ID not found in .env file. Please run "docflu init" to setup Google OAuth2 credentials.'
      );
    }
    
    if (!this.clientSecret) {
      throw new Error(
        'GOOGLE_CLIENT_SECRET not found in .env file. Please run "docflu init" to setup Google OAuth2 credentials.'
      );
    }
  }

  /**
   * Generate PKCE code verifier and challenge
   */
  generatePKCE() {
    const codeVerifier = crypto.randomBytes(96).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    
    return { codeVerifier, codeChallenge };
  }

  /**
   * Exchange authorization code for tokens using PKCE (direct HTTP request)
   */
  async exchangeTokenWithPKCE(code, codeVerifier) {
    try {
      const tokenEndpoint = 'https://oauth2.googleapis.com/token';
      
      const requestBody = new URLSearchParams({
        client_id: this.clientId,
        code: code,
        code_verifier: codeVerifier,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri,
      });

      console.log(chalk.gray('🌐 Making direct PKCE token request...'));
      
      const response = await axios.post(tokenEndpoint, requestBody, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      console.log(chalk.green('✅ PKCE token exchange successful!'));
      return response.data;
      
    } catch (error) {
      console.error(chalk.red('❌ PKCE token exchange failed:'), error.message);
      if (error.response) {
        console.error(chalk.gray('Response status:'), error.response.status);
        console.error(chalk.gray('Response data:'), error.response.data);
      }
      throw error;
    }
  }

  /**
   * OAuth2 PKCE authentication flow
   */
  async authenticate() {
    return new Promise(async (resolve, reject) => {
      try {
        console.log(chalk.blue('🔐 Starting Google OAuth2 PKCE authentication...'));
        
        // Generate PKCE parameters
        const { codeVerifier, codeChallenge } = this.generatePKCE();
        const state = crypto.randomBytes(32).toString('hex');
        
        console.log(chalk.gray('🔑 Generated code verifier and challenge (SHA256)'));

        // Create authorization URL
        const authUrl = this.oauth2Client.generateAuthUrl({
          access_type: 'offline',
          scope: this.scopes,
          code_challenge: codeChallenge,
          code_challenge_method: 'S256',
          state: state,
        });

        // Start localhost server for callback
        const server = http.createServer();
        const port = 8080;
        
        server.on('request', async (req, res) => {
          try {
            const parsedUrl = url.parse(req.url, true);
            
                          if (parsedUrl.pathname === '/callback') {
                const { code, state: returnedState, error } = parsedUrl.query;
                
                console.log(chalk.gray('🔍 Callback received:'));
                console.log(chalk.gray(`   Code: ${code ? code.substr(0, 20) + '...' : 'null'}`));
                console.log(chalk.gray(`   State: ${returnedState ? returnedState.substr(0, 10) + '...' : 'null'}`));
                console.log(chalk.gray(`   Error: ${error || 'null'}`));
              
              // Send response to browser
              res.writeHead(200, { 'Content-Type': 'text/html' });
              if (error) {
                res.end(`
                  <html>
                    <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                      <h2 style="color: #d32f2f;">❌ Authentication Failed</h2>
                      <p>Error: ${error}</p>
                      <p>You can close this tab and try again.</p>
                    </body>
                  </html>
                `);
                reject(new Error(`OAuth2 error: ${error}`));
              } else if (code && returnedState === state) {
                res.end(`
                  <html>
                    <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                      <h2 style="color: #4caf50;">✅ Authentication Successful!</h2>
                      <p>You can now close this tab and return to the terminal.</p>
                      <p>docflu CLI has been granted access to your Google Docs.</p>
                    </body>
                  </html>
                `);
                
                // Exchange authorization code for tokens
                console.log(chalk.blue('🔄 Exchanging authorization code for tokens (PKCE)...'));
                
                // For PKCE flow, we need to use getToken with specific parameters
                const tokenRequest = {
                  code: code,
                  codeVerifier: codeVerifier,
                  redirect_uri: this.redirectUri,
                };
                
                console.log(chalk.gray('📋 Token request parameters:'));
                console.log(chalk.gray(`   Code: ${code ? code.substr(0, 20) + '...' : 'null'}`));
                console.log(chalk.gray(`   Code verifier: ${codeVerifier ? codeVerifier.substr(0, 20) + '...' : 'null'}`));
                console.log(chalk.gray(`   Redirect URI: ${this.redirectUri}`));
                
                // Use Google OAuth2Client library with client secret + PKCE
                const { tokens } = await this.oauth2Client.getToken({
                  code: code,
                  codeVerifier: codeVerifier,
                });
                
                // Set credentials
                this.oauth2Client.setCredentials(tokens);
                
                // Save tokens
                await this.saveTokens(tokens);
                
                console.log(chalk.green('✅ Authentication successful!'));
                console.log(chalk.gray('🔑 Tokens saved to .docusaurus/google-tokens.json'));
                
                resolve(tokens);
              } else {
                res.end(`
                  <html>
                    <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                      <h2 style="color: #ff9800;">⚠️ Invalid Request</h2>
                      <p>Invalid authorization response. Please try again.</p>
                    </body>
                  </html>
                `);
                reject(new Error('Invalid authorization response'));
              }
              
              // Close server
              server.close();
            }
          } catch (error) {
            console.error(chalk.red('❌ Error handling callback:'), error.message);
            server.close();
            reject(error);
          }
        });

        server.listen(port, '127.0.0.1', () => {
          console.log(chalk.gray(`🖥️ Started localhost server on http://127.0.0.1:${port}`));
          console.log(chalk.blue('🌐 Opening browser for consent...'));
          
          // Open browser
          open(authUrl).catch((error) => {
            console.log(chalk.yellow('⚠️ Could not open browser automatically'));
            console.log(chalk.blue('Please open this URL in your browser:'));
            console.log(chalk.cyan(authUrl));
          });
          
          console.log(chalk.yellow('✅ Please approve the application in your browser'));
          console.log(chalk.gray('⏳ Waiting for authorization callback...'));
        });

        // Handle server errors
        server.on('error', (error) => {
          console.error(chalk.red('❌ Server error:'), error.message);
          reject(error);
        });

      } catch (error) {
        console.error(chalk.red('❌ Authentication error:'), error.message);
        reject(error);
      }
    });
  }

  /**
   * Load tokens from file
   */
  async loadTokens() {
    try {
      if (await fs.pathExists(this.tokensPath)) {
        const tokens = await fs.readJson(this.tokensPath);
        return tokens;
      }
      return null;
    } catch (error) {
      console.log(chalk.yellow('⚠️ Could not load existing tokens:', error.message));
      return null;
    }
  }

  /**
   * Save tokens to file
   */
  async saveTokens(tokens) {
    try {
      // Ensure .docusaurus directory exists
      await fs.ensureDir(path.dirname(this.tokensPath));
      
      // Add metadata
      const tokenData = {
        ...tokens,
        client_id: this.clientId,
        pkce_used: true,
        created_at: new Date().toISOString(),
      };
      
      await fs.writeJson(this.tokensPath, tokenData, { spaces: 2 });
    } catch (error) {
      console.error(chalk.red('❌ Failed to save tokens:'), error.message);
      throw error;
    }
  }

  /**
   * Create a new Google Docs document
   */
  async createDocument(title = 'Documentation') {
    try {
      console.log(chalk.blue(`📄 Creating new Google Docs document: "${title}"`));
      
      const response = await this.docs.documents.create({
        requestBody: {
          title: title,
        },
      });

      const document = response.data;
      const documentUrl = `https://docs.google.com/document/d/${document.documentId}`;
      
      console.log(chalk.green('✅ Document created successfully!'));
      console.log(chalk.cyan(`📄 Document ID: ${document.documentId}`));
      console.log(chalk.cyan(`🔗 URL: ${documentUrl}`));
      
      return {
        documentId: document.documentId,
        title: document.title,
        url: documentUrl,
        revisionId: document.revisionId,
      };
    } catch (error) {
      console.error(chalk.red('❌ Failed to create document:'), error.message);
      throw error;
    }
  }



  /**
   * Get document information
   */
  async getDocument(documentId) {
    try {
      const response = await this.docs.documents.get({
        documentId: documentId,
      });
      
      return response.data;
    } catch (error) {
      console.error(chalk.red('❌ Failed to get document:'), error.message);
      throw error;
    }
  }

  /**
   * Test API connectivity
   */
  async testConnection() {
    try {
      console.log(chalk.blue('🔍 Testing Google Docs API connection...'));
      
      // Simple API test without creating dummy documents
      const response = await this.docs.documents.create({
        requestBody: {
          title: 'docflu Connection Test',
        },
      });

      if (response.data.documentId) {
        console.log(chalk.green('✅ Google Docs API connection successful!'));
        return {
          documentId: response.data.documentId,
          title: response.data.title,
          url: `https://docs.google.com/document/d/${response.data.documentId}`,
          revisionId: response.data.revisionId,
        };
      } else {
        throw new Error('Invalid API response');
      }
    } catch (error) {
      console.error(chalk.red('❌ Google Docs API connection failed:'), error.message);
      throw error;
    }
  }
}

module.exports = GoogleDocsClient; 