import * as fs from 'fs';
import * as path from 'path';
import { JiraConfig } from '../types';
import { colors } from '../utils/colors';

// Load config from file
export const loadConfig = (): JiraConfig => {
  try {
    // Look for config in multiple locations
    const configPaths = [
      path.join(process.cwd(), 'jira-config.json'),
      path.join(
        process.env.HOME || process.env.USERPROFILE || '',
        '.jira-sprint-metrics',
        'config.json',
      ),
    ];

    for (const configPath of configPaths) {
      if (fs.existsSync(configPath)) {
        const configData = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(configData);

        // Check that config has required properties
        if (
          typeof config.baseUrl !== 'string' ||
          typeof config.email !== 'string' ||
          typeof config.apiToken !== 'string'
        ) {
          throw new Error('Invalid config: missing required properties');
        }

        // Ensure boards is an array
        if (!Array.isArray(config.boards)) {
          throw new Error('Invalid config: boards must be an array');
        }

        return config;
      }
    }

    console.error(
      `${colors.red}Config file not found. Please create a jira-config.json file.${colors.reset}`,
    );
    process.exit(1);
  } catch (error: unknown) {
    console.error(`${colors.red}Failed to load config:${colors.reset}`, error);
    process.exit(1);
  }

  // This should never be reached due to process.exit above,
  // but TypeScript needs a return value
  throw new Error('Failed to load config');
};
