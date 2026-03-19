import { QueryClient } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import AsyncStorage from "@react-native-async-storage/async-storage";

// 1. Create a generic QueryClient
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days (Time to keep inactive data in cache)
            staleTime: 1000 * 60 * 5, // 5 minutes (Time before data is considered stale)
            retry: 2, // Retry failed requests twice
            networkMode: "offlineFirst", // Keep serving cached data when offline
        },
        mutations: {
            networkMode: "offlineFirst", // Allow mutations to queue when offline
        },
    },
});

// 2. Create the AsyncStorage persister
export const asyncStoragePersister = createAsyncStoragePersister({
    storage: AsyncStorage,
    throttleTime: 1000, // Only save cache to disk once per second to prevent thrashing
});
