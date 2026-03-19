import React, { useEffect, useState } from "react";
import { View, Text, Animated } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function OfflineBanner() {
    const [isOffline, setIsOffline] = useState(false);
    const insets = useSafeAreaInsets();
    const slideAnim = React.useRef(new Animated.Value(0)).current;

    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener((state) => {
            const offline = state.isConnected === false;
            setIsOffline(offline);

            if (offline) {
                setIsVisible(true);
                Animated.timing(slideAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }).start();
            } else {
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }).start(() => setIsVisible(false));
            }
        });

        return () => unsubscribe();
    }, [slideAnim]);

    if (!isOffline && !isVisible) return null;

    const translateY = slideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [-100, 0], // slide down from top
    });

    return (
        <Animated.View
            style={{
                transform: [{ translateY }],
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                backgroundColor: "#FEF2F2", // red-50
                borderBottomWidth: 1,
                borderBottomColor: "#FCA5A5", // red-300
                paddingTop: insets.top + 8, // stay under the notch/status bar
                paddingBottom: 8,
                paddingHorizontal: 16,
                zIndex: 9999, // Float above all navigation headers
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 3,
                elevation: 5,
            }}
        >
            <Ionicons name="cloud-offline" size={16} color="#DC2626" style={{ marginRight: 6 }} />
            <Text style={{ color: "#991B1B", fontSize: 13, fontWeight: "600" }}>
                You're offline. Viewing saved records.
            </Text>
        </Animated.View>
    );
}
