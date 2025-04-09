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
  initialTotalPoints: number,
): Promise<SprintScopeChanges> {
  const isFutureSprint = sprint.state === 'future';

  // If it's a future sprint, return a minimal, placeholder changes object
  if (isFutureSprint) {
    return {
      initialPoints: initialTotalPoints,
      currentPoints: initialTotalPoints,
      netPointChange: 0,
      currentIssueCount: 0,

      // Empty/minimal added issues tracking
      addedIssueCount: 0,
      addedIssues: [],
      addedPoints: 0,
      addedByAssignee: {},

      // Empty removed issues tracking
      removedIssueCount: 0,
      removedIssues: [],
      removedPoints: 0,
      removedByAssignee: {},
    };
  }

  const storyPointsField = boardConfig.customFields?.storyPoints || 'customfield_10016';
  const sprintStartDate = new Date(sprint.startDate);

  // Comprehensive query to get all current sprint issues
  const currentQuery = encodeURIComponent(`sprint = "${sprint.name}" ORDER BY created ASC`);

  const currentResponse = await client.get<JiraSearchResponse>(
    `/rest/api/3/search?jql=${currentQuery}&fields=key,summary,${storyPointsField},status,assignee,created,changelog&expand=changelog&maxResults=500`,
  );

  // Detailed issue mapping with sprint assignment tracking
  const currentIssues = currentResponse.data.issues.map((issue) => {
    const sprintAssignmentDetails = extractSprintAssignmentDetails(
      issue,
      sprint.name,
      sprintStartDate,
    );

    return {
      key: issue.key,
      summary: issue.fields.summary || 'No summary',
      points: issue.fields[storyPointsField] || 0,
      status: issue.fields.status?.name || 'Unknown',
      assignee: issue.fields.assignee ? issue.fields.assignee.displayName : 'Unassigned',
      created: issue.fields.created ? new Date(issue.fields.created) : new Date(),
      sprintAssignmentDetails,
    };
  });

  // Calculate current total points
  const currentPoints = currentIssues.reduce((sum, issue) => sum + issue.points, 0);
  const pointDifference = currentPoints - initialTotalPoints;

  // Identify issues added to the sprint after start
  const addedIssues = currentIssues
    .filter((issue) => issue.sprintAssignmentDetails.wasAddedAfterSprintStart)
    .map(({ sprintAssignmentDetails, ...rest }) => rest);

  const addedPoints = addedIssues.reduce((sum, issue) => sum + issue.points, 0);

  // Group added issues by assignee
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

  return {
    initialPoints: initialTotalPoints,
    currentPoints,
    netPointChange: pointDifference,
    currentIssueCount: currentIssues.length,

    addedIssueCount: addedIssues.length,
    addedIssues,
    addedPoints,
    addedByAssignee,

    // Placeholder for removed issues (complex to determine precisely)
    removedIssueCount: 0,
    removedIssues: [],
    removedPoints: 0,
    removedByAssignee: {},
  };
}

// Enhanced sprint assignment detection
function extractSprintAssignmentDetails(issue: any, sprintName: string, sprintStartDate: Date) {
  // Default return if no changelog or complex history
  const defaultResult = {
    wasAddedAfterSprintStart: false,
    sprintAssignmentDate: null,
  };

  // No changelog or malformed issue
  if (!issue.changelog || !issue.changelog.histories) {
    return defaultResult;
  }

  // Find sprint assignment history
  const sprintAssignmentHistory = issue.changelog.histories
    .filter((history: any) =>
      history.items.some(
        (item: any) => item.field === 'Sprint' && item.toString.includes(sprintName),
      ),
    )
    .sort((a: any, b: any) => new Date(b.created).getTime() - new Date(a.created).getTime());

  // If no sprint assignment found
  if (sprintAssignmentHistory.length === 0) {
    return defaultResult;
  }

  // Get the most recent sprint assignment
  const latestSprintAssignment = sprintAssignmentHistory[0];
  const sprintAssignmentDate = new Date(latestSprintAssignment.created);

  return {
    wasAddedAfterSprintStart: sprintAssignmentDate > sprintStartDate,
    sprintAssignmentDate: sprintAssignmentDate,
  };
}
