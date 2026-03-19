import React, { useMemo, useEffect, useCallback } from "react";
import {
    View,
    Text,
    SectionList,
    TouchableOpacity,
    Alert,
    Platform,
    ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { VaccineRecord, VaccineStatus, Child } from "../types/vaccine";
import {
    matchVaccinesToSchedule,
    getStatusSummary,
} from "../services/matchingService";
import { useWhoSchedule } from "../hooks/useWhoSchedule";
import { generateVaccineReport } from "../services/reportService";
import { scheduleVaccineReminders } from "../services/notificationService";

// ---------------------------------------------------------------------------
// Demo data — replace with real data from Supabase later
// ---------------------------------------------------------------------------
const DEMO_CHILD: Child = {
    id: "demo-child-1",
    name: "Arjun",
    dateOfBirth: new Date(2025, 5, 15), // June 15, 2025
    gender: "male",
    parentId: "demo-parent",
};

const DEMO_RECORDS: VaccineRecord[] = [
    // Simulate a few given vaccines for the demo
    {
        id: "r1",
        childId: "demo-child-1",
        vaccineName: "BCG",
        dateAdministered: new Date(2025, 5, 15),
        scanSource: "manual",
        rawOCRText: "",
        verified: true,
    },
    {
        id: "r2",
        childId: "demo-child-1",
        vaccineName: "OPV-0",
        dateAdministered: new Date(2025, 5, 15),
        scanSource: "manual",
        rawOCRText: "",
        verified: true,
    },
    {
        id: "r3",
        childId: "demo-child-1",
        vaccineName: "Hepatitis B",
        dateAdministered: new Date(2025, 5, 16),
        administeredBy: "Dr. Sharma",
        scanSource: "camera",
        rawOCRText: "Hep B birth dose",
        verified: true,
    },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Age milestones used for grouping (matches whoSchedule labels) */
const MILESTONES = [
    "Birth",
    "6 weeks",
    "10 weeks",
    "14 weeks",
    "9 months",
    "12 months",
    "15 months",
    "16-18 months",
    "18 months",
];

function computeAge(dob: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - dob.getTime();
    const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // Edge case: born today or future DOB (timezone drift)
    if (totalDays <= 0) return "Newborn";

    const months = Math.floor(totalDays / 30.44);
    const weeks = Math.floor(totalDays / 7);

    if (months >= 12) {
        const years = Math.floor(months / 12);
        const rem = months % 12;
        return rem > 0 ? `${years}y ${rem}m` : `${years}y`;
    }
    if (months >= 1) return `${months} month${months !== 1 ? "s" : ""}`;
    if (weeks >= 1) return `${weeks} week${weeks !== 1 ? "s" : ""}`;
    return `${totalDays} day${totalDays !== 1 ? "s" : ""}`;
}

function formatDate(date: Date): string {
    const d = date.getDate().toString().padStart(2, "0");
    const m = (date.getMonth() + 1).toString().padStart(2, "0");
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
}

type StatusKey = VaccineStatus["status"];

const STATUS_CONFIG: Record<
    StatusKey,
    {
        label: string;
        icon: keyof typeof Ionicons.glyphMap;
        bg: string;
        text: string;
        border: string;
    }
> = {
    given: {
        label: "Given ✓",
        icon: "checkmark-circle",
        bg: "#F0FDF4",
        text: "#16A34A",
        border: "#BBF7D0",
    },
    overdue: {
        label: "Overdue",
        icon: "alert-circle",
        bg: "#FEF2F2",
        text: "#DC2626",
        border: "#FECACA",
    },
    upcoming: {
        label: "Upcoming",
        icon: "time-outline",
        bg: "#F9FAFB",
        text: "#6B7280",
        border: "#E5E7EB",
    },
    missing: {
        label: "Missing",
        icon: "close-circle",
        bg: "#FFFBEB",
        text: "#D97706",
        border: "#FDE68A",
    },
};

import { useAppStore } from "../store/appStore";

// ===========================================================================
// Main Component
// ===========================================================================
export default function DashboardScreen() {
    // ── Pull active state from Zustand ───────────────────────────────────────
    const child = useAppStore((state) => state.selectedChild());
    // For now we use the demo records array, but in a real app this would be: 
    // const records = useAppStore((state) => state.vaccineRecords);
    const records = DEMO_RECORDS.filter(r => r.childId === child?.id);

    const { data: whoSchedule, isLoading: isScheduleLoading } = useWhoSchedule();

    const statuses = useMemo(() => {
        if (!whoSchedule || !child) return [];
        // Optional refactor of matchVaccinesToSchedule to accept whoSchedule 
        // as a param, but for now we know it uses the constant natively.
        // Once shifted fully, matchVaccinesToSchedule will take `whoSchedule`
        return matchVaccinesToSchedule(records, child.dateOfBirth);
    }, [records, child?.dateOfBirth, whoSchedule]);

    const summary = useMemo(() => getStatusSummary(statuses), [statuses]);
    const allGiven = summary.total > 0 && summary.given === summary.total;

    // Group statuses by milestone label into SectionList-compatible shape
    const sections = useMemo(() => {
        const map = new Map<string, VaccineStatus[]>();
        for (const ms of MILESTONES) map.set(ms, []);
        for (const s of statuses) {
            const label = s.whoVaccine.recommendedAgeLabel;
            const existing = map.get(label) ?? [];
            existing.push(s);
            map.set(label, existing);
        }
        return Array.from(map.entries())
            .filter(([, list]) => list.length > 0)
            .map(([title, data]) => ({ title, data }));
    }, [statuses]);

    // Continuously update local push notifications when the timeline changes
    useEffect(() => {
        if (!child) return;
        if (statuses.length > 0) {
            scheduleVaccineReminders(child, statuses).catch((err) => {
                console.log("Failed to schedule reminders:", err);
            });
        }
    }, [statuses, child]);

    if (isScheduleLoading) {
        return (
            <SafeAreaView className="flex-1 bg-white items-center justify-center">
                <ActivityIndicator size="large" color="#0077B6" />
                <Text className="text-gray-500 mt-4">Loading Schedule...</Text>
            </SafeAreaView>
        );
    }

    if (!child) {
        return (
            <SafeAreaView className="flex-1 bg-white items-center justify-center px-6">
                <Ionicons name="people-outline" size={64} color="#D1D5DB" />
                <Text className="text-xl font-bold text-gray-800 mt-4 text-center" accessibilityRole="header">
                    No Child Selected
                </Text>
                <Text style={{ color: "#4B5563" }} className="text-center mt-2 leading-5">
                    Please add or select a child from the Home tab to view their vaccination dashboard.
                </Text>
            </SafeAreaView>
        );
    }

    // Memoized render callbacks for SectionList
    const renderSectionHeader = useCallback(({ section }: { section: { title: string; data: VaccineStatus[] } }) => (
        <View
            className="flex-row items-center px-5 py-2"
            style={{ backgroundColor: "#F9FAFB" }}
        >
            <View
                className="rounded-full items-center justify-center mr-2"
                style={{ width: 24, height: 24, backgroundColor: "#E5E7EB" }}
            >
                <Ionicons name="calendar" size={12} color="#6B7280" />
            </View>
            <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {section.title}
            </Text>
            <View className="flex-1" />
            <Text className="text-xs text-gray-400">
                {section.data.filter((i) => i.status === "given").length}/{section.data.length}
            </Text>
        </View>
    ), []);

    const renderItem = useCallback(({ item }: { item: VaccineStatus }) => (
        <VaccineRow key={item.whoVaccine.id} status={item} />
    ), []);

    const ListHeader = useMemo(() => (
        <View className="px-5 pt-4 pb-2">
            <View className="flex-row items-center mb-4">
                <View
                    className="rounded-full items-center justify-center mr-4"
                    style={{
                        width: 56,
                        height: 56,
                        backgroundColor: "#EBF8FF",
                    }}
                >
                    <Ionicons name="person" size={28} color="#0077B6" />
                </View>
                <View className="flex-1">
                    <Text className="text-2xl font-bold text-gray-800" accessibilityRole="header">
                        {child!.name}
                    </Text>
                    <Text style={{ color: "#4B5563" }} className="text-sm">
                        {computeAge(child!.dateOfBirth)} old • Born{" "}
                        {formatDate(child!.dateOfBirth)}
                    </Text>
                </View>
            </View>

            {/* Celebration Banner */}
            {allGiven && (
                <View
                    className="rounded-2xl p-4 mb-4 items-center"
                    style={{ backgroundColor: "#F0FDF4", borderColor: "#BBF7D0", borderWidth: 1 }}
                >
                    <Text style={{ fontSize: 32, marginBottom: 4 }}>🎉</Text>
                    <Text className="text-base font-bold" style={{ color: "#16A34A" }}>
                        All vaccines up to date!
                    </Text>
                    <Text className="text-xs mt-1 text-center" style={{ color: "#15803D" }}>
                        Great job keeping {child!.name}'s immunizations on track.
                    </Text>
                </View>
            )}

            {/* Summary Chips */}
            <View className="flex-row mb-4">
                <SummaryChip emoji="✅" label="Given" count={summary.given} bg="#F0FDF4" textColor="#16A34A" />
                <SummaryChip emoji="⚠️" label="Overdue" count={summary.overdue} bg="#FEF2F2" textColor="#DC2626" />
                <SummaryChip emoji="📅" label="Upcoming" count={summary.upcoming} bg="#EFF6FF" textColor="#2563EB" />
            </View>

            {/* Partial data: no records yet */}
            {statuses.length > 0 && summary.given === 0 && (
                <View
                    className="rounded-2xl p-4 mb-4"
                    style={{ backgroundColor: "#EFF6FF", borderColor: "#BFDBFE", borderWidth: 1 }}
                    accessibilityRole="alert"
                >
                    <Text className="text-xs leading-5" style={{ color: "#1E40AF" }}>
                        No vaccine records found yet for {child!.name}. Scan a vaccination certificate
                        from the Scan tab, or check back after your next doctor visit.
                    </Text>
                </View>
            )}
        </View>
    ), [child, allGiven, summary, statuses]);

    const ListFooter = useMemo(() => (
        <View className="px-5 mt-2 mb-6">
            <View
                className="rounded-2xl p-5"
                style={{
                    backgroundColor: allGiven ? "#F0FDF4" : "#FFF7ED",
                    borderColor: allGiven ? "#BBF7D0" : "#FED7AA",
                    borderWidth: 1,
                }}
                accessibilityRole="alert"
            >
                <View className="flex-row items-start mb-3">
                    <Ionicons
                        name="medical"
                        size={22}
                        color={allGiven ? "#16A34A" : "#EA580C"}
                        style={{ marginRight: 10, marginTop: 2 }}
                    />
                    <View className="flex-1">
                        <Text
                            className="text-sm font-semibold mb-1"
                            style={{ color: allGiven ? "#15803D" : "#9A3412" }}
                        >
                            {allGiven
                                ? "Stay on track with your pediatrician"
                                : "Consult your doctor about missing vaccines"}
                        </Text>
                        <Text
                            className="text-xs leading-5"
                            style={{ color: allGiven ? "#166534" : "#9A3412" }}
                        >
                            {allGiven
                                ? "All current vaccines are recorded. Continue regular check-ups with your pediatrician. VaccineGuard does not provide medical advice."
                                : "Please consult your doctor and schedule an appointment to review this list. VaccineGuard does not provide medical advice."}
                        </Text>
                    </View>
                </View>

                <TouchableOpacity
                    className="rounded-xl py-3 flex-row items-center justify-center"
                    style={{
                        backgroundColor: allGiven ? "#16A34A" : "#0077B6",
                        minHeight: 48,
                    }}
                    activeOpacity={0.85}
                    onPress={() => generateVaccineReport(child!, statuses)}
                    accessibilityLabel="Share vaccination report with your doctor"
                    accessibilityRole="button"
                >
                    <Ionicons name="share-outline" size={18} color="#FFFFFF" />
                    <Text className="text-white text-sm font-semibold ml-2">
                        Share this report with Doctor
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    ), [allGiven, child, statuses]);

    return (
        <SafeAreaView className="flex-1 bg-white">
            <SectionList
                sections={sections}
                keyExtractor={(item) => item.whoVaccine.id}
                renderItem={renderItem}
                renderSectionHeader={renderSectionHeader}
                ListHeaderComponent={ListHeader}
                ListFooterComponent={ListFooter}
                stickySectionHeadersEnabled={false}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 24 }}
            />
        </SafeAreaView>
    );
}

// ===========================================================================
// Sub-components
// ===========================================================================

function SummaryChip({
    emoji,
    label,
    count,
    bg,
    textColor,
}: {
    emoji: string;
    label: string;
    count: number;
    bg: string;
    textColor: string;
}) {
    return (
        <View
            className="flex-1 rounded-2xl py-3 px-2 items-center mx-1"
            style={{ backgroundColor: bg }}
        >
            <Text style={{ fontSize: 16, marginBottom: 2 }}>{emoji}</Text>
            <Text className="text-lg font-bold" style={{ color: textColor }}>
                {count}
            </Text>
            <Text className="text-xs" style={{ color: textColor, opacity: 0.8 }}>
                {label}
            </Text>
        </View>
    );
}

function MilestoneGroup({
    milestone,
    items,
}: {
    milestone: string;
    items: VaccineStatus[];
}) {
    return (
        <View className="mb-2">
            {/* Milestone header */}
            <View
                className="flex-row items-center px-5 py-2"
                style={{ backgroundColor: "#F9FAFB" }}
            >
                <View
                    className="rounded-full items-center justify-center mr-2"
                    style={{ width: 24, height: 24, backgroundColor: "#E5E7EB" }}
                >
                    <Ionicons name="calendar" size={12} color="#6B7280" />
                </View>
                <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {milestone}
                </Text>
                <View className="flex-1" />
                <Text className="text-xs text-gray-400">
                    {items.filter((i) => i.status === "given").length}/{items.length}
                </Text>
            </View>

            {/* Vaccine rows */}
            {items.map((item) => (
                <VaccineRow key={item.whoVaccine.id} status={item} />
            ))}
        </View>
    );
}

function VaccineRow({ status }: { status: VaccineStatus }) {
    const cfg = STATUS_CONFIG[status.status];
    const { whoVaccine } = status;

    return (
        <View
            className="flex-row items-center px-5 py-3"
            style={{ borderBottomWidth: 1, borderBottomColor: "#F3F4F6" }}
        >
            {/* Status icon */}
            <View
                className="rounded-xl items-center justify-center mr-3"
                style={{
                    width: 36,
                    height: 36,
                    backgroundColor: cfg.bg,
                    borderWidth: 1,
                    borderColor: cfg.border,
                }}
            >
                <Ionicons name={cfg.icon} size={18} color={cfg.text} />
            </View>

            {/* Vaccine info */}
            <View className="flex-1 mr-2">
                <Text className="text-sm font-medium text-gray-800" numberOfLines={1}>
                    {whoVaccine.vaccineName}
                </Text>
                <Text className="text-xs text-gray-400 mt-0.5" numberOfLines={1}>
                    {whoVaccine.disease}
                </Text>
            </View>

            {/* Right side: status badge + date info */}
            <View className="items-end">
                <View
                    className="rounded-full px-2 py-0.5 mb-1"
                    style={{ backgroundColor: cfg.bg, borderWidth: 1, borderColor: cfg.border }}
                >
                    <Text
                        className="text-xs font-semibold"
                        style={{ color: cfg.text, fontSize: 10 }}
                    >
                        {cfg.label}
                    </Text>
                </View>

                {status.status === "given" && status.givenRecord && (
                    <Text className="text-xs text-gray-400">
                        {formatDate(status.givenRecord.dateAdministered)}
                    </Text>
                )}
                {status.status === "overdue" && status.weeksOverdue !== null && (
                    <Text className="text-xs font-medium" style={{ color: "#DC2626" }}>
                        {status.weeksOverdue}w overdue
                    </Text>
                )}
                {status.status === "upcoming" && (
                    <Text className="text-xs text-gray-400">
                        Due {formatDate(status.dueDate)}
                    </Text>
                )}
            </View>
        </View>
    );
}
