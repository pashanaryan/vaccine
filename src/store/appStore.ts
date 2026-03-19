import { create } from "zustand";
import { Alert } from "react-native";
import { Child, VaccineRecord } from "../types/vaccine";
import {
    AuthUser,
    signUpWithEmail,
    signInWithEmail,
    signInWithGoogle,
    signOut as authSignOut,
    getCurrentUser,
    onAuthStateChange,
} from "../services/authService";
import {
    createChild,
    getChildren,
    updateChild,
    deleteChild,
} from "../services/childService";
import {
    saveVaccineRecords,
    getVaccineRecords,
    deleteVaccineRecord,
} from "../services/vaccineService";

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------
interface AppState {
    // Auth
    currentUser: AuthUser | null;
    isAuthLoading: boolean;

    // Children
    children: Child[];
    selectedChildId: string | null;
    isChildrenLoading: boolean;

    // Vaccine Records
    vaccineRecords: VaccineRecord[];
    isRecordsLoading: boolean;

    // Derived
    selectedChild: () => Child | null;

    // Auth actions
    initAuth: () => () => void; // returns unsubscribe fn
    doSignUp: (email: string, password: string, fullName: string) => Promise<void>;
    doSignIn: (email: string, password: string) => Promise<void>;
    doGoogleSignIn: () => Promise<void>;
    doSignOut: () => Promise<void>;

    // Child actions
    fetchChildren: () => Promise<void>;
    addChild: (child: Omit<Child, "id">) => Promise<void>;
    editChild: (id: string, updates: Partial<Child>) => Promise<void>;
    removeChild: (id: string) => Promise<void>;
    selectChild: (id: string) => void;

    // Vaccine record actions
    fetchRecords: (childId: string) => Promise<void>;
    saveRecords: (records: VaccineRecord[]) => Promise<void>;
    removeRecord: (id: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Error handler — shows an Alert and logs
// ---------------------------------------------------------------------------
function handleError(error: unknown) {
    const message =
        error instanceof Error ? error.message : "An unexpected error occurred.";
    Alert.alert("Error", message);
    console.error("[appStore]", error);
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
export const useAppStore = create<AppState>((set, get) => ({
    // ── Initial state ────────────────────────────────────────────────────────
    currentUser: null,
    isAuthLoading: true,
    children: [
        {
            id: "demo-child-1",
            name: "Arjun",
            dateOfBirth: new Date(2025, 5, 15),
            gender: "male",
            parentId: "demo-parent",
        },
        {
            id: "demo-child-2",
            name: "Maya",
            dateOfBirth: new Date(2023, 1, 10),
            gender: "female",
            parentId: "demo-parent",
        },
    ],
    selectedChildId: "demo-child-1",
    isChildrenLoading: false,
    vaccineRecords: [],
    isRecordsLoading: false,

    // ── Derived ──────────────────────────────────────────────────────────────
    selectedChild: () => {
        const { children, selectedChildId } = get();
        return children.find((c) => c.id === selectedChildId) ?? null;
    },

    // ── Auth actions ─────────────────────────────────────────────────────────
    initAuth: () => {
        // Check for existing session on startup
        getCurrentUser().then((user) => {
            set({ currentUser: user, isAuthLoading: false });
            if (user) get().fetchChildren();
        });

        // Listen for auth state changes (sign-in, sign-out, token refresh)
        const unsubscribe = onAuthStateChange((user) => {
            set({ currentUser: user, isAuthLoading: false });
            if (user) {
                get().fetchChildren();
            } else {
                set({ children: [], selectedChildId: null, vaccineRecords: [] });
            }
        });

        return unsubscribe;
    },

    doSignUp: async (email, password, fullName) => {
        try {
            set({ isAuthLoading: true });
            const user = await signUpWithEmail(email, password, fullName);
            set({ currentUser: user, isAuthLoading: false });
            Alert.alert(
                "Account created!",
                "Please check your email to confirm your account before signing in."
            );
        } catch (error) {
            set({ isAuthLoading: false });
            handleError(error);
        }
    },

    doSignIn: async (email, password) => {
        try {
            set({ isAuthLoading: true });
            const user = await signInWithEmail(email, password);
            set({ currentUser: user, isAuthLoading: false });
        } catch (error) {
            set({ isAuthLoading: false });
            handleError(error);
        }
    },

    doGoogleSignIn: async () => {
        try {
            set({ isAuthLoading: true });
            const user = await signInWithGoogle();
            set({ currentUser: user, isAuthLoading: false });
        } catch (error) {
            set({ isAuthLoading: false });
            handleError(error);
        }
    },

    doSignOut: async () => {
        try {
            await authSignOut();
            set({
                currentUser: null,
                children: [],
                selectedChildId: null,
                vaccineRecords: [],
            });
        } catch (error) {
            handleError(error);
        }
    },

    // ── Child actions ────────────────────────────────────────────────────────
    fetchChildren: async () => {
        const { currentUser } = get();
        if (!currentUser) return;

        try {
            set({ isChildrenLoading: true });
            const kids = await getChildren(currentUser.id);
            set({ children: kids, isChildrenLoading: false });

            // Auto-select first child if none selected
            if (!get().selectedChildId && kids.length > 0) {
                set({ selectedChildId: kids[0].id });
                get().fetchRecords(kids[0].id);
            }
        } catch (error) {
            set({ isChildrenLoading: false });
            handleError(error);
        }
    },

    addChild: async (child) => {
        try {
            set({ isChildrenLoading: true });
            const newChild = await createChild(child);
            set((state) => ({
                children: [...state.children, newChild],
                selectedChildId: state.selectedChildId ?? newChild.id,
                isChildrenLoading: false,
            }));
        } catch (error) {
            set({ isChildrenLoading: false });
            handleError(error);
        }
    },

    editChild: async (id, updates) => {
        try {
            const updated = await updateChild(id, updates);
            set((state) => ({
                children: state.children.map((c) => (c.id === id ? updated : c)),
            }));
        } catch (error) {
            handleError(error);
        }
    },

    removeChild: async (id) => {
        try {
            await deleteChild(id);
            set((state) => {
                const remaining = state.children.filter((c) => c.id !== id);
                return {
                    children: remaining,
                    selectedChildId:
                        state.selectedChildId === id
                            ? remaining[0]?.id ?? null
                            : state.selectedChildId,
                    vaccineRecords:
                        state.selectedChildId === id ? [] : state.vaccineRecords,
                };
            });
        } catch (error) {
            handleError(error);
        }
    },

    selectChild: (id) => {
        set({ selectedChildId: id, vaccineRecords: [] });
        get().fetchRecords(id);
    },

    // ── Vaccine record actions ───────────────────────────────────────────────
    fetchRecords: async (childId) => {
        try {
            set({ isRecordsLoading: true });
            const records = await getVaccineRecords(childId);
            set({ vaccineRecords: records, isRecordsLoading: false });
        } catch (error) {
            set({ isRecordsLoading: false });
            handleError(error);
        }
    },

    saveRecords: async (records) => {
        try {
            set({ isRecordsLoading: true });
            await saveVaccineRecords(records);
            // Re-fetch to get server-assigned IDs
            const { selectedChildId } = get();
            if (selectedChildId) {
                const updated = await getVaccineRecords(selectedChildId);
                set({ vaccineRecords: updated, isRecordsLoading: false });
            } else {
                set({ isRecordsLoading: false });
            }
        } catch (error) {
            set({ isRecordsLoading: false });
            handleError(error);
        }
    },

    removeRecord: async (id) => {
        try {
            await deleteVaccineRecord(id);
            set((state) => ({
                vaccineRecords: state.vaccineRecords.filter((r) => r.id !== id),
            }));
        } catch (error) {
            handleError(error);
        }
    },
}));
