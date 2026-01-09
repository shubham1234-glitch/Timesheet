/**
 * Get a time-based greeting message
 * @returns A greeting string based on the current time of day
 */
export function getGreeting(): string {
  const hour = new Date().getHours();
  
  if (hour >= 5 && hour < 12) {
    return "Good Morning";
  } else if (hour >= 12 && hour < 17) {
    return "Good Afternoon";
  } else if (hour >= 17 && hour < 21) {
    return "Good Evening";
  } else {
    return "Good Night";
  }
}

/**
 * Get a personalized greeting with user name
 * @param userName - The name of the user (optional)
 * @returns A greeting string with the user's name, or just the greeting if no name is provided
 */
export function getPersonalizedGreeting(userName?: string | null): string {
  const greeting = getGreeting();
  if (userName) {
    return `${greeting}, ${userName}`;
  }
  return greeting;
}

