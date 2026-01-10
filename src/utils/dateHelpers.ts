/**
 * Date formatting utilities
 * Uses native Date methods which properly respect the device's local timezone
 */

/**
 * Format a date/time string to a localized time string (e.g., "2:30 PM" or "14:30")
 * Uses getHours()/getMinutes() which are guaranteed to return local timezone values
 */
export function formatLocalTime(dateString: string | Date | null | undefined): string {
  if (!dateString) return "";
  
  const date = typeof dateString === "string" ? new Date(dateString) : dateString;
  
  // Check for invalid date
  if (isNaN(date.getTime())) return "";
  
  // getHours() and getMinutes() always return local timezone values
  const hours = date.getHours();
  const minutes = date.getMinutes();
  
  // Format as 12-hour time with AM/PM
  const ampm = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  const minStr = minutes.toString().padStart(2, "0");
  
  return `${hour12}:${minStr} ${ampm}`;
}

/**
 * Format a date/time string to a 24-hour time string (e.g., "14:30")
 */
export function formatLocalTime24(dateString: string | Date | null | undefined): string {
  if (!dateString) return "";
  
  const date = typeof dateString === "string" ? new Date(dateString) : dateString;
  
  if (isNaN(date.getTime())) return "";
  
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  
  return `${hours}:${minutes}`;
}

/**
 * Format a date for display in date dividers
 */
export function formatDateDivider(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return "Today";
  } else if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  } else {
    // Use local date formatting
    const options: Intl.DateTimeFormatOptions = {
      weekday: "long",
      month: "short",
      day: "numeric",
    };
    // Try locale formatting, fallback to manual formatting
    try {
      return date.toLocaleDateString(undefined, options);
    } catch {
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
    }
  }
}

/**
 * Format relative time for conversation lists (e.g., "Just now", "5m", "2h", "3d")
 */
export function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return "";
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  
  // For older dates, show month and day
  const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  try {
    return date.toLocaleDateString("en-US", options);
  } catch {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  }
}

/**
 * Format date for conversation history drawer
 */
export function formatConversationDate(dateString: string): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return formatLocalTime(dateString);
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return days[date.getDay()];
  } else {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  }
}
