import {
  BoardConfig,
  DriftScoreResult,
  JiraClient,
  JiraSearchResponse,
  SprintData,
} from '../types';
import { handleJiraApiError } from '../api/errors';
import { calculateBusinessDays } from '../utils/dates';

// Helper function to add business days to a date (skipping weekends)
export function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let daysAdded = 0;

  while (daysAdded < days) {
    result.setDate(result.getDate() + 1);
    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (result.getDay() !== 0 && result.getDay() !== 6) {
      daysAdded++;
    }
  }

  return result;
}

// Helper function to subtract business days from a date (skipping weekends)
export function subtractBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let daysSubtracted = 0;

  while (daysSubtracted < days) {
    result.setDate(result.getDate() - 1);
    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (result.getDay() !== 0 && result.getDay() !== 6) {
      daysSubtracted++;
    }
  }

  return result;
}

// Calculate drift score
export const calculateDriftScore = async (
  client: JiraClient,
  sprintData: SprintData,
  boardConfig: BoardConfig,
  options: { timeShift?: number; futureDays?: number } = {},
): Promise<DriftScoreResult> => {
  try {
    // Handle backward compatibility - if futureDays is set but timeShift isn't
    const timeShift = options.timeShift !== undefined ? options.timeShift : options.futureDays;

    // Use the predefined story points field
    const storyPointsField = boardConfig.customFields?.storyPoints || 'customfield_10016';

    // Get initial sprint scope (total story points at sprint start)
    const initialScopeQuery = encodeURIComponent(`sprint = ${sprintData.id}`);
    const initialScopeResponse = await client.get<JiraSearchResponse>(
      `/rest/api/3/search?jql=${initialScopeQuery}&fields=${storyPointsField},status,summary,assignee`,
    );

    // Calculate initial total points
    const initialTotalPoints = initialScopeResponse.data.issues.reduce((total, issue) => {
      const points = issue.fields[storyPointsField] || 0;
      return total + points;
    }, 0);

    // Get current remaining points (actual remaining)
    const currentRemainingQuery = encodeURIComponent(
      `sprint = "${sprintData.name}" AND status != Done`,
    );
    const currentRemainingResponse = await client.get<JiraSearchResponse>(
      `/rest/api/3/search?jql=${currentRemainingQuery}&fields=${storyPointsField},status,summary,assignee`,
    );

    const currentRemainingPoints = currentRemainingResponse.data.issues.reduce((total, issue) => {
      const points = issue.fields[storyPointsField] || 0;
      return total + points;
    }, 0);

    // Get completed issues
    const completedQuery = encodeURIComponent(`sprint = "${sprintData.name}" AND status = Done`);
    const completedResponse = await client.get<JiraSearchResponse>(
      `/rest/api/3/search?jql=${completedQuery}&fields=${storyPointsField},status,summary,assignee`,
    );

    const completedPoints = completedResponse.data.issues.reduce((total, issue) => {
      const points = issue.fields[storyPointsField] || 0;
      return total + points;
    }, 0);

    // Collect detailed information for remaining issues
    const remainingIssues = currentRemainingResponse.data.issues.map((issue) => ({
      key: issue.key,
      summary: issue.fields.summary,
      points: issue.fields[storyPointsField] || 0,
      status: issue.fields.status.name,
      assignee: issue.fields.assignee ? issue.fields.assignee.displayName : 'Unassigned',
    }));

    // Collect detailed information for completed issues
    const completedIssues = completedResponse.data.issues.map((issue) => ({
      key: issue.key,
      summary: issue.fields.summary,
      points: issue.fields[storyPointsField] || 0,
      status: issue.fields.status.name,
      assignee: issue.fields.assignee ? issue.fields.assignee.displayName : 'Unassigned',
    }));

    // Calculate sprint dates
    const startDate = new Date(sprintData.startDate);
    const endDate = new Date(sprintData.endDate);
    const currentDate = new Date();

    // Apply time shift if specified - using business days, supporting negative values
    if (timeShift !== undefined) {
      // Add or subtract the specified number of business days
      const adjustedDate =
        timeShift >= 0
          ? addBusinessDays(currentDate, timeShift)
          : subtractBusinessDays(currentDate, Math.abs(timeShift));

      console.log(
        `Time shifted ${timeShift > 0 ? 'forward' : 'backward'} by ${Math.abs(timeShift)} business days to ${adjustedDate.toISOString().split('T')[0]}`,
      );

      // Use adjusted date for calculation (assuming no additional work is done)
      currentDate.setTime(adjustedDate.getTime());
    }

    // For debug purposes
    // console.log('Sprint start date:', startDate.toISOString());
    // console.log('Sprint end date:', endDate.toISOString());
    // console.log('Current date before adjustment:', new Date().toISOString());
    // console.log('Current date after adjustment:', currentDate.toISOString());

    // We don't want to cap currentDate to the end date anymore, to allow projections beyond sprint end
    // Let the elapsedBusinessDays calculation show the true projected value
    const effectiveCurrentDate = currentDate;

    // Get sprint-specific configuration if available
    const sprintConfig = boardConfig.sprints?.[sprintData.name];

    // Calculate total and elapsed business days
    const calculatedTotalBusinessDays = calculateBusinessDays(startDate, endDate);
    // Use sprint-specific total business days if provided
    const totalSprintBusinessDays = sprintConfig?.totalBusinessDays ?? calculatedTotalBusinessDays;

    // Calculate elapsed business days without capping to sprint end date
    const elapsedBusinessDays = calculateBusinessDays(startDate, effectiveCurrentDate);
    console.log('Business days elapsed:', elapsedBusinessDays);

    // Calculate planned remaining points based on linear burndown
    let plannedRemainingPoints;
    let dailyRate;
    let expectedCompletedPoints;

    // Get the team velocity - prioritize sprint-specific value, then board default, then calculate
    const teamVelocity = sprintConfig?.teamVelocity ?? boardConfig.defaultTeamVelocity;

    if (teamVelocity) {
      // If team velocity is specified, use it to calculate daily rate
      dailyRate = teamVelocity / totalSprintBusinessDays;
      expectedCompletedPoints = elapsedBusinessDays * dailyRate;
      plannedRemainingPoints = Math.max(0, initialTotalPoints - expectedCompletedPoints);
    } else {
      // Default to a simple linear burndown
      const completionRatio = elapsedBusinessDays / totalSprintBusinessDays;
      expectedCompletedPoints = initialTotalPoints * completionRatio;
      plannedRemainingPoints = Math.max(0, initialTotalPoints * (1 - completionRatio));
      dailyRate = initialTotalPoints / totalSprintBusinessDays;
    }

    // Round to one decimal place for better readability
    plannedRemainingPoints = Math.round(plannedRemainingPoints * 10) / 10;
    expectedCompletedPoints = Math.round(expectedCompletedPoints * 10) / 10;
    dailyRate = Math.round(dailyRate * 10) / 10;

    // Drift score is now the difference between actual remaining and planned remaining
    const driftScore = Math.round((currentRemainingPoints - plannedRemainingPoints) * 10) / 10;

    return {
      initialTotalPoints,
      currentRemainingPoints,
      plannedRemainingPoints,
      driftScore,
      remainingIssues,
      completedIssues,
      completedPoints,
      totalSprintBusinessDays,
      elapsedBusinessDays,
      dailyRate,
      expectedCompletedPoints,
    };
  } catch (error: unknown) {
    handleJiraApiError(error, 'Failed to calculate drift score');
    return {
      initialTotalPoints: 0,
      currentRemainingPoints: 0,
      plannedRemainingPoints: 0,
      driftScore: 0,
      remainingIssues: [],
      completedIssues: [],
      completedPoints: 0,
      totalSprintBusinessDays: 0,
      elapsedBusinessDays: 0,
      dailyRate: 0,
      expectedCompletedPoints: 0,
    };
  }
};
