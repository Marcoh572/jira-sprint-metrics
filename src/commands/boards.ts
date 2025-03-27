import { Command } from 'commander';
import { JiraConfig } from '../types';
import { colors } from '../utils/colors';
import { formatBoardsList } from '../utils/formatting';

export const setupBoardsCommand = (program: Command) => {
  program
    .command('boards')
    .description('List all configured boards')
    .option('--no-color', 'Disable colored output')
    .action((options, command) => {
      // Access the parent Command object to get the config
      const parent = command.parent as Command & { config: JiraConfig };
      const config = parent.config;

      // If --no-color is specified, clear all color codes
      if (options.color === false) {
        Object.keys(colors).forEach((key) => {
          (colors as any)[key] = '';
        });
      }

      if (config.boards.length === 0) {
        console.log(
          `${colors.yellow}No boards configured. Add boards to your config file.${colors.reset}`,
        );
        return;
      }

      const output = formatBoardsList(config.boards, config.defaultBoard);
      console.log(output);
    });
};
