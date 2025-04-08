/**
 * Normalizes a file path to consistently use forward slashes.
 *
 * @param path - The input path string.
 * @returns The normalized path string.
 */
export function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}
