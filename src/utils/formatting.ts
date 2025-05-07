import { formatFinishLineBreakdown } from '../format/formatFinishLineBreakdown';
import { BoardConfig, ProgressReportData, SprintData, SprintScopeChanges } from '../types';
import { colors } from './colors';
import { formatBusinessDaysBreakdown } from './dates';

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
  timeShift?: number,
  boardConfig?: any,
  scopeChanges?: SprintScopeChanges,
  rawCalculatedRemaining?: number,
  teamVelocity?: number,
  sprintLoadInfo?: {
    type: 'light' | 'heavy' | 'normal';
    loadPercentage: number;
    expectedCompletionDay?: string;
    overcommitPoints?: number;
  } | null,
  sprintState?: string,
): string => {
  // Add this function definition near the top of the function, before use
  const sortStatusKeys = (statuses: string[]): string[] => {
    if (statusOrder.length > 0) {
      // Sort according to the defined order (and then alphabetically for any not in the order)
      return [...statuses].sort((a, b) => {
        const indexA = statusOrder.indexOf(a);
        const indexB = statusOrder.indexOf(b);

        if (indexA !== -1 && indexB !== -1) {
          return indexA - indexB;
        } else if (indexA !== -1) {
          return -1;
        } else if (indexB !== -1) {
          return 1;
        } else {
          return a.localeCompare(b);
        }
      });
    }
    return statuses.sort();
  };
  // Renamed from essentiallyDoneStatuses
  const finishLineStatuses = boardConfig?.finishLineStatuses || [];

  // Get the status order if specified
  const statusOrder = boardConfig?.statusOrder || [];

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

  // Drift score color determination
  let driftColor;
  if (Math.abs(driftScore) <= 5) {
    driftColor = colors.green; // Minor deviation
  } else if (Math.abs(driftScore) <= 15) {
    driftColor = colors.yellow; // Moderate deviation
  } else {
    driftColor = colors.red; // Significant deviation
  }

  // Calculate the total work that's counted in drift calculations
  const totalDriftWork = currentRemainingPoints + completedPoints;

  // Build the output
  let output = '';

  // Header
  output += `\n${colors.bright}${colors.cyan}=== Progress: Board ${boardId} "${sprintName}" ===${colors.reset}\n`;

  // Sprint Overview section (new)
  if (teamVelocity) {
    // Filter out issues in finish line statuses
    const activeRemainingPoints = currentRemainingPoints;

    // Calculate Sprint Load using only active work
    const loadPercentage = Math.round((activeRemainingPoints / teamVelocity) * 100);
    // Calculate overcommitted points only for active work
    const overcommittedPoints =
      activeRemainingPoints > teamVelocity ? activeRemainingPoints - teamVelocity : 0;

    // Output Sprint Overview
    output += `\n${colors.bright}${colors.white}Sprint Overview:${colors.reset}\n`;
    output += `  ${colors.dim}Team Velocity:${colors.reset} ${colors.bright}${teamVelocity}${colors.reset} points per sprint (${dailyRate.toFixed(1)} points/day)\n`;

    if (sprintLoadInfo) {
      // Use drift-counted points for Sprint Load, but only active work
      const loadColor = loadPercentage > 100 ? colors.red : colors.green;
      output += `  ${colors.dim}Sprint Load:${colors.reset} ${colors.bright}${activeRemainingPoints}${colors.reset} drift-counted points (${loadColor}${loadPercentage}% of capacity${colors.reset})\n`;

      // Show overcommitted points if applicable, using only active work
      if (loadPercentage > 100) {
        output += `  ${colors.dim}Overcommitted By:${colors.reset} ${colors.red}${overcommittedPoints}${colors.reset} points beyond team capacity\n`;
      } else if (sprintLoadInfo?.type === 'light' && sprintLoadInfo.expectedCompletionDay) {
        output += `  ${colors.dim}Expected Completion:${colors.reset} Day ${colors.green}${sprintLoadInfo.expectedCompletionDay}${colors.reset} of ${totalSprintBusinessDays} at full velocity\n`;
      }
    }

    // Current status with drift-counted points
    const percentComplete = Math.round((completedPoints / totalDriftWork) * 100);
    output += `  ${colors.dim}Current Status:${colors.reset} ${colors.bright}${completedPoints}/${totalDriftWork}${colors.reset} drift-counted points completed (${percentComplete}%)\n`;
  }

  // Add breakdown of calculation
  output += `\n${colors.bright}${colors.white}Calculation Breakdown:${colors.reset}\n`;

  // Remaining actual calculation
  output += `${colors.bright}Remaining Actual (${colors.red}${currentRemainingPoints}${colors.reset}):${colors.reset}\n`;

  // Group by status for better organization, EXCLUDING finish line statuses
  const remainingByStatus: Record<
    string,
    Array<{ key: string; summary: string; points: number; assignee: string }>
  > = {};

  // Filter out finish line statuses from remaining issues
  const activeRemainingIssues = remainingIssues.filter(
    (issue) => !finishLineStatuses.includes(issue.status),
  );

  activeRemainingIssues.forEach((issue) => {
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

  // Get all status keys
  const allStatusKeys = Object.keys(remainingByStatus);

  // Sort status keys according to statusOrder if provided
  let sortedStatusKeys: string[] = [];

  if (statusOrder.length > 0) {
    // First add any statuses that weren't in the order list (at the front)
    const unknownStatuses = allStatusKeys.filter((status) => !statusOrder.includes(status));

    // Sort unknown statuses alphabetically to ensure consistent order
    unknownStatuses.sort().forEach((status: string) => {
      sortedStatusKeys.push(status);
    });

    // Then add all statuses in the specified order
    statusOrder.forEach((status: string) => {
      if (allStatusKeys.includes(status)) {
        sortedStatusKeys.push(status);
      }
    });
  } else {
    // If no statusOrder provided, use the original keys
    sortedStatusKeys = allStatusKeys;
  }

  // Show remaining issues by status in the specified order
  sortedStatusKeys.forEach((status) => {
    const issues = remainingByStatus[status];
    const totalStatusPoints = issues.reduce((sum, issue) => sum + issue.points, 0);

    output += `  ${colors.dim}${status}:${colors.reset} ${colors.bright}${totalStatusPoints} points${colors.reset} (${issues.length} issues)\n`;

    // Only show detailed issue list if there are 10 or fewer issues or if they're high point issues
    const showDetailed = issues.length <= 10 || totalStatusPoints > 20;
    if (showDetailed) {
      // Sort by points (highest first)
      const sortedIssues = [...issues].sort((a, b) => b.points - a.points);

      // Show all issues, even those with 0 points
      sortedIssues.forEach((issue) => {
        const trimmedSummary =
          issue.summary.length > 40 ? issue.summary.substring(0, 37) + '...' : issue.summary;
        output += `    ${colors.dim}- ${issue.key}${colors.reset} [${colors.red}${issue.points}${colors.reset}]: ${trimmedSummary} ${colors.blue}(${issue.assignee})${colors.reset}\n`;
      });
    }
  });

  // 🏁 FINISH LINE: Visual delimiter between race track and completed work
  output += `\n${colors.bright}${colors.green}────────────── 🏁 ISSUES PAST THE FINISH LINE 🏁 ──────────────${colors.reset}\n`;

  // Combine completed issues from both sources
  const finishLineCompletedIssues = [
    ...completedIssues, // Explicitly completed issues
    ...remainingIssues.filter((issue) => finishLineStatuses.includes(issue.status)), // Issues in finish line statuses
  ];

  // Remove any potential duplicates by creating a map keyed by issue key
  const uniqueCompletedIssuesMap = new Map();
  finishLineCompletedIssues.forEach((issue) => {
    // If this issue isn't already in the map, or if the new issue has points and the existing one doesn't
    if (
      !uniqueCompletedIssuesMap.has(issue.key) ||
      (issue.points > 0 && uniqueCompletedIssuesMap.get(issue.key).points === 0)
    ) {
      uniqueCompletedIssuesMap.set(issue.key, issue);
    }
  });

  // Convert back to an array
  const uniqueCompletedIssues = completedIssues;

  // Group completed issues by status
  const completedByStatus: Record<
    string,
    Array<{ key: string; summary: string; points: number; assignee: string }>
  > = {};

  uniqueCompletedIssues.forEach((issue) => {
    if (!completedByStatus[issue.status]) {
      completedByStatus[issue.status] = [];
    }
    completedByStatus[issue.status].push({
      key: issue.key,
      summary: issue.summary,
      points: issue.points,
      assignee: issue.assignee,
    });
  });

  // Calculate total points of completed issues
  const totalCompletedPoints = uniqueCompletedIssues.reduce((sum, issue) => sum + issue.points, 0);

  // Display Completed Issues section
  output += `\n${colors.bright}Completed Issues (${colors.green}${totalCompletedPoints}${colors.reset} points):${colors.reset}\n`;

  // Use same sorting logic as remaining issues
  const completedStatusKeys = sortStatusKeys(Object.keys(completedByStatus));

  completedStatusKeys.forEach((status: string) => {
    const issues = completedByStatus[status];
    const totalStatusPoints = issues.reduce((sum, issue) => sum + issue.points, 0);

    output += `  ${colors.dim}${status}:${colors.reset} ${colors.bright}${totalStatusPoints} points${colors.reset} (${issues.length} issues)\n`;

    // Sort and show detailed issues
    const sortedIssues = [...issues].sort((a, b) => b.points - a.points);
    sortedIssues.forEach((issue) => {
      const trimmedSummary =
        issue.summary.length > 40 ? issue.summary.substring(0, 37) + '...' : issue.summary;
      output += `    ${colors.dim}- ${issue.key}${colors.reset} [${colors.green}${issue.points}${colors.reset}]: ${trimmedSummary} ${colors.blue}(${issue.assignee})${colors.reset}\n`;
    });
  });

  // SPRINT TIMELINE SECTION - Use totalDriftCountedPoints for consistency
  output += `\n${colors.bright}${colors.white}Sprint Timeline:${colors.reset}\n`;

  // Use the total drift-counted points as the denominator
  const currentTotalPoints = currentRemainingPoints + completedPoints;

  // Calculate percentages using drift-counted total points
  const workCompletionPercent =
    currentTotalPoints > 0
      ? Math.min(100, Math.round((completedPoints / currentTotalPoints) * 100))
      : 0;

  const expectedCompletionPercent =
    elapsedBusinessDays === totalSprintBusinessDays
      ? 100
      : Math.round((expectedCompletedPoints / currentTotalPoints) * 100);

  // Calculate the bars
  const timelineWidth = 40;
  const workCompletedBar = '='
    .repeat(Math.round((workCompletionPercent / 100) * timelineWidth))
    .padEnd(timelineWidth);
  const expectedProgressBar = '='
    .repeat(Math.round((expectedCompletionPercent / 100) * timelineWidth))
    .padEnd(timelineWidth);

  // Status line and interpretation logic
  const aheadOrBehind = driftScore > 0 ? 'behind' : driftScore < 0 ? 'ahead' : 'on track';
  const differenceAmount = Math.abs(driftScore).toFixed(1);
  const statusColor = driftScore > 0 ? colors.red : driftScore < 0 ? colors.green : colors.blue;

  // Display the timeline
  output += `  Completed:    [${statusColor}${workCompletedBar}${colors.reset}] ${workCompletionPercent}% (${completedPoints} of ${currentTotalPoints} total points)\n`;
  output += `  Expected:     [${colors.yellow}${expectedProgressBar}${colors.reset}] ${expectedCompletionPercent}% (${expectedCompletedPoints} of ${currentTotalPoints} total points)\n`;

  // Status line using pre-calculated drift score
  output += `  Status: Team is ${statusColor}${differenceAmount} points ${aheadOrBehind}${colors.reset} expected pace (Day ${elapsedBusinessDays} of ${totalSprintBusinessDays})\n`;

  // DRIFT SCORE SECTION
  output += `\n${colors.bright}${colors.yellow}➤➤ ${colors.reset}${colors.bright}Drift Score${colors.reset}${colors.reset} (Less is best): ${driftColor}${driftScore}${colors.reset} = [${colors.yellow}${expectedCompletedPoints} expected completed${colors.reset}] - [${colors.blue}${totalCompletedPoints} actual completed${colors.reset}]\n`;

  // Drift score interpretation
  let driftExplanation = '';
  if (driftScore > 0) {
    driftExplanation = `The team is ${Math.abs(driftScore)} points behind the expected progress for this point in the sprint.`;
  } else if (driftScore < 0) {
    driftExplanation = `The team is ${Math.abs(driftScore)} points ahead of the expected progress for this point in the sprint.`;
  } else {
    driftExplanation = 'The team is exactly on track with expected progress.';
  }
  output += `  ${colors.dim}Interpretation:${colors.reset} ${driftColor}${driftExplanation}${colors.reset}\n`;

  output += formatFinishLineBreakdown(
    uniqueCompletedIssues, // Use all completed issues
    colors,
    boardConfig?.finishLineStatuses, // Pass the finishLineStatuses from boardConfig
  );

  // REMAINING PLANNED SECTION
  output += `\n${colors.bright}Remaining Planned (${colors.green}${plannedRemainingPoints}${colors.reset}):${colors.reset}\n`;
  output += `  ${colors.dim}Initial Points:${colors.reset} ${colors.bright}${initialTotalPoints}${colors.reset}\n`;
  output += `  ${colors.dim}Sprint Duration:${colors.reset} ${colors.bright}${totalSprintBusinessDays}${colors.reset} business days\n`;

  // Calculate percentage complete without capping at 100%
  const percentComplete = Math.round((elapsedBusinessDays / totalSprintBusinessDays) * 100);

  // Always display the elapsedBusinessDays value that was provided - don't recalculate it
  output += `  ${colors.dim}Days Elapsed:${colors.reset} ${colors.bright}${elapsedBusinessDays}${colors.reset} business days (${percentComplete}% complete)`;

  // Add a note if time-shifted
  if (timeShift && timeShift !== 0) {
    output += ` ${colors.yellow}[time-shifted]${colors.reset}`;
  }
  output += `\n`;

  // Display the expectedCompletedPoints that was actually used in calculations
  output += `  ${colors.dim}Expected Burn Rate:${colors.reset} ${colors.bright}${dailyRate}${colors.reset} points per day\n`;
  output += `  ${colors.dim}Expected Completed:${colors.reset} ${colors.bright}${expectedCompletedPoints}${colors.reset} points by now\n`;

  // IMPROVED: Make the expected remaining calculation clearer, especially for light sprint loads
  if (rawCalculatedRemaining !== undefined && rawCalculatedRemaining < 0) {
    // When calculation would result in a negative value - handle light sprint loads better
    output += `  ${colors.dim}Expected Remaining:${colors.reset} ${initialTotalPoints} - ${expectedCompletedPoints} = ${colors.green}0${colors.reset} points\n`;

    if (sprintLoadInfo?.type === 'light' && sprintLoadInfo.expectedCompletionDay) {
      output += `  ${colors.dim}Note:${colors.reset} ${colors.yellow}Based on team velocity, all sprint work should be completed by day ${sprintLoadInfo.expectedCompletionDay} of ${totalSprintBusinessDays}.${colors.reset}\n`;
    }
  } else {
    // Normal case
    output += `  ${colors.dim}Expected Remaining:${colors.reset} ${initialTotalPoints} - ${expectedCompletedPoints} = ${colors.green}${plannedRemainingPoints}${colors.reset} points\n`;
  }

  // Add a note explaining the difference between initial points and current points
  if (scopeChanges && scopeChanges.netPointChange !== 0) {
    const changeDirection = scopeChanges.netPointChange > 0 ? 'increased' : 'decreased';
    const absChange = Math.abs(scopeChanges.netPointChange);
    output += `  ${colors.dim}Note:${colors.reset} ${colors.yellow}Initial commitment was ${initialTotalPoints} points. Sprint scope has ${changeDirection} by ${absChange} points to ${currentTotalPoints} total points.${colors.reset}\n`;
  }

  // SPRINT SCOPE CHANGES SECTION
  if (scopeChanges) {
    output += `\n${colors.bright}${colors.white}Sprint Scope Changes:${colors.reset}\n`;

    // Show points comparison
    const deltaColor = scopeChanges.netPointChange > 0 ? colors.red : colors.green;
    const deltaSign = scopeChanges.netPointChange > 0 ? '+' : '';

    output += `  ${colors.dim}Initial Points:${colors.reset} ${colors.bright}${scopeChanges.initialPoints}${colors.reset}\n`;
    output += `  ${colors.dim}Current Points:${colors.reset} ${colors.bright}${scopeChanges.currentPoints}${colors.reset}\n`;
    output += `  ${colors.dim}Net Point Change:${colors.reset} ${deltaColor}${deltaSign}${scopeChanges.netPointChange}${colors.reset}\n`;

    // Show added issues (scope creep)
    if (scopeChanges.addedIssueCount > 0) {
      output += `\n  ${colors.red}Issues Added to Sprint${colors.reset} (+${scopeChanges.addedPoints} points):\n`;

      // Sort added issues by points
      const sortedAdded = [...scopeChanges.addedIssues].sort((a, b) => b.points - a.points);

      // Show all added issues
      sortedAdded.forEach((issue) => {
        const trimmedSummary =
          issue.summary && issue.summary.length > 40
            ? issue.summary.substring(0, 37) + '...'
            : issue.summary || 'No summary';
        output += `    ${colors.dim}- ${issue.key}${colors.reset} [${colors.red}${issue.points}${colors.reset}]: ${trimmedSummary} ${colors.blue}(${issue.assignee})${colors.reset}\n`;
      });

      // Show distribution by assignee
      output += `\n  ${colors.dim}Added Work by Assignee:${colors.reset}\n`;
      Object.entries(scopeChanges.addedByAssignee)
        .sort((a, b) => b[1].points - a[1].points)
        .forEach(([assignee, data]) => {
          output += `    ${colors.blue}${assignee}:${colors.reset} ${colors.bright}${data.count} issues${colors.reset} (${colors.red}+${data.points} points${colors.reset})\n`;
        });
    }

    // Show removed issues
    if (scopeChanges.removedIssueCount > 0) {
      output += `\n  ${colors.green}Issues Removed from Sprint${colors.reset} (-${scopeChanges.removedPoints} points):\n`;

      // Sort removed issues by points
      const sortedRemoved = [...scopeChanges.removedIssues].sort((a, b) => b.points - a.points);

      // Show all removed issues
      sortedRemoved.forEach((issue) => {
        const trimmedSummary =
          issue.summary && issue.summary.length > 40
            ? issue.summary.substring(0, 37) + '...'
            : issue.summary || 'No summary';
        output += `    ${colors.dim}- ${issue.key}${colors.reset} [${colors.green}${issue.points}${colors.reset}]: ${trimmedSummary} ${colors.blue}(${issue.assignee})${colors.reset}\n`;
      });

      // Show distribution by assignee
      output += `\n  ${colors.dim}Removed Work by Assignee:${colors.reset}\n`;
      Object.entries(scopeChanges.removedByAssignee)
        .sort((a, b) => b[1].points - a[1].points)
        .forEach(([assignee, data]) => {
          output += `    ${colors.blue}${assignee}:${colors.reset} ${colors.bright}${data.count} issues${colors.reset} (${colors.green}-${data.points} points${colors.reset})\n`;
        });
    }

    // Show current workload distribution
    output += `\n  ${colors.dim}Current Workload Distribution:${colors.reset}\n`;

    // We'll reuse the existing assigneeWorkload data for this
    Object.entries(assigneeWorkload)
      .sort((a, b) => b[1] - a[1])
      .forEach(([assignee, points]) => {
        output += `    ${colors.blue}${assignee}:${colors.reset} ${colors.bright}${points} points${colors.reset}\n`;
      });

    if (unassignedPoints > 0) {
      output += `    ${colors.blue}Unassigned:${colors.reset} ${colors.bright}${unassignedPoints} points${colors.reset}\n`;
    }
  }

  // ENHANCED: Special case message for light sprints that are behind
  if (
    plannedRemainingPoints === 0 &&
    currentRemainingPoints > 0 &&
    sprintLoadInfo?.type === 'light'
  ) {
    output += `\n${colors.bright}${colors.yellow}⚠ Light Sprint Warning: ${colors.reset}${colors.yellow}This sprint contains only ${sprintLoadInfo.loadPercentage}% of the team's capacity.${colors.reset}\n`;
    output += `  ${colors.yellow}Based on team velocity, all work should be completed by day ${sprintLoadInfo.expectedCompletionDay}, but ${currentRemainingPoints} points remain.${colors.reset}\n`;
  }

  // SPRINT DETAILS SECTION
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
    sprintState, // Pass the sprint state
  );

  return output;
};

// Updated formatPlanningReport function with a separate section for unpointed "essentially done" issues
export const formatPlanningReport = (
  boardId: number,
  sprintName: string,
  groomed: number,
  total: number,
  issuesByStatus: Record<
    string,
    Array<{ key: string; summary: string; assignee: string; points?: number | null }>
  >,
  groomedStatuses: string[],
  ungroomedStatuses: string[],
  boardConfig?: BoardConfig,
): string => {
  // Get the status order if specified
  const statusOrder = boardConfig?.statusOrder || [];
  // Get essentially done statuses
  const finishLineStatuses = boardConfig?.finishLineStatuses || [];

  // Risk details are now passed in from the calculated risk score
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

  // Organize issues by pointed status and workflow status
  const pointedByStatus: Record<string, any[]> = {};
  const unpointedByStatus: Record<string, any[]> = {};
  const finishLineUnpointedByStatus: Record<string, any[]> = {};

  // Populate the status groups
  Object.keys(issuesByStatus).forEach((status) => {
    const statusIssues = issuesByStatus[status];

    // Separate pointed and unpointed issues
    const pointed = statusIssues.filter(
      (issue) => issue.points !== null && issue.points !== undefined,
    );
    const unpointed = statusIssues.filter(
      (issue) => issue.points === null || issue.points === undefined,
    );

    if (pointed.length > 0) {
      pointedByStatus[status] = pointed;
    }

    if (unpointed.length > 0) {
      // If status is a "finish line" status, put in a separate category
      if (finishLineStatuses.includes(status)) {
        finishLineUnpointedByStatus[status] = unpointed;
      } else {
        unpointedByStatus[status] = unpointed;
      }
    }
  });

  // Sort status keys according to statusOrder if provided
  const sortStatusKeys = (statuses: string[]): string[] => {
    if (statusOrder.length > 0) {
      // Sort according to the defined order (and then alphabetically for any not in the order)
      return [...statuses].sort((a, b) => {
        const indexA = statusOrder.indexOf(a);
        const indexB = statusOrder.indexOf(b);

        if (indexA !== -1 && indexB !== -1) {
          return indexA - indexB;
        } else if (indexA !== -1) {
          return -1;
        } else if (indexB !== -1) {
          return 1;
        } else {
          return a.localeCompare(b);
        }
      });
    }
    return statuses.sort();
  };

  // Unpointed Issues Section (Still need grooming) - excluding essentially done statuses
  output += `\n${colors.bright}${colors.yellow}UNGROOMED ISSUES (Unpointed):${colors.reset}\n`;
  output += `${colors.yellow}=================================${colors.reset}\n`;

  const unpointedStatusKeys = sortStatusKeys(Object.keys(unpointedByStatus));

  if (unpointedStatusKeys.length === 0) {
    output += `${colors.green}No unpointed issues that need grooming!${colors.reset}\n\n`;
  } else {
    unpointedStatusKeys.forEach((status) => {
      const issues = unpointedByStatus[status];

      output += `${colors.yellow}${status}${colors.reset}: ${issues.length} issues\n`;

      issues.forEach((issue) => {
        const trimmedSummary =
          issue.summary.length > 50 ? issue.summary.substring(0, 47) + '...' : issue.summary;
        output += `  ${colors.dim}- ${issue.key}:${colors.reset} ${trimmedSummary} (${issue.assignee})\n`;
      });

      output += '\n';
    });
  }

  // Pointed Issues Section (Ready for planning)
  output += `\n${colors.bright}${colors.green}GROOMED ISSUES (Pointed):${colors.reset}\n`;
  output += `${colors.green}==============================${colors.reset}\n`;

  const pointedStatusKeys = sortStatusKeys(Object.keys(pointedByStatus));

  if (pointedStatusKeys.length === 0) {
    output += `${colors.yellow}No pointed issues yet.${colors.reset}\n\n`;
  } else {
    pointedStatusKeys.forEach((status) => {
      const issues = pointedByStatus[status];
      const totalPoints = issues.reduce((sum, issue) => sum + (issue.points || 0), 0);

      output += `${colors.green}${status}${colors.reset}: ${issues.length} issues (${totalPoints} points)\n`;

      issues.forEach((issue) => {
        const trimmedSummary =
          issue.summary.length > 50 ? issue.summary.substring(0, 47) + '...' : issue.summary;
        output += `  ${colors.dim}- ${issue.key}${colors.reset} [${colors.bright}${issue.points}${colors.reset}]: ${trimmedSummary} (${issue.assignee})\n`;
      });

      output += '\n';
    });
  }

  // Unpointed essentially done issues section (No need to groom these)
  const finishLineKeys = sortStatusKeys(Object.keys(finishLineUnpointedByStatus));
  if (finishLineKeys.length > 0) {
    output += `\n${colors.bright}${colors.blue}ESSENTIALLY DONE ISSUES (Not requiring points):${colors.reset}\n`;
    output += `${colors.blue}===============================================${colors.reset}\n`;

    finishLineKeys.forEach((status) => {
      const issues = finishLineUnpointedByStatus[status];

      output += `${colors.blue}${status}${colors.reset}: ${issues.length} issues\n`;

      issues.forEach((issue) => {
        const trimmedSummary =
          issue.summary.length > 50 ? issue.summary.substring(0, 47) + '...' : issue.summary;
        output += `  ${colors.dim}- ${issue.key}:${colors.reset} ${trimmedSummary} (${issue.assignee})\n`;
      });

      output += '\n';
    });
  }

  // Calculate total points across all pointed issues
  const totalPoints = Object.values(pointedByStatus)
    .flat()
    .reduce((sum, issue) => sum + (issue.points || 0), 0);

  // Count issues that need grooming (excluding essentially done unpointed issues)
  const unpointedNeedGroomingCount = Object.values(unpointedByStatus).flat().length;
  const totalNeedGroomingCount = unpointedNeedGroomingCount + groomed;

  // Summary
  output += `\n${colors.bright}${colors.white}SUMMARY:${colors.reset}\n`;
  output += `${colors.white}==========${colors.reset}\n`;
  output += `  ${colors.green}GROOMED issues (with points): ${groomed} (${totalPoints} points)${colors.reset}\n`;
  output += `  ${colors.yellow}UNGROOMED issues (need points): ${unpointedNeedGroomingCount}${colors.reset}\n`;

  // Only show essentially done count if there are any
  if (finishLineKeys.length > 0) {
    const essentiallyDoneCount = Object.values(finishLineUnpointedByStatus).flat().length;
    output += `  ${colors.blue}ESSENTIALLY DONE issues (no points needed): ${essentiallyDoneCount}${colors.reset}\n`;
  }

  output += `  ${colors.bright}Total active issues: ${total}${colors.reset}\n`;

  // Adjust risk score to only consider issues that need grooming
  const adjustedRiskScore =
    totalNeedGroomingCount > 0 ? parseFloat((1 - groomed / totalNeedGroomingCount).toFixed(2)) : 0;

  // Determine adjusted risk level
  let adjustedRiskLevel = 'Low';
  if (adjustedRiskScore > 0.66) {
    adjustedRiskLevel = 'High';
  } else if (adjustedRiskScore > 0.33) {
    adjustedRiskLevel = 'Medium';
  }

  // Risk color based on level
  let adjustedRiskColor;
  if (adjustedRiskLevel === 'Low') {
    adjustedRiskColor = colors.green;
  } else if (adjustedRiskLevel === 'Medium') {
    adjustedRiskColor = colors.yellow;
  } else {
    adjustedRiskColor = colors.red;
  }

  output += `  ${colors.bright}${colors.yellow}➤➤ ${colors.reset}${colors.bright}Risk Score:${colors.reset} ${adjustedRiskColor}${adjustedRiskScore} (${adjustedRiskLevel} Risk)${colors.reset} = 1 - ([${colors.green}${groomed} groomed issues${colors.reset}] / [${colors.bright}${totalNeedGroomingCount} issues needing grooming${colors.reset}])\n`;

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

export const formatDigestReport = (
  boardId: number,
  progressData: ProgressReportData | null,
  planningData: {
    sprintName: string;
    groomed: number;
    total: number;
    riskScore: number;
    riskLevel: string;
    // Add these new properties
    groomedIssues?: number;
    totalNeedingGrooming?: number;
  } | null,
): string => {
  let output = '';

  // Add progress digest
  if (progressData) {
    output += `\n${colors.bright}${colors.cyan}=== Progress: Board ${boardId} "${progressData.sprintName}" ===${colors.reset}\n`;

    // Determine drift score color based on its value
    let driftColor;
    const driftScore = progressData.driftScore; // Make sure we get it from progressData

    if (Math.abs(driftScore) <= 5) {
      driftColor = colors.green; // Good - close to ideal
    } else if (Math.abs(driftScore) <= 15) {
      driftColor = colors.yellow; // Warning - moderate drift
    } else {
      driftColor = colors.red; // Bad - significant drift
    }

    // Drift score
    output += `\n${colors.bright}${colors.yellow}➤➤ ${colors.reset}${colors.bright}Drift Score${colors.reset}${colors.reset} (Less is best): ${driftColor}${driftScore}${colors.reset} = [${colors.yellow}${progressData.expectedCompletedPoints} expected completed${colors.reset}] - [${colors.blue}${progressData.completedPoints} actual completed${colors.reset}]\n`;

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

    // Add Risk Score for progress data
    if (
      progressData &&
      progressData.groomedIssues !== undefined &&
      progressData.totalNeedingGrooming !== undefined
    ) {
      let riskColor;
      const riskScore = progressData.riskScore || 0;
      const riskLevel = progressData.riskLevel || 'Low';

      if (riskLevel === 'Low') {
        riskColor = colors.green;
      } else if (riskLevel === 'Medium') {
        riskColor = colors.yellow;
      } else {
        riskColor = colors.red;
      }

      output += `${colors.bright}Risk Score:${colors.reset} ${riskColor}${riskScore.toFixed(2)} (${riskLevel} Risk)${colors.reset} = 1 - ([${colors.green}${progressData.groomedIssues} groomed issues${colors.reset}] / [${colors.bright}${progressData.totalNeedingGrooming} issues needing grooming${colors.reset}])\n`;
    }
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
    output += `${colors.bright}Risk Score:${colors.reset} ${riskColor}${planningData.riskScore.toFixed(2)} (${planningData.riskLevel} Risk)${colors.reset} = 1 - ([${colors.green}${planningData.groomed} groomed${colors.reset}] / [${colors.bright}${planningData.total} total to groom${colors.reset}])\n`;
  }

  return output;
};
