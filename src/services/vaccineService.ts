import { supabase } from "./supabaseClient";
import { VaccineRecord } from "../types/vaccine";

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------
function friendlyError(context: string, raw: string): Error {
    console.error(`[vaccineService] ${context}:`, raw);

    const msg = raw.toLowerCase();
    if (msg.includes("foreign key") || msg.includes("violates"))
        return new Error("The child profile associated with this record was not found.");
    if (msg.includes("permission") || msg.includes("policy"))
        return new Error("You don't have permission to manage this vaccine record. Please sign in again.");
    if (msg.includes("not found"))
        return new Error("Vaccine record not found. It may have been deleted.");

    return new Error("Something went wrong while managing vaccine records. Please try again.");
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/**
 * Save one or more vaccine records (bulk insert).
 */
export async function saveVaccineRecords(
    records: VaccineRecord[]
): Promise<void> {
    if (records.length === 0) return;

    const rows = records.map((r) => ({
        id: r.id.startsWith("local_") ? undefined : r.id, // let DB assign for local IDs
        child_id: r.childId,
        vaccine_name: r.vaccineName,
        date_administered: r.dateAdministered.toISOString().split("T")[0],
        administered_by: r.administeredBy ?? null,
        batch_number: r.batchNumber ?? null,
        scan_source: r.scanSource,
        raw_ocr_text: r.rawOCRText,
        verified: r.verified,
    }));

    const { error } = await supabase.from("vaccine_records").insert(rows);
    if (error) throw friendlyError("saveVaccineRecords", error.message);
}

/**
 * Get all vaccine records for a given child.
 */
export async function getVaccineRecords(
    childId: string
): Promise<VaccineRecord[]> {
    const { data, error } = await supabase
        .from("vaccine_records")
        .select("*")
        .eq("child_id", childId)
        .order("date_administered", { ascending: true });

    if (error) throw friendlyError("getVaccineRecords", error.message);
    return (data ?? []).map(mapRow);
}

/**
 * Delete a single vaccine record by ID.
 */
export async function deleteVaccineRecord(id: string): Promise<void> {
    const { error } = await supabase
        .from("vaccine_records")
        .delete()
        .eq("id", id);

    if (error) throw friendlyError("deleteVaccineRecord", error.message);
}

/**
 * Update a single vaccine record (e.g. mark as verified).
 */
export async function updateVaccineRecord(
    id: string,
    updates: Partial<VaccineRecord>
): Promise<VaccineRecord> {
    const payload: Record<string, unknown> = {};
    if (updates.vaccineName !== undefined) payload.vaccine_name = updates.vaccineName;
    if (updates.dateAdministered !== undefined)
        payload.date_administered = updates.dateAdministered.toISOString().split("T")[0];
    if (updates.administeredBy !== undefined) payload.administered_by = updates.administeredBy;
    if (updates.batchNumber !== undefined) payload.batch_number = updates.batchNumber;
    if (updates.verified !== undefined) payload.verified = updates.verified;

    const { data, error } = await supabase
        .from("vaccine_records")
        .update(payload)
        .eq("id", id)
        .select()
        .single();

    if (error) throw friendlyError("updateVaccineRecord", error.message);
    return mapRow(data);
}

// ---------------------------------------------------------------------------
// Row mapper — snake_case DB → camelCase TS
// ---------------------------------------------------------------------------
function mapRow(row: Record<string, unknown>): VaccineRecord {
    return {
        id: row.id as string,
        childId: row.child_id as string,
        vaccineName: row.vaccine_name as string,
        dateAdministered: new Date(row.date_administered as string),
        administeredBy: (row.administered_by as string) ?? undefined,
        batchNumber: (row.batch_number as string) ?? undefined,
        scanSource: row.scan_source as VaccineRecord["scanSource"],
        rawOCRText: (row.raw_ocr_text as string) ?? "",
        verified: row.verified as boolean,
    };
}
