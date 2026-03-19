import validator from "validator";

/**
 * Text Input Sanitization Service
 * 
 * Provides robust validation and sanitization for all user-facing text inputs
 * before they hit the database, preventing injection or malformed data.
 */

/**
 * Sanitizes a standard text field (like a child's name or vaccine name).
 * Strips HTML tags, trims whitespace, and removes common injection characters.
 */
export function sanitizeText(input: string | null | undefined): string {
    if (!input) return "";

    // 1. Convert to string and trim
    let safe = String(input).trim();

    // 2. Escape HTML entities (converts < to &lt;, > to &gt;, etc)
    safe = validator.escape(safe);

    return safe;
}

/**
 * Validates and sanitizes an email address.
 * Returns null if the email is invalid.
 */
export function sanitizeEmail(email: string | null | undefined): string | null {
    if (!email) return null;
    const safe = validator.trim(String(email));
    if (validator.isEmail(safe)) {
        return validator.normalizeEmail(safe) as string;
    }
    return null;
}

/**
 * Validates a date string specifically for DD/MM/YYYY.
 * Returns true if valid, false otherwise.
 */
export function isValidDateString(dateStr: string): boolean {
    // Regex for DD/MM/YYYY
    const regex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    if (!regex.test(dateStr)) return false;

    const [, day, month, year] = dateStr.match(regex)!;

    // Create a strict date using validator (expects YYYY/MM/DD)
    return validator.isDate(`${year}/${month}/${day}`, { format: "YYYY/MM/DD", strictMode: true });
}
