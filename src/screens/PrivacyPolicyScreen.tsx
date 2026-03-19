import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

export default function PrivacyPolicyScreen() {
    const navigation = useNavigation();

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
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    className="p-2 mr-2"
                >
                    <Ionicons name="arrow-back" size={24} color="#111827" />
                </TouchableOpacity>
                <Text className="text-xl font-bold text-gray-800">Privacy Policy</Text>
            </View>

            {/* Content */}
            <ScrollView
                className="flex-1 px-5 pt-4"
                contentContainerStyle={{ paddingBottom: 40 }}
            >
                <View className="items-center mb-6 mt-4">
                    <View className="bg-blue-50 w-20 h-20 rounded-full items-center justify-center mb-4">
                        <Ionicons name="shield-checkmark" size={40} color="#0077B6" />
                    </View>
                    <Text className="text-2xl font-bold text-gray-800 text-center">
                        Your Family's Privacy First
                    </Text>
                    <Text className="text-gray-medium text-sm text-center mt-2 leading-5 px-4">
                        We built VaccineGuard to help parents track immunizations without
                        compromising their children's data security.
                    </Text>
                </View>

                <PolicySection
                    icon="cloud-offline-outline"
                    title="1. Secure Cloud Storage"
                    content="Your account and vaccination records are stored securely in our cloud database (powered by Supabase). Data is protected using Row Level Security (RLS), meaning cryptographically, only your authenticated account can ever read or write your child's data."
                />

                <PolicySection
                    icon="camera-outline"
                    title="2. Image Scanning & AI"
                    content="VaccineGuard uses OpenAI's GPT-4o Vision API to read vaccination cards. When you take a photo:\n• The image is immediately compressed on your device.\n• ALL location data and device metadata (EXIF) are stripped before leaving your phone.\n• The image is sent securely to the AI solely for text extraction.\n• We do NOT permanently store your photos from the camera scanner."
                />

                <PolicySection
                    icon="document-text-outline"
                    title="3. Medical Disclaimer"
                    content="VaccineGuard is a tracking tool for personal reference only. It is NOT a certified medical device and does not provide medical advice. Always consult your pediatrician regarding your child's official immunization schedule."
                />

                <PolicySection
                    icon="trash-bin-outline"
                    title="4. Data Deletion"
                    content="You own your data. If you delete a child's profile, all associated vaccination records are immediately and permanently wiped from our database. If you delete your account, your entire family's footprint is erased."
                />

                <View className="mt-8 pt-6" style={{ borderTopWidth: 1, borderTopColor: "#E5E7EB" }}>
                    <Text className="text-xs text-gray-400 text-center leading-5">
                        Last updated: March 2024{"\n"}
                        For any privacy-related questions or data export requests, please contact our support team.
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function PolicySection({
    icon,
    title,
    content,
}: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    content: string;
}) {
    return (
        <View className="mb-6">
            <View className="flex-row items-center mb-2">
                <Ionicons name={icon} size={20} color="#0077B6" style={{ marginRight: 8 }} />
                <Text className="text-lg font-bold text-gray-800 flex-1">{title}</Text>
            </View>
            <Text className="text-sm text-gray-600 leading-6 pl-7">
                {content}
            </Text>
        </View>
    );
}
