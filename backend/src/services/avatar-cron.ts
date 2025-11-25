import { db } from "../db";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";

/**
 * Get current date in Eastern timezone (America/New_York)
 */
function getEasternDate(date: Date = new Date()): string {
  return date.toLocaleDateString("en-US", { 
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

/**
 * Check if a new avatar should be generated and trigger generation if needed
 */
export async function checkAndGenerateAvatar() {
  try {
    console.log("[Avatar Cron] Checking if new avatar should be generated...");

    // Get group settings
    const groupSettings = await db.groupSettings.findUnique({
      where: { id: "global-chat" },
    });

    if (!groupSettings) {
      console.log("[Avatar Cron] No group settings found, skipping avatar generation");
      return;
    }

    // Check if avatar was already generated today (Eastern time)
    const todayEastern = getEasternDate();

    if (groupSettings.lastAvatarGenDate) {
      const lastGenDateEastern = getEasternDate(new Date(groupSettings.lastAvatarGenDate));

      if (lastGenDateEastern === todayEastern) {
        console.log("[Avatar Cron] Avatar already generated today (Eastern time)");
        return;
      }
    }

    console.log("[Avatar Cron] Triggering avatar generation...");

    // Call the avatar generation endpoint
    const response = await fetch(`${BACKEND_URL}/api/ai/generate-group-avatar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Avatar Cron] Failed to generate avatar:", errorText);
      return;
    }

    const result = await response.json();
    console.log("[Avatar Cron] Avatar generation result:", result);
  } catch (error) {
    console.error("[Avatar Cron] Error in avatar cron job:", error);
  }
}

/**
 * Get next midnight in Eastern timezone
 */
function getNextMidnightEastern(): Date {
  const now = new Date();
  
  // Get current time in Eastern timezone
  const easternTimeStr = now.toLocaleString("en-US", { 
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  
  // Parse Eastern time
  const [datePart, timePart] = easternTimeStr.split(", ");
  const [month, day, year] = datePart.split("/");
  const [hour, minute, second] = timePart.split(":");
  
  // Create date for next midnight Eastern
  const nextMidnightEastern = new Date(`${year}-${month}-${day}T00:00:00-05:00`);
  
  // If we're past midnight today, move to tomorrow
  if (now >= nextMidnightEastern) {
    nextMidnightEastern.setDate(nextMidnightEastern.getDate() + 1);
  }
  
  return nextMidnightEastern;
}

/**
 * Start the daily avatar generation cron job
 * Runs every day at midnight Eastern time (00:00 America/New_York)
 */
export function startAvatarCron() {
  console.log("[Avatar Cron] Starting daily avatar generation cron job (Eastern time)");

  // Calculate time until next midnight Eastern
  const now = new Date();
  const nextMidnightEastern = getNextMidnightEastern();
  const timeUntilMidnight = nextMidnightEastern.getTime() - now.getTime();

  // Run at midnight Eastern
  setTimeout(() => {
    checkAndGenerateAvatar();

    // Then run every 24 hours
    setInterval(() => {
      checkAndGenerateAvatar();
    }, 24 * 60 * 60 * 1000); // 24 hours
  }, timeUntilMidnight);

  const midnightEasternStr = nextMidnightEastern.toLocaleString("en-US", {
    timeZone: "America/New_York",
    dateStyle: "full",
    timeStyle: "long"
  });
  
  console.log(`[Avatar Cron] Next avatar generation scheduled for: ${midnightEasternStr}`);
}
