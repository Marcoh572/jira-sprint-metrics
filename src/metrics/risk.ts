// Extract risk score calculation function

export const calculateRiskScore = (
  allIssues: Array<{ 
    key: string; 
    summary: string; 
    assignee: string; 
    points?: number | null;
    status: string; 
  }>,
  essentiallyDoneStatuses: string[] = []
): {
  riskScore: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  groomed: number;
  totalNeedingGrooming: number;
} => {
  // Separate issues into pointed and unpointed categories
  const pointed = allIssues.filter(issue => 
    issue.points !== null && issue.points !== undefined
  );
  
  // Filter out "essentially done" issues from unpointed issues
  const unpointedNeedGrooming = allIssues.filter(issue => 
    (issue.points === null || issue.points === undefined) && 
    !essentiallyDoneStatuses.includes(issue.status)
  );
  
  // Calculate counts
  const groomed = pointed.length;
  const totalNeedingGrooming = groomed + unpointedNeedGrooming.length;
  
  // Calculate risk score
  const riskScore = totalNeedingGrooming > 0 
    ? parseFloat((1 - groomed / totalNeedingGrooming).toFixed(2)) 
    : 0;
  
  // Determine risk level
  let riskLevel: 'Low' | 'Medium' | 'High' = 'Low';
  if (riskScore > 0.66) {
    riskLevel = 'High';
  } else if (riskScore > 0.33) {
    riskLevel = 'Medium';
  }
  
  return {
    riskScore,
    riskLevel,
    groomed,
    totalNeedingGrooming
  };
};