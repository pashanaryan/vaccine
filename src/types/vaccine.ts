/**
 * Core TypeScript interfaces for VaccineGuard
 */

// ---------------------------------------------------------------------------
// 1. VaccineRecord — represents one vaccine a child has received
// ---------------------------------------------------------------------------
export interface VaccineRecord {
    id: string;
    childId: string;
    vaccineName: string;
    dateAdministered: Date;
    administeredBy?: string; // doctor name
    batchNumber?: string;
    scanSource: "camera" | "upload" | "manual";
    rawOCRText: string; // original text from scan
    verified: boolean; // has the parent confirmed this extraction?
    lowConfidence?: boolean; // OCR flagged this entry as uncertain
}

// ---------------------------------------------------------------------------
// 2. Child — represents a child profile
// ---------------------------------------------------------------------------
export interface Child {
    id: string;
    name: string;
    dateOfBirth: Date;
    gender: "male" | "female" | "other";
    parentId: string;
}

// ---------------------------------------------------------------------------
// 3. WHOVaccine — represents a WHO recommended vaccine
// ---------------------------------------------------------------------------
export interface WHOVaccine {
    id: string;
    vaccineName: string;
    commonAliases: string[]; // alternate names, e.g. ["OPV", "Polio drops"]
    recommendedAgeWeeks: number; // age in weeks when due
    recommendedAgeLabel: string; // e.g. "6 weeks", "9 months"
    doses: number;
    doseNumber: number;
    disease: string; // e.g. "Poliomyelitis"
    isMandatory: boolean;
    notes: string;
}

// ---------------------------------------------------------------------------
// 4. VaccineStatus — computed type for cross-reference result
// ---------------------------------------------------------------------------
export interface VaccineStatus {
    whoVaccine: WHOVaccine;
    status: "given" | "missing" | "overdue" | "upcoming";
    givenRecord: VaccineRecord | null;
    dueDate: Date;
    weeksOverdue: number | null;
}
