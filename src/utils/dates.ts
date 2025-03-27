import { addBusinessDays, subtractBusinessDays } from '../metrics/drift';

// Calculate business days between two dates, including the start date but excluding the current date if it's today
export function calculateBusinessDays(start: Date, end: Date): number {
  // Create new Date objects and normalize to midnight
  const startDate = new Date(start);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(end);
  endDate.setHours(0, 0, 0, 0);

  // Get today's date normalized to midnight
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // If the end date is today, we want to exclude it from the count
  // because the day isn't complete yet
  const adjustedEndDate =
    endDate.getTime() === today.getTime()
      ? new Date(today.getTime() - 86400000) // Subtract one day (86400000 ms)
      : endDate;

  // If the dates are the same, return 1 if it's a business day, 0 if weekend
  if (startDate.getTime() === adjustedEndDate.getTime()) {
    const day = startDate.getDay();
    return day !== 0 && day !== 6 ? 1 : 0;
  }

  let businessDays = 0;
  let currentDate = new Date(startDate);

  // Start counting from the start date (inclusive) up to adjusted end date
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

export function formatBusinessDaysBreakdown(
  startDate: Date,
  endDate: Date,
  currentDate: Date,
  elapsedBusinessDays: number,
  totalSprintBusinessDays: number,
  colors: any,
  timeShift?: number,
): string {
  // Normalize dates to midnight
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  const current = new Date(currentDate);
  current.setHours(0, 0, 0, 0);

  // Get today's actual date normalized to midnight
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Determine if current date has been time-shifted
  const isTimeShifted = timeShift !== undefined && timeShift !== 0;

  // Calculate the shifted date for display
  let properlyShiftedDate = current;
  if (isTimeShifted && timeShift !== undefined) {
    properlyShiftedDate =
      timeShift >= 0
        ? addBusinessDays(current, timeShift)
        : subtractBusinessDays(current, Math.abs(timeShift));
  }

  // For time-shifted dates, we still consider the final day as partial
  // and should exclude it from completed business days
  const finalDateForCounting = new Date(properlyShiftedDate);
  finalDateForCounting.setDate(finalDateForCounting.getDate() - 1);

  // Recalculate elapsed business days excluding the partial (shifted) day
  const shiftedElapsedBusinessDays = isTimeShifted
    ? calculateBusinessDays(start, finalDateForCounting)
    : elapsedBusinessDays;

  // Create arrays to store the breakdown
  const allDays: string[] = [];
  const businessDays: string[] = [];

  // Clone the start date
  let date = new Date(start);

  // Format dates for display
  const formatDate = (d: Date) => {
    return d.toISOString().split('T')[0]; // YYYY-MM-DD format
  };

  // Loop through days from start to the day before shifted date (excluding partial day)
  while (date <= finalDateForCounting) {
    const isBusinessDay = date.getDay() !== 0 && date.getDay() !== 6;
    const dateStr = formatDate(date);
    const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];

    // Add to all days
    allDays.push(`${dateStr} (${dayName})`);

    // Add only business days
    if (isBusinessDay) {
      businessDays.push(`${dateStr} (${dayName})`);
    }

    // Move to next day
    date.setDate(date.getDate() + 1);
  }

  // Build the breakdown string
  let breakdown = `\n${colors.bright}${colors.white}Business Days Breakdown:${colors.reset}\n`;
  breakdown += `  ${colors.dim}Sprint Start:${colors.reset} ${colors.bright}${formatDate(start)}${colors.reset}\n`;

  // Display the current date, noting if it's time-shifted
  if (isTimeShifted) {
    const actualDateStr = formatDate(current);
    const shiftedDateStr = formatDate(properlyShiftedDate);

    breakdown += `  ${colors.dim}Current Date:${colors.reset} ${colors.bright}${shiftedDateStr}${colors.reset} ${colors.yellow}[Time-shifted from ${actualDateStr}, ${timeShift > 0 ? '+' : ''}${timeShift} business days]${colors.reset} ${colors.reset}\n`;
  } else {
    // For non-time-shifted dates
    const isCurrentToday = current.getTime() === today.getTime();
    breakdown += `  ${colors.dim}Current Date:${colors.reset} ${colors.bright}${formatDate(current)}${colors.reset}${isCurrentToday ? ` ${colors.reset}` : ''}\n`;
  }

  breakdown += `  ${colors.dim}Sprint End:${colors.reset} ${colors.bright}${formatDate(end)}${colors.reset}\n`;

  // Display the adjusted business days elapsed count for time-shifted dates
  breakdown += `  ${colors.dim}Business Days Elapsed:${colors.reset} ${colors.bright}${shiftedElapsedBusinessDays}${colors.reset}`;
  if (isTimeShifted) {
    breakdown += ` ${colors.yellow}(adjusted for time shift, excluding partial day)${colors.reset}`;
  }
  breakdown += `\n`;

  breakdown += `  ${colors.dim}Total Sprint Business Days:${colors.reset} ${colors.bright}${totalSprintBusinessDays}${colors.reset}\n`;
  breakdown += `  ${colors.dim}Calendar Days Elapsed:${colors.reset} ${colors.bright}${allDays.length}${colors.reset}\n`;

  // List the business days
  if (businessDays.length > 0) {
    breakdown += `  ${colors.dim}Business Days:${colors.reset} ${businessDays.join(', ')}\n`;
  }

  return breakdown;
}
