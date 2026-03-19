import { ExpoConfig, ConfigContext } from 'expo/config';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env file explicitly
dotenv.config({ path: path.resolve(__dirname, '.env') });

export default ({ config }: ConfigContext): ExpoConfig => ({
    ...config,
    name: "VaccineGuard",
    slug: "vaccineguard",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
        image: "./assets/splash-icon.png",
        resizeMode: "contain",
        backgroundColor: "#ffffff",
    },
    ios: {
        supportsTablet: true,
    },
    android: {
        adaptiveIcon: {
            backgroundColor: "#E6F4FE",
            foregroundImage: "./assets/android-icon-foreground.png",
            backgroundImage: "./assets/android-icon-background.png",
            monochromeImage: "./assets/android-icon-monochrome.png",
        },
        predictiveBackGestureEnabled: false,
    },
    web: {
        favicon: "./assets/favicon.png",
    },
    plugins: ["expo-sharing", "expo-web-browser"],
    extra: {
        // Expose env vars via expo-constants instead of raw process.env
        supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
        supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
        openAiApiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
    },
});
