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

  const isFutureSprint = startDate.getTime() > current.getTime();
  console.log('formatBusinessDaysBreakdown  > isFutureSprint:', isFutureSprint);

  console.log('Start Date:', startDate);
  console.log('Current Date:', current);
  console.log('Start Date Time:', startDate.getTime());
  console.log('Current Date Time:', current.getTime());
  console.log('Start Date > Current Date:', startDate > current);

  // Helper function to format dates as YYYY-MM-DD
  const formatDate = (date: Date) => {
    // Check if the date is valid before trying to convert it
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      return 'Not scheduled'; // Or any other appropriate message
    }
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  };
  // Determine if current date has been time-shifted
  const isTimeShifted = timeShift !== undefined && timeShift !== 0;

  // Calculate the shifted date for display
  let shiftedDate = current;
  if (isTimeShifted) {
    shiftedDate =
      timeShift > 0
        ? addBusinessDays(current, timeShift)
        : subtractBusinessDays(current, Math.abs(timeShift));
  }

  // Build the breakdown string
  let breakdown = `\n${colors.bright}${colors.white}Business Days Breakdown:${colors.reset}\n`;
  breakdown += `  ${colors.dim}Sprint Start:${colors.reset} ${
    isFutureSprint
      ? `${colors.yellow}Future Sprint${colors.reset}`
      : `${colors.bright}${formatDate(startDate)}${colors.reset}`
  }\n`;
  breakdown += `  ${colors.dim}Sprint End:${colors.reset} ${colors.bright}${formatDate(endDate)}${colors.reset}\n`;

  if (isFutureSprint) {
    breakdown += `  ${colors.yellow}Sprint Status: Upcoming Future Sprint${colors.reset}\n`;
    breakdown += `  ${colors.dim}Planned Dates:${colors.reset} ${colors.bright}${formatDate(start)} - ${formatDate(end)}${colors.reset} `;
    breakdown += `${colors.dim}(${totalSprintBusinessDays} business days)${colors.reset}\n`;
  } else {
    // Display the current date, noting if it's time-shifted
    if (isTimeShifted) {
      const actualDateStr = formatDate(current);
      const shiftedDateStr = formatDate(shiftedDate);

      breakdown += `  ${colors.dim}Current Date:${colors.reset} ${colors.bright}${shiftedDateStr}${colors.reset} ${colors.yellow}[Time-shifted from ${actualDateStr}, ${timeShift > 0 ? '+' : ''}${timeShift} business days]${colors.reset}\n`;
    } else {
      // For non-time-shifted dates
      breakdown += `  ${colors.dim}Current Date:${colors.reset} ${colors.bright}${formatDate(current)}${colors.reset}\n`;
    }

    breakdown += `  ${colors.dim}Sprint End:${colors.reset} ${colors.bright}${formatDate(end)}${colors.reset}\n`;

    // Display elapsed business days
    breakdown += `  ${colors.dim}Business Days Elapsed:${colors.reset} ${colors.bright}${elapsedBusinessDays}${colors.reset}`;

    // Add a note if time-shifted
    if (isTimeShifted) {
      breakdown += ` ${colors.yellow}(includes time shift effect)${colors.reset}`;
    }
    breakdown += `\n`;

    breakdown += `  ${colors.dim}Total Sprint Business Days:${colors.reset} ${colors.bright}${totalSprintBusinessDays}${colors.reset}\n`;

    // Calculate calendar days elapsed
    const calendarDays = Math.round((current.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    breakdown += `  ${colors.dim}Calendar Days Elapsed:${colors.reset} ${colors.bright}${calendarDays}${colors.reset}\n`;
  }

  return breakdown;
}
