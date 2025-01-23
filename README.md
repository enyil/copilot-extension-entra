# Copilot Extension for Entra

This sample Copilot extension issues an Entra token for the user.

## Environment Variables

Set these variables in your environment (e.g., add them to a `.env` file):

- **TENANT_ID**: Your Azure Entra tenant ID.
- **CLIENT_ID**: Your Azure app (client) ID.  
- **CLIENT_SECRET**: Your Azure app client's secret.  
- **REDIRECT_URI**: The redirect URI used for the OAuth flow to your own extension web server. ie. http://localhost:3000/callback
- **TOKEN_URL**: The endpoint used to exchange the authorization code for an access token.
- **GITHUB_REDIRECT_URL**: The url used to redirect the user at the end of the authorization. .i.e. your main organization url. https://github.com/enyilCorp   
- **DEBUG**: Set to `"true"` for verbose logging.

Use `npm start` or `yarn start` to start the server after setting your environment variables.