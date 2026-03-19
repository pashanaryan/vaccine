import { supabase } from "./supabaseClient";
import { Child } from "../types/vaccine";

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------
function friendlyError(context: string, raw: string): Error {
    console.error(`[childService] ${context}:`, raw);

    const msg = raw.toLowerCase();
    if (msg.includes("duplicate") || msg.includes("unique"))
        return new Error("A child with this information already exists.");
    if (msg.includes("permission") || msg.includes("policy"))
        return new Error("You don't have permission to perform this action. Please sign in again.");
    if (msg.includes("not found"))
        return new Error("Child profile not found. It may have been deleted.");

    return new Error("Something went wrong while managing the child profile. Please try again.");
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/**
 * Create a new child profile for the current user.
 */
export async function createChild(
    child: Omit<Child, "id">
): Promise<Child> {
    const { data, error } = await supabase
        .from("children")
        .insert({
            name: child.name,
            date_of_birth: child.dateOfBirth.toISOString().split("T")[0],
            gender: child.gender,
            parent_id: child.parentId,
        })
        .select()
        .single();

    if (error) throw friendlyError("createChild", error.message);
    return mapRow(data);
}

/**
 * Get all children for a given parent.
 */
export async function getChildren(parentId: string): Promise<Child[]> {
    const { data, error } = await supabase
        .from("children")
        .select("*")
        .eq("parent_id", parentId)
        .order("created_at", { ascending: true });

    if (error) throw friendlyError("getChildren", error.message);
    return (data ?? []).map(mapRow);
}

/**
 * Update a child profile.
 */
export async function updateChild(
    id: string,
    updates: Partial<Child>
): Promise<Child> {
    const payload: Record<string, unknown> = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.dateOfBirth !== undefined)
        payload.date_of_birth = updates.dateOfBirth.toISOString().split("T")[0];
    if (updates.gender !== undefined) payload.gender = updates.gender;

    const { data, error } = await supabase
        .from("children")
        .update(payload)
        .eq("id", id)
        .select()
        .single();

    if (error) throw friendlyError("updateChild", error.message);
    return mapRow(data);
}

/**
 * Delete a child profile (cascades to vaccine_records via FK).
 */
export async function deleteChild(id: string): Promise<void> {
    const { error } = await supabase.from("children").delete().eq("id", id);
    if (error) throw friendlyError("deleteChild", error.message);
}

// ---------------------------------------------------------------------------
// Row mapper — snake_case DB → camelCase TS
// ---------------------------------------------------------------------------
function mapRow(row: Record<string, unknown>): Child {
    return {
        id: row.id as string,
        name: row.name as string,
        dateOfBirth: new Date(row.date_of_birth as string),
        gender: row.gender as Child["gender"],
        parentId: row.parent_id as string,
    };
}
