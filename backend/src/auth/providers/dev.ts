// Dev-only auth provider. Fits the AuthProvider interface so the full session
// flow (state cookie, upsert, requireOwnership) is exercised exactly as with
// Google — the only difference is that the "consent" step is a same-origin
// bounce instead of a trip to accounts.google.com.
//
// **Never** register this in a deployed environment. providers/index.ts
// triple-gates on NODE_ENV, DEV_AUTH_ENABLED, and the absence of
// AWS_EXECUTION_ENV (Fargate always sets the last).
import { AuthProvider, ProviderProfile } from "./provider";

export class DevAuthProvider implements AuthProvider {
    readonly name = "dev";

    authorizeUrl(state: string, redirectUri: string): string {
        // Bounce straight back to our own callback. The callback validates
        // `state` against the session cookie, so this redirect still proves
        // same-browser round-trip; it just skips the OAuth server.
        const params = new URLSearchParams({ code: "dev", state });
        return `${redirectUri}?${params.toString()}`;
    }

    async exchangeCodeForProfile(): Promise<ProviderProfile> {
        return {
            providerSub: "dev-local",
            email: "dev@localhost",
            displayName: "Dev User",
        };
    }
}
