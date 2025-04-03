import { BoardConfig, GroomingMetricsResult, JiraClient, JiraSearchResponse } from '../types';
import { handleJiraApiError } from '../api/errors';

// Get grooming metrics based on whether issues have story points assigned
export const getGroomingMetrics = async (
  client: JiraClient,
  sprintName: string,
  boardConfig: BoardConfig,
): Promise<GroomingMetricsResult> => {
  try {
    // Use the predefined story points field from board config
    const storyPointsField = boardConfig.customFields?.storyPoints || 'customfield_10016';

    // Query to get all issues in the sprint with point information
    const jql = encodeURIComponent(`sprint = "${sprintName}"`);
    const response = await client.get<JiraSearchResponse>(
      `/rest/api/3/search?jql=${jql}&fields=summary,status,assignee,${storyPointsField}&maxResults=500`,
    );

    // Process all issues for detailed breakdown
    const issuesByStatus: Record<
      string,
      Array<{ key: string; summary: string; assignee: string; points: number | null }>
    > = {};

    let pointedCount = 0;
    let totalCount = response.data.issues.length;

    // Process each issue
    response.data.issues.forEach((issue) => {
      const status = issue.fields.status.name;
      const points = issue.fields[storyPointsField] || null;
      const isPointed = points !== null && points !== undefined;
      const assignee = issue.fields.assignee ? issue.fields.assignee.displayName : 'Unassigned';

      // Track pointed vs unpointed
      if (isPointed) {
        pointedCount++;
      }

      // Initialize status array if needed
      if (!issuesByStatus[status]) {
        issuesByStatus[status] = [];
      }

      // Add issue to the status group
      issuesByStatus[status].push({
        key: issue.key,
        summary: issue.fields.summary,
        assignee,
        points,
      });
    });

    // Create versions of issue lists filtered by pointed status for the result
    const groomedIssues = response.data.issues
      .filter(
        (issue) =>
          issue.fields[storyPointsField] !== null && issue.fields[storyPointsField] !== undefined,
      )
      .map((issue) => ({
        key: issue.key,
        summary: issue.fields.summary,
        status: issue.fields.status.name,
        assignee: issue.fields.assignee ? issue.fields.assignee.displayName : 'Unassigned',
        isGroomed: true, // These are pointed issues
      }));

    const ungroomedIssues = response.data.issues
      .filter(
        (issue) =>
          issue.fields[storyPointsField] === null || issue.fields[storyPointsField] === undefined,
      )
      .map((issue) => ({
        key: issue.key,
        summary: issue.fields.summary,
        status: issue.fields.status.name,
        assignee: issue.fields.assignee ? issue.fields.assignee.displayName : 'Unassigned',
        isGroomed: false, // These are unpointed issues
      }));

    return {
      groomed: pointedCount, // "groomed" is defined as having points assigned
      total: totalCount,
      groomedIssues,
      ungroomedIssues,
      issuesByStatus,
      groomedStatuses: [], // Not used anymore
      ungroomedStatuses: [], // Not used anymore
    };
  } catch (error: unknown) {
    handleJiraApiError(error, 'Failed to fetch grooming metrics');
    return {
      groomed: 0,
      total: 0,
      groomedIssues: [],
      ungroomedIssues: [],
      issuesByStatus: {},
      groomedStatuses: [],
      ungroomedStatuses: [],
    };
  }
};
