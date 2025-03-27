import { AxiosError } from '../types';
import { colors } from '../utils/colors';

// Enhanced error handling for Jira API calls
export const handleJiraApiError = (error: unknown, context: string) => {
  // Check if it's an AxiosError-like object
  if (error && typeof error === 'object') {
    const axiosError = error as AxiosError;

    if (axiosError.response) {
      // The request was made and the server responded with an error status
      console.error(
        `${colors.red}${context}. Server response:${colors.reset}`,
        axiosError.response.status,
        axiosError.response.data,
      );

      if (axiosError.response.data?.errorMessages?.length > 0) {
        console.error(
          `${colors.red}Error message:${colors.reset}`,
          axiosError.response.data.errorMessages[0],
        );
      }
    } else if (axiosError.request) {
      // The request was made but no response was received
      console.error(
        `${colors.red}${context}. No response received:${colors.reset}`,
        axiosError.request,
      );
    } else if (axiosError.message) {
      // Something happened in setting up the request
      console.error(`${colors.red}${context}:${colors.reset}`, axiosError.message);
    } else {
      // Not a standard axios error
      console.error(`${colors.red}${context}:${colors.reset}`, error);
    }
  } else {
    // Fallback for non-object errors
    console.error(`${colors.red}${context}:${colors.reset}`, error);
  }
};
