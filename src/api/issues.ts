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
      `/rest/api/3/search?jql=${jql}&fields=assignee,${storyPointsField}`,
    );

    const issues = response.data.issues;
    let totalPoints = 0;
    const assigneeWorkload: Record<string, number> = {};
    let unassignedPoints = 0;

    issues.forEach((issue: { fields: Record<string, any> }) => {
      const points = issue.fields[storyPointsField] || 0;
      totalPoints += points;

      // Track workload by assignee
      if (issue.fields.assignee) {
        const assigneeName = issue.fields.assignee.displayName;
        assigneeWorkload[assigneeName] = (assigneeWorkload[assigneeName] || 0) + points;
      } else {
        unassignedPoints += points;
      }
    });

    return {
      totalPoints,
      assigneeWorkload,
      unassignedPoints,
    };
  } catch (error: unknown) {
    handleJiraApiError(error, 'Failed to fetch remaining issues');
    return {
      totalPoints: 0,
      assigneeWorkload: {},
      unassignedPoints: 0,
    };
  }
};
