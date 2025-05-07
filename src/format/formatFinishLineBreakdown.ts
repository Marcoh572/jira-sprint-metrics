/**
 * Formats a section showing completed points broken down by assignee
 * This function analyzes completed issues and groups them by assignee
 * to show each person's contribution to the sprint's completed work
 */
export const formatFinishLineBreakdown = (
  completedIssues: Array<{
    key: string;
    summary: string;
    points: number;
    status: string;
    assignee: string;
  }>,
  colors: any,
  finishLineStatuses?: string[],
): string => {
  // Group completed issues by assignee
  const pointsByAssignee: Record<
    string,
    {
      points: number;
      issues: Array<{
        key: string;
        summary: string;
        points: number;
        status: string;
      }>;
    }
  > = {};

  // Process each completed issue
  completedIssues.forEach((issue) => {
    const assignee = issue.assignee || 'Unassigned';

    // Initialize the assignee record if this is the first issue for this assignee
    if (!pointsByAssignee[assignee]) {
      pointsByAssignee[assignee] = {
        points: 0,
        issues: [],
      };
    }

    // Add the issue's points to the assignee's total
    pointsByAssignee[assignee].points += issue.points;

    // Add the issue to the assignee's list of issues
    pointsByAssignee[assignee].issues.push({
      key: issue.key,
      summary: issue.summary,
      points: issue.points,
      status: issue.status,
    });
  });

  // Calculate total completed points
  const totalCompletedPoints = Object.values(pointsByAssignee).reduce(
    (sum, assignee) => sum + assignee.points,
    0,
  );

  // Build the output
  let output = '';

  // Section header - Removed the double yellow arrow as requested
  output += `\n${colors.bright}Finish Line Breakdown${colors.reset} (${totalCompletedPoints} points):${colors.reset}\n`;

  // Sort assignees by points (highest first)
  const sortedAssignees = Object.entries(pointsByAssignee).sort(
    ([, a], [, b]) => b.points - a.points,
  );

  // If there are no completed issues with points, show a message
  if (totalCompletedPoints === 0) {
    output += `  ${colors.dim}No points have crossed the finish line yet.${colors.reset}\n`;
    return output;
  }

  // Display each assignee's contribution
  sortedAssignees.forEach(([assignee, data]) => {
    // Only show assignees who have any issues (even if zero points)
    if (data.issues.length > 0) {
      const pointsPercentage =
        totalCompletedPoints > 0 ? Math.round((data.points / totalCompletedPoints) * 100) : 0;

      // Color-code based on contribution percentage
      let contributionColor = colors.green;
      if (pointsPercentage < 10) contributionColor = colors.dim;
      else if (pointsPercentage < 25) contributionColor = colors.blue;

      // Display the assignee's summary line
      output += `  ${colors.blue}${assignee}:${colors.reset} ${colors.bright}${data.points} points${colors.reset}`;

      // Only show percentage if there are points
      if (totalCompletedPoints > 0) {
        output += ` (${contributionColor}${pointsPercentage}%${colors.reset} of completed work)`;
      }
      output += `\n`;

      // Show ALL issues for this assignee, including zero-point issues
      // Sort by points (highest first), then by key
      const sortedIssues = [...data.issues].sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return a.key.localeCompare(b.key);
      });

      // Display all issues as requested
      sortedIssues.forEach((issue) => {
        const trimmedSummary =
          issue.summary.length > 40 ? issue.summary.substring(0, 37) + '...' : issue.summary;

        // Use green for positive points, dim gray for zero points
        const pointsColor = issue.points > 0 ? colors.green : colors.dim;
        output += `    ${colors.dim}- ${issue.key}${colors.reset} [${pointsColor}${issue.points}${colors.reset}]: ${trimmedSummary}\n`;
      });
    }
  });

  // Calculate total zero-point issues
  const zeroPointIssues = completedIssues.filter((issue) => issue.points === 0);
  if (zeroPointIssues.length > 0) {
    // We're now showing zero-point issues with each assignee, but still provide the total count as a summary
    output += `\n  ${colors.dim}Total zero-point issues: ${zeroPointIssues.length} issues completed with no points assigned${colors.reset}\n`;
  }

  // Update the note to mention all finish line statuses
  const statusList =
    finishLineStatuses && finishLineStatuses.length > 0 ? finishLineStatuses.join(', ') : 'done';

  output += `\n  ${colors.dim}Note: This shows points that crossed the finish line prior to or during this sprint.${colors.reset}\n`;
  output += `  ${colors.dim}It represents who carried the issues that are now in ${statusList} status.${colors.reset}\n`;

  return output;
};
