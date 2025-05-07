import { addBusinessDays, subtractBusinessDays } from '../metrics/drift';

// Calculate business days between two dates, where the sprint start date is day 0
export function calculateBusinessDays(start: Date, end: Date): number {
  // Create new Date objects and normalize to midnight
  const startDate = new Date(start);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(end);
  endDate.setHours(0, 0, 0, 0);

  // Get today's date normalized to midnight
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // If the end date is today, use it directly - we want to count business days including today
  // This is different from the previous implementation which excluded today
  const adjustedEndDate = endDate;

  // If today is the sprint start date, return 0 (day zero of sprint)
  if (startDate.getTime() === adjustedEndDate.getTime()) {
    return 0;
  }

  let businessDays = 0;
  let currentDate = new Date(startDate);

  // Move to next day to start counting from day 1
  currentDate.setDate(currentDate.getDate() + 1);

  // Count business days up to adjusted end date (inclusive)
  while (currentDate <= adjustedEndDate) {
    // Check if it's a weekday (Monday-Friday)
    if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
      businessDays++;
    }

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return businessDays;
}

// Calculate business hours between two dates
export function calculateBusinessHours(start: Date, end: Date): number {
  let businessHours = 0;
  let currentDate = new Date(start);

  while (currentDate <= end) {
    // Check if it's a weekday (Monday-Friday)
    if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
      const currentHour = currentDate.getHours();

      // Business hours are typically 9 AM to 5 PM
      if (currentHour >= 9 && currentHour < 17) {
        businessHours++;
      }
    }

    // Increment by one hour
    currentDate.setHours(currentDate.getHours() + 1);
  }

  return businessHours;
}

export const formatBusinessDaysBreakdown = (
  startDate: Date,
  endDate: Date,
  currentDate: Date,
  elapsedBusinessDays: number,
  totalSprintBusinessDays: number,
  colors: any,
  timeShift?: number,
  sprintState?: string, // Add the sprint state parameter
): string => {
  let output = '';

  const formattedStartDate = startDate.toISOString().split('T')[0];
  const formattedEndDate = endDate.toISOString().split('T')[0];

  // Create a copy of currentDate to avoid modifying the original
  let effectiveDate = new Date(currentDate.getTime());

  // Apply time shift if specified
  if (timeShift) {
    // We don't need to recalculate this here because elapsedBusinessDays already accounts for the time shift
    // Just log the information
    console.log(
      `Using time-shifted date (${timeShift > 0 ? 'forward' : 'backward'} by ${Math.abs(timeShift)} business days)`,
    );
  }

  // Debug output that shows the comparison
  const startTime = startDate.getTime();
  const currentTime = effectiveDate.getTime();
  const isFutureSprint = startTime > currentTime;

  console.log('formatBusinessDaysBreakdown  > isFutureSprint:', isFutureSprint);
  console.log('Start Date:', startDate.toISOString());
  console.log('Current Date:', effectiveDate.toISOString());
  console.log('Start Date Time:', startTime);
  console.log('Current Date Time:', currentTime);
  console.log('Start Date > Current Date:', startTime > currentTime);
  console.log('Sprint State:', sprintState || 'unknown');
  console.log('Time Shift:', timeShift || 'none');
  console.log('Elapsed Business Days:', elapsedBusinessDays);

  output += '\n';
  output += 'Business Days Breakdown:\n';

  // Calculate the days between today and the sprint start
  const todayMs = effectiveDate.getTime();
  const startDateMs = startDate.getTime();
  const diffDays = Math.round((todayMs - startDateMs) / (1000 * 60 * 60 * 24));

  const sprintStartStr =
    isFutureSprint && sprintState !== 'active' ? 'Future Sprint' : formattedStartDate;
  output += `  ${colors.dim}Sprint Start:${colors.reset} ${sprintStartStr}\n`;
  output += `  ${colors.dim}Sprint End:${colors.reset} ${formattedEndDate}\n`;

  // Determine sprint status based on state first, then use time-aware calculations as fallback
  let sprintStatus;

  // If time-shifting, we need to adjust our determination of the sprint status
  if (timeShift) {
    // With time shifting, we need to determine what the status would be on the shifted date
    if (elapsedBusinessDays < 0) {
      // If time-shifted to before the sprint start
      sprintStatus = 'Upcoming Future Sprint (Time-Shifted View)';
    } else if (elapsedBusinessDays >= totalSprintBusinessDays) {
      // If time-shifted to after the sprint end
      sprintStatus = 'Completed Past Sprint (Time-Shifted View)';
    } else {
      // If time-shifted to during the sprint
      sprintStatus = 'Active Current Sprint (Time-Shifted View)';
    }
  } else {
    // Without time shifting, prioritize the sprint state from Jira
    if (sprintState === 'active') {
      sprintStatus = 'Active Current Sprint';
    } else if (sprintState === 'future') {
      sprintStatus = 'Upcoming Future Sprint';
    } else if (sprintState === 'closed') {
      sprintStatus = 'Completed Past Sprint';
    } else {
      // Fallback to timestamp-based determination if sprint state is unknown
      if (elapsedBusinessDays <= 0 && isFutureSprint) {
        sprintStatus = 'Upcoming Future Sprint';
      } else if (todayMs > endDate.getTime()) {
        sprintStatus = 'Completed Past Sprint';
      } else {
        sprintStatus = 'Active Current Sprint';
      }
    }
  }

  output += `  ${colors.dim}Sprint Status:${colors.reset} ${sprintStatus}\n`;
  output += `  ${colors.dim}Planned Dates:${colors.reset} ${formattedStartDate} - ${formattedEndDate} (${totalSprintBusinessDays} business days)\n`;

  if (timeShift && timeShift !== 0) {
    output += `  ${colors.yellow}Note: Reporting time shifted by ${timeShift} business days${colors.reset}\n`;
  }

  return output;
};
