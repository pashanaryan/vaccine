import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import {
    getNotificationsEnabled,
    setNotificationsEnabled,
    requestNotificationPermissions,
} from "../services/notificationService";

export default function NotificationsScreen() {
    const navigation = useNavigation();
    const [isEnabled, setIsEnabled] = useState(false);
    const [hasOSPermission, setHasOSPermission] = useState(false);

    useEffect(() => {
        // 1. Load app preference from AsyncStorage
        getNotificationsEnabled().then((status) => setIsEnabled(status));

        // 2. Check actual OS permission silently
        // If we don't have OS permission, the switch should probably drop a hint
        requestNotificationPermissions().then((granted) => {
            setHasOSPermission(granted);
            if (!granted && isEnabled) {
                // Mismatch: App says yes, but OS denied it.
                // We could prompt them to open settings here, but for now we just track it.
            }
        });
    }, [isEnabled]);

    const toggleSwitch = async () => {
        const newVal = !isEnabled;

        if (newVal && !hasOSPermission) {
            // Trying to turn it ON, but OS blocked it
            const granted = await requestNotificationPermissions();
            setHasOSPermission(granted);
            if (!granted) {
                // They hit "Deny" on the OS prompt, or it's permanently disabled.
                // Can't turn it on.
                return;
            }
        }

        setIsEnabled(newVal);
        await setNotificationsEnabled(newVal);
        // Note: Re-scheduling actually happens dynamically in Dashboard.
        // For now, turning it off instantly cancels all pending. 
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            {/* Header */}
            <View
                className="flex-row items-center px-4 py-3"
                style={{
                    borderBottomWidth: 1,
                    borderBottomColor: "#F3F4F6",
                }}
            >
                <TouchableOpacity onPress={() => navigation.goBack()} className="p-2 mr-2">
                    <Ionicons name="arrow-back" size={24} color="#111827" />
                </TouchableOpacity>
                <Text className="text-xl font-bold text-gray-800">Notifications</Text>
            </View>

            <ScrollView className="flex-1 px-5 pt-6">
                <View className="items-center mb-8">
                    <View className="bg-blue-50 w-20 h-20 rounded-full items-center justify-center mb-4">
                        <Ionicons name="notifications" size={40} color="#0077B6" />
                    </View>
                    <Text className="text-2xl font-bold text-gray-800 text-center">
                        Stay on Track
                    </Text>
                    <Text className="text-gray-medium text-sm text-center mt-2 leading-5 px-4">
                        VaccineGuard can gently remind you when your child is due or overdue for a vaccination.
                    </Text>
                </View>

                {/* Master Toggle Area */}
                <View className="bg-gray-light rounded-2xl p-5 mb-6">
                    <View className="flex-row justify-between items-center mb-2">
                        <Text className="text-lg font-bold text-gray-800">
                            Enable Reminders
                        </Text>
                        <Switch
                            trackColor={{ false: "#D1D5DB", true: "#BFDBFE" }}
                            thumbColor={isEnabled ? "#0077B6" : "#F3F4F6"}
                            ios_backgroundColor="#D1D5DB"
                            onValueChange={toggleSwitch}
                            value={isEnabled}
                        />
                    </View>
                    <Text className="text-sm text-gray-500 leading-5">
                        Receive local push notifications securely on this device without relying on internet servers.
                    </Text>
                    {!hasOSPermission && isEnabled && (
                        <Text className="text-xs text-red-500 mt-2">
                            Warning: OS permissions are disabled. Please check your phone settings.
                        </Text>
                    )}
                </View>

                {/* Explainers */}
                <Text className="text-sm font-bold text-gray-800 mb-4 px-1 uppercase tracking-wider">
                    What we send
                </Text>

                <View className="flex-row mb-5">
                    <View className="w-10 h-10 bg-blue-50 rounded-full items-center justify-center mr-4">
                        <Ionicons name="calendar-outline" size={20} color="#0077B6" />
                    </View>
                    <View className="flex-1">
                        <Text className="text-base font-semibold text-gray-800">Upcoming Doses</Text>
                        <Text className="text-sm text-gray-500 leading-5 mt-1">
                            Reminders 2 weeks before a scheduled dose so you can book an appointment.
                        </Text>
                    </View>
                </View>

                <View className="flex-row mb-5">
                    <View className="w-10 h-10 bg-red-50 rounded-full items-center justify-center mr-4">
                        <Ionicons name="alert-circle-outline" size={20} color="#DC2626" />
                    </View>
                    <View className="flex-1">
                        <Text className="text-base font-semibold text-gray-800">Overdue Alerts</Text>
                        <Text className="text-sm text-gray-500 leading-5 mt-1">
                            Gentle nudges if your child misses a major timeline milestone.
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
