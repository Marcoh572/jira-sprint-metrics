import {
  BoardConfig,
  DriftScoreResult,
  JiraClient,
  JiraResponse,
  JiraSearchResponse,
  SprintData,
} from '../types';
import { handleJiraApiError } from '../api/errors';
import { calculateBusinessDays } from '../utils/dates';
import { getActualRemaining } from '../api/issues';

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

export const calculateDriftScore = async (
  client: JiraClient,
  sprintData: SprintData,
  boardConfig: BoardConfig,
  options: { timeShift?: number; futureDays?: number } = {},
): Promise<DriftScoreResult> => {
  try {
    // Renamed from essentiallyDoneStatuses
    const finishLineStatuses = boardConfig.finishLineStatuses || [];

    // Adjust the query to use the new term
    const finishLineQuery = encodeURIComponent(
      `sprint = "${sprintData.name}" AND status IN (${finishLineStatuses.map((status) => `"${status}"`).join(',')})`,
    );

    // Handle backward compatibility - if futureDays is set but timeShift isn't
    const timeShift = options.timeShift !== undefined ? options.timeShift : options.futureDays;

    // Use the predefined story points field
    const storyPointsField = boardConfig.customFields?.storyPoints || 'customfield_10016';

    // NEW: Comprehensive method for calculating completed issues with robust deduplication
    const calculateCompletedIssuesSummary = async (
      completedResponse: JiraResponse<JiraSearchResponse>,
      essentiallyDoneResponse: JiraResponse<JiraSearchResponse>,
      storyPointsField: string,
    ) => {
      // Map to track unique issues across different statuses
      const completedIssuesMap = new Map<
        string,
        {
          key: string;
          summary: string;
          points: number;
          status: string;
          assignee: string;
        }
      >();

      // Process issues, prioritizing most informative entry
      const processIssues = (response: JiraResponse<JiraSearchResponse>) => {
        response.data.issues.forEach((issue) => {
          const processedIssue = {
            key: issue.key,
            summary: issue.fields.summary,
            points: issue.fields[storyPointsField] || 0,
            status: issue.fields.status.name,
            assignee: issue.fields.assignee ? issue.fields.assignee.displayName : 'Unassigned',
          };

          // Intelligent deduplication logic
          const existingIssue = completedIssuesMap.get(issue.key);
          if (!existingIssue || processedIssue.points > existingIssue.points) {
            completedIssuesMap.set(issue.key, processedIssue);
          }
        });
      };
      // Process both completed and essentially done issues
      processIssues(completedResponse);
      processIssues(essentiallyDoneResponse);

      // Convert map to array and calculate total points
      // Convert map to array and calculate total points
      const issues = Array.from(completedIssuesMap.values());
      const totalPoints = issues.reduce((sum, issue) => sum + issue.points, 0);

      return {
        totalPoints,
        issues,
        uniqueIssueCount: completedIssuesMap.size,
      };
    };

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

    // Get remaining work using getActualRemaining which filters out "essentially done" statuses
    const actualRemainingData = await getActualRemaining(client, sprintData.name, boardConfig);

    // Use the filtered total points instead of calculating from raw data
    const currentRemainingPoints = actualRemainingData.totalPoints;

    // Get completed issues (strictly "Done")
    const completedQuery = encodeURIComponent(`sprint = "${sprintData.name}" AND status = Done`);
    const completedResponse = await client.get<JiraSearchResponse>(
      `/rest/api/3/search?jql=${completedQuery}&fields=${storyPointsField},status,summary,assignee`,
    );

    // Get essentially done issues
    const essentiallyDoneQuery = encodeURIComponent(
      `sprint = "${sprintData.name}" AND status IN (${boardConfig?.finishLineStatuses?.map((status) => `"${status}"`).join(',')})`,
    );
    const essentiallyDoneResponse = await client.get<JiraSearchResponse>(
      `/rest/api/3/search?jql=${essentiallyDoneQuery}&fields=${storyPointsField},status,summary,assignee`,
    );

    // Calculate comprehensive completed issues summary
    const completedIssuesSummary = await calculateCompletedIssuesSummary(
      completedResponse,
      essentiallyDoneResponse,
      storyPointsField, // Add this parameter
    );

    // Collect detailed information for remaining issues
    const currentRemainingQuery = encodeURIComponent(
      `sprint = "${sprintData.name}" AND status != Done`,
    );
    const currentRemainingResponse = await client.get<JiraSearchResponse>(
      `/rest/api/3/search?jql=${currentRemainingQuery}&fields=${storyPointsField},status,summary,assignee`,
    );

    // Collect detailed information for remaining issues
    const remainingIssues = currentRemainingResponse.data.issues.map((issue) => ({
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

    // Get sprint-specific configuration if available
    const sprintConfig = boardConfig.sprints?.[sprintData.name];

    // Calculate total and elapsed business days
    const calculatedTotalBusinessDays = calculateBusinessDays(startDate, endDate);
    // Use sprint-specific total business days if provided
    const totalSprintBusinessDays = sprintConfig?.totalBusinessDays ?? calculatedTotalBusinessDays;

    // Calculate elapsed business days without capping to sprint end date
    const elapsedBusinessDays = calculateBusinessDays(startDate, currentDate);
    console.log('Business days elapsed:', elapsedBusinessDays);

    // Get the team velocity - prioritize sprint-specific value, then board default, then calculate
    const teamVelocity = sprintConfig?.teamVelocity ?? boardConfig.defaultTeamVelocity;
    const completedPoints = completedIssuesSummary.totalPoints;

    const currentTotalPoints = currentRemainingPoints + completedPoints;

    // Existing sprint burndown and velocity calculations
    let plannedRemainingPoints;
    let dailyRate;
    let expectedCompletedPoints;
    let sprintLoadInfo = null;

    if (teamVelocity) {
      // If team velocity is specified, use it to calculate daily rate
      dailyRate = teamVelocity / totalSprintBusinessDays;
      expectedCompletedPoints = Math.min(
        currentTotalPoints, // KEY CHANGE: Use current total points
        (elapsedBusinessDays / totalSprintBusinessDays) * currentTotalPoints,
      );

      // Calculate expected completion day for light sprints
      const expectedCompletionDay = Math.min(
        totalSprintBusinessDays,
        initialTotalPoints / dailyRate,
      );

      // Determine if this is a light or heavy sprint load
      if (initialTotalPoints < teamVelocity) {
        sprintLoadInfo = {
          type: 'light' as const,
          loadPercentage: Math.round((initialTotalPoints / teamVelocity) * 100),
          expectedCompletionDay: expectedCompletionDay.toFixed(1),
        };
      } else if (initialTotalPoints > teamVelocity) {
        sprintLoadInfo = {
          type: 'heavy' as const,
          loadPercentage: Math.round((initialTotalPoints / teamVelocity) * 100),
          overcommitPoints: initialTotalPoints - teamVelocity,
        };
      } else {
        sprintLoadInfo = {
          type: 'normal' as const,
          loadPercentage: 100,
        };
      }
      // Calculate planned remaining (can't be negative)
      plannedRemainingPoints = Math.max(0, initialTotalPoints - expectedCompletedPoints);
    } else {
      // Default to a simple linear burndown if no team velocity is set
      const completionRatio = elapsedBusinessDays / totalSprintBusinessDays;
      expectedCompletedPoints = initialTotalPoints * completionRatio;
      plannedRemainingPoints = Math.max(0, initialTotalPoints * (1 - completionRatio));
      dailyRate = initialTotalPoints / totalSprintBusinessDays;
    }

    // Store the raw calculated value before applying the floor
    const rawCalculatedRemaining = initialTotalPoints - expectedCompletedPoints;

    // Round to one decimal place for better readability
    plannedRemainingPoints = Math.round(plannedRemainingPoints * 10) / 10;
    expectedCompletedPoints = Math.round(expectedCompletedPoints * 10) / 10;
    dailyRate = Math.round(dailyRate * 10) / 10;

    // Calculate drift score using total completed points from comprehensive summary
    const driftScore =
      Math.round((expectedCompletedPoints - completedIssuesSummary.totalPoints) * 10) / 10;

    // Calculate total drift work
    const totalDriftWork = currentRemainingPoints + completedIssuesSummary.totalPoints;

    return {
      initialTotalPoints,
      currentRemainingPoints,
      plannedRemainingPoints,
      rawCalculatedRemaining,
      driftScore,
      remainingIssues,
      completedIssues: completedIssuesSummary.issues,
      completedPoints,
      totalSprintBusinessDays,
      elapsedBusinessDays,
      dailyRate,
      expectedCompletedPoints,
      teamVelocity,
      sprintLoadInfo,
      totalDriftWork,
      completedIssuesSummary,
    };
  } catch (error: unknown) {
    handleJiraApiError(error, 'Failed to calculate drift score');
    return {
      initialTotalPoints: 0,
      currentRemainingPoints: 0,
      plannedRemainingPoints: 0,
      rawCalculatedRemaining: 0,
      driftScore: 0,
      remainingIssues: [],
      completedIssues: [],
      completedPoints: 0,
      totalSprintBusinessDays: 0,
      elapsedBusinessDays: 0,
      dailyRate: 0,
      expectedCompletedPoints: 0,
      teamVelocity: 0,
      sprintLoadInfo: null,
      totalDriftWork: 0,
      completedIssuesSummary: {
        totalPoints: 0,
        issues: [],
        uniqueIssueCount: 0,
      },
    };
  }
};
