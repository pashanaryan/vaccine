import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import PrivacyPolicyScreen from "./PrivacyPolicyScreen";
import NotificationsScreen from "./NotificationsScreen";

export type ProfileStackParamList = {
    ProfileMain: undefined;
    PrivacyPolicy: undefined;
    Notifications: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

function ProfileMainScreen() {
    const navigation = useNavigation<any>();

    return (
        <SafeAreaView className="flex-1 bg-white">
            <ScrollView className="flex-1 px-5 pt-4">
                {/* Header */}
                <Text className="text-2xl font-bold text-gray-800 mb-6">Profile</Text>

                {/* Avatar & User Info */}
                <View className="items-center mb-8">
                    <View className="w-24 h-24 rounded-full items-center justify-center mb-3" style={{ backgroundColor: "#0077B6" }}>
                        <Ionicons name="person" size={44} color="#FFFFFF" />
                    </View>
                    <Text className="text-lg font-semibold text-gray-800">
                        Parent Name
                    </Text>
                    <Text className="text-gray-medium text-sm text-gray-500">
                        Sign in to sync your data
                    </Text>
                </View>

                {/* Settings Menu */}
                <Text className="text-lg font-semibold text-gray-800 mb-3">
                    Settings
                </Text>

                <MenuItem
                    icon="person-circle-outline"
                    label="Account"
                    subtitle="Sign in or create an account"
                    onPress={() => { }}
                />
                <MenuItem
                    icon="notifications-outline"
                    label="Notifications"
                    subtitle="Manage vaccine reminders"
                    onPress={() => navigation.navigate("Notifications")}
                />
                <MenuItem
                    icon="people-outline"
                    label="Manage Children"
                    subtitle="Add, edit, or remove children"
                    onPress={() => { }}
                />
                <MenuItem
                    icon="cloud-upload-outline"
                    label="Backup & Sync"
                    subtitle="Keep your data safe in the cloud"
                    onPress={() => { }}
                />
                <MenuItem
                    icon="shield-checkmark-outline"
                    label="Privacy Policy"
                    subtitle="Data handling and terms"
                    onPress={() => navigation.navigate("PrivacyPolicy")}
                />
                <MenuItem
                    icon="help-circle-outline"
                    label="Help & Support"
                    subtitle="FAQs, feedback, and contact"
                    onPress={() => { }}
                />

                {/* Version */}
                <View className="items-center mt-6 mb-8">
                    <Text className="text-gray-500 text-xs">
                        VaccineGuard v1.0.0
                    </Text>
                    <Text className="text-gray-400 text-xs mt-1">
                        Not a medical device • Consult your doctor
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

/** Reusable settings menu item */
function MenuItem({
    icon,
    label,
    subtitle,
    onPress,
}: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    subtitle: string;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity
            className="flex-row items-center rounded-2xl p-4 mb-3"
            style={{ backgroundColor: "#F9FAFB" }}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View className="w-10 h-10 bg-white rounded-xl items-center justify-center mr-3 shadow-sm">
                <Ionicons name={icon} size={22} color="#0077B6" />
            </View>
            <View className="flex-1">
                <Text className="text-gray-800 text-sm font-medium">{label}</Text>
                <Text className="text-gray-500 text-xs mt-0.5">{subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
        </TouchableOpacity>
    );
}

// Wrap the main profile screen in a stack so we can push inner screens over the tab bar
export default function ProfileScreen() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="ProfileMain" component={ProfileMainScreen} />
            <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
        </Stack.Navigator>
    );
}
