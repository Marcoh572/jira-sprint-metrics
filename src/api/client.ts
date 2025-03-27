import axios from 'axios';
import { JiraClient, JiraConfig } from '../types';

// Create the Jira API client
export const createJiraClient = (config: JiraConfig): JiraClient => {
  const axiosInstance = axios.create({
    baseURL: config.baseUrl,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${config.email}:${config.apiToken}`).toString('base64')}`,
    },
  });

  const client: JiraClient = {
    get: <T>(url: string) => axiosInstance.get<T>(url) as Promise<{ data: T }>,
  };

  return client;
};
