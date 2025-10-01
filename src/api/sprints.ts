import { JiraClient, JiraSprintResponse, SprintData } from '../types';
import { handleJiraApiError } from './errors';

// Get sprint by name
export const getSprintByName = async (
  client: JiraClient,
  boardId: number,
  sprintName: string,
): Promise<SprintData | null> => {
  try {
    // Get all sprints for the board
    const response = await client.get<JiraSprintResponse>(
      `/rest/agile/1.0/board/${boardId}/sprint?state=active,future,closed`,
    );

    // Find the sprint with the matching name
    const sprint = response.data.values.find(
      (sprint) =>
        sprint.name === sprintName || sprint.name.toLowerCase() === sprintName.toLowerCase(),
    );

    if (sprint) {
      return sprint;
    }

    console.warn(`Sprint "${sprintName}" not found`);
    return null;
  } catch (error: unknown) {
    handleJiraApiError(error, 'Failed to fetch sprint by name');
    return null;
  }
};

// Get active sprint
export const getActiveSprint = async (
  client: JiraClient,
  boardId: number,
): Promise<SprintData | null> => {
  try {
    const response = await client.get<JiraSprintResponse>(
      `/rest/agile/1.0/board/${boardId}/sprint?state=active`,
    );
    return response.data.values[0] || null;
  } catch (error: unknown) {
    handleJiraApiError(error, 'Failed to fetch active sprint');
    return null;
  }
};

// Get next sprint (first future sprint)
export const getNextSprint = async (
  client: JiraClient,
  boardId: number,
): Promise<SprintData | null> => {
  try {
    const response = await client.get<JiraSprintResponse>(
      `/rest/agile/1.0/board/${boardId}/sprint?state=future`,
    );

    // Sort sprints by start date
    const futureSprints = response.data.values.sort(
      (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
    );

    return futureSprints[0] || null;
  } catch (error: unknown) {
    handleJiraApiError(error, 'Failed to fetch next sprint');
    return null;
  }
};

// Get initial sprint scope (total issues when sprint started)
export const getInitialSprintScope = async (
  client: JiraClient,
  sprintId: number,
): Promise<number> => {
  try {
    // Use a simple query that just looks at all issues in the sprint
    const jql = encodeURIComponent(`sprint = ${sprintId}`);

    const response = await client.get<{ total: number }>(`/rest/api/2/search/jql?jql=${jql}`);

    return response.data.total;
  } catch (error: unknown) {
    handleJiraApiError(error, 'Failed to fetch initial sprint scope');

    // Return a default value to continue execution
    console.warn('Using default value for initial sprint scope');
    return 10; // A reasonable default value
  }
};
