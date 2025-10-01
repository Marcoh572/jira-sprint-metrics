// Define AxiosError type
export type AxiosError = {
  response?: {
    status: number;
    data: any;
  };
  request?: any;
  message: string;
};

export type JiraAuthInfo = {
  success: boolean;
  jira_email: string;
  jira_api_token: string;
  jira_auth_token: string;
  jira_site: string;
  jira_site_id: string;
}

// Sprint-specific configuration
export type SprintConfig = {
  totalBusinessDays?: number;
  teamVelocity?: number; // Sprint-specific team velocity
  notes?: string; // Optional field for documenting why velocity changed
};

// Board config type
export interface BoardConfig {
  id: number;
  name: string;
  defaultTeamVelocity: number;
  customFields?: {
    groomedStatus: string[];
    ungroomedStatus: string[];
    storyPoints: string;
  };
  // Renamed from essentiallyDoneStatuses
  finishLineStatuses?: string[];
  statusOrder?: string[];
  sprints?: {
    [sprintName: string]: {
      totalBusinessDays?: number;
      teamVelocity?: number;
      notes?: string;
    };
  };
}

// Data source for a report
export type ReportDataSource = {
  boardId: number; // ID of the board to generate report for
  sprint: string; // Name of sprint to generate report for
};

// Report configuration type
export type ReportConfig = {
  description?: string; // Optional description of the report
  progress?: ReportDataSource[]; // Sources for progress reports
  plan?: ReportDataSource[]; // Sources for plan reports
};

// Jira config type
export type JiraConfig = {
  baseUrl: string;
  email: string;
  apiToken: string;
  boards: BoardConfig[]; // Array of board configurations
  defaultBoard?: number; // Optional default board ID
  reports?: {
    [reportId: string]: ReportConfig; // Named reports with unique IDs
  };
};

export type SprintData = {
  id: number;
  name: string;
  state: string;
  startDate: string;
  endDate: string;
};

export type ProgressReportData = {
  sprintName: string;
  driftScore: number;
  totalPoints: number;
  currentRemainingPoints: number;
  plannedRemainingPoints: number;
  rawCalculatedRemaining: number; // Added
  actualRemaining: number;
  assigneeWorkload: Record<string, number>;
  unassignedPoints: number;
  completedPoints: number;
  elapsedBusinessDays: number;
  dailyRate: number;
  expectedCompletedPoints: number;
  initialTotalPoints: number;
  // Add team velocity and sprint load info
  teamVelocity?: number;
  sprintLoadInfo?: {
    type: 'light' | 'heavy' | 'normal';
    loadPercentage: number;
    expectedCompletionDay?: string;
    overcommitPoints?: number;
  } | null;
  // Risk score properties
  groomedIssues?: number;
  totalNeedingGrooming?: number;
  riskScore?: number;
  riskLevel?: 'Low' | 'Medium' | 'High';
};

export type PlanReportData = {
  name: string;
  riskScore: number;
  itemsGroomed: number;
  totalItems: number;
};

export type JiraResponse<T> = {
  data: T;
};

export type JiraSearchResponse = {
  total: number;
  issues: Array<{
    key: string;
    fields: {
      summary: string;
      status: { name: string };
      assignee?: { displayName: string };
      [storyPointsField: string]: any;
    };
  }>;
};

export type JiraSprintResponse = {
  values: Array<SprintData>;
};

export type JiraClient = {
  get: <T>(url: string) => Promise<JiraResponse<T>>;
};

export type IssueDetails = {
  key: string;
  summary: string;
  status: string;
  assignee: string;
  isGroomed: boolean;
};

export type GroomingMetricsResult = {
  groomed: number;
  total: number;
  groomedIssues: IssueDetails[];
  ungroomedIssues: IssueDetails[];
  issuesByStatus: Record<string, Array<{ key: string; summary: string; assignee: string }>>;
  groomedStatuses: string[];
  ungroomedStatuses: string[];
};

export type DriftScoreResult = {
  initialTotalPoints: number;
  currentRemainingPoints: number;
  plannedRemainingPoints: number;
  rawCalculatedRemaining: number; // Added for formatting clarity
  driftScore: number;
  remainingIssues: Array<{
    key: string;
    summary: string;
    points: number;
    status: string;
    assignee: string;
  }>;
  completedIssues: Array<{
    key: string;
    summary: string;
    points: number;
    status: string;
    assignee: string;
  }>;
  completedPoints: number;
  totalSprintBusinessDays: number;
  elapsedBusinessDays: number;
  dailyRate: number;
  expectedCompletedPoints: number;
  teamVelocity?: number; // Added for context
  sprintLoadInfo?: {
    // Added for sprint load context
    type: 'light' | 'heavy' | 'normal';
    loadPercentage: number;
    expectedCompletionDay?: string;
    overcommitPoints?: number;
  } | null;
  totalDriftWork: number;
  completedIssuesSummary?: CompletedIssuesSummary;
};

export interface ActualRemainingResult {
  totalPoints: number;
  assigneeWorkload: Record<string, number>;
  unassignedPoints: number;
  issuesByStatus?: Record<
    string,
    {
      points: number;
      issues: Array<{
        key: string;
        summary: string;
        points: number;
        assignee: string;
        status: string;
      }>;
    }
  >;
}

export interface SprintScopeChanges {
  initialPoints: number;
  currentPoints: number;
  netPointChange: number;
  currentIssueCount: number;

  addedIssueCount: number;
  addedIssues: Array<{
    key: string;
    summary: string;
    points: number;
    status: string;
    assignee: string;
  }>;
  addedPoints: number;
  addedByAssignee: Record<
    string,
    {
      count: number;
      points: number;
      issues: Array<{
        key: string;
        summary: string;
        points: number;
        status: string;
        assignee: string;
      }>;
    }
  >;

  removedIssueCount: number;
  removedIssues: Array<{
    key: string;
    summary: string;
    points: number;
    status: string;
    assignee: string;
  }>;
  removedPoints: number;
  removedByAssignee: Record<
    string,
    {
      count: number;
      points: number;
      issues: Array<{
        key: string;
        summary: string;
        points: number;
        status: string;
        assignee: string;
      }>;
    }
  >;
}

export type CompletedIssuesSummary = {
  totalPoints: number;
  issues: Array<{
    key: string;
    summary: string;
    points: number;
    status: string;
    assignee: string;
  }>;
  uniqueIssueCount: number;
};

