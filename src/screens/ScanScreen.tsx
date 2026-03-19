import React, { useState, useRef, useEffect } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    Image,
    TextInput,
    ScrollView,
    Alert,
    Animated,
    Easing,
    Switch,
    Platform,
    KeyboardAvoidingView,
    ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { VaccineRecord } from "../types/vaccine";
import { extractVaccinesFromImage } from "../services/ocrService";
import { sanitizeAndCompressImage } from "../services/imageService";
import { WHO_SCHEDULE } from "../constants/whoSchedule";
import { useSaveVaccinesOffline } from "../hooks/useOfflineMutations";
import { Picker } from "@react-native-picker/picker";
import { useAppStore } from "../store/appStore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type ScreenState = "landing" | "preview" | "processing" | "review";
type ScanSource = "camera" | "upload";

/** Editable card model — extends VaccineRecord with UI-only state */
interface EditableCard extends VaccineRecord {
    confirmed: boolean;
    diseaseInfo: string | null;
    dateString: string; // editable string representation
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function ScanScreen() {
    const [state, setState] = useState<ScreenState>("landing");
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [scanSource, setScanSource] = useState<ScanSource>("camera");
    const [cards, setCards] = useState<EditableCard[]>([]);
    const [expandedInfo, setExpandedInfo] = useState<string | null>(null);

    // Dynamic state
    const { children, selectedChildId } = useAppStore();
    const [targetChildId, setTargetChildId] = useState<string | null>(null);

    useEffect(() => {
        if (!targetChildId && selectedChildId) setTargetChildId(selectedChildId);
    }, [selectedChildId]);

    // Grab the offline-first queue mutation
    const { mutateAsync: saveVaccinesOffline } = useSaveVaccinesOffline();

    // ── Image Capture ────────────────────────────────────────────────────────
    const handleTakePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
            Alert.alert(
                "Permission needed",
                "Camera access is required to scan vaccination certificates."
            );
            return;
        }
        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
            base64: true,
        });
        if (!result.canceled && result.assets[0]) {
            setImageUri(result.assets[0].uri);
            setScanSource("camera");
            setState("preview");
        }
    };

    const handlePickFromGallery = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
            Alert.alert(
                "Permission needed",
                "Gallery access is required to upload vaccination certificates."
            );
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
            base64: true,
        });
        if (!result.canceled && result.assets[0]) {
            setImageUri(result.assets[0].uri);
            setScanSource("upload");
            setState("preview");
        }
    };

    // ── Analysis ─────────────────────────────────────────────────────────────
    const handleAnalyze = async () => {
        if (!imageUri) return;
        setState("processing");

        try {
            // 1. Sanitize (strip EXIF) and compress the image
            const safeBase64 = await sanitizeAndCompressImage(imageUri);

            // 2. Send the safe baseline to OpenAI
            const records = await extractVaccinesFromImage(
                safeBase64,
                "pending", // childId assigned later on save
                scanSource
            );

            if (records.length === 0) {
                Alert.alert(
                    "No vaccines found",
                    "We couldn't detect any vaccine information in this image. Try taking a clearer photo or enter records manually.",
                    [
                        { text: "Retake", onPress: () => setState("landing") },
                        { text: "OK", style: "cancel", onPress: () => setState("landing") },
                    ]
                );
                return;
            }

            // Convert to editable cards
            const editable: EditableCard[] = records.map((r) => ({
                ...r,
                confirmed: false,
                diseaseInfo: lookupDisease(r.vaccineName),
                dateString: formatDate(r.dateAdministered),
            }));

            setCards(editable);
            setState("review");
        } catch {
            Alert.alert(
                "Analysis failed",
                "Something went wrong while analyzing the image. Please try again.",
                [{ text: "OK", onPress: () => setState("landing") }]
            );
        }
    };

    // ── Card Editing ─────────────────────────────────────────────────────────
    const updateCard = (id: string, updates: Partial<EditableCard>) => {
        setCards((prev) =>
            prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
        );
    };

    const deleteCard = (id: string) => {
        setCards((prev) => prev.filter((c) => c.id !== id));
        if (cards.length <= 1) setState("landing");
    };

    const handleSave = async () => {
        const confirmedCards = cards.filter((c) => c.confirmed);

        if (confirmedCards.length === 0) {
            Alert.alert("Wait", "Please confirm at least one vaccine to save.");
            return;
        }

        // ── Duplicate Detection ──────────────────────────────────────────────
        const { vaccineRecords } = useAppStore.getState();
        const existingNames = new Set(
            vaccineRecords
                .filter((r) => r.childId === (targetChildId || selectedChildId))
                .map((r) => r.vaccineName.toLowerCase())
        );
        const duplicates = confirmedCards.filter((c) =>
            existingNames.has(c.vaccineName.toLowerCase())
        );

        const doSave = async () => {
            const recordsToSave: VaccineRecord[] = confirmedCards.map((c) => {
                const { confirmed, diseaseInfo, dateString, ...coreRecord } = c;
                return {
                    ...coreRecord,
                    childId: targetChildId || selectedChildId || "pending",
                };
            });

            await saveVaccinesOffline(recordsToSave);

            setCards([]);
            setImageUri(null);
            setState("landing");
        };

        if (duplicates.length > 0) {
            const names = duplicates.map((d) => d.vaccineName).join(", ");
            Alert.alert(
                "Possible Duplicates",
                `The following vaccines already exist for this child: ${names}.\n\nSaving again may create duplicate entries. Are you sure?`,
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Save Anyway", style: "destructive", onPress: doSave },
                ]
            );
            return;
        }

        await doSave();
    };

    // ── Reset ────────────────────────────────────────────────────────────────
    const handleRetake = () => {
        setImageUri(null);
        setCards([]);
        setState("landing");
    };

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <SafeAreaView className="flex-1 bg-white">
            <KeyboardAvoidingView
                className="flex-1"
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                {state === "landing" && (
                    <LandingState
                        onTakePhoto={handleTakePhoto}
                        onPickGallery={handlePickFromGallery}
                    />
                )}
                {state === "preview" && imageUri && (
                    <PreviewState
                        imageUri={imageUri}
                        onAnalyze={handleAnalyze}
                        onRetake={handleRetake}
                    />
                )}
                {state === "processing" && <ProcessingState />}
                {state === "review" && (
                    <ReviewState
                        cards={cards}
                        expandedInfo={expandedInfo}
                        onToggleInfo={(id) =>
                            setExpandedInfo(expandedInfo === id ? null : id)
                        }
                        onUpdateCard={updateCard}
                        onDeleteCard={deleteCard}
                        onSave={handleSave}
                        onRetake={handleRetake}
                        childrenList={children}
                        selectedChildId={targetChildId || selectedChildId || ""}
                        onSelectChild={setTargetChildId}
                    />
                )}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

// ===========================================================================
// STATE 1 — Landing
// ===========================================================================
function LandingState({
    onTakePhoto,
    onPickGallery,
}: {
    onTakePhoto: () => void;
    onPickGallery: () => void;
}) {
    return (
        <View className="flex-1 px-5 pt-4">
            {/* Header */}
            <Text className="text-2xl font-bold text-gray-800 mb-1">
                Scan Certificate
            </Text>
            <Text className="text-gray-medium text-sm mb-8">
                Capture or upload a vaccination certificate to extract details
                automatically
            </Text>

            {/* Illustration area */}
            <View className="flex-1 items-center justify-center mb-8">
                <View className="bg-gray-light rounded-full p-8 mb-6">
                    <Ionicons name="document-text-outline" size={64} color="#0077B6" />
                </View>
                <Text className="text-gray-800 text-lg font-semibold mb-2">
                    Vaccine Card Scanner
                </Text>
                <Text className="text-gray-medium text-sm text-center px-8 leading-5">
                    Take a photo or upload an image of your child's vaccination card.
                    Our AI will extract the vaccine details for you.
                </Text>
            </View>

            {/* Action Buttons */}
            <TouchableOpacity
                className="bg-primary rounded-2xl py-4 mb-3 flex-row items-center justify-center"
                onPress={onTakePhoto}
                activeOpacity={0.85}
                style={{
                    shadowColor: "#0077B6",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.25,
                    shadowRadius: 8,
                    elevation: 6,
                }}
            >
                <Ionicons name="camera" size={22} color="#FFFFFF" />
                <Text className="text-white text-base font-semibold ml-3">
                    Take Photo
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                className="bg-accent rounded-2xl py-4 mb-6 flex-row items-center justify-center"
                onPress={onPickGallery}
                activeOpacity={0.85}
                style={{
                    shadowColor: "#00B4D8",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.2,
                    shadowRadius: 8,
                    elevation: 6,
                }}
            >
                <Ionicons name="images" size={22} color="#FFFFFF" />
                <Text className="text-white text-base font-semibold ml-3">
                    Upload from Gallery
                </Text>
            </TouchableOpacity>

            {/* Footer */}
            <View className="items-center mb-4">
                <Text className="text-gray-medium text-xs text-center">
                    Powered by AI Vision • Results should be verified by a doctor
                </Text>
            </View>
        </View>
    );
}

// ===========================================================================
// STATE 2 — Preview
// ===========================================================================
function PreviewState({
    imageUri,
    onAnalyze,
    onRetake,
}: {
    imageUri: string;
    onAnalyze: () => void;
    onRetake: () => void;
}) {
    return (
        <View className="flex-1 px-5 pt-4">
            <Text className="text-2xl font-bold text-gray-800 mb-1">
                Preview
            </Text>
            <Text className="text-gray-medium text-sm mb-4">
                Check that the image is clear and readable
            </Text>

            {/* Image preview */}
            <View
                className="flex-1 rounded-3xl overflow-hidden mb-4"
                style={{
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 8,
                    elevation: 4,
                }}
            >
                <Image
                    source={{ uri: imageUri }}
                    className="flex-1"
                    resizeMode="contain"
                    style={{ backgroundColor: "#F5F5F5" }}
                />
            </View>

            {/* Buttons */}
            <TouchableOpacity
                className="bg-primary rounded-2xl py-4 mb-3 flex-row items-center justify-center"
                onPress={onAnalyze}
                activeOpacity={0.85}
                style={{
                    shadowColor: "#0077B6",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.25,
                    shadowRadius: 8,
                    elevation: 6,
                }}
            >
                <Ionicons name="scan" size={20} color="#FFFFFF" />
                <Text className="text-white text-base font-semibold ml-2">
                    Looks good, analyze
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                className="rounded-2xl py-4 mb-6 flex-row items-center justify-center border-2 border-gray-200"
                onPress={onRetake}
                activeOpacity={0.7}
            >
                <Ionicons name="refresh" size={20} color="#9CA3AF" />
                <Text className="text-gray-medium text-base font-medium ml-2">
                    Retake
                </Text>
            </TouchableOpacity>
        </View>
    );
}

// ===========================================================================
// STATE 3 — Processing (Animated)
// ===========================================================================
function ProcessingState() {
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const spinAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Pulse animation
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.15,
                    duration: 800,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 800,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ])
        ).start();

        // Spin animation
        Animated.loop(
            Animated.timing(spinAnim, {
                toValue: 1,
                duration: 2000,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        ).start();
    }, []);

    const spin = spinAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ["0deg", "360deg"],
    });

    return (
        <View className="flex-1 items-center justify-center px-8">
            {/* Animated icon */}
            <Animated.View
                style={{
                    transform: [{ scale: pulseAnim }],
                    marginBottom: 32,
                }}
            >
                <View
                    className="bg-primary rounded-full items-center justify-center"
                    style={{ width: 100, height: 100 }}
                >
                    <Animated.View style={{ transform: [{ rotate: spin }] }}>
                        <Ionicons name="scan-outline" size={48} color="#FFFFFF" />
                    </Animated.View>
                </View>
            </Animated.View>

            <Text className="text-xl font-bold text-gray-800 mb-2 text-center">
                Reading your child's vaccine record...
            </Text>
            <Text className="text-gray-medium text-sm text-center mb-8 leading-5">
                Our AI is extracting vaccine information from the image. This usually
                takes a few seconds.
            </Text>

            <ActivityIndicator size="small" color="#0077B6" />
        </View>
    );
}

// ===========================================================================
// STATE 4 — Review
// ===========================================================================
function ReviewState({
    cards,
    expandedInfo,
    onToggleInfo,
    onUpdateCard,
    onDeleteCard,
    onSave,
    onRetake,
    childrenList,
    selectedChildId,
    onSelectChild,
}: {
    cards: EditableCard[];
    expandedInfo: string | null;
    onToggleInfo: (id: string) => void;
    onUpdateCard: (id: string, updates: Partial<EditableCard>) => void;
    onDeleteCard: (id: string) => void;
    onSave: () => void;
    onRetake: () => void;
    childrenList: any[];
    selectedChildId: string;
    onSelectChild: (id: string) => void;
}) {
    const confirmedCount = cards.filter((c) => c.confirmed).length;

    return (
        <View className="flex-1">
            <ScrollView
                className="flex-1 px-5 pt-4"
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <Text className="text-2xl font-bold text-gray-800 mb-1">
                    Review Results
                </Text>
                <Text className="text-gray-medium text-sm mb-4">
                    {cards.length} vaccine{cards.length !== 1 ? "s" : ""} found — please
                    verify each entry
                </Text>

                {/* Disclaimer Banner */}
                <View
                    className="rounded-2xl p-4 mb-5"
                    style={{ backgroundColor: "#FFF7ED", borderColor: "#FED7AA", borderWidth: 1 }}
                >
                    <View className="flex-row items-start">
                        <Text style={{ fontSize: 18, marginRight: 8, marginTop: 1 }}>⚕️</Text>
                        <Text className="flex-1 text-xs leading-5" style={{ color: "#9A3412" }}>
                            Please verify this information with your doctor. VaccineGuard is a
                            tracking tool, not a medical advisor.
                        </Text>
                    </View>
                </View>

                {/* Target Child Selector */}
                {childrenList.length > 0 && (
                    <View className="mb-6">
                        <Text className="text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">
                            Assign to Child
                        </Text>
                        <View className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden" style={Platform.OS === 'ios' ? { height: 'auto' } : { height: 50 }}>
                            <Picker
                                selectedValue={selectedChildId}
                                onValueChange={(itemValue) => onSelectChild(itemValue)}
                                style={Platform.OS === 'ios' ? { height: 120, width: "100%", marginVertical: -30 } : { height: 50, width: "100%" }}
                                itemStyle={Platform.OS === 'ios' ? { height: 120, fontSize: 16 } : undefined}
                            >
                                {childrenList.map((child) => (
                                    <Picker.Item key={child.id} label={child.name} value={child.id} />
                                ))}
                            </Picker>
                        </View>
                    </View>
                )}

                {/* Vaccine Cards */}
                {cards.map((card) => (
                    <VaccineCard
                        key={card.id}
                        card={card}
                        isInfoExpanded={expandedInfo === card.id}
                        onToggleInfo={() => onToggleInfo(card.id)}
                        onUpdate={(updates) => onUpdateCard(card.id, updates)}
                        onDelete={() => onDeleteCard(card.id)}
                    />
                ))}

                {/* Spacer for bottom button */}
                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Bottom Action Bar */}
            <View
                className="px-5 pb-6 pt-3 bg-white"
                style={{
                    borderTopWidth: 1,
                    borderTopColor: "#F3F4F6",
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: -2 },
                    shadowOpacity: 0.05,
                    shadowRadius: 4,
                    elevation: 4,
                }}
            >
                <TouchableOpacity
                    className="rounded-2xl py-4 mb-2 flex-row items-center justify-center"
                    style={{
                        backgroundColor: confirmedCount > 0 ? "#0077B6" : "#D1D5DB",
                        shadowColor: confirmedCount > 0 ? "#0077B6" : "transparent",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.25,
                        shadowRadius: 8,
                        elevation: confirmedCount > 0 ? 6 : 0,
                    }}
                    onPress={onSave}
                    disabled={confirmedCount === 0}
                    activeOpacity={0.85}
                >
                    <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={confirmedCount > 0 ? "#FFFFFF" : "#9CA3AF"}
                    />
                    <Text
                        className="text-base font-semibold ml-2"
                        style={{ color: confirmedCount > 0 ? "#FFFFFF" : "#9CA3AF" }}
                    >
                        Save {confirmedCount} vaccine{confirmedCount !== 1 ? "s" : ""} to
                        profile
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    className="rounded-2xl py-3 flex-row items-center justify-center"
                    onPress={onRetake}
                    activeOpacity={0.7}
                >
                    <Ionicons name="camera-outline" size={18} color="#9CA3AF" />
                    <Text className="text-gray-medium text-sm font-medium ml-2">
                        Scan another certificate
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

// ===========================================================================
// Vaccine Card Component
// ===========================================================================
function VaccineCard({
    card,
    isInfoExpanded,
    onToggleInfo,
    onUpdate,
    onDelete,
}: {
    card: EditableCard;
    isInfoExpanded: boolean;
    onToggleInfo: () => void;
    onUpdate: (updates: Partial<EditableCard>) => void;
    onDelete: () => void;
}) {
    const isLowConfidence = card.lowConfidence === true;

    return (
        <View
            className="bg-white rounded-2xl p-4 mb-4"
            style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 8,
                elevation: 3,
                borderWidth: isLowConfidence ? 2 : 1,
                borderColor: isLowConfidence
                    ? "#F59E0B"
                    : card.confirmed
                        ? "#0077B6"
                        : "#F3F4F6",
            }}
        >
            {/* Low confidence banner */}
            {isLowConfidence && (
                <View
                    className="flex-row items-center rounded-lg px-3 py-2 mb-3"
                    style={{ backgroundColor: "#FFFBEB" }}
                    accessibilityRole="alert"
                >
                    <Text style={{ fontSize: 14, marginRight: 6 }}>⚠️</Text>
                    <Text className="text-xs font-medium flex-1" style={{ color: "#92400E" }}>
                        Low confidence — please verify this name and date
                    </Text>
                </View>
            )}
            {/* Header row: vaccine name + actions */}
            <View className="flex-row items-center mb-3">
                <View
                    className="rounded-xl items-center justify-center mr-3"
                    style={{
                        width: 40,
                        height: 40,
                        backgroundColor: card.confirmed ? "#EBF8FF" : "#F5F5F5",
                    }}
                >
                    <Ionicons
                        name="medkit"
                        size={20}
                        color={card.confirmed ? "#0077B6" : "#9CA3AF"}
                    />
                </View>
                <View className="flex-1">
                    <TextInput
                        className="text-base font-semibold text-gray-800"
                        value={card.vaccineName}
                        onChangeText={(text) => onUpdate({ vaccineName: text })}
                        placeholder="Vaccine name"
                        placeholderTextColor="#9CA3AF"
                    />
                </View>
                <TouchableOpacity onPress={onToggleInfo} className="p-2 mr-1">
                    <Ionicons
                        name="help-circle-outline"
                        size={22}
                        color="#00B4D8"
                    />
                </TouchableOpacity>
                <TouchableOpacity onPress={onDelete} className="p-2">
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                </TouchableOpacity>
            </View>

            {/* Disease info panel — collapsed by default */}
            {isInfoExpanded && (
                <View
                    className="rounded-xl p-3 mb-3"
                    style={{ backgroundColor: "#F0F9FF" }}
                >
                    <View className="flex-row items-start">
                        <Ionicons
                            name="information-circle"
                            size={16}
                            color="#0077B6"
                            style={{ marginTop: 2, marginRight: 6 }}
                        />
                        <Text className="text-xs flex-1 leading-4" style={{ color: "#0369A1" }}>
                            {card.diseaseInfo ??
                                "Disease information not available for this vaccine."}
                        </Text>
                    </View>
                </View>
            )}

            {/* Date field */}
            <View className="flex-row items-center mb-3">
                <Ionicons
                    name="calendar-outline"
                    size={16}
                    color="#9CA3AF"
                    style={{ marginRight: 8 }}
                />
                <TextInput
                    className="flex-1 text-sm text-gray-800 bg-gray-light rounded-xl px-3 py-2"
                    value={card.dateString}
                    onChangeText={(text) => onUpdate({ dateString: text })}
                    placeholder="DD/MM/YYYY"
                    placeholderTextColor="#9CA3AF"
                />
            </View>

            {/* Batch / Doctor (optional, displayed if present) */}
            {(card.administeredBy || card.batchNumber) && (
                <View className="flex-row mb-3">
                    {card.administeredBy ? (
                        <View className="flex-row items-center flex-1 mr-2">
                            <Ionicons
                                name="person-outline"
                                size={14}
                                color="#9CA3AF"
                                style={{ marginRight: 4 }}
                            />
                            <Text className="text-xs text-gray-medium" numberOfLines={1}>
                                Dr. {card.administeredBy}
                            </Text>
                        </View>
                    ) : null}
                    {card.batchNumber ? (
                        <View className="flex-row items-center">
                            <Ionicons
                                name="barcode-outline"
                                size={14}
                                color="#9CA3AF"
                                style={{ marginRight: 4 }}
                            />
                            <Text className="text-xs text-gray-medium" numberOfLines={1}>
                                Batch: {card.batchNumber}
                            </Text>
                        </View>
                    ) : null}
                </View>
            )}

            {/* Confirm toggle */}
            <View
                className="flex-row items-center justify-between rounded-xl px-3 py-2"
                style={{ backgroundColor: card.confirmed ? "#F0FDF4" : "#F9FAFB" }}
            >
                <View className="flex-row items-center">
                    <Ionicons
                        name={card.confirmed ? "checkmark-circle" : "ellipse-outline"}
                        size={18}
                        color={card.confirmed ? "#16A34A" : "#9CA3AF"}
                        style={{ marginRight: 8 }}
                    />
                    <Text
                        className="text-sm font-medium"
                        style={{ color: card.confirmed ? "#16A34A" : "#6B7280" }}
                    >
                        {card.confirmed ? "Confirmed" : "Confirm this entry"}
                    </Text>
                </View>
                <Switch
                    value={card.confirmed}
                    onValueChange={(val) => onUpdate({ confirmed: val })}
                    trackColor={{ false: "#D1D5DB", true: "#86EFAC" }}
                    thumbColor={card.confirmed ? "#16A34A" : "#F3F4F6"}
                    ios_backgroundColor="#D1D5DB"
                />
            </View>
        </View>
    );
}

// ===========================================================================
// Helpers
// ===========================================================================

/** Lookup the disease this vaccine protects against from the WHO schedule */
function lookupDisease(vaccineName: string): string | null {
    const normalized = vaccineName.toLowerCase();
    for (const entry of WHO_SCHEDULE) {
        // Check vaccine name
        if (entry.vaccineName.toLowerCase().includes(normalized)) {
            return `Protects against: ${entry.disease}`;
        }
        // Check aliases
        for (const alias of entry.commonAliases) {
            if (
                alias.toLowerCase().includes(normalized) ||
                normalized.includes(alias.toLowerCase())
            ) {
                return `Protects against: ${entry.disease}`;
            }
        }
    }
    return null;
}

/** Format a Date to DD/MM/YYYY */
function formatDate(date: Date): string {
    const d = date.getDate().toString().padStart(2, "0");
    const m = (date.getMonth() + 1).toString().padStart(2, "0");
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
}
