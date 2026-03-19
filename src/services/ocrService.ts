import { VaccineRecord } from "../types/vaccine";
import Constants from "expo-constants";

// ---------------------------------------------------------------------------
// OpenAI gpt-4o Vision — Vaccine Certificate OCR
// ---------------------------------------------------------------------------

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

const SYSTEM_PROMPT = `You are a medical document parser specializing in childhood vaccination records. Extract vaccine information from this image of a child's vaccination card or doctor's record.

CRITICAL PARSING RULES:
1. VACCINE NAMES: Never split abbreviations. "DPT", "OPV", "BCG", "IPV", "MMR", "MR" are single vaccine names — do NOT split them into separate letters. Common handwritten vaccines include: DPT, OPV, IPV, BCG, Hep B, Hep A, MMR, TT, Td, Pentavalent, Rotavirus, PCV, Typhoid, JE (Japanese Encephalitis).
2. DATES: Normalize ALL dates to ISO 8601 format (YYYY-MM-DD) before returning. Common input formats include DD/MM/YY, DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY. For 2-digit years: 00-30 → 20xx, 31-99 → 19xx.
3. LANGUAGE: The certificate may be in Hindi, Urdu, Tamil, Bengali, French, Spanish, Arabic, or any other language. Always translate vaccine names to their standard English WHO equivalents. If unsure, keep the original and set "lowConfidence": true.
4. CONFIDENCE: If you are uncertain about a vaccine name (illegible handwriting, smudges, partial text), set "lowConfidence": true for that entry so the user can manually review it.

Return ONLY a JSON array with this structure for each vaccine found:
[{
  "vaccineName": string (standard English name, e.g. "DPT" not "D PT"),
  "dateAdministered": string (ALWAYS ISO 8601: YYYY-MM-DD),
  "administeredBy": string or null,
  "batchNumber": string or null,
  "rawText": string (the original text you found this in),
  "unmatched": boolean (true if the name could not be mapped to a standard WHO vaccine),
  "lowConfidence": boolean (true if you are uncertain about the vaccine name or date)
}]
If you cannot find vaccine data, return an empty array [].
Do not include any explanation or markdown — raw JSON only.`;

// ---------------------------------------------------------------------------
// Abbreviation lookup table — maps common shorthand → canonical WHO name
// ---------------------------------------------------------------------------
const VACCINE_ABBREVIATION_MAP: Record<string, string> = {
    // DPT variants
    "dpt": "DTwP",
    "dtp": "DTwP",
    "dptwhole": "DTwP",
    "dtap": "DTaP",
    "dtwp": "DTwP",
    // Polio
    "opv": "OPV (Oral Polio Vaccine)",
    "ipv": "IPV (Inactivated Polio Vaccine)",
    "polio": "OPV (Oral Polio Vaccine)",
    "polio drops": "OPV (Oral Polio Vaccine)",
    // Hepatitis
    "hep b": "Hepatitis B",
    "hepb": "Hepatitis B",
    "hepatitis-b": "Hepatitis B",
    "hep a": "Hepatitis A",
    "hepa": "Hepatitis A",
    "hepatitis-a": "Hepatitis A",
    // Measles/MMR
    "mmr": "MMR (Measles, Mumps, Rubella)",
    "mr": "MR (Measles, Rubella)",
    "measles": "Measles",
    // Pentavalent
    "penta": "Pentavalent",
    "pentavalent": "Pentavalent",
    // Rotavirus
    "rota": "Rotavirus",
    "rotavirus": "Rotavirus",
    "rv": "Rotavirus",
    // PCV
    "pcv": "PCV (Pneumococcal Conjugate Vaccine)",
    "pcv13": "PCV (Pneumococcal Conjugate Vaccine)",
    // BCG
    "bcg": "BCG",
    // Typhoid
    "typhoid": "Typhoid Conjugate Vaccine",
    "tcv": "Typhoid Conjugate Vaccine",
    // Japanese Encephalitis
    "je": "Japanese Encephalitis",
    // Tetanus
    "tt": "Tetanus Toxoid",
    "td": "Td (Tetanus, Diphtheria)",
    // Hindi common names
    "खसरा": "Measles",
    "पोलियो": "OPV (Oral Polio Vaccine)",
    "बीसीजी": "BCG",
    "टिटनस": "Tetanus Toxoid",
};

/** Shape returned by the OpenAI extraction before we map to VaccineRecord */
interface RawOCREntry {
    vaccineName: string;
    dateAdministered: string;
    administeredBy: string | null;
    batchNumber: string | null;
    rawText: string;
    unmatched?: boolean;
    lowConfidence?: boolean;
}

/**
 * Convert an image URI to a base64 data-URL.
 * If the input is already base64, return it as-is.
 */
async function resolveImageToBase64(imageInput: string): Promise<string> {
    // Already a data URL
    if (imageInput.startsWith("data:image/")) {
        return imageInput;
    }

    // File URI → fetch as blob → base64
    try {
        const response = await fetch(imageInput);
        const blob = await response.blob();
        return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error("[ocrService] Failed to convert image to base64:", error);
        throw new Error("Could not read the image file.");
    }
}

// ---------------------------------------------------------------------------
// Date normalization — handles all common formats → Date object
// ---------------------------------------------------------------------------

/**
 * Parse a date string into a Date object. Handles:
 *  - ISO 8601: YYYY-MM-DD
 *  - DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
 *  - DD/MM/YY (2-digit year: 00-30 → 20xx, 31-99 → 19xx)
 */
function parseDate(raw: string): Date {
    const trimmed = raw.trim();

    // DD/MM/YY (2-digit year)
    const ddmmyy = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2})$/);
    if (ddmmyy) {
        const [, day, month, shortYear] = ddmmyy;
        const yearNum = Number(shortYear);
        const fullYear = yearNum <= 30 ? 2000 + yearNum : 1900 + yearNum;
        return new Date(fullYear, Number(month) - 1, Number(day));
    }

    // DD/MM/YYYY (4-digit year)
    const ddmmyyyy = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
    if (ddmmyyyy) {
        const [, day, month, year] = ddmmyyyy;
        return new Date(Number(year), Number(month) - 1, Number(day));
    }

    // ISO 8601: YYYY-MM-DD
    const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) {
        const [, year, month, day] = iso;
        return new Date(Number(year), Number(month) - 1, Number(day));
    }

    // Fallback to native parser
    const date = new Date(trimmed);
    if (isNaN(date.getTime())) {
        console.warn(`[ocrService] Unable to parse date: "${raw}", defaulting to now.`);
        return new Date();
    }
    return date;
}

// ---------------------------------------------------------------------------
// Post-processing pipeline
// ---------------------------------------------------------------------------

/**
 * Normalize a vaccine name through the abbreviation lookup table.
 * Returns { name, wasRemapped } so we can flag changes for the user.
 */
function normalizeVaccineName(raw: string): { name: string; wasRemapped: boolean } {
    const key = raw.trim().toLowerCase().replace(/\s+/g, " ");

    // Direct match
    if (VACCINE_ABBREVIATION_MAP[key]) {
        return { name: VACCINE_ABBREVIATION_MAP[key], wasRemapped: true };
    }

    // Try stripping trailing dose numbers: "DPT 1" → "dpt"
    const withoutDose = key.replace(/\s*\d+$/, "");
    if (VACCINE_ABBREVIATION_MAP[withoutDose]) {
        return { name: VACCINE_ABBREVIATION_MAP[withoutDose], wasRemapped: true };
    }

    // Try joining split abbreviations: "D PT" → "dpt", "O P V" → "opv"
    const collapsed = key.replace(/\s/g, "");
    if (VACCINE_ABBREVIATION_MAP[collapsed]) {
        return { name: VACCINE_ABBREVIATION_MAP[collapsed], wasRemapped: true };
    }

    return { name: raw.trim(), wasRemapped: false };
}

/**
 * Run the full post-processing pipeline on a raw OCR entry array:
 *  1. Normalize vaccine names via the abbreviation lookup
 *  2. Flag low-confidence entries (unmatched + not remapped)
 */
function postProcessOCREntries(entries: RawOCREntry[]): RawOCREntry[] {
    return entries.map((entry) => {
        const { name, wasRemapped } = normalizeVaccineName(entry.vaccineName);

        // If it was remapped, the name is now canonical — confidence is high
        // If the model already flagged lowConfidence, keep it
        // If it's unmatched AND we couldn't remap it, flag lowConfidence
        const lowConfidence =
            entry.lowConfidence === true ||
            (entry.unmatched === true && !wasRemapped);

        return {
            ...entry,
            vaccineName: name,
            lowConfidence,
            unmatched: entry.unmatched === true && !wasRemapped,
        };
    });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateLocalId(): string {
    return `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ---------------------------------------------------------------------------
// Main extraction function
// ---------------------------------------------------------------------------

/**
 * Extract vaccine records from an image using OpenAI gpt-4o Vision API.
 *
 * @param imageInput  Base64 data-URL string OR a file/content URI
 * @param childId     The ID of the child this scan belongs to
 * @param scanSource  How the image was captured
 * @returns           Parsed VaccineRecord[] — empty array on failure
 */
export async function extractVaccinesFromImage(
    imageInput: string,
    childId: string,
    scanSource: "camera" | "upload" = "camera"
): Promise<VaccineRecord[]> {
    const apiKey = Constants.expoConfig?.extra?.openAiApiKey ?? "";

    if (!apiKey) {
        console.error("[ocrService] openAiApiKey is not set in app config.");
        return [];
    }

    try {
        // Step 1: Resolve image to base64
        const base64Image = await resolveImageToBase64(imageInput);

        // Step 2: Call OpenAI Vision API
        const response = await fetch(OPENAI_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: SYSTEM_PROMPT,
                    },
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: "Extract all vaccine information from this image.",
                            },
                            {
                                type: "image_url",
                                image_url: {
                                    url: base64Image,
                                    detail: "high",
                                },
                            },
                        ],
                    },
                ],
                max_tokens: 2048,
                temperature: 0.1, // Low temperature for deterministic extraction
            }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(
                `[ocrService] OpenAI API error (${response.status}):`,
                errorBody
            );
            return [];
        }

        const data = await response.json();
        const rawContent: string =
            data?.choices?.[0]?.message?.content?.trim() ?? "";

        if (!rawContent) {
            console.warn("[ocrService] Empty response from OpenAI.");
            return [];
        }

        // Step 3: Parse and validate JSON
        const parsed = parseOCRResponse(rawContent);

        // Step 4: Post-process — abbreviation normalization + confidence flags
        const processed = postProcessOCREntries(parsed);

        // Step 5: Map to VaccineRecord[]
        return processed.map((entry) => ({
            id: generateLocalId(),
            childId,
            vaccineName: entry.vaccineName,
            dateAdministered: parseDate(entry.dateAdministered),
            administeredBy: entry.administeredBy ?? undefined,
            batchNumber: entry.batchNumber ?? undefined,
            scanSource,
            rawOCRText: entry.rawText,
            verified: false, // Parent must confirm
            lowConfidence: entry.lowConfidence ?? false,
        }));
    } catch (error) {
        console.error("[ocrService] Unexpected error during extraction:", error);
        return [];
    }
}

/**
 * Safely parse the raw OpenAI response string into RawOCREntry[].
 * Handles markdown code fences, trailing commas, and other common issues.
 */
function parseOCRResponse(raw: string): RawOCREntry[] {
    try {
        // Strip markdown code-fence wrappers if the model included them
        let cleaned = raw
            .replace(/^```json\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/\s*```$/i, "")
            .trim();

        const parsed = JSON.parse(cleaned);

        // Validate: must be an array
        if (!Array.isArray(parsed)) {
            console.warn(
                "[ocrService] Response is not an array. Raw response:",
                raw
            );
            return [];
        }

        // Validate each entry has at least vaccineName
        return parsed.filter((entry: unknown) => {
            if (typeof entry !== "object" || entry === null) return false;
            const e = entry as Record<string, unknown>;
            return typeof e.vaccineName === "string" && e.vaccineName.length > 0;
        }) as RawOCREntry[];
    } catch (parseError) {
        console.error(
            "[ocrService] Failed to parse JSON from OpenAI response.",
            "\nParse error:",
            parseError,
            "\nRaw response:",
            raw
        );
        return [];
    }
}
