# Copilot Extension - GitHub Model Integration

**Copilot Extension Utilizing GitHub Model [OpenAI GPT-4o Mini] for Chat Completion**

This extension demonstrates how to invoke the GitHub Model [OpenAI GPT-4o Mini] to generate chat completions. It takes user input, sends it to the GitHub Model, and returns the model's response back to Copilot Chat, enabling seamless interaction.

![Screenshot 2024-08-08 at 12 37 05 PM](https://github.com/user-attachments/assets/11d71101-420a-4058-9b38-06a03105a172)


## Local Setup Instructions

1. **Clone the Repository**
   ```bash
   git clone https://github.com/octodemo/amb-copilot-extensions.git
   
   ```

2. **Install the Required Dependencies**
   Navigate to the `gh-model-extn` directory and install the dependencies:
   ```bash
   cd gh-model-extn
   npm install
   ```

3. **Run the App**
   Start the Angular application:
   ```bash
   npm start
   ```

4. **Access the Application**
   Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## Deployment to Azure
1. Establish OIDC Connectivity with Microsoft Entra ID by refering the [documentation](https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/about-security-hardening-with-openid-connect#getting-started-with-oidc)
   - Add the following secrets to GitHub Secrets:
     ```properties
     AZURE_CLIENT_ID - Your Azure client ID
     AZURE_AD_TENANT - Your Azure AD tenant
     AZURE_SUBSCRIPTION_ID  -  Your Azure subscription ID
     ```
2. Create a Web applicaton to host the extension
3. Update the `app-name` input for the workflow [Node Deploy](.github/workflows/node-deploy.yml) with the Azure Web application name
4. Trigger the workflow by selecting the `pack-name=gh-model-extn` and clicking on `Run workflow`
