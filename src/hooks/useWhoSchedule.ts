import { useQuery } from "@tanstack/react-query";
import { WHO_SCHEDULE } from "../constants/whoSchedule";
import { WHOVaccine } from "../types/vaccine";

/**
 * A React Query hook to fetch the WHO Schedule.
 * Right now it simply resolves the static constant, but wrapping it
 * in React Query ensures that if we later move the schedule to Supabase,
 * the component tree stays the same AND it's cached offline forever.
 */
export function useWhoSchedule() {
    return useQuery<WHOVaccine[]>({
        queryKey: ["who-schedule"],
        queryFn: async () => {
            // Simulate a network fetch if we were pulling from Supabase
            // const { data } = await supabase.from('who_vaccines').select('*');
            // return data;

            return Promise.resolve(WHO_SCHEDULE);
        },
        // The WHO schedule essentially never changes, cache heavily
        staleTime: Infinity,
        gcTime: Infinity,
    });
}
