// Provider-agnostic OAuth interface. Implementations convert an OAuth
// authorization-code-grant flow into a normalized profile we can persist.
//
// Rolling this rather than using Passport because:
//   - The flow is ~50 lines of standards-defined behavior; wrappers add more
//     indirection than code savings at this scale.
//   - A clean domain interface here means GitHub / Apple / etc. fit the same
//     shape without Passport's per-strategy quirks leaking into our routes.

export interface ProviderProfile {
    /** Stable identifier for this user *within* the provider. For Google this
     *  is the `sub` claim; never the email (emails change, subs don't). */
    providerSub: string;
    email: string;
    displayName: string;
    avatarUrl?: string;
}

export interface AuthProvider {
    /** Machine-readable, URL-safe. Shows up as /api/auth/:provider/start. */
    readonly name: string;

    /** Build the consent URL the user's browser is redirected to. `state`
     *  is a random token the caller stashes in the session; the provider
     *  echoes it back on the callback so we can detect CSRF. */
    authorizeUrl(state: string, redirectUri: string): string;

    /** Exchange an authorization code for a token + profile. Returns the
     *  normalized profile — token lifecycle is internal to the provider. */
    exchangeCodeForProfile(code: string, redirectUri: string): Promise<ProviderProfile>;
}

export class ProviderConfigError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ProviderConfigError";
    }
}
