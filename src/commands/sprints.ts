import { Command } from 'commander';
import { BoardConfig, JiraClient, JiraConfig, JiraSprintResponse } from '../types';
import { getActiveSprint } from '../api/sprints';
import { handleJiraApiError } from '../api/errors';
import { colors } from '../utils/colors';
import { formatSprintsList } from '../utils/formatting';

export const setupSprintsCommand = (program: Command) => {
  program
    .command('sprints')
    .description('List all sprints for a board')
    .requiredOption('-b, --board <id>', 'Jira board ID', parseInt)
    .option('-s <state>', 'Sprint state (active, future, closed, all)', 'all')
    .option('--no-color', 'Disable colored output')
    .action(async (options, command) => {
      // Access the parent Command object to get the config and client
      const parent = command.parent as Command & { config: JiraConfig; client: JiraClient };
      const config = parent.config;
      const client = parent.client;

      // If --no-color is specified, clear all color codes
      if (options.color === false) {
        Object.keys(colors).forEach((key) => {
          (colors as any)[key] = '';
        });
      }

      const boardId = options.board;

      // Find the board configuration
      const boardConfig = config.boards.find((b: BoardConfig) => b.id === boardId);
      if (!boardConfig) {
        console.error(`${colors.red}Board ${boardId} not found in configuration${colors.reset}`);
        return;
      }

      console.log(
        `\n${colors.bright}${colors.cyan}Sprints for board ${boardConfig.name || boardId}:${colors.reset}`,
      );

      try {
        // Determine the state parameter
        let stateParam = 'state=active,future,closed';
        if (options.s && options.s !== 'all') {
          stateParam = `state=${options.s}`;
        }

        // Get all sprints for the board
        const response = await client.get<JiraSprintResponse>(
          `/rest/agile/1.0/board/${boardId}/sprint?${stateParam}`,
        );

        if (response.data.values.length === 0) {
          console.log(`${colors.yellow}No sprints found.${colors.reset}`);
          return;
        }

        // Get active sprint for comparison
        const activeSprint = await getActiveSprint(client, boardId);

        // Sort sprints by state and then by start date (newest first within each state)
        const sortedSprints = [...response.data.values].sort((a, b) => {
          // First group by state (active, future, closed)
          if (a.state !== b.state) {
            if (a.state === 'active') return -1;
            if (b.state === 'active') return 1;
            if (a.state === 'future') return -1;
            if (b.state === 'future') return 1;
          }

          // Then sort by start date within each state group
          return new Date(b.startDate || '').getTime() - new Date(a.startDate || '').getTime();
        });

        // Format and display the sprints list
        const output = formatSprintsList(sortedSprints, activeSprint);
        console.log(output);
      } catch (error: unknown) {
        handleJiraApiError(error, 'Failed to fetch sprints');
      }
    });
};
