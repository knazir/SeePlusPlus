// Google OAuth 2.0 provider. Implements the authorization-code flow against
// Google's OpenID Connect endpoints. Standard, well-documented flow — see
// https://developers.google.com/identity/protocols/oauth2/web-server.
//
// `sub` is Google's stable user ID (a numeric string). We treat it as the
// unique identifier within the "google" provider; emails change, subs don't.
import { AuthProvider, ProviderConfigError, ProviderProfile } from "./provider";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

interface GoogleTokenResponse {
    access_token: string;
    id_token?: string;
    token_type: string;
    expires_in: number;
}

interface GoogleUserInfo {
    sub: string;
    email: string;
    email_verified?: boolean;
    name?: string;
    given_name?: string;
    picture?: string;
}

export class GoogleProvider implements AuthProvider {
    readonly name = "google";

    constructor(
        private readonly clientId: string,
        private readonly clientSecret: string,
    ) {
        if (!clientId) throw new ProviderConfigError("GOOGLE_CLIENT_ID not set");
        if (!clientSecret) throw new ProviderConfigError("GOOGLE_CLIENT_SECRET not set");
    }

    authorizeUrl(state: string, redirectUri: string): string {
        const params = new URLSearchParams({
            client_id: this.clientId,
            redirect_uri: redirectUri,
            response_type: "code",
            scope: "openid email profile",
            state,
            // Force account chooser so users can switch accounts. Without
            // this, repeat clicks silently re-authorize the last account.
            prompt: "select_account",
        });
        return `${GOOGLE_AUTH_URL}?${params.toString()}`;
    }

    async exchangeCodeForProfile(
        code: string,
        redirectUri: string,
    ): Promise<ProviderProfile> {
        const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                code,
                client_id: this.clientId,
                client_secret: this.clientSecret,
                redirect_uri: redirectUri,
                grant_type: "authorization_code",
            }),
        });
        if (!tokenRes.ok) {
            const body = await tokenRes.text().catch(() => "");
            throw new Error(`Google token exchange failed (${tokenRes.status}): ${body}`);
        }
        const token = (await tokenRes.json()) as GoogleTokenResponse;

        const userRes = await fetch(GOOGLE_USERINFO_URL, {
            headers: { Authorization: `Bearer ${token.access_token}` },
        });
        if (!userRes.ok) {
            throw new Error(`Google userinfo fetch failed (${userRes.status})`);
        }
        const info = (await userRes.json()) as GoogleUserInfo;

        return {
            providerSub: info.sub,
            email: info.email,
            displayName: info.name || info.given_name || info.email,
            avatarUrl: info.picture,
        };
    }
}
