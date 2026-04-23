// Provider registry. Adding a new provider (GitHub, Apple, etc.):
//   1. Implement AuthProvider in a sibling file.
//   2. Instantiate it here conditionally on its env vars.
//   3. Register it in `registerProviders()`.
//
// Routes look providers up by `name`, so no route/middleware changes needed.
import { AuthProvider } from "./provider";
import { GoogleProvider } from "./google";

const registry = new Map<string, AuthProvider>();

export function registerProviders(): void {
    const googleId = process.env.GOOGLE_CLIENT_ID;
    const googleSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (googleId && googleSecret) {
        registry.set("google", new GoogleProvider(googleId, googleSecret));
    } else {
        console.warn("[auth] Google OAuth not configured (GOOGLE_CLIENT_ID/SECRET missing)");
    }
}

export function getProvider(name: string): AuthProvider | undefined {
    return registry.get(name);
}

export function enabledProviders(): string[] {
    return Array.from(registry.keys());
}
