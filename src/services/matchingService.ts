import { VaccineRecord, VaccineStatus, WHOVaccine } from "../types/vaccine";
import { WHO_SCHEDULE } from "../constants/whoSchedule";

// ---------------------------------------------------------------------------
// Vaccine Matching Service
//
// Cross-references a child's VaccineRecord[] against the WHO_SCHEDULE to
// produce a VaccineStatus[] that tells the parent exactly what's given,
// missing, overdue, or upcoming.
// ---------------------------------------------------------------------------

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

// ----------------------------- Public API ----------------------------------

/**
 * Cross-reference given vaccine records with the full WHO schedule and return
 * a status for every scheduled vaccine.
 *
 * @param records       Vaccines the child has received
 * @param dateOfBirth   The child's date of birth
 * @returns             One VaccineStatus per WHO_SCHEDULE entry
 */
export function matchVaccinesToSchedule(
    records: VaccineRecord[],
    dateOfBirth: Date
): VaccineStatus[] {
    const now = new Date();

    return WHO_SCHEDULE.map((whoVaccine) => {
        // 1. Find the best matching record for this WHO vaccine
        const match = findBestMatch(whoVaccine, records);

        // 2. Compute due date: DOB + recommended age in weeks
        const dueDate = new Date(
            dateOfBirth.getTime() + whoVaccine.recommendedAgeWeeks * MS_PER_WEEK
        );

        // 3. Determine status
        if (match) {
            return {
                whoVaccine,
                status: "given" as const,
                givenRecord: match,
                dueDate,
                weeksOverdue: null,
            };
        }

        // Not yet given — is it upcoming or overdue?
        if (dueDate > now) {
            return {
                whoVaccine,
                status: "upcoming" as const,
                givenRecord: null,
                dueDate,
                weeksOverdue: null,
            };
        }

        // Overdue: due date has passed
        const weeksOverdue = Math.floor(
            (now.getTime() - dueDate.getTime()) / MS_PER_WEEK
        );

        return {
            whoVaccine,
            status: "overdue" as const,
            givenRecord: null,
            dueDate,
            weeksOverdue,
        };
    });
}

/**
 * Convenience: return only vaccines with a specific status.
 */
export function filterByStatus(
    statuses: VaccineStatus[],
    status: VaccineStatus["status"]
): VaccineStatus[] {
    return statuses.filter((s) => s.status === status);
}

/**
 * Convenience: summary counts.
 */
export function getStatusSummary(statuses: VaccineStatus[]) {
    return {
        given: statuses.filter((s) => s.status === "given").length,
        missing: statuses.filter((s) => s.status === "missing").length,
        overdue: statuses.filter((s) => s.status === "overdue").length,
        upcoming: statuses.filter((s) => s.status === "upcoming").length,
        total: statuses.length,
    };
}

// ----------------------------- Matching Logic ------------------------------

/**
 * Find the best VaccineRecord that matches a given WHOVaccine.
 *
 * Strategy:
 *   1. Exact match on vaccine name (case-insensitive)
 *   2. Any alias is contained in the record name (or vice-versa)
 *   3. Levenshtein distance ≤ 3 against any alias
 *
 * If multiple records match, prefer the one closest to the expected date.
 */
function findBestMatch(
    whoVaccine: WHOVaccine,
    records: VaccineRecord[]
): VaccineRecord | null {
    // Build the set of names to match against
    const candidates = [
        whoVaccine.vaccineName,
        ...whoVaccine.commonAliases,
    ].map(normalize);

    const scored: { record: VaccineRecord; score: number }[] = [];

    for (const record of records) {
        const recordName = normalize(record.vaccineName);
        const score = bestMatchScore(recordName, candidates);

        if (score >= 0) {
            scored.push({ record, score });
        }
    }

    if (scored.length === 0) return null;

    // Sort by score descending (higher = better match)
    scored.sort((a, b) => b.score - a.score);
    return scored[0].record;
}

/**
 * Score how well `input` matches any of the `candidates`.
 * Returns -1 for no match.
 *
 *   100  — exact match
 *    80  — one contains the other
 *    60  — Levenshtein ≤ 1
 *    40  — Levenshtein ≤ 2
 *    20  — Levenshtein ≤ 3
 *    -1  — no match
 */
function bestMatchScore(input: string, candidates: string[]): number {
    let best = -1;

    for (const candidate of candidates) {
        // Exact match
        if (input === candidate) return 100;

        // Containment (either direction)
        if (input.includes(candidate) || candidate.includes(input)) {
            best = Math.max(best, 80);
            continue;
        }

        // Levenshtein distance (only compute for strings of similar length)
        if (Math.abs(input.length - candidate.length) <= 4) {
            const dist = levenshtein(input, candidate);
            if (dist <= 1) best = Math.max(best, 60);
            else if (dist <= 2) best = Math.max(best, 40);
            else if (dist <= 3) best = Math.max(best, 20);
        }

        // Also try matching against individual words in multi-word candidates
        const candidateWords = candidate.split(/[\s\-]+/);
        const inputWords = input.split(/[\s\-]+/);
        for (const cw of candidateWords) {
            for (const iw of inputWords) {
                if (cw.length >= 3 && iw.length >= 3) {
                    if (cw === iw) best = Math.max(best, 70);
                    else if (cw.includes(iw) || iw.includes(cw))
                        best = Math.max(best, 50);
                }
            }
        }
    }

    return best;
}

// ----------------------------- String Utilities ----------------------------

/**
 * Normalize a vaccine name for comparison:
 * lowercase, strip punctuation, collapse whitespace.
 */
function normalize(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9\s\-]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Levenshtein distance between two strings.
 * Classic dynamic-programming implementation (O(m·n) time and space).
 */
function levenshtein(a: string, b: string): number {
    const m = a.length;
    const n = b.length;

    // Quick exits
    if (m === 0) return n;
    if (n === 0) return m;

    // Build matrix
    const dp: number[][] = Array.from({ length: m + 1 }, () =>
        Array(n + 1).fill(0)
    );

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1, // deletion
                dp[i][j - 1] + 1, // insertion
                dp[i - 1][j - 1] + cost // substitution
            );
        }
    }

    return dp[m][n];
}
