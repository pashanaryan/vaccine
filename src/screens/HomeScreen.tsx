import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useAppStore } from "../store/appStore";

export default function HomeScreen() {
    const navigation = useNavigation<any>();
    const { children, selectedChildId, selectChild } = useAppStore();

    return (
        <SafeAreaView className="flex-1 bg-white">
            <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View className="mb-6" accessibilityRole="header">
                    <View className="flex-row items-center mb-1">
                        <Ionicons name="shield-checkmark" size={28} color="#0077B6" />
                        <Text className="text-2xl font-bold text-gray-800 ml-2">
                            VaccineGuard
                        </Text>
                    </View>
                    <Text style={{ color: "#4B5563" }} className="text-sm">
                        Keeping your little ones protected
                    </Text>
                </View>

                {/* Children Section (Horizontal Switcher) */}
                <Text className="text-lg font-semibold text-gray-800 mb-3">
                    Your Children
                </Text>
                {children.length === 0 ? (
                    <View className="bg-gray-50 rounded-2xl p-6 items-center mb-8 border border-gray-100">
                        <Ionicons name="people-outline" size={48} color="#9CA3AF" />
                        <Text style={{ color: "#4B5563" }} className="text-sm mt-3 text-center">
                            No children added yet.{"\n"}Tap "Add New" to get started.
                        </Text>
                    </View>
                ) : (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        className="mb-8"
                        accessibilityRole="scrollbar"
                        accessibilityLabel="Children selector"
                    >
                        {children.map((child) => {
                            const isSelected = child.id === selectedChildId;
                            return (
                                <TouchableOpacity
                                    key={child.id}
                                    onPress={() => selectChild(child.id)}
                                    accessibilityLabel={`Select ${child.name}${isSelected ? ", currently selected" : ""}`}
                                    accessibilityRole="button"
                                    style={{ minWidth: 64, minHeight: 88 }}
                                    className={`mr-4 items-center ${isSelected ? "opacity-100" : "opacity-60"}`}
                                >
                                    <View
                                        className={`w-16 h-16 rounded-full items-center justify-center mb-2 border-2 ${isSelected ? "border-blue-500 bg-blue-100" : "border-gray-200 bg-gray-100"
                                            }`}
                                    >
                                        <Ionicons
                                            name="person"
                                            size={32}
                                            color={isSelected ? "#0077B6" : "#6B7280"}
                                        />
                                    </View>
                                    <Text className={`text-sm font-medium ${isSelected ? "text-blue-700" : "text-gray-600"}`}>
                                        {child.name}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}

                        {/* Add Child Button */}
                        <TouchableOpacity
                            onPress={() => navigation.navigate("AddChild")}
                            accessibilityLabel="Add a new child"
                            accessibilityRole="button"
                            style={{ minWidth: 64, minHeight: 88 }}
                            className="mr-6 items-center opacity-80"
                        >
                            <View
                                className="w-16 h-16 rounded-full items-center justify-center mb-2 border-2 border-dashed border-gray-300 bg-gray-50"
                            >
                                <Ionicons name="add" size={32} color="#9CA3AF" />
                            </View>
                            <Text style={{ color: "#4B5563" }} className="text-sm font-medium">
                                Add New
                            </Text>
                        </TouchableOpacity>
                    </ScrollView>
                )}

                {/* Disclaimer Banner */}
                <View className="bg-blue-50 rounded-2xl p-4 mb-6 border border-blue-100" accessibilityRole="alert">
                    <View className="flex-row items-start">
                        <Ionicons
                            name="information-circle"
                            size={20}
                            color="#0077B6"
                            style={{ marginTop: 2 }}
                        />
                        <Text className="text-primary text-xs ml-2 flex-1 leading-5">
                            VaccineGuard helps you track vaccinations but is not a medical
                            tool. Always consult your healthcare provider for medical advice.
                        </Text>
                    </View>
                </View>

                {/* Quick Actions */}
                <Text className="text-lg font-semibold text-gray-800 mb-3">
                    Quick Actions
                </Text>
                <View className="flex-row mb-6">
                    <TouchableOpacity
                        className="flex-1 bg-primary rounded-2xl p-4 mr-2 items-center"
                        style={{ minHeight: 80 }}
                        onPress={() => navigation.navigate("Scan")}
                        accessibilityLabel="Scan a vaccination certificate"
                        accessibilityRole="button"
                    >
                        <Ionicons name="camera-outline" size={28} color="#FFFFFF" />
                        <Text className="text-white text-sm font-medium mt-2">
                            Scan Certificate
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        className="flex-1 bg-accent rounded-2xl p-4 ml-2 items-center"
                        style={{ minHeight: 80 }}
                        onPress={() => navigation.navigate("AddChild")}
                        accessibilityLabel="Add a new child profile"
                        accessibilityRole="button"
                    >
                        <Ionicons name="person-add-outline" size={28} color="#FFFFFF" />
                        <Text className="text-white text-sm font-medium mt-2">
                            Add Child
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
