import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { Child, VaccineStatus } from "../types/vaccine";
import { addWeeks, isBefore, startOfDay, isToday, isFuture } from "date-fns";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Constants
const NOTIFICATIONS_ENABLED_KEY = "vg_notifications_enabled";

// Setup fundamental handler for when app is in foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

/**
 * Checks if the user has enabled notifications in our app settings.
 * Default is true if they haven't set it yet.
 */
export async function getNotificationsEnabled(): Promise<boolean> {
    const val = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
    return val !== "false";
}

/**
 * Toggles the global app setting for notifications.
 * If turned off, it instantly cancels all pending OS scheduling.
 */
export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
    await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, enabled.toString());
    if (!enabled) {
        await Notifications.cancelAllScheduledNotificationsAsync();
    }
}

/**
 * Requests OS-level permissions for push notifications.
 */
export async function requestNotificationPermissions() {
    if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
            name: "Vaccine Reminders",
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#0077B6",
        });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    return finalStatus === "granted";
}

/**
 * Core Logic: Analyzes a child's vaccine statuses and uses the operating
 * system APIs to schedule future local alerts for upcoming/overdue doses.
 * We completely wipe the queue and recalculate every time this is called
 * so the system stays pristine without duplicates.
 */
export async function scheduleVaccineReminders(child: Child, statuses: VaccineStatus[]) {
    // 1. Check if parent toggled them off in app settings
    const enabled = await getNotificationsEnabled();
    if (!enabled) return;

    // 2. Clear all previously scheduled notifications to prevent duplicates
    // Note: If we had multiple children, we'd need to be careful here or track IDs.
    // For simplicity, syncing ONE child's timeline wipes the slate cleanly.
    await Notifications.cancelAllScheduledNotificationsAsync();

    const now = startOfDay(new Date());

    for (const status of statuses) {
        const { vaccineName } = status.whoVaccine;

        // A. Handle Upcoming (Due within 2 weeks)
        if (status.status === "upcoming" && status.dueDate) {
            // 2 weeks before the exact due date
            const alertDate = addWeeks(startOfDay(status.dueDate), -2);

            // Only schedule if the alert date is today or in the future
            // We don't want to accidentally schedule alerts in the past
            if (isToday(alertDate) || isFuture(alertDate)) {
                await Notifications.scheduleNotificationAsync({
                    content: {
                        title: "Upcoming Vaccine Reminder 📅",
                        body: `Time to check in with your doctor about ${vaccineName} for ${child.name}. It's due in 2 weeks.`,
                        sound: true,
                    },
                    trigger: {
                        type: Notifications.SchedulableTriggerInputTypes.DATE,
                        date: alertDate, // Fires right at midnight on that day in production, could customize to 9AM
                    },
                });
            }
        }

        // B. Handle Overdue
        // If it is overdue, we schedule a gentle nudge immediately for the next day, once.
        if (status.status === "overdue") {
            // We schedule a single reminder for tomorrow to nudge them
            const alertDate = addWeeks(now, 1); // nudge them in a week

            await Notifications.scheduleNotificationAsync({
                content: {
                    title: "Vaccine Overdue ⚠️",
                    body: `Gentle reminder: ${child.name} is overdue for the ${vaccineName} vaccine. Please consult your pediatrician.`,
                    sound: true,
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DATE,
                    date: alertDate,
                },
            });
        }
    }
}
