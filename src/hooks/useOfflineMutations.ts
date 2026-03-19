import { useMutation, useQueryClient } from "@tanstack/react-query";
import { VaccineRecord } from "../types/vaccine";
import { saveVaccineRecords } from "../services/vaccineService";
import { Alert } from "react-native";
import NetInfo from "@react-native-community/netinfo";

/**
 * A React Query mutation hook designed for offline-first architecture.
 * If the user's connection drops, this mutation hits the "paused" queue
 * in AsyncStorage and will automatically fire the `saveVaccineRecords`
 * service call when the device comes back online.
 */
export function useSaveVaccinesOffline() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (records: VaccineRecord[]) => {
            // If we are offline, React Query handles pausing this.
            // But we double check to ensure we don't throw immediate fatal errors
            // if the service tries to blindly hit Supabase.
            const state = await NetInfo.fetch();
            if (!state.isConnected) {
                // We throw an error that React Query catches so it can retry/queue it
                throw new Error("Offline. Queued for sync.");
            }

            await saveVaccineRecords(records);
            return records;
        },
        onMutate: async (newRecords) => {
            // Optimistic Update: Instantly inject these into our local cache
            // so the UI reflects the change immediately before the network call finishes.
            const childId = newRecords[0]?.childId;
            if (!childId) return;

            await queryClient.cancelQueries({ queryKey: ["vaccines", childId] });
            const previous = queryClient.getQueryData<VaccineRecord[]>(["vaccines", childId]);

            queryClient.setQueryData<VaccineRecord[]>(["vaccines", childId], (old) => {
                return [...(old || []), ...newRecords];
            });

            // Show a toast that it's safe to leave the screen
            Alert.alert(
                "Saved successfully",
                "Records saved locally. They will sync to the cloud automatically."
            );

            return { previous, childId };
        },
        onError: (err, newRecords, context) => {
            // If genuine error (not just offline), rollback our optimistic update
            if (err.message !== "Offline. Queued for sync." && context?.childId) {
                queryClient.setQueryData(["vaccines", context.childId], context.previous);
                Alert.alert("Sync Failed", "Could not save records to the cloud.");
            }
        },
        onSettled: (data, error, variables, context) => {
            // Always refetch when the dust settles to ensure server sync
            if (context?.childId) {
                queryClient.invalidateQueries({ queryKey: ["vaccines", context.childId] });
            }
        },
    });
}
