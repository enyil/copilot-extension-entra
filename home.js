import { createServer } from 'node:http';
import { prompt, createDoneEvent, createTextEvent, createConfirmationEvent } from "@copilot-extensions/preview-sdk";
import { parse } from 'node:url';
import { jwtDecode } from 'jwt-decode';

async function getUserInfoFromGitHubToken(token) {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (!response.ok) {
      console.error('GitHub API error:', response.status);
      return null;
    }
    
    const userData = await response.json();
    return userData.email || userData.login;
  } catch (error) {
    console.error('Failed to get GitHub user info:', error);
    return null;
  }
}

function getUserInfoFromEntraToken(token) {
  try {
    const decoded = jwtDecode(token);
    return decoded.email || decoded.upn || decoded.oid || decoded.sub;
  } catch (error) {
    console.error('Failed to decode Entra token:', error);
    return null;
  }
}

function getRequestBody(request) {
  return new Promise((resolve) => {
    const bodyParts = [];
    let body;
    request
      .on("data", (chunk) => {
        bodyParts.push(chunk);
      })
      .on("end", () => {
        body = Buffer.concat(bodyParts);
        resolve(body);
      });
  });
}

class TokenStore {
  constructor() {
    this.tokens = new Map();
    this.debug = process.env.DEBUG === 'true';
    setInterval(() => this.cleanupExpiredTokens(), 5 * 60 * 1000);
  }

  log(...args) {
    if (this.debug) {
      console.log('[TokenStore]', ...args);
    }
  }

  storeToken(token) {
    try {
      const userIdentifier = getUserInfoFromEntraToken(token);
      if (!userIdentifier) {
        throw new Error('Could not extract user identifier from token');
      }
      
      const tokenData = {
        token,
        expiresAt: Date.now() + (3600 * 1000), // 1 hour
        userIdentifier
      };
      
      this.tokens.set(userIdentifier, tokenData);
      this.log('Stored token for user:', userIdentifier);
      this.log('Current tokens:', Array.from(this.tokens.keys()));
      return userIdentifier;
    } catch (error) {
      this.log('Failed to store token:', error);
      throw error;
    }
  }

  hasValidToken(userId) {
    const tokenData = this.tokens.get(userId);
    return tokenData && Date.now() < tokenData.expiresAt;
  }

  getToken(userId) {
    const tokenData = this.tokens.get(userId);
    this.log('Getting token for user:', userId, 'found:', !!tokenData);
    
    if (!tokenData) {
      return null;
    }

    if (Date.now() > tokenData.expiresAt) {
      this.log('Token expired for user:', userId);
      this.tokens.delete(userId);
      return null;
    }

    return tokenData.token;
  }

  cleanupExpiredTokens() {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [userId, tokenData] of this.tokens.entries()) {
      if (now > tokenData.expiresAt) {
        this.tokens.delete(userId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      this.log(`Cleaned up ${cleanedCount} expired tokens`);
    }
  }
}

const tokenStore = new TokenStore();
const endpoint = "https://models.inference.ai.azure.com/chat/completions";
const modelName = "gpt-4o";
const AUTH_URL = `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/authorize?client_id=${process.env.CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}&scope=openid%20profile`;

const createAuthHtml = (authUrl) => `
<!DOCTYPE html>
<html>
  <head>
    <style>
      .auth-button {
        display: inline-block;
        padding: 10px 20px;
        background-color: #2ea44f;
        color: white;
        text-decoration: none;
        border-radius: 6px;
        font-family: -apple-system,system-ui,"Segoe UI",Helvetica,Arial,sans-serif;
      }
    </style>
  </head>
  <body>
    <a href="${authUrl}" class="auth-button">Authorize</a>
  </body>
</html>`;

const createCustomMessage = (content) => {
  return `data: ${JSON.stringify({
    type: 'assistant',
    message: { content, role: 'assistant' }
  })}\n\n`;
};

const server = createServer(async (req, res) => {
  const { pathname, query } = parse(req.url, true);

  // Handle authentication routes
  if (pathname === '/auth') {
    const authUrl = `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/authorize?client_id=${process.env.CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}&scope=openid%20profile`;
    res.writeHead(302, { Location: authUrl });
    console.log('Redirecting to auth URL');
    return res.end();
  }

  if (pathname === '/github-redirect') {
    const authUrl = `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/authorize?client_id=${process.env.CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}&scope=openid%20profile`;
    res.writeHead(302, { Location: authUrl });
    console.log('Redirecting to auth URL');
    return res.end();
  }

  if (pathname === '/callback') {
    const code = query.code;
    if (!code) {
      res.writeHead(400);
      console.log('Code not found');
      return res.end('Code not found');
    }

    try {
      const data = new URLSearchParams({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        code,
        redirect_uri: process.env.REDIRECT_URI,
        grant_type: 'authorization_code',
      });

      const response = await fetch(process.env.TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: data.toString(),
      });

      if (!response.ok) {
        res.writeHead(500);
        console.log('Failed to exchange token');
        return res.end('Failed to exchange token');
      }

      
      const tokenResponse = await response.json();
      const userId = tokenStore.storeToken(tokenResponse.access_token);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      console.log('Entra Token exchange successful');
      res.writeHead(302, { Location: `${process.env.GITHUB_REDIRECT_URL}` });
      return res.end();
    } catch (err) {
      res.writeHead(500);
      return res.end('Token exchange failed');
    }
  }

  // Handle chat completion route
  if (pathname === '/chat' && req.method === 'POST') {
    try {
      const githubToken = req.headers["x-github-token"];
      console.log('GitHub token:', githubToken);
      var userIdentifier = await getUserInfoFromGitHubToken(githubToken);
      console.log('User identifier:', userIdentifier);
      
      if (!userIdentifier) {
        res.writeHead(401);
        console.log('Unable to identify user from GitHub token');
        return res.end('Unable to identify user from GitHub token');
      }
      const entraToken = tokenStore.getToken(userIdentifier);
      if (!entraToken) {
        console.log('No Entra token found, sending auth message');
        
        res.write(createTextEvent(`Please authenticate to use this extension here: ${AUTH_URL}`));
        return res.end();
      }
      console.log('Entra token found!');
      // print entire request body
      const body = await getRequestBody(req);
      var payload = JSON.parse(body);
      // append to messages with a system prompt telling the model it is an assistant for EnyilCorp that helps with azure resources
      var history = payload.messages;
      history.push({
        role: 'system',
        content: 'You are an assistant for EnyilCorp that helps with azure resources. Your name is enyilCorpuso.',
      });
      console.log('Payload:', payload);
      console.log('Messages:', history);
      console.log('headers:', req.headers);
      const { stream } = await prompt.stream({
        messages: payload.messages,
        model: modelName,
        endpoint,
        token: githubToken,
      });

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      for await (const chunk of stream) {
        res.write(new TextDecoder().decode(chunk));
        console.log('new chunk');
      }

      res.write(createDoneEvent());
      return res.end();
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        error: 'Chat completion failed',
        authUrl: err.name === 'TokenExpiredError' ? AUTH_URL : undefined
      }));
    }
  }

  // Default route
  res.writeHead(200);
  res.end('Hello from Developer World!');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
