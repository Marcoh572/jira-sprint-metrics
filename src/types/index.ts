// Define AxiosError type
export type AxiosError = {
  response?: {
    status: number;
    data: any;
  };
  request?: any;
  message: string;
};

// Sprint-specific configuration
export type SprintConfig = {
  totalBusinessDays?: number;
  teamVelocity?: number; // Sprint-specific team velocity
  notes?: string; // Optional field for documenting why velocity changed
};

// Board config type
export type BoardConfig = {
  id: number; // Board ID
  name?: string; // Optional board name for better reporting
  defaultTeamVelocity?: number; // Default team velocity for burndown calculation
  customFields?: {
    groomedStatus?: string[]; // Status values that indicate an item is groomed
    ungroomedStatus?: string[]; // Status values that indicate an item is not yet groomed
    storyPoints?: string; // Field name for story points
  };
  // Sprint-specific configurations
  sprints?: {
    [sprintName: string]: SprintConfig;
  };
};

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
  name: string;
  driftScore: number;
  initialTotalPoints: number;
  currentRemainingPoints: number;
  plannedRemainingPoints: number;
  actualRemaining: number;
  assigneeWorkload: Record<string, number>;
  unassignedPoints: number;
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
    fields: Record<string, any>;
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
};

export type ActualRemainingResult = {
  totalPoints: number;
  assigneeWorkload: Record<string, number>;
  unassignedPoints: number;
};
