import { Command } from 'commander';
import {
  BoardConfig,
  JiraClient,
  JiraConfig,
  JiraSearchResponse,
  JiraSprintResponse,
} from '../types';
import { getActiveSprint } from '../api/sprints';
import { handleJiraApiError } from '../api/errors';
import { colors } from '../utils/colors';

export const setupDebugCommand = (program: Command) => {
  program
    .command('debug')
    .description('Show debug information about sprints and fields')
    .requiredOption('-b, --board <id>', 'Jira board ID', parseInt)
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

      // Find board config
      const boardConfig = config.boards.find((b: BoardConfig) => b.id === boardId);
      if (!boardConfig) {
        console.error(`${colors.red}Board ${boardId} not found in configuration${colors.reset}`);
        return;
      }

      console.log(
        `\n${colors.bright}${colors.cyan}Debugging board: ${boardConfig.name || boardId}${colors.reset}`,
      );

      // Get all sprints
      try {
        console.log(`\n${colors.bright}${colors.white}=== Available Sprints ===${colors.reset}`);
        const response = await client.get<JiraSprintResponse>(
          `/rest/agile/1.0/board/${boardId}/sprint?state=active,future,closed`,
        );

        console.log(`${colors.bright}Found ${response.data.values.length} sprints${colors.reset}`);

        // Get active sprint for highlighting
        const activeSprint = await getActiveSprint(client, boardId);

        // Sort by ID (usually chronological)
        const sortedSprints = [...response.data.values].sort((a, b) => b.id - a.id);

        // Show the 5 most recent sprints
        sortedSprints.slice(0, 5).forEach((sprint) => {
          const isActive = activeSprint && sprint.id === activeSprint.id;
          const activeMarker = isActive ? `${colors.yellow}→ ${colors.reset}` : '  ';
          const stateColor =
            sprint.state === 'active'
              ? colors.green
              : sprint.state === 'future'
                ? colors.blue
                : colors.dim;
          console.log(
            `${activeMarker}${sprint.name} (${colors.dim}ID: ${sprint.id}, State: ${stateColor}${sprint.state}${colors.reset})`,
          );
        });
      } catch (error: unknown) {
        handleJiraApiError(error, 'Failed to fetch sprints');
      }

      // Check for story points field
      try {
        console.log(`\n${colors.bright}${colors.white}=== Fields ===${colors.reset}`);
        const storyPointsField = boardConfig.customFields?.storyPoints || 'customfield_10016';
        console.log(
          `Using story points field: "${colors.bright}${storyPointsField}${colors.reset}"`,
        );

        // Find an issue with story points to test
        const response = await client.get<JiraSearchResponse>(
          `/rest/api/3/search?jql=project = CLN&maxResults=1`,
        );

        if (response.data.issues.length > 0) {
          const issue = response.data.issues[0];
          console.log(`Testing with issue: ${colors.blue}${issue.key}${colors.reset}`);

          if (issue.fields[storyPointsField] !== undefined) {
            console.log(
              `${colors.green}✓ Story points field found with value: ${colors.bright}${issue.fields[storyPointsField]}${colors.reset}`,
            );
          } else {
            console.log(
              `${colors.red}✗ Story points field NOT found. Available fields:${colors.reset}`,
            );
            const fieldKeys = Object.keys(issue.fields);
            fieldKeys
              .filter((k) => k.includes('point') || k.includes('story') || k.includes('estimate'))
              .forEach((k) => {
                console.log(`  - ${k}: ${issue.fields[k]}`);
              });
          }
        } else {
          console.log(`${colors.yellow}No issues found to test story points field${colors.reset}`);
        }
      } catch (error: unknown) {
        handleJiraApiError(error, 'Failed to check fields');
      }

      // Check statuses
      try {
        console.log(`\n${colors.bright}${colors.white}=== Statuses ===${colors.reset}`);
        const groomedStatuses: string[] = boardConfig.customFields?.groomedStatus || [
          'TO PLAN',
          'TO COMMIT',
        ];
        const ungroomedStatuses: string[] = boardConfig.customFields?.ungroomedStatus || [
          'TO GROOM',
          'TO REFINE',
        ];

        console.log(
          `${colors.green}Groomed statuses:${colors.reset} ${groomedStatuses.join(', ')}`,
        );
        console.log(
          `${colors.yellow}Ungroomed statuses:${colors.reset} ${ungroomedStatuses.join(', ')}`,
        );

        // Get all statuses
        const response = await client.get('/rest/api/3/status');

        if ('data' in response && Array.isArray(response.data)) {
          const allStatuses = response.data.map((s: any) => s.name);
          console.log(`\n${colors.dim}All available statuses:${colors.reset}`);
          console.log(allStatuses.join(', '));

          // Check if configured statuses exist
          const missingGroomed = groomedStatuses.filter((s) => !allStatuses.includes(s));
          const missingUngroomed = ungroomedStatuses.filter((s) => !allStatuses.includes(s));

          if (missingGroomed.length > 0) {
            console.log(
              `\n${colors.red}✗ Missing groomed statuses: ${missingGroomed.join(', ')}${colors.reset}`,
            );
          } else {
            console.log(`\n${colors.green}✓ All groomed statuses exist${colors.reset}`);
          }

          if (missingUngroomed.length > 0) {
            console.log(
              `${colors.red}✗ Missing ungroomed statuses: ${missingUngroomed.join(', ')}${colors.reset}`,
            );
          } else {
            console.log(`${colors.green}✓ All ungroomed statuses exist${colors.reset}`);
          }
        }
      } catch (error: unknown) {
        handleJiraApiError(error, 'Failed to check statuses');
      }
    });
};
