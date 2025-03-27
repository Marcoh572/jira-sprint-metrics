import { BoardConfig, GroomingMetricsResult, JiraClient, JiraSearchResponse } from '../types';
import { handleJiraApiError } from '../api/errors';

// Get grooming metrics based on issue statuses with detailed breakdown
export const getGroomingMetrics = async (
  client: JiraClient,
  sprintName: string,
  boardConfig: BoardConfig,
): Promise<GroomingMetricsResult> => {
  try {
    // Configure status values from config with explicit type annotations
    const groomedStatuses: string[] = boardConfig.customFields?.groomedStatus || [
      'TO PLAN',
      'TO COMMIT',
    ];
    const ungroomedStatuses: string[] = boardConfig.customFields?.ungroomedStatus || [
      'TO GROOM',
      'TO REFINE',
    ];

    // Build JQL with proper status handling using 'IN' operator for better JQL syntax
    const groomedStatusList = groomedStatuses.map((status) => `"${status}"`).join(', ');
    const ungroomedStatusList = ungroomedStatuses.map((status) => `"${status}"`).join(', ');

    // Query using the sprint name with proper JQL syntax to get all relevant issues
    const totalJql = encodeURIComponent(
      `sprint = "${sprintName}" AND status in (${ungroomedStatusList}, ${groomedStatusList})`,
    );
    const totalResponse = await client.get<JiraSearchResponse>(
      `/rest/api/3/search?jql=${totalJql}&fields=summary,status,assignee&maxResults=100`,
    );

    // Get groomed issues separately
    const groomedJql = encodeURIComponent(
      `sprint = "${sprintName}" AND status in (${groomedStatusList})`,
    );
    const groomedResponse = await client.get<JiraSearchResponse>(
      `/rest/api/3/search?jql=${groomedJql}&fields=summary,status,assignee&maxResults=100`,
    );

    // With proper typing, we can directly access these properties
    const totalCount = totalResponse.data.total;
    const groomedCount = groomedResponse.data.total;

    // Process all issues for detailed breakdown
    const allIssues = totalResponse.data.issues.map((issue) => ({
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status.name,
      assignee: issue.fields.assignee ? issue.fields.assignee.displayName : 'Unassigned',
      isGroomed: groomedStatuses.includes(issue.fields.status.name),
    }));

    // Create separate lists
    const groomedIssues = allIssues.filter((issue) => issue.isGroomed);
    const ungroomedIssues = allIssues.filter((issue) => !issue.isGroomed);

    // Group by status for more detailed breakdown
    const issuesByStatus: Record<
      string,
      Array<{ key: string; summary: string; assignee: string }>
    > = {};

    allIssues.forEach((issue) => {
      if (!issuesByStatus[issue.status]) {
        issuesByStatus[issue.status] = [];
      }

      issuesByStatus[issue.status].push({
        key: issue.key,
        summary: issue.summary,
        assignee: issue.assignee,
      });
    });

    return {
      groomed: groomedCount,
      total: totalCount,
      groomedIssues,
      ungroomedIssues,
      issuesByStatus,
      groomedStatuses,
      ungroomedStatuses,
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
