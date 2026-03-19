import { supabase } from "./supabaseClient";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import type { Session, User } from "@supabase/supabase-js";

// Ensures the web browser closes after the auth flow completes
WebBrowser.maybeCompleteAuthSession();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface AuthUser {
    id: string;
    email: string;
    fullName: string | null;
    avatarUrl: string | null;
}

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------
function friendlyError(context: string, raw: string): Error {
    console.error(`[authService] ${context}:`, raw);

    const msg = raw.toLowerCase();
    if (msg.includes("invalid login"))
        return new Error("Invalid email or password. Please check your credentials and try again.");
    if (msg.includes("already registered") || msg.includes("already been registered"))
        return new Error("An account with this email already exists. Try signing in instead.");
    if (msg.includes("email not confirmed"))
        return new Error("Please check your email and confirm your account before signing in.");
    if (msg.includes("invalid email"))
        return new Error("Please enter a valid email address.");
    if (msg.includes("password") && msg.includes("short"))
        return new Error("Password must be at least 6 characters long.");
    if (msg.includes("rate") || msg.includes("limit"))
        return new Error("Too many attempts. Please wait a moment before trying again.");
    if (msg.includes("network") || msg.includes("fetch"))
        return new Error("Unable to connect. Please check your internet connection.");

    return new Error("Authentication failed. Please try again.");
}

// ---------------------------------------------------------------------------
// Email / Password Auth
// ---------------------------------------------------------------------------

/**
 * Sign up a new user with email, password, and full name.
 * Sends a confirmation email via Supabase.
 */
export async function signUpWithEmail(
    email: string,
    password: string,
    fullName: string
): Promise<AuthUser> {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: fullName,
            },
        },
    });

    if (error) throw friendlyError("signUpWithEmail", error.message);
    if (!data.user) throw new Error("Sign-up succeeded but no user was returned. Please try signing in.");

    return mapUser(data.user);
}

/**
 * Sign in an existing user with email and password.
 */
export async function signInWithEmail(
    email: string,
    password: string
): Promise<AuthUser> {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) throw friendlyError("signInWithEmail", error.message);
    if (!data.user) throw new Error("Sign-in succeeded but no user was returned.");

    return mapUser(data.user);
}

/**
 * Sign out the current user.
 */
export async function signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw friendlyError("signOut", error.message);
}

/**
 * Get the currently authenticated user, or null if not signed in.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

    if (error || !user) return null;
    return mapUser(user);
}

/**
 * Get the current session, or null if not authenticated.
 */
export async function getSession(): Promise<Session | null> {
    const {
        data: { session },
    } = await supabase.auth.getSession();
    return session;
}

/**
 * Listen for auth state changes (sign in, sign out, token refresh).
 * Returns an unsubscribe function.
 */
export function onAuthStateChange(
    callback: (user: AuthUser | null) => void
): () => void {
    const {
        data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
        callback(session?.user ? mapUser(session.user) : null);
    });

    return () => subscription.unsubscribe();
}

// ---------------------------------------------------------------------------
// Google OAuth (via Expo AuthSession)
// ---------------------------------------------------------------------------

/**
 * Sign in with Google using Supabase OAuth + Expo AuthSession.
 *
 * Prerequisites:
 *   1. Enable Google provider in Supabase Dashboard → Auth → Providers
 *   2. Set the redirect URL in your Google Cloud Console OAuth credentials
 */
export async function signInWithGoogle(): Promise<AuthUser> {
    const redirectUrl = makeRedirectUri({
        scheme: "vaccineguard",
        path: "auth/callback",
    });

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
            redirectTo: redirectUrl,
            skipBrowserRedirect: true,
        },
    });

    if (error) throw friendlyError("signInWithGoogle", error.message);
    if (!data.url) throw new Error("Could not generate a Google sign-in URL.");

    // Open the OAuth URL in the system browser
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

    if (result.type !== "success" || !("url" in result)) {
        throw new Error("Google sign-in was cancelled or failed.");
    }

    // Extract tokens from the redirect URL
    const url = new URL(result.url);
    const params = new URLSearchParams(
        url.hash ? url.hash.substring(1) : url.search.substring(1)
    );
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (!accessToken) {
        throw new Error("Google sign-in did not return an access token.");
    }

    // Set the session in Supabase
    const { data: sessionData, error: sessionError } =
        await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken ?? "",
        });

    if (sessionError)
        throw friendlyError("signInWithGoogle/setSession", sessionError.message);
    if (!sessionData.user)
        throw new Error("Google sign-in succeeded but no user was returned.");

    return mapUser(sessionData.user);
}

// ---------------------------------------------------------------------------
// User mapper
// ---------------------------------------------------------------------------
function mapUser(user: User): AuthUser {
    return {
        id: user.id,
        email: user.email ?? "",
        fullName: (user.user_metadata?.full_name as string) ?? null,
        avatarUrl: (user.user_metadata?.avatar_url as string) ?? null,
    };
}
