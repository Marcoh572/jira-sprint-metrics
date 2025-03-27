import { SprintData } from '../types';
import { colors } from './colors';
import { formatBusinessDaysBreakdown } from './dates';

// Function to colorize the Progress Report
export const formatProgressReport = (
  boardId: number,
  sprintName: string,
  initialTotalPoints: number,
  currentRemainingPoints: number,
  plannedRemainingPoints: number,
  driftScore: number,
  assigneeWorkload: Record<string, number>,
  unassignedPoints: number,
  remainingIssues: Array<{
    key: string;
    summary: string;
    points: number;
    status: string;
    assignee: string;
  }>,
  completedIssues: Array<{
    key: string;
    summary: string;
    points: number;
    status: string;
    assignee: string;
  }>,
  completedPoints: number,
  totalSprintBusinessDays: number,
  elapsedBusinessDays: number,
  dailyRate: number,
  expectedCompletedPoints: number,
  startDate: Date,
  endDate: Date,
  currentDate: Date,
  timeShift?: number, // Add timeShift parameter
): string => {
  // Format assignee workload
  const assigneeWorkloadEntries = Object.entries(assigneeWorkload);
  const formattedWorkload = assigneeWorkloadEntries
    .map(([name, points]) => {
      // Extract just the first name for brevity
      const firstName = name.split(' ')[0];
      return `${colors.blue}${firstName}${colors.reset} ${colors.bright}${points}${colors.reset}`;
    })
    .join(', ');

  const workloadWithUnassigned =
    assigneeWorkloadEntries.length > 0
      ? `${formattedWorkload}, ${colors.yellow}Uncarried ${colors.bright}${unassignedPoints}${colors.reset}`
      : `${colors.yellow}Uncarried ${colors.bright}${unassignedPoints}${colors.reset}`;

  // Determine drift score color based on its value
  let driftColor;
  if (Math.abs(driftScore) <= 5) {
    driftColor = colors.green; // Good - close to ideal
  } else if (Math.abs(driftScore) <= 15) {
    driftColor = colors.yellow; // Warning - moderate drift
  } else {
    driftColor = colors.red; // Bad - significant drift
  }

  // Build the output
  let output = '';

  // Header
  output += `\n${colors.bright}${colors.cyan}=== Progress: Board ${boardId} "${sprintName}" ===${colors.reset}\n`;

  // Add detailed breakdowns
  output += `\n${colors.bright}${colors.white}Calculation Breakdown:${colors.reset}\n`;

  // Remaining actual calculation
  output += `${colors.bright}Remaining Actual (${colors.red}${currentRemainingPoints}${colors.reset}):${colors.reset}\n`;

  // Group by status for better organization
  const remainingByStatus: Record<
    string,
    Array<{ key: string; summary: string; points: number; assignee: string }>
  > = {};
  remainingIssues.forEach((issue) => {
    if (!remainingByStatus[issue.status]) {
      remainingByStatus[issue.status] = [];
    }
    remainingByStatus[issue.status].push({
      key: issue.key,
      summary: issue.summary,
      points: issue.points,
      assignee: issue.assignee,
    });
  });

  // Show remaining issues by status
  Object.entries(remainingByStatus).forEach(([status, issues]) => {
    const totalStatusPoints = issues.reduce((sum, issue) => sum + issue.points, 0);
    output += `  ${colors.dim}${status}:${colors.reset} ${colors.bright}${totalStatusPoints} points${colors.reset} (${issues.length} issues)\n`;

    // Only show detailed issue list if there are 10 or fewer issues or if they're high point issues
    const showDetailed = issues.length <= 10 || totalStatusPoints > 20;
    if (showDetailed) {
      // Sort by points (highest first)
      const sortedIssues = [...issues].sort((a, b) => b.points - a.points);

      // Show top issues with points
      sortedIssues.forEach((issue) => {
        if (issue.points > 0) {
          // Only show issues with points
          const trimmedSummary =
            issue.summary.length > 40 ? issue.summary.substring(0, 37) + '...' : issue.summary;
          output += `    ${colors.dim}- ${issue.key}${colors.reset} [${colors.red}${issue.points}${colors.reset}]: ${trimmedSummary} ${colors.blue}(${issue.assignee})${colors.reset}\n`;
        }
      });
    }
  });

  // Remaining planned calculation
  output += `\n${colors.bright}Remaining Planned (${colors.green}${plannedRemainingPoints}${colors.reset}):${colors.reset}\n`;
  output += `  ${colors.dim}Initial Points:${colors.reset} ${colors.bright}${initialTotalPoints}${colors.reset}\n`;
  output += `  ${colors.dim}Sprint Duration:${colors.reset} ${colors.bright}${totalSprintBusinessDays}${colors.reset} business days\n`;

  // Calculate percentage complete without capping at 100%
  const percentComplete = Math.round((elapsedBusinessDays / totalSprintBusinessDays) * 100);
  output += `  ${colors.dim}Days Elapsed:${colors.reset} ${colors.bright}${elapsedBusinessDays}${colors.reset} business days (${percentComplete}% complete)\n`;

  output += `  ${colors.dim}Expected Burn Rate:${colors.reset} ${colors.bright}${dailyRate}${colors.reset} points per day\n`;
  output += `  ${colors.dim}Expected Completed:${colors.reset} ${colors.bright}${expectedCompletedPoints}${colors.reset} points by now\n`;
  output += `  ${colors.dim}Expected Remaining:${colors.reset} ${initialTotalPoints} - ${expectedCompletedPoints} = ${colors.green}${plannedRemainingPoints}${colors.reset} points\n`;

  // Done issues
  if (completedIssues.length > 0) {
    output += `\n${colors.bright}Completed Issues (${colors.green}${completedPoints}${colors.reset} points):${colors.reset}\n`;

    // Sort by points (highest first)
    const sortedCompletedIssues = [...completedIssues].sort((a, b) => b.points - a.points);

    // Show top completed issues with points
    sortedCompletedIssues.forEach((issue) => {
      if (issue.points > 0) {
        // Only show issues with points
        const trimmedSummary =
          issue.summary.length > 40 ? issue.summary.substring(0, 37) + '...' : issue.summary;
        output += `  ${colors.dim}- ${issue.key}${colors.reset} [${colors.green}${issue.points}${colors.reset}]: ${trimmedSummary} ${colors.blue}(${issue.assignee})${colors.reset}\n`;
      }
    });
  }

  // Drift score
  output += `\n${colors.bright}${colors.yellow}➤➤ ${colors.reset}${colors.bright}Drift Score${colors.reset}${colors.reset} (Ideal is zero): ${driftColor}${driftScore}${colors.reset} = [${colors.red}${currentRemainingPoints} remaining actual${colors.reset}] - [${colors.green}${plannedRemainingPoints} remaining planned${colors.reset}]\n`;

  // Burden balance
  output += `${colors.bright}Burden Balance:${colors.reset} ${workloadWithUnassigned}\n`;

  // Sprint details
  output += `\n${colors.bright}${colors.white}Sprint Details:${colors.reset}\n`;
  output += `  ${colors.dim}Initial Sprint Points:${colors.reset} ${colors.bright}${initialTotalPoints}${colors.reset}\n`;
  output += `  ${colors.green}Completed Points:${colors.reset} ${colors.bright}${completedPoints}${colors.reset}\n`;
  output += `  ${colors.red}Remaining Points:${colors.reset} ${colors.bright}${currentRemainingPoints}${colors.reset}\n`;

  output += formatBusinessDaysBreakdown(
    startDate,
    endDate,
    currentDate,
    elapsedBusinessDays,
    totalSprintBusinessDays,
    colors,
    timeShift,
  );

  return output;
};

// Function to format planning report
export const formatPlanningReport = (
  boardId: number,
  sprintName: string,
  groomed: number,
  total: number,
  issuesByStatus: Record<string, Array<{ key: string; summary: string; assignee: string }>>,
  groomedStatuses: string[],
  ungroomedStatuses: string[],
): string => {
  // Calculate risk score
  const riskScore = total > 0 ? parseFloat((1 - groomed / total).toFixed(2)) : 0;

  // Determine risk level
  let riskLevel = 'Low';
  if (riskScore > 0.66) {
    riskLevel = 'High';
  } else if (riskScore > 0.33) {
    riskLevel = 'Medium';
  }

  // Risk color based on level
  let riskColor;
  if (riskLevel === 'Low') {
    riskColor = colors.green;
  } else if (riskLevel === 'Medium') {
    riskColor = colors.yellow;
  } else {
    riskColor = colors.red;
  }

  // Build the output
  let output = '';

  // Header
  output += `\n${colors.bright}${colors.cyan}=== Planning: Board ${boardId} "${sprintName}" ===${colors.reset}\n`;

  // Breakdown by status
  output += `\n${colors.bright}${colors.white}Breakdown by Status:${colors.reset}\n`;
  output += `${colors.dim}-------------------${colors.reset}\n`;

  // Define a custom order for statuses
  const statusOrder = [
    'TO REFINE',
    'TO GROOM',
    'TO PLAN',
    // Add other statuses in your preferred order
  ];

  // Sort the status keys according to our custom order
  const sortedStatusKeys = Object.keys(issuesByStatus).sort((a, b) => {
    // Get the index of each status in our custom order (or Infinity if not found)
    const indexA = statusOrder.indexOf(a);
    const indexB = statusOrder.indexOf(b);

    // If both are in our custom list, sort by their position
    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB;
    }

    // If only one is in our custom list, prioritize it
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;

    // If neither is in our custom list, maintain alphabetical order
    return a.localeCompare(b);
  });

  // Show issues by status in our custom order
  sortedStatusKeys.forEach((status) => {
    const issues = issuesByStatus[status];
    const isGroomed = groomedStatuses.includes(status);
    const statusCategory = isGroomed ? 'GROOMED' : 'UNGROOMED';

    // Green for groomed statuses, yellow for ungroomed
    const statusColor = isGroomed ? colors.green : colors.yellow;

    output += `${statusColor}${status}${colors.reset} (${statusColor}${statusCategory}${colors.reset}): ${colors.bright}${issues.length}${colors.reset} issues\n`;

    // Show each issue in this status
    issues.forEach((issue) => {
      // Dim the issue details for better contrast with headers
      const trimmedSummary =
        issue.summary.length > 50 ? issue.summary.substring(0, 47) + '...' : issue.summary;
      output += `  ${colors.dim}- ${issue.key}:${colors.reset} ${trimmedSummary} ${colors.blue}(${issue.assignee})${colors.reset}\n`;
    });

    output += '\n'; // Add spacing between status groups
  });

  // Summary
  output += `${colors.bright}${colors.white}Summary:${colors.reset}\n`;
  output += `  ${colors.green}Groomed issues: ${groomed}${colors.reset}\n`;
  output += `  ${colors.yellow}Ungroomed issues: ${total - groomed}${colors.reset}\n`;
  output += `  ${colors.bright}Total issues: ${total}${colors.reset}\n`;

  // Risk score with attention arrows
  output += `  ${colors.bright}${colors.yellow}➤➤ ${colors.reset}${colors.bright}Risk Score:${colors.reset} ${riskColor}${riskScore} (${riskLevel} Risk)${colors.reset} = 1 - ([${colors.green}${groomed} groomed${colors.reset}] / [${colors.bright}${total} total${colors.reset} to groom])\n`;

  // Status categories
  output += `\n${colors.bright}${colors.white}Status Categories:${colors.reset}\n`;
  output += `  ${colors.green}GROOMED statuses: ${groomedStatuses.join(', ')}${colors.reset}\n`;
  output += `  ${colors.yellow}UNGROOMED statuses: ${ungroomedStatuses.join(', ')}${colors.reset}\n`;

  return output;
};

// Function to format sprint list
export const formatSprintsList = (
  sprints: SprintData[],
  activeSprint: SprintData | null,
): string => {
  let output = '';

  output += `\n${colors.bright}${colors.cyan}Available Sprints:${colors.reset}\n`;

  let currentState = '';

  sprints.forEach((sprint) => {
    // Add state header when state changes
    if (sprint.state !== currentState) {
      currentState = sprint.state;
      output += `\n${colors.bright}${colors.white}${currentState.toUpperCase()} SPRINTS:${colors.reset}\n`;
    }

    // Format dates
    const startDate = sprint.startDate
      ? new Date(sprint.startDate).toLocaleDateString()
      : 'Unknown';
    const endDate = sprint.endDate ? new Date(sprint.endDate).toLocaleDateString() : 'Unknown';

    // Color-code by state
    let stateColor;
    if (sprint.state === 'active') {
      stateColor = colors.green;
    } else if (sprint.state === 'future') {
      stateColor = colors.blue;
    } else {
      stateColor = colors.dim;
    }

    // Add an arrow indicator for the active sprint
    const isActive = activeSprint && sprint.id === activeSprint.id;
    const indicator = isActive ? `${colors.bright}${colors.yellow}→ ${colors.reset}` : '  ';

    output += `${indicator}${stateColor}${sprint.name}${colors.reset}\n`;
    output += `   ID: ${colors.dim}${sprint.id}${colors.reset}\n`;
    output += `   Dates: ${colors.dim}${startDate} to ${endDate}${colors.reset}\n`;
  });

  output += `\n${colors.dim}Use sprint names with the following commands:${colors.reset}\n`;
  output += `  ${colors.blue}report -b <board> --progress -s "<sprint name>"${colors.reset}\n`;
  output += `  ${colors.blue}report -b <board> --planning -s "<sprint name>"${colors.reset}\n`;
  output += `  ${colors.blue}report -b <board> --progress --planning -s "<sprint name>"${colors.reset}\n`;

  return output;
};

// Function to format boards list
export const formatBoardsList = (boards: any[], defaultBoardId?: number): string => {
  let output = '';

  output += `\n${colors.bright}${colors.cyan}Configured Boards:${colors.reset}\n`;
  output += `${colors.dim}-----------------${colors.reset}\n`;

  boards.forEach((board) => {
    const isDefault = board.id === defaultBoardId;
    const boardMarker = isDefault ? `${colors.yellow}(default)${colors.reset}` : '';

    output += `${colors.bright}${colors.white}ID: ${board.id}${colors.reset} ${boardMarker}\n`;
    output += `${colors.blue}Name: ${board.name || 'Unnamed'}${colors.reset}\n`;

    if (board.teamVelocity) {
      output += `${colors.green}Team Velocity: ${board.teamVelocity} points per sprint${colors.reset}\n`;
    }

    if (board.customFields) {
      output += `${colors.bright}Custom Fields:${colors.reset}\n`;
      if (board.customFields.storyPoints) {
        output += `  ${colors.dim}Story Points: ${board.customFields.storyPoints}${colors.reset}\n`;
      }
      if (board.customFields.groomedStatus && board.customFields.groomedStatus.length > 0) {
        output += `  ${colors.green}Groomed Statuses: ${board.customFields.groomedStatus.join(', ')}${colors.reset}\n`;
      }
      if (board.customFields.ungroomedStatus && board.customFields.ungroomedStatus.length > 0) {
        output += `  ${colors.yellow}Ungroomed Statuses: ${board.customFields.ungroomedStatus.join(', ')}${colors.reset}\n`;
      }
    }

    output += '\n'; // Add spacing between boards
  });

  return output;
};

// Format a digest report with just the key metrics
export const formatDigestReport = (
  boardId: number,
  progressData: {
    sprintName: string;
    driftScore: number;
    currentRemainingPoints: number;
    plannedRemainingPoints: number;
    assigneeWorkload: Record<string, number>;
    unassignedPoints: number;
    completedPoints: number;
    totalPoints: number;
  } | null,
  planningData: {
    sprintName: string;
    groomed: number;
    total: number;
    riskScore: number;
    riskLevel: string;
  } | null,
): string => {
  let output = '';

  // Add progress digest
  if (progressData) {
    output += `\n${colors.bright}${colors.cyan}=== Progress: Board ${boardId} "${progressData.sprintName}" ===${colors.reset}\n`;

    // Determine drift score color based on its value
    let driftColor;
    if (Math.abs(progressData.driftScore) <= 5) {
      driftColor = colors.green; // Good - close to ideal
    } else if (Math.abs(progressData.driftScore) <= 15) {
      driftColor = colors.yellow; // Warning - moderate drift
    } else {
      driftColor = colors.red; // Bad - significant drift
    }

    // Drift score
    output += `${colors.bright}Drift Score${colors.reset} (Ideal is zero): ${driftColor}${progressData.driftScore}${colors.reset} = [${colors.red}${progressData.currentRemainingPoints} remaining actual${colors.reset}] - [${colors.green}${progressData.plannedRemainingPoints} remaining planned${colors.reset}]\n`;

    // Format assignee workload
    const assigneeWorkloadEntries = Object.entries(progressData.assigneeWorkload);
    const formattedWorkload = assigneeWorkloadEntries
      .map(([name, points]) => {
        // Extract just the first name for brevity
        const firstName = name.split(' ')[0];
        return `${colors.blue}${firstName}${colors.reset} ${colors.bright}${points}${colors.reset}`;
      })
      .join(', ');

    const workloadWithUnassigned =
      assigneeWorkloadEntries.length > 0
        ? `${formattedWorkload}, ${colors.yellow}Uncarried ${colors.bright}${progressData.unassignedPoints}${colors.reset}`
        : `${colors.yellow}Uncarried ${colors.bright}${progressData.unassignedPoints}${colors.reset}`;

    // Burden balance
    output += `${colors.bright}Burden Balance:${colors.reset} ${workloadWithUnassigned}\n`;
  }

  // Add planning digest
  if (planningData) {
    if (progressData) {
      output += '\n'; // Add spacing between reports
    }

    output += `${colors.bright}${colors.cyan}=== Planning: Board ${boardId} "${planningData.sprintName}" ===${colors.reset}\n`;

    // Risk color based on level
    let riskColor;
    if (planningData.riskLevel === 'Low') {
      riskColor = colors.green;
    } else if (planningData.riskLevel === 'Medium') {
      riskColor = colors.yellow;
    } else {
      riskColor = colors.red;
    }

    // Risk score
    output += `${colors.bright}Risk Score:${colors.reset} ${riskColor}${planningData.riskScore} (${planningData.riskLevel} Risk)${colors.reset} = 1 - ([${colors.green}${planningData.groomed} groomed${colors.reset}] / [${colors.bright}${planningData.total} total${colors.reset} to groom])\n`;
  }

  return output;
};
