#!/usr/bin/env node

import { Command } from 'commander';
import { loadConfig } from './config/config';
import { createJiraClient } from './api/client';
import { setupReportCommand } from './commands/report';
import { setupBoardsCommand } from './commands/boards';
import { setupSprintsCommand } from './commands/sprints';
import { setupDebugCommand } from './commands/debug';

// Main program setup
const program = new Command();

program
  .name('jira-metrics')
  .description('CLI tool for calculating sprint metrics')
  .version('1.0.0');

// Load configuration
const config = loadConfig();

// Create Jira client
const client = createJiraClient(config);

// Store config and client on the program instance for commands to access
(program as any).config = config;
(program as any).client = client;

// Setup all commands
setupReportCommand(program);
setupBoardsCommand(program);
setupSprintsCommand(program);
setupDebugCommand(program);

// Main function to run the program
const main = () => {
  program.parse(process.argv);
};

// Execute main if this is the main module
if (require.main === module) {
  main();
}

// Export functions for testing and reuse
export { loadConfig, createJiraClient };
