import axios from 'axios';
import { JiraClient, JiraConfig, JiraAuthInfo } from '../types';
import readline from 'readline';
import { colors } from '../utils/colors';

// Create the Jira API client
export const createJiraClient = (config: JiraConfig, authInfo: JiraAuthInfo): JiraClient => {
  const axiosInstance = axios.create({
    baseURL: getJiraUrl(config, authInfo),
    headers: {
      'Content-Type': 'application/json',
      // Authorization: `Basic ${Buffer.from(`${config.email}:${config.apiToken}`).toString('base64')}`,
      Authorization: getAuthHeader(authInfo),
    },
  });

  const client: JiraClient = {
    get: <T>(url: string) => axiosInstance.get<T>(url) as Promise<{ data: T }>,
  };

  return client;
};

function getJiraUrl(config: JiraConfig, authInfo: JiraAuthInfo): string {
  if (authInfo.jira_auth_token) {
    return `https://api.atlassian.com/ex/jira/${authInfo.jira_site_id}`;
  } else if (authInfo.jira_api_token) {
    return authInfo.jira_site;
  }
  throw new Error('No valid Jira authentication information available');
}

function getAuthHeader(authInfo: JiraAuthInfo): string {
  if (authInfo.jira_auth_token) {
    return `Bearer ${authInfo.jira_auth_token}`;
  } else if (authInfo.jira_api_token) {
    return `Basic ${Buffer.from(`${authInfo.jira_email}:${authInfo.jira_api_token}`).toString('base64')}`;
  }
  throw new Error('No valid Jira authentication information available');
}

const WEBSERVER_BASE_URL = "http://localhost:5002";
const LOCAL_API_KEY = "9f9bd8ccde985c4692841945b9ad71b881e8c56831d8cac7a2ef4eca3e72062a";

export async function jiraOauthLogin() {
  const response = await axios.get(`${WEBSERVER_BASE_URL}/api/v0/oauth/jira/login`, {
    headers: {
      Authorization: `Bearer ${LOCAL_API_KEY}`,
      'content-type': 'application/json'
    },
  });
  if (response.status === 200 && response?.data.authorize_url) {
    console.log("Opening browser for Jira OAuth login...");
    const open = (await import('open')).default;
    // open(response.data.authorize_url);
  } else {
    console.error(`${colors.red}Jira OAuth login failed${colors.reset}`);
  }
  // Wait for user confirmation
  await new Promise<void>((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question('Press Enter after completing OAuth login in your browser...', () => {
      rl.close();
      resolve();
    });
  });
};

export async function getJiraAuth(): Promise<JiraAuthInfo> {
  const response = await axios.get(`${WEBSERVER_BASE_URL}/api/v0/jira/auth`, {
    headers: {
      Authorization: `Bearer ${LOCAL_API_KEY}`,
      'content-type': 'application/json'
    },
  });
  return response.data;
};