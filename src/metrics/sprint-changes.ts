import {
  BoardConfig,
  JiraClient,
  JiraSearchResponse,
  SprintData,
  SprintScopeChanges,
} from '../types';

// Get initial sprint content using JQL
export async function getInitialSprintContent(
  client: JiraClient,
  boardId: number,
  sprint: SprintData,
  boardConfig: BoardConfig,
): Promise<any[]> {
  const storyPointsField = boardConfig.customFields?.storyPoints || 'customfield_10016';

  // Get the sprint start date
  const startDate = new Date(sprint.startDate);
  // Format as YYYY-MM-DD for JQL
  const formattedStartDate = startDate.toISOString().split('T')[0];

  // Create JQL query that finds issues that were in the sprint on or before the start date
  const jql = encodeURIComponent(
    `sprint = ${sprint.id} AND sprint CHANGED BEFORE startOfDay("${formattedStartDate}")`,
  );

  // Query Jira API
  const response = await client.get<JiraSearchResponse>(
    `/rest/api/3/search?jql=${jql}&fields=key,summary,${storyPointsField},status,assignee`,
  );

  return response.data.issues.map((issue) => ({
    key: issue.key,
    summary: issue.fields.summary,
    points: issue.fields[storyPointsField] || 0,
    status: issue.fields.status.name,
    assignee: issue.fields.assignee ? issue.fields.assignee.displayName : 'Unassigned',
  }));
}

// Analyze sprint scope changes
export async function getSimplifiedSprintChanges(
  client: JiraClient,
  sprint: SprintData,
  initialPoints: number, // Use the initial points value calculated in sprint summary
  boardConfig: BoardConfig,
): Promise<{
  currentPoints: number;
  pointsDelta: number;
  currentIssueCount: number;
  issuesByAssignee: Record<string, { count: number; points: number }>;
}> {
  const storyPointsField = boardConfig.customFields?.storyPoints || 'customfield_10016';

  // Get all issues currently in the sprint
  const jql = encodeURIComponent(`sprint = ${sprint.id}`);
  const response = await client.get<JiraSearchResponse>(
    `/rest/api/3/search?jql=${jql}&fields=${storyPointsField},assignee&maxResults=500`,
  );

  const currentIssueCount = response.data.issues.length;

  // Calculate total points in sprint
  let currentPoints = 0;
  const issuesByAssignee: Record<string, { count: number; points: number }> = {};

  response.data.issues.forEach((issue) => {
    const points = issue.fields[storyPointsField] || 0;
    currentPoints += points;

    const assignee = issue.fields.assignee ? issue.fields.assignee.displayName : 'Unassigned';

    if (!issuesByAssignee[assignee]) {
      issuesByAssignee[assignee] = { count: 0, points: 0 };
    }

    issuesByAssignee[assignee].count += 1;
    issuesByAssignee[assignee].points += points;
  });

  // Calculate delta from initial points
  const pointsDelta = currentPoints - initialPoints;

  return {
    currentPoints,
    pointsDelta,
    currentIssueCount,
    issuesByAssignee,
  };
}

export async function getSprintScopeChanges(
  client: JiraClient,
  sprint: SprintData,
  boardConfig: BoardConfig,
  initialTotalPoints: number, // Add this parameter to use the already calculated initialTotalPoints
): Promise<SprintScopeChanges> {
  const storyPointsField = boardConfig.customFields?.storyPoints || 'customfield_10016';

  // Get the sprint's start date
  const sprintStartDate = new Date(sprint.startDate);

  // 1. Get all issues currently in the sprint
  const currentQuery = encodeURIComponent(`sprint = ${sprint.id}`);
  const currentResponse = await client.get<JiraSearchResponse>(
    `/rest/api/3/search?jql=${currentQuery}&fields=key,summary,${storyPointsField},status,assignee,created&maxResults=500`,
  );

  const currentIssues = currentResponse.data.issues.map((issue) => ({
    key: issue.key,
    summary: issue.fields.summary || 'No summary',
    points: issue.fields[storyPointsField] || 0,
    status: issue.fields.status?.name || 'Unknown',
    assignee: issue.fields.assignee ? issue.fields.assignee.displayName : 'Unassigned',
    created: issue.fields.created ? new Date(issue.fields.created) : new Date(),
  }));

  // 2. Since we can't reliably determine added/removed issues with JQL,
  // we'll use a simpler approach based on comparing current points with initial points

  // Calculate current total points
  const currentPoints = currentIssues.reduce((sum, issue) => sum + issue.points, 0);

  // We already have initialTotalPoints from the drift calculation

  // Calculate the point difference
  const pointDifference = currentPoints - initialTotalPoints;

  // 3. For added issues, we'll use issues created after sprint start as a best guess
  // This isn't perfect, but it's a reasonable approximation without JQL history access
  const addedIssues = currentIssues
    .filter((issue) => issue.created > sprintStartDate)
    .map(({ created, ...rest }) => rest);

  const addedPoints = addedIssues.reduce((sum, issue) => sum + issue.points, 0);

  // 4. For removed issues, we can't directly query them, so we'll estimate
  // If pointDifference is negative, some issues were likely removed
  // If it's positive but less than addedPoints, some were likely both added and removed
  const estimatedRemovedPoints = Math.max(0, addedPoints - pointDifference);

  // 5. Group added issues by assignee
  const addedByAssignee: Record<string, { count: number; points: number; issues: any[] }> = {};
  addedIssues.forEach((issue) => {
    const assignee = issue.assignee;
    if (!addedByAssignee[assignee]) {
      addedByAssignee[assignee] = { count: 0, points: 0, issues: [] };
    }
    addedByAssignee[assignee].count += 1;
    addedByAssignee[assignee].points += issue.points;
    addedByAssignee[assignee].issues.push(issue);
  });

  // 6. Since we can't identify specific removed issues, create a placeholder
  const removedIssues = [];

  // Try to get a better estimate of removed issues by looking at the changelog
  // But only if we have reason to believe issues were removed (estimatedRemovedPoints > 0)
  const removedByAssignee: Record<string, { count: number; points: number; issues: any[] }> = {};
  if (estimatedRemovedPoints > 0) {
    // Add a placeholder for unidentified removed issues
    removedIssues.push({
      key: 'N/A',
      summary: 'Issues removed from sprint (details not available)',
      points: estimatedRemovedPoints,
      status: 'Unknown',
      assignee: 'Unknown',
    });

    // Add a placeholder entry in removedByAssignee
    removedByAssignee['Unknown'] = {
      count: 1,
      points: estimatedRemovedPoints,
      issues: [
        {
          key: 'N/A',
          summary: 'Issues removed from sprint (details not available)',
          points: estimatedRemovedPoints,
          status: 'Unknown',
          assignee: 'Unknown',
        },
      ],
    };
  }

  return {
    initialPoints: initialTotalPoints,
    currentPoints,
    netPointChange: pointDifference,
    currentIssueCount: currentIssues.length,

    addedIssueCount: addedIssues.length,
    addedIssues,
    addedPoints,
    addedByAssignee,

    removedIssueCount: removedIssues.length,
    removedIssues,
    removedPoints: estimatedRemovedPoints,
    removedByAssignee,
  };
}
