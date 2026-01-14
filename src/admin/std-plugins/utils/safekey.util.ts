/**
 * Generates a safekey from a given string (typically module name)
 * Converts to lowercase, replaces spaces and special chars with underscores
 * @param name - The name to convert to a safekey
 * @returns A sanitized safekey string
 */
export function generateSafekey(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s_]/g, '') // Remove special characters (keep underscores)
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/_+/g, '_') // Replace multiple underscores with single underscore
    .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
}

/**
 * Generates a random 3-digit number
 * @returns A 3-digit number as a string
 */
export function generateRandomThreeDigit(): string {
  return Math.floor(100 + Math.random() * 900).toString();
}

/**
 * Appends a random 3-digit suffix to a safekey
 * @param safekey - The base safekey
 * @returns Safekey with 3-digit suffix
 */
export function appendRandomSuffix(safekey: string): string {
  const suffix = generateRandomThreeDigit();
  return `${safekey}_${suffix}`;
}
