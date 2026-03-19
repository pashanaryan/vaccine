import React, { useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useAppStore } from "../store/appStore";

export default function AddChildScreen() {
    const navigation = useNavigation();
    const addChild = useAppStore((state) => state.addChild);

    const [name, setName] = useState("");
    const [gender, setGender] = useState<"male" | "female">("male");

    // For simplicity without a heavy DatePicker dependency right now,
    // we'll ask for Year and Month, and default to the 1st
    const [birthYear, setBirthYear] = useState(new Date().getFullYear().toString());
    const [birthMonth, setBirthMonth] = useState((new Date().getMonth() + 1).toString());

    const handleSave = () => {
        if (!name.trim()) return;

        const year = parseInt(birthYear) || new Date().getFullYear();
        // Month is 0-indexed in JS Date
        const month = (parseInt(birthMonth) || 1) - 1;

        addChild({
            name: name.trim(),
            dateOfBirth: new Date(year, month, 1),
            gender,
            parentId: "current-user",
        });

        navigation.goBack();
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <KeyboardAvoidingView
                className="flex-1"
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                {/* Header */}
                <View className="flex-row items-center justify-between px-5 pt-3 pb-4 border-b border-gray-100">
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        className="p-2 -ml-2"
                        accessibilityLabel="Close add child screen"
                        accessibilityRole="button"
                        style={{ minWidth: 44, minHeight: 44 }}
                    >
                        <Ionicons name="close" size={26} color="#374151" />
                    </TouchableOpacity>
                    <Text className="text-xl font-bold text-gray-800" accessibilityRole="header">Add Child</Text>
                    <View style={{ width: 44 }} />
                </View>

                <ScrollView className="flex-1 px-5 pt-6">
                    {/* Avatar area */}
                    <View className="items-center mb-8">
                        <View className="w-24 h-24 rounded-full bg-blue-50 items-center justify-center border-2 border-blue-100 mb-3">
                            <Ionicons name="person" size={48} color="#0077B6" />
                        </View>
                        <Text style={{ color: "#4B5563" }} className="text-sm">Child's Profile</Text>
                    </View>

                    {/* Form Fields */}
                    <Text className="text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">
                        Name
                    </Text>
                    <TextInput
                        className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 mb-6 text-base text-gray-800"
                        placeholder="e.g. Arjun"
                        value={name}
                        onChangeText={setName}
                        placeholderTextColor="#9CA3AF"
                        accessibilityLabel="Child's name"
                        style={{ minHeight: 48 }}
                    />

                    <Text className="text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">
                        Biological Sex
                    </Text>
                    <View className="flex-row mb-6">
                        <TouchableOpacity
                            className={`flex-1 flex-row items-center justify-center py-3 rounded-xl border ${gender === "male" ? "bg-blue-50 border-blue-200" : "bg-white border-gray-200"
                                } mr-2`}
                            onPress={() => setGender("male")}
                            accessibilityLabel={`Select male${gender === "male" ? ", currently selected" : ""}`}
                            accessibilityRole="button"
                            style={{ minHeight: 48 }}
                        >
                            <Ionicons
                                name="male"
                                size={18}
                                color={gender === "male" ? "#0077B6" : "#6B7280"}
                            />
                            <Text
                                className={`ml-2 font-medium ${gender === "male" ? "text-blue-700" : "text-gray-600"}`}
                            >
                                Male
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            className={`flex-1 flex-row items-center justify-center py-3 rounded-xl border ${gender === "female" ? "bg-blue-50 border-blue-200" : "bg-white border-gray-200"
                                } ml-2`}
                            onPress={() => setGender("female")}
                            accessibilityLabel={`Select female${gender === "female" ? ", currently selected" : ""}`}
                            accessibilityRole="button"
                            style={{ minHeight: 48 }}
                        >
                            <Ionicons
                                name="female"
                                size={18}
                                color={gender === "female" ? "#0077B6" : "#6B7280"}
                            />
                            <Text
                                className={`ml-2 font-medium ${gender === "female" ? "text-blue-700" : "text-gray-600"}`}
                            >
                                Female
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <Text className="text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">
                        Birth Month & Year
                    </Text>
                    <View className="flex-row mb-6">
                        <TextInput
                            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 mr-2 text-base text-gray-800 text-center"
                            placeholder="MM"
                            keyboardType="number-pad"
                            maxLength={2}
                            value={birthMonth}
                            onChangeText={setBirthMonth}
                            accessibilityLabel="Birth month"
                            style={{ minHeight: 48 }}
                        />
                        <TextInput
                            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 ml-2 text-base text-gray-800 text-center"
                            placeholder="YYYY"
                            keyboardType="number-pad"
                            maxLength={4}
                            value={birthYear}
                            onChangeText={setBirthYear}
                            accessibilityLabel="Birth year"
                            style={{ minHeight: 48 }}
                        />
                    </View>
                </ScrollView>

                {/* Sticky Bottom Action */}
                <View className="px-5 py-4 border-t border-gray-100 bg-white shadow-lg">
                    <TouchableOpacity
                        className={`rounded-2xl py-4 flex-row items-center justify-center ${name.trim() ? "bg-primary" : "bg-gray-300"}`}
                        onPress={handleSave}
                        disabled={!name.trim()}
                        accessibilityLabel={name.trim() ? "Save child profile" : "Enter a name to save"}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: !name.trim() }}
                        style={{ minHeight: 52 }}
                    >
                        <Text className="text-white text-base font-bold">
                            Save Profile
                        </Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
