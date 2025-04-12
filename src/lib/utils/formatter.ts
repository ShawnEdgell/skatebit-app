// src/lib/utils/formatter.ts

/**
 * Formats a file size in bytes into a human-readable string (B, KB, MB, GB, TB).
 * Handles null, undefined, and 0 bytes gracefully.
 * @param bytes - The file size in bytes.
 * @param decimals - The number of decimal places to display (default: 1).
 * @returns A formatted string representation of the file size.
 */
export function formatFileSize(
  bytes: number | null | undefined,
  decimals = 1
): string {
  if (bytes == null || isNaN(bytes) || bytes <= 0) return "0 B";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

  // Handle edge case for log(0) or negative numbers if bytes somehow bypass initial check
  if (bytes <= 0) return "0 B";

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  // Ensure index is within bounds and calculation is valid
  const safeIndex = Math.max(0, Math.min(i, sizes.length - 1)); // Clamp index
  const unit = sizes[safeIndex];
  const value = parseFloat((bytes / Math.pow(k, safeIndex)).toFixed(dm));

  if (isNaN(value) || !isFinite(value)) {
    // Fallback if calculation fails unexpectedly
    console.warn(`formatFileSize failed for bytes: ${bytes}`);
    return `${bytes} B`; // Return original bytes with base unit
  }

  return `${value} ${unit}`;
}

// --- ADDED Relative Time Function ---

// Intl.RelativeTimeFormat is widely supported, but ensure target environments have it.
const RFT = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
// Define time units and their thresholds in seconds
const DIVISIONS: Array<{ amount: number; name: Intl.RelativeTimeFormatUnit }> =
  [
    { amount: 60, name: "seconds" },
    { amount: 60, name: "minutes" },
    { amount: 24, name: "hours" },
    { amount: 7, name: "days" },
    { amount: 4.34524, name: "weeks" }, // Average weeks per month
    { amount: 12, name: "months" },
    { amount: Number.POSITIVE_INFINITY, name: "years" },
  ];

/**
 * Formats a UNIX timestamp (seconds since epoch) into a relative time string (e.g., "2 days ago").
 * @param timestampSeconds - The UNIX timestamp in seconds.
 * @returns A human-readable relative time string, or an empty string if input is invalid.
 */
export function formatRelativeTime(
  timestampSeconds: number | null | undefined
): string {
  if (
    timestampSeconds == null ||
    isNaN(timestampSeconds) ||
    timestampSeconds <= 0
  ) {
    // Return empty string for invalid/missing timestamps
    return "";
  }
  try {
    // Convert seconds to milliseconds for Date object
    const date = new Date(timestampSeconds * 1000);
    // Check if date is valid after conversion
    if (isNaN(date.getTime())) {
      console.warn(
        `formatRelativeTime received invalid timestamp (seconds): ${timestampSeconds}`
      );
      return "";
    }

    const now = new Date();
    let duration = (date.getTime() - now.getTime()) / 1000; // Difference in seconds

    for (const division of DIVISIONS) {
      if (Math.abs(duration) < division.amount) {
        // Found the right unit
        return RFT.format(Math.round(duration), division.name);
      }
      // If duration is larger, divide to check the next unit
      duration /= division.amount;
    }
    // Should be handled by Number.POSITIVE_INFINITY in years division
    return ""; // Fallback if something unexpected happens
  } catch (e) {
    console.error(
      "Error formatting relative time for timestamp:",
      timestampSeconds,
      e
    );
    return ""; // Return empty string on error
  }
}
