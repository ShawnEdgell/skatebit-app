/**
 * Handles errors by logging them with optional context.
 *
 * @param error - The error object.
 * @param context - Additional context to display in the log.
 */
export function handleError(error: unknown, context: string = ""): void {
  console.error(`Error ${context ? `in ${context}` : ""}:`, error);
  // Optional: Dispatch notifications or update a Svelte store here.
}
