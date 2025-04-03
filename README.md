# Jira Sprint Metrics

A simple command-line tool that generates sprint metrics reports from Jira.

## Features

- **Sprint Progress Report**: Shows drift score and team workload distribution
- **Sprint Planning Metrics**: Calculates risk score based on grooming status
- **Simple Configuration**: Easy to configure for your Jira instance
- **Clean Output**: Provides metrics in a clear, readable format

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/jira-sprint-metrics.git
cd jira-sprint-metrics

# Install dependencies
npm install

# Build the project
npm run build

# Link for global usage (optional)
npm link
```


```
Usage: jira-metrics [options] [command]

CLI tool for calculating sprint metrics

Options:
  -V, --version      output the version number
  -h, --help         display help for command

Commands:
  report [options]   Generate sprint metrics reports
  boards [options]   List all configured boards
  sprints [options]  List all sprints for a board
  debug [options]    Show debug information about sprints and fields
  help [command]     display help for command
```


```
npm run build && node dist/index.js debug -b 2
npm run build && node dist/index.js boards
npm run build && node dist/index.js sprints -b 2
npm run build && node dist/index.js report -b 2 -pa -ln

```


## Configuration

The application uses a JSON configuration file to store connection details, board information, and preferences.

### Example Configuration

See `config.example.json` for a complete example. You should copy this file to `~/.jira-sprint-metrics/config.json` and modify it for your environment.

### Configuration Options

#### Top-level Configuration

| Option | Description |
|--------|-------------|
| `baseUrl` | Your Jira instance URL (e.g., `https://your-company.atlassian.net`) |
| `email` | Email address for Jira API authentication |
| `apiToken` | Jira API token (generate in your Atlassian account settings) |
| `defaultBoard` | Default board ID to use when no board is specified |

#### Board Configuration

Each entry in the `boards` array can have the following properties:

| Option | Description |
|--------|-------------|
| `id` | Jira board ID |
| `name` | Display name for the board |
| `defaultTeamVelocity` | Default velocity (points per sprint) for this team |
| `customFields` | Custom field mappings for Jira fields |
| `essentiallyDoneStatuses` | Array of statuses that should not count toward the drift calculation |
| `statusOrder` | Array defining the order statuses should appear in reports |
| `sprints` | Object mapping sprint names to sprint-specific configurations |

#### Custom Fields

| Option | Description |
|--------|-------------|
| `groomedStatus` | Array of statuses considered "groomed" |
| `ungroomedStatus` | Array of statuses considered "ungroomed" |
| `storyPoints` | Jira custom field ID for story points (for example, ours is `customfield_10016`) |

#### essentiallyDoneStatuses

Define statuses that should not count toward the remaining work in drift calculations. 
Issues in these statuses are nearly complete but not yet marked as "Done" in Jira.

Example:
```json
"essentiallyDoneStatuses": [
  "PASSED QA",
  "Ready for Deployment",
  "CLOSED"
]
```

#### statusOrder

Define the order in which statuses should appear in the reports. This should match your team's workflow progression.

Example:
```json
"statusOrder": [
  "TO REFINE",
  "TO GROOM", 
  "TO PLAN",
  "SPRINT COMMITTED",
  "IN PROGRESS",
  "BLOCKED",
  "TO REVIEW",
  "READY FOR QA",
  "PASSED QA",
  "Ready for Deployment",
  "DONE"
]
```

> Any statuses that appear in issues but are not defined in this list will appear at the beginning of the report.

#### Sprint-specific Configuration

You can override board defaults for specific sprints:

| Option | Description |
|--------|-------------|
| `totalBusinessDays` | Number of business days in the sprint |
| `teamVelocity` | Team velocity for this specific sprint |
| `notes` | Optional notes about this sprint |

#### Predefined Reports

Define named report configurations in the `reports` section:

| Option | Description |
|--------|-------------|
| `description` | Description of what this report shows |
| `progress` | Array of board/sprint pairs for progress reports |
| `plan` | Array of board/sprint pairs for planning reports |