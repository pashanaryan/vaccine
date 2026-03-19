import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";

import HomeScreen from "../screens/HomeScreen";
import ScanScreen from "../screens/ScanScreen";
import DashboardScreen from "../screens/DashboardScreen";
import ProfileScreen from "../screens/ProfileScreen";
import AddChildScreen from "../screens/AddChildScreen";
import { OfflineBanner } from "../components/OfflineBanner";

export type RootStackParamList = {
    MainTabs: undefined;
    AddChild: undefined;
};

export type RootTabParamList = {
    Home: undefined;
    Scan: undefined;
    Dashboard: undefined;
    Profile: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<RootTabParamList>();

const TAB_ICONS: Record<
    keyof RootTabParamList,
    { focused: keyof typeof Ionicons.glyphMap; default: keyof typeof Ionicons.glyphMap }
> = {
    Home: { focused: "home", default: "home-outline" },
    Scan: { focused: "scan-circle", default: "scan-circle-outline" },
    Dashboard: { focused: "grid", default: "grid-outline" },
    Profile: { focused: "person", default: "person-outline" },
};

function TabNavigator() {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarActiveTintColor: "#0077B6",
                tabBarInactiveTintColor: "#9CA3AF",
                tabBarStyle: {
                    backgroundColor: "#FFFFFF",
                    borderTopColor: "#F3F4F6",
                    borderTopWidth: 1,
                    paddingTop: 6,
                    paddingBottom: 8,
                    height: 60,
                },
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: "600",
                },
                tabBarIcon: ({ focused, color, size }) => {
                    const icons = TAB_ICONS[route.name as keyof RootTabParamList];
                    const iconName = focused ? icons.focused : icons.default;
                    return <Ionicons name={iconName} size={size} color={color} />;
                },
            })}
        >
            <Tab.Screen name="Home" component={HomeScreen} />
            <Tab.Screen
                name="Scan"
                component={ScanScreen}
                options={{
                    tabBarLabel: "Scan",
                }}
            />
            <Tab.Screen name="Dashboard" component={DashboardScreen} />
            <Tab.Screen name="Profile" component={ProfileScreen} />
        </Tab.Navigator>
    );
}

export default function RootNavigator() {
    return (
        <NavigationContainer>
            <OfflineBanner />
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="MainTabs" component={TabNavigator} />
                <Stack.Screen
                    name="AddChild"
                    component={AddChildScreen}
                    options={{ presentation: "modal" }}
                />
            </Stack.Navigator>
        </NavigationContainer>
    );
}
