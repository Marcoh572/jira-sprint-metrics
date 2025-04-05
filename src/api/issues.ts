import { ActualRemainingResult, BoardConfig, JiraClient, JiraSearchResponse } from '../types';
import { handleJiraApiError } from './errors';

// Get actual remaining issues in sprint with story points
export const getActualRemaining = async (
  client: JiraClient,
  sprintName: string,
  boardConfig: BoardConfig,
): Promise<ActualRemainingResult> => {
  try {
    const storyPointsField = boardConfig.customFields?.storyPoints || 'customfield_10016';
    const jql = encodeURIComponent(`sprint = "${sprintName}" AND status != Done`);
    const response = await client.get<JiraSearchResponse>(
      `/rest/api/3/search?jql=${jql}&fields=assignee,${storyPointsField},status,summary`,
    );

    const issues = response.data.issues;
    let totalPoints = 0;
    const assigneeWorkload: Record<string, number> = {};
    let unassignedPoints = 0;

    // Get the list of essentially done statuses (if configured)
    const essentiallyDoneStatuses = boardConfig.finishLineStatuses || [];

    // Track issues by status for detailed reporting
    const issuesByStatus: Record<string, { points: number; issues: any[] }> = {};

    issues.forEach((issue: { key: string; fields: Record<string, any> }) => {
      const points = issue.fields[storyPointsField] || 0;
      const status = issue.fields.status?.name || 'Unknown';

      // Add to issues by status tracking
      if (!issuesByStatus[status]) {
        issuesByStatus[status] = { points: 0, issues: [] };
      }

      issuesByStatus[status].points += points;
      issuesByStatus[status].issues.push({
        key: issue.key,
        summary: issue.fields.summary || '',
        points,
        assignee: issue.fields.assignee ? issue.fields.assignee.displayName : 'Unassigned',
        status,
      });

      // Only count towards total if the status is NOT in essentially done statuses
      const isEssentiallyDone = essentiallyDoneStatuses.includes(status);

      if (!isEssentiallyDone) {
        totalPoints += points;

        // Track workload by assignee (only for issues that count as remaining work)
        if (issue.fields.assignee) {
          const assigneeName = issue.fields.assignee.displayName;
          assigneeWorkload[assigneeName] = (assigneeWorkload[assigneeName] || 0) + points;
        } else {
          unassignedPoints += points;
        }
      }
    });

    return {
      totalPoints,
      assigneeWorkload,
      unassignedPoints,
      issuesByStatus,
    };
  } catch (error: unknown) {
    handleJiraApiError(error, 'Failed to fetch remaining issues');
    return {
      totalPoints: 0,
      assigneeWorkload: {},
      unassignedPoints: 0,
      issuesByStatus: {},
    };
  }
};
