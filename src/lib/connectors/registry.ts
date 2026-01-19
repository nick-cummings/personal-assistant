import { db } from '@/lib/db';
import { decryptJson } from '@/lib/utils/crypto';
import type { ConnectorType } from '@/types';
import type {
  Connector,
  ConnectorConfigMap,
  ConnectorConstructor,
  ConnectorMetadata,
  ConfigField,
  ToolSet,
} from './types';

// Registry of connector constructors
const connectorConstructors: Partial<Record<ConnectorType, ConnectorConstructor<ConnectorType>>> =
  {};

// Registry of connector metadata
const connectorMetadata: Record<ConnectorType, ConnectorMetadata> = {
  github: {
    type: 'github',
    name: 'GitHub',
    description: 'Access pull requests, issues, and workflow runs',
    configFields: [
      {
        key: 'token',
        label: 'Personal Access Token',
        type: 'password',
        placeholder: 'ghp_...',
        required: true,
        helpText: 'Generate at GitHub Settings > Developer settings > Personal access tokens',
      },
      {
        key: 'defaultOwner',
        label: 'Default Owner/Organization',
        type: 'text',
        placeholder: 'your-org',
        required: false,
        helpText: 'Default repository owner for queries',
      },
    ],
    setupInstructions: `# GitHub Connector Setup

## Prerequisites
- A GitHub account
- Access to the repositories you want to query

## Step 1: Generate a Personal Access Token

1. Go to GitHub.com and sign in
2. Click your profile picture (top right) → **Settings**
3. Scroll down and click **Developer settings** (left sidebar)
4. Click **Personal access tokens** → **Tokens (classic)**
5. Click **Generate new token** → **Generate new token (classic)**
6. Give your token a descriptive name (e.g., "Personal Assistant")
7. Set an expiration (recommend 90 days or custom)
8. Select the following scopes:
   - \`repo\` - Full control of private repositories (or \`public_repo\` for public only)
   - \`read:org\` - Read organization membership (if accessing org repos)
   - \`workflow\` - Access GitHub Actions workflows
9. Click **Generate token**
10. **Copy the token immediately** - you won't be able to see it again!

## Step 2: Configure the Connector

1. Enter the token in the **Personal Access Token** field
2. Optionally set a **Default Owner/Organization** (e.g., your GitHub username or org name)
3. Click **Save** to store the configuration
4. Click **Test Connection** to verify it works

## Available Tools
Once connected, the assistant can:
- List and search pull requests
- Get PR details, diffs, and comments
- List and search issues
- View GitHub Actions workflow runs

## Security Notes
- Your token is encrypted before storage
- Never share your token with others
- Revoke and regenerate if compromised
- Use the minimum required scopes`,
  },
  jira: {
    type: 'jira',
    name: 'Jira',
    description: 'Search issues, view sprints, and track work',
    configFields: [
      {
        key: 'host',
        label: 'Jira Host',
        type: 'url',
        placeholder: 'your-company.atlassian.net',
        required: true,
        helpText: 'Your Jira Cloud domain',
      },
      {
        key: 'email',
        label: 'Email',
        type: 'email',
        placeholder: 'you@company.com',
        required: true,
        helpText: 'Email associated with your Jira account',
      },
      {
        key: 'apiToken',
        label: 'API Token',
        type: 'password',
        placeholder: 'Your API token',
        required: true,
        helpText: 'Generate at id.atlassian.com > Security > API tokens',
      },
    ],
    setupInstructions: `# Jira Connector Setup

## Prerequisites
- A Jira Cloud account (this connector does not support Jira Server/Data Center)
- Access to the projects you want to query

## Step 1: Find Your Jira Host

Your Jira host is the domain you use to access Jira, typically:
- \`your-company.atlassian.net\`

Do not include \`https://\` or any path - just the domain.

## Step 2: Generate an API Token

1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click **Create API token**
3. Enter a label (e.g., "Personal Assistant")
4. Click **Create**
5. **Copy the token immediately** - you won't be able to see it again!

## Step 3: Configure the Connector

1. Enter your Jira domain in the **Jira Host** field (e.g., \`your-company.atlassian.net\`)
2. Enter the **Email** address associated with your Atlassian account
3. Paste the API token in the **API Token** field
4. Click **Save** to store the configuration
5. Click **Test Connection** to verify it works

## Available Tools
Once connected, the assistant can:
- Search issues using JQL (Jira Query Language)
- Get detailed issue information including comments
- List projects you have access to
- View active sprints and their issues

## Common JQL Examples
- \`project = PROJ AND status = "In Progress"\`
- \`assignee = currentUser() AND resolution = Unresolved\`
- \`created >= -7d ORDER BY created DESC\`

## Security Notes
- Your API token is encrypted before storage
- The token has the same permissions as your Jira account
- Revoke the token at id.atlassian.com if compromised`,
  },
  confluence: {
    type: 'confluence',
    name: 'Confluence',
    description: 'Search and read documentation pages',
    configFields: [
      {
        key: 'host',
        label: 'Confluence Host',
        type: 'url',
        placeholder: 'your-company.atlassian.net',
        required: true,
        helpText: 'Your Confluence Cloud domain',
      },
      {
        key: 'email',
        label: 'Email',
        type: 'email',
        placeholder: 'you@company.com',
        required: true,
      },
      {
        key: 'apiToken',
        label: 'API Token',
        type: 'password',
        placeholder: 'Your API token',
        required: true,
      },
    ],
    setupInstructions: `# Confluence Connector Setup

## Prerequisites
- A Confluence Cloud account (this connector does not support Confluence Server/Data Center)
- Access to the spaces and pages you want to query

## Step 1: Find Your Confluence Host

Your Confluence host is typically the same as your Jira host:
- \`your-company.atlassian.net\`

Do not include \`https://\` or any path - just the domain.

## Step 2: Generate an API Token

If you already have an Atlassian API token (e.g., from Jira setup), you can reuse it.

Otherwise:
1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click **Create API token**
3. Enter a label (e.g., "Personal Assistant")
4. Click **Create**
5. **Copy the token immediately** - you won't be able to see it again!

## Step 3: Configure the Connector

1. Enter your Confluence domain in the **Confluence Host** field
2. Enter the **Email** address associated with your Atlassian account
3. Paste the API token in the **API Token** field
4. Click **Save** to store the configuration
5. Click **Test Connection** to verify it works

## Available Tools
Once connected, the assistant can:
- List available spaces
- Search pages and content using CQL (Confluence Query Language)
- Read full page content
- Get child pages of a parent page

## Common CQL Examples
- \`space = DEV AND type = page\`
- \`text ~ "deployment guide"\`
- \`creator = currentUser() AND created >= now("-30d")\`

## Security Notes
- Your API token is encrypted before storage
- The token has the same permissions as your Confluence account
- You can use the same token for both Jira and Confluence`,
  },
  jenkins: {
    type: 'jenkins',
    name: 'Jenkins',
    description: 'View build status and logs',
    configFields: [
      {
        key: 'url',
        label: 'Jenkins URL',
        type: 'url',
        placeholder: 'https://jenkins.your-company.com',
        required: true,
      },
      {
        key: 'username',
        label: 'Username',
        type: 'text',
        placeholder: 'your-username',
        required: true,
      },
      {
        key: 'apiToken',
        label: 'API Token',
        type: 'password',
        placeholder: 'Your API token',
        required: true,
        helpText: 'Generate in Jenkins > User > Configure > API Token',
      },
    ],
    setupInstructions: `# Jenkins Connector Setup

## Prerequisites
- Access to a Jenkins server
- A Jenkins user account with appropriate permissions

## Step 1: Get Your Jenkins URL

Your Jenkins URL is the base URL you use to access Jenkins:
- \`https://jenkins.your-company.com\`
- \`https://ci.example.org:8080\`

Include the protocol (https://) but not any path like /job/.

## Step 2: Generate an API Token

1. Log in to your Jenkins server
2. Click your username (top right) → **Configure**
3. Scroll to the **API Token** section
4. Click **Add new Token**
5. Give it a name (e.g., "Personal Assistant")
6. Click **Generate**
7. **Copy the token immediately** - you won't be able to see it again!

## Step 3: Configure the Connector

1. Enter your Jenkins URL in the **Jenkins URL** field
2. Enter your Jenkins **Username**
3. Paste the API token in the **API Token** field
4. Click **Save** to store the configuration
5. Click **Test Connection** to verify it works

## Available Tools
Once connected, the assistant can:
- List all jobs/pipelines
- Get job status and build history
- Get details of specific builds
- Retrieve build console logs

## Required Permissions
Your Jenkins user needs these permissions:
- Overall/Read
- Job/Read
- Job/ExtendedRead (for build logs)

## Security Notes
- Your API token is encrypted before storage
- The token has the same permissions as your Jenkins user
- Revoke the token in Jenkins if compromised
- Consider using a service account with limited permissions`,
  },
  aws: {
    type: 'aws',
    name: 'AWS',
    description: 'Access CloudWatch logs, CodePipeline, and more',
    configFields: [
      {
        key: 'accessKeyId',
        label: 'Access Key ID',
        type: 'text',
        placeholder: 'AKIA...',
        required: true,
      },
      {
        key: 'secretAccessKey',
        label: 'Secret Access Key',
        type: 'password',
        placeholder: 'Your secret key',
        required: true,
      },
      {
        key: 'region',
        label: 'Region',
        type: 'text',
        placeholder: 'us-east-1',
        required: true,
      },
    ],
    setupInstructions: `# AWS Connector Setup

## Prerequisites
- An AWS account
- IAM permissions to create access keys
- Knowledge of which AWS region your resources are in

## Step 1: Create an IAM User (Recommended)

For security, create a dedicated IAM user:

1. Go to AWS Console → **IAM** → **Users**
2. Click **Create user**
3. Enter a username (e.g., "personal-assistant")
4. Click **Next**
5. Choose **Attach policies directly**
6. Attach the following managed policies (or create a custom one):
   - \`CloudWatchLogsReadOnlyAccess\`
   - \`AWSCodePipeline_ReadOnlyAccess\`
   - \`AWSCodeBuildReadOnlyAccess\`
   - \`AmazonECS_ReadOnlyAccess\` (if using ECS)
   - \`AWSLambda_ReadOnlyAccess\` (if using Lambda)
7. Click **Create user**

## Step 2: Generate Access Keys

1. Go to **IAM** → **Users** → select your user
2. Click the **Security credentials** tab
3. Under **Access keys**, click **Create access key**
4. Select **Application running outside AWS**
5. Click **Create access key**
6. **Copy both the Access Key ID and Secret Access Key** - the secret won't be shown again!

## Step 3: Configure the Connector

1. Enter your **Access Key ID** (starts with AKIA)
2. Enter your **Secret Access Key**
3. Enter your **Region** (e.g., us-east-1, eu-west-1)
4. Click **Save** to store the configuration
5. Click **Test Connection** to verify it works

## Available Tools
Once connected, the assistant can:
- List CloudWatch log groups
- Search and filter CloudWatch logs
- List CodePipeline pipelines and their status
- Get CodeBuild project and build status
- Describe ECS services
- Get Lambda function status

## Security Best Practices
- Use a dedicated IAM user with minimal permissions
- Never use root account credentials
- Rotate access keys regularly
- Enable MFA on your AWS account
- Your credentials are encrypted before storage`,
  },
  outlook: {
    type: 'outlook',
    name: 'Outlook',
    description: 'Search emails and calendar events',
    configFields: [
      {
        key: 'clientId',
        label: 'Client ID',
        type: 'text',
        placeholder: 'Your Azure AD app client ID',
        required: true,
      },
      {
        key: 'clientSecret',
        label: 'Client Secret',
        type: 'password',
        placeholder: 'Your client secret',
        required: true,
      },
      {
        key: 'tenantId',
        label: 'Tenant ID',
        type: 'text',
        placeholder: 'Your Azure AD tenant ID',
        required: true,
      },
    ],
    setupInstructions: `# Outlook Connector Setup

## Prerequisites
- A Microsoft 365 account (personal or work/school)
- Access to Azure Portal (for app registration)

## Step 1: Register an Azure AD Application

1. Go to https://portal.azure.com
2. Navigate to **Azure Active Directory** → **App registrations**
3. Click **New registration**
4. Configure the application:
   - **Name**: Personal Assistant
   - **Supported account types**: Choose based on your needs:
     - "Accounts in this organizational directory only" (work/school only)
     - "Accounts in any organizational directory and personal Microsoft accounts" (broadest)
   - **Redirect URI**: Select "Web" and enter:
     \`http://localhost:3000/api/auth/outlook/callback\`
5. Click **Register**

## Step 2: Note the Application IDs

From the app's **Overview** page, copy:
1. **Application (client) ID** - this is your Client ID
2. **Directory (tenant) ID** - this is your Tenant ID

## Step 3: Create a Client Secret

1. Go to **Certificates & secrets** (left sidebar)
2. Click **New client secret**
3. Enter a description and select an expiry
4. Click **Add**
5. **Copy the secret value immediately** - you won't see it again!

## Step 4: Configure API Permissions

1. Go to **API permissions** (left sidebar)
2. Click **Add a permission**
3. Select **Microsoft Graph**
4. Select **Delegated permissions**
5. Add these permissions:
   - \`Mail.Read\` - Read user mail
   - \`Calendars.Read\` - Read user calendars
   - \`User.Read\` - Sign in and read user profile
6. Click **Add permissions**
7. If you're an admin, click **Grant admin consent** (optional but recommended)

## Step 5: Configure the Connector

1. Enter the **Client ID** (Application ID)
2. Enter the **Client Secret** (secret value)
3. Enter the **Tenant ID** (Directory ID)
4. Click **Save** to store the configuration

## Step 6: Authorize the Connection

1. Click **Connect** or visit \`/api/auth/outlook\`
2. Sign in with your Microsoft account
3. Grant the requested permissions
4. You'll be redirected back after successful authorization

## Available Tools
Once connected, the assistant can:
- Search emails with filters
- Get full email details
- List mail folders
- Get calendar events

## Security Notes
- Your credentials are encrypted before storage
- The app uses OAuth 2.0 with refresh tokens
- Revoke access at https://account.live.com/consent/Manage`,
  },
  gmail: {
    type: 'gmail',
    name: 'Gmail',
    description: 'Search and read emails from Gmail',
    configFields: [
      {
        key: 'clientId',
        label: 'Client ID',
        type: 'text',
        placeholder: 'Your Google Cloud OAuth client ID',
        required: true,
        helpText: 'Create in Google Cloud Console > APIs & Services > Credentials',
      },
      {
        key: 'clientSecret',
        label: 'Client Secret',
        type: 'password',
        placeholder: 'Your client secret',
        required: true,
      },
    ],
    setupInstructions: `# Gmail Connector Setup

## Prerequisites
- A Google account
- Access to Google Cloud Console

## Step 1: Create a Google Cloud Project

1. Go to https://console.cloud.google.com
2. Click the project dropdown (top left) → **New Project**
3. Enter a project name (e.g., "Personal Assistant")
4. Click **Create**
5. Select your new project from the dropdown

## Step 2: Enable the Gmail API

1. Go to **APIs & Services** → **Library**
2. Search for "Gmail API"
3. Click **Gmail API**
4. Click **Enable**

## Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** (or Internal if using Google Workspace)
3. Click **Create**
4. Fill in the required fields:
   - **App name**: Personal Assistant
   - **User support email**: Your email
   - **Developer contact email**: Your email
5. Click **Save and Continue**
6. On the **Scopes** page:
   - Click **Add or Remove Scopes**
   - Add these scopes:
     - \`https://www.googleapis.com/auth/gmail.readonly\`
     - \`https://www.googleapis.com/auth/gmail.labels\`
   - Click **Update**
7. Click **Save and Continue**
8. Add your email as a test user (required for External apps in testing)
9. Click **Save and Continue**

## Step 4: Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Select **Web application**
4. Enter a name (e.g., "Personal Assistant Web Client")
5. Under **Authorized redirect URIs**, add:
   \`http://localhost:3000/api/auth/gmail/callback\`
6. Click **Create**
7. **Copy the Client ID and Client Secret**

## Step 5: Configure the Connector

1. Enter the **Client ID**
2. Enter the **Client Secret**
3. Click **Save** to store the configuration

## Step 6: Authorize the Connection

1. Click **Connect** or visit \`/api/auth/gmail\`
2. Sign in with your Google account
3. Grant the requested permissions
4. You'll be redirected back after successful authorization

## Available Tools
Once connected, the assistant can:
- Search emails using Gmail search syntax
- Get full email details
- List email labels

## Gmail Search Syntax Examples
- \`from:boss@company.com\` - Emails from a specific sender
- \`subject:meeting\` - Emails with "meeting" in subject
- \`is:unread\` - Unread emails
- \`after:2024/01/01\` - Emails after a date
- \`has:attachment\` - Emails with attachments

## Security Notes
- Your credentials are encrypted before storage
- The app only requests read-only access
- Revoke access at https://myaccount.google.com/permissions`,
  },
  yahoo: {
    type: 'yahoo',
    name: 'Yahoo Mail',
    description: 'Search and read emails from Yahoo Mail',
    configFields: [
      {
        key: 'clientId',
        label: 'Client ID',
        type: 'text',
        placeholder: 'Your Yahoo app client ID',
        required: true,
        helpText: 'Create at developer.yahoo.com',
      },
      {
        key: 'clientSecret',
        label: 'Client Secret',
        type: 'password',
        placeholder: 'Your client secret',
        required: true,
      },
    ],
    setupInstructions: `# Yahoo Mail Connector Setup

## Prerequisites
- A Yahoo account
- Access to Yahoo Developer Network

## Step 1: Create a Yahoo App

1. Go to https://developer.yahoo.com/apps/
2. Sign in with your Yahoo account
3. Click **Create an App**
4. Fill in the application details:
   - **Application Name**: Personal Assistant
   - **Application Type**: Web Application
   - **Description**: Personal AI assistant email integration
   - **Home Page URL**: \`http://localhost:3000\`
   - **Redirect URI(s)**: \`http://localhost:3000/api/auth/yahoo/callback\`
5. Under **API Permissions**, select:
   - **Mail** → **Read**
6. Click **Create App**

## Step 2: Get Your Credentials

After creating the app, you'll see:
1. **Client ID (Consumer Key)** - Copy this
2. **Client Secret (Consumer Secret)** - Click to reveal and copy

## Step 3: Configure the Connector

1. Enter the **Client ID**
2. Enter the **Client Secret**
3. Click **Save** to store the configuration

## Step 4: Authorize the Connection

1. Click **Connect** or visit \`/api/auth/yahoo\`
2. Sign in with your Yahoo account
3. Grant the requested permissions
4. You'll be redirected back after successful authorization

## Available Tools
Once connected, the assistant can:
- Search emails
- Get full email details
- List mail folders
- Get emails from specific folders

## Troubleshooting

### "Invalid redirect URI" error
- Make sure the redirect URI in your Yahoo app exactly matches:
  \`http://localhost:3000/api/auth/yahoo/callback\`
- Yahoo requires exact matching, including trailing slashes

### "App not verified" warning
- This is normal for personal apps
- Click "Continue" to proceed with authorization

## Security Notes
- Your credentials are encrypted before storage
- The app only requests read-only access
- Revoke access at https://login.yahoo.com/account/security
- Yahoo tokens expire after 1 hour but are automatically refreshed`,
  },
  'google-drive': {
    type: 'google-drive',
    name: 'Google Drive',
    description: 'List, search, and read files from Google Drive',
    configFields: [
      {
        key: 'clientId',
        label: 'Client ID',
        type: 'text',
        placeholder: 'Your Google Cloud OAuth client ID',
        required: true,
      },
      {
        key: 'clientSecret',
        label: 'Client Secret',
        type: 'password',
        placeholder: 'Your client secret',
        required: true,
      },
    ],
    setupInstructions: `# Google Drive Connector Setup

## Prerequisites
- A Google account
- Access to Google Cloud Console

## Step 1: Create or Use Existing Google Cloud Project

If you already have a project from Gmail setup, you can reuse it.

Otherwise:
1. Go to https://console.cloud.google.com
2. Click the project dropdown (top left) → **New Project**
3. Enter a project name (e.g., "Personal Assistant")
4. Click **Create**

## Step 2: Enable the Google Drive API

1. Go to **APIs & Services** → **Library**
2. Search for "Google Drive API"
3. Click **Google Drive API**
4. Click **Enable**

## Step 3: Configure OAuth Consent Screen

If not already configured:
1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** (or Internal for Google Workspace)
3. Fill in required fields and add scopes:
   - \`https://www.googleapis.com/auth/drive.readonly\`
   - \`https://www.googleapis.com/auth/drive.metadata.readonly\`

## Step 4: Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Select **Web application**
4. Add authorized redirect URI:
   \`http://localhost:3000/api/auth/google-drive/callback\`
5. Click **Create**
6. **Copy the Client ID and Client Secret**

## Step 5: Configure & Authorize

1. Enter credentials and save
2. Click **Connect** to authorize
3. Sign in and grant permissions

## Available Tools
- List and search files
- Get file details
- Read file content (Docs, Sheets, text files)
- List folders

## Security Notes
- Read-only access to your Drive
- Revoke at https://myaccount.google.com/permissions`,
  },
  'google-docs': {
    type: 'google-docs',
    name: 'Google Docs',
    description: 'Read and search Google Docs documents',
    configFields: [
      {
        key: 'clientId',
        label: 'Client ID',
        type: 'text',
        placeholder: 'Your Google Cloud OAuth client ID',
        required: true,
      },
      {
        key: 'clientSecret',
        label: 'Client Secret',
        type: 'password',
        placeholder: 'Your client secret',
        required: true,
      },
    ],
    setupInstructions: `# Google Docs Connector Setup

## Prerequisites
- A Google account
- Access to Google Cloud Console

## Step 1: Create or Use Existing Google Cloud Project

Reuse an existing project or create a new one at https://console.cloud.google.com

## Step 2: Enable Required APIs

1. Go to **APIs & Services** → **Library**
2. Enable **Google Docs API**
3. Enable **Google Drive API** (for listing/searching)

## Step 3: Configure OAuth Consent Screen

Add these scopes:
- \`https://www.googleapis.com/auth/documents.readonly\`
- \`https://www.googleapis.com/auth/drive.readonly\`

## Step 4: Create OAuth Credentials

1. Go to **Credentials** → **Create Credentials** → **OAuth client ID**
2. Select **Web application**
3. Add redirect URI:
   \`http://localhost:3000/api/auth/google-docs/callback\`
4. Copy credentials

## Step 5: Configure & Authorize

1. Enter credentials and save
2. Click **Connect** to authorize

## Available Tools
- List Google Docs
- Get full document text
- Search documents by content

## Security Notes
- Read-only access
- Can reuse credentials from other Google connectors`,
  },
  'google-sheets': {
    type: 'google-sheets',
    name: 'Google Sheets',
    description: 'Read data from Google Sheets spreadsheets',
    configFields: [
      {
        key: 'clientId',
        label: 'Client ID',
        type: 'text',
        placeholder: 'Your Google Cloud OAuth client ID',
        required: true,
      },
      {
        key: 'clientSecret',
        label: 'Client Secret',
        type: 'password',
        placeholder: 'Your client secret',
        required: true,
      },
    ],
    setupInstructions: `# Google Sheets Connector Setup

## Prerequisites
- A Google account
- Access to Google Cloud Console

## Step 1: Create or Use Existing Google Cloud Project

Reuse an existing project or create a new one at https://console.cloud.google.com

## Step 2: Enable Required APIs

1. Go to **APIs & Services** → **Library**
2. Enable **Google Sheets API**
3. Enable **Google Drive API** (for listing/searching)

## Step 3: Configure OAuth Consent Screen

Add these scopes:
- \`https://www.googleapis.com/auth/spreadsheets.readonly\`
- \`https://www.googleapis.com/auth/drive.readonly\`

## Step 4: Create OAuth Credentials

1. Go to **Credentials** → **Create Credentials** → **OAuth client ID**
2. Select **Web application**
3. Add redirect URI:
   \`http://localhost:3000/api/auth/google-sheets/callback\`
4. Copy credentials

## Step 5: Configure & Authorize

1. Enter credentials and save
2. Click **Connect** to authorize

## Available Tools
- List spreadsheets
- Get spreadsheet info and sheets
- Read cell values by range
- Get sheet data as a table

## Security Notes
- Read-only access
- Can reuse credentials from other Google connectors`,
  },
  'google-calendar': {
    type: 'google-calendar',
    name: 'Google Calendar',
    description: 'View calendar events and check availability',
    configFields: [
      {
        key: 'clientId',
        label: 'Client ID',
        type: 'text',
        placeholder: 'Your Google Cloud OAuth client ID',
        required: true,
      },
      {
        key: 'clientSecret',
        label: 'Client Secret',
        type: 'password',
        placeholder: 'Your client secret',
        required: true,
      },
    ],
    setupInstructions: `# Google Calendar Connector Setup

## Prerequisites
- A Google account
- Access to Google Cloud Console

## Step 1: Create or Use Existing Google Cloud Project

Reuse an existing project or create a new one at https://console.cloud.google.com

## Step 2: Enable the Google Calendar API

1. Go to **APIs & Services** → **Library**
2. Search for "Google Calendar API"
3. Click **Enable**

## Step 3: Configure OAuth Consent Screen

Add these scopes:
- \`https://www.googleapis.com/auth/calendar.readonly\`
- \`https://www.googleapis.com/auth/calendar.events.readonly\`

## Step 4: Create OAuth Credentials

1. Go to **Credentials** → **Create Credentials** → **OAuth client ID**
2. Select **Web application**
3. Add redirect URI:
   \`http://localhost:3000/api/auth/google-calendar/callback\`
4. Copy credentials

## Step 5: Configure & Authorize

1. Enter credentials and save
2. Click **Connect** to authorize

## Available Tools
- List calendars
- Get today's events
- Get upcoming events
- Search events
- Check free/busy status

## Security Notes
- Read-only access to calendars
- Can reuse credentials from other Google connectors`,
  },
  'google-cloud': {
    type: 'google-cloud',
    name: 'Google Cloud',
    description: 'Access GCP logs, Cloud Functions, Compute Engine, and GKE',
    configFields: [
      {
        key: 'projectId',
        label: 'Project ID',
        type: 'text',
        placeholder: 'your-project-id',
        required: true,
        helpText: 'Found in Google Cloud Console',
      },
      {
        key: 'clientEmail',
        label: 'Service Account Email',
        type: 'email',
        placeholder: 'service-account@project.iam.gserviceaccount.com',
        required: true,
      },
      {
        key: 'privateKey',
        label: 'Private Key',
        type: 'password',
        placeholder: '-----BEGIN PRIVATE KEY-----\\n...',
        required: true,
        helpText: 'From service account JSON key file',
      },
      {
        key: 'region',
        label: 'Default Region',
        type: 'text',
        placeholder: 'us-central1',
        required: false,
      },
    ],
    setupInstructions: `# Google Cloud Connector Setup

## Prerequisites
- A Google Cloud project
- IAM permissions to create service accounts

## Step 1: Create a Service Account

1. Go to **IAM & Admin** → **Service Accounts**
2. Click **Create Service Account**
3. Enter a name (e.g., "personal-assistant")
4. Click **Create and Continue**
5. Grant these roles:
   - **Logging** → Logs Viewer
   - **Cloud Functions** → Cloud Functions Viewer
   - **Compute Engine** → Compute Viewer
   - **Kubernetes Engine** → Kubernetes Engine Viewer
6. Click **Done**

## Step 2: Create a Key

1. Click on the service account you created
2. Go to **Keys** tab
3. Click **Add Key** → **Create new key**
4. Select **JSON**
5. Click **Create** (downloads the key file)

## Step 3: Extract Credentials

Open the downloaded JSON file and copy:
- \`project_id\` → Project ID
- \`client_email\` → Service Account Email
- \`private_key\` → Private Key (including BEGIN/END lines)

## Step 4: Configure the Connector

1. Enter all credentials
2. Optionally set a default region
3. Click **Save** and **Test Connection**

## Available Tools
- List and search Cloud Logging entries
- List Cloud Functions
- List Compute Engine instances
- List GKE clusters
- Get project info

## Security Notes
- Uses service account authentication (no OAuth)
- Keep the private key secure
- Use minimal IAM permissions
- Rotate keys periodically`,
  },
};

// Register a connector implementation
export function registerConnector<T extends ConnectorType>(
  type: T,
  constructor: ConnectorConstructor<T>
) {
  // Use unknown as intermediate type for proper type narrowing
  connectorConstructors[type] = constructor as unknown as ConnectorConstructor<ConnectorType>;
}

// Get connector metadata for UI
export function getConnectorMetadata(type: ConnectorType): ConnectorMetadata {
  return connectorMetadata[type];
}

// Get all connector metadata
export function getAllConnectorMetadata(): ConnectorMetadata[] {
  return Object.values(connectorMetadata);
}

// Get config fields for a connector type
export function getConfigFields(type: ConnectorType): ConfigField[] {
  return connectorMetadata[type]?.configFields ?? [];
}

// Get setup instructions for a connector type
export function getSetupInstructions(type: ConnectorType): string {
  return connectorMetadata[type]?.setupInstructions ?? '';
}

// Create a connector instance from database config
export async function createConnectorInstance<T extends ConnectorType>(
  type: T
): Promise<Connector<T> | null> {
  const Constructor = connectorConstructors[type];
  if (!Constructor) {
    console.warn(`No connector implementation registered for type: ${type}`);
    return null;
  }

  const dbConnector = await db.connector.findUnique({
    where: { type },
  });

  if (!dbConnector || !dbConnector.enabled) {
    return null;
  }

  try {
    const config = decryptJson<ConnectorConfigMap[T]>(dbConnector.config);
    return new Constructor(config) as Connector<T>;
  } catch (error) {
    console.error(`Failed to create connector instance for ${type}:`, error);
    return null;
  }
}

// Get all enabled connector instances
export async function getEnabledConnectors(): Promise<Connector[]> {
  const dbConnectors = await db.connector.findMany({
    where: { enabled: true },
  });

  const connectors: Connector[] = [];

  for (const dbConnector of dbConnectors) {
    const type = dbConnector.type as ConnectorType;
    const Constructor = connectorConstructors[type];

    if (!Constructor) {
      continue;
    }

    try {
      const config = decryptJson<ConnectorConfigMap[typeof type]>(dbConnector.config);
      const instance = new Constructor(config);
      connectors.push(instance);
    } catch (error) {
      console.error(`Failed to create connector instance for ${type}:`, error);
    }
  }

  return connectors;
}

// Get all tools from enabled connectors as a ToolSet
export async function getAllConnectorTools(): Promise<ToolSet> {
  const connectors = await getEnabledConnectors();
  const tools: ToolSet = {};

  for (const connector of connectors) {
    const connectorTools = connector.getTools();
    Object.assign(tools, connectorTools);
  }

  return tools;
}
