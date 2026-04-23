// Provider registry. Adding a new provider (GitHub, Apple, etc.):
//   1. Implement AuthProvider in a sibling file.
//   2. Instantiate it here conditionally on its env vars.
//   3. Register it in `registerProviders()`.
//
// Routes look providers up by `name`, so no route/middleware changes needed.
import { AuthProvider } from "./provider";
import { DevAuthProvider } from "./dev";
import { GoogleProvider } from "./google";

const registry = new Map<string, AuthProvider>();

/** Triple-gated: NODE_ENV must be development, the flag must be explicitly
 *  on, and we must not be running inside an ECS/Fargate task (which always
 *  sets AWS_EXECUTION_ENV). Any one of these failing → dev provider is
 *  invisible. Fail-closed by design: if something ever misconfigures a
 *  deployed env with NODE_ENV=development, the AWS_EXECUTION_ENV check
 *  still blocks registration. */
function shouldRegisterDevProvider(): boolean {
    return (
        process.env.NODE_ENV === "development" &&
        process.env.DEV_AUTH_ENABLED === "true" &&
        !process.env.AWS_EXECUTION_ENV
    );
}

export function registerProviders(): void {
    const googleId = process.env.GOOGLE_CLIENT_ID;
    const googleSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (googleId && googleSecret) {
        registry.set("google", new GoogleProvider(googleId, googleSecret));
    } else {
        console.warn("[auth] Google OAuth not configured (GOOGLE_CLIENT_ID/SECRET missing)");
    }

    if (shouldRegisterDevProvider()) {
        registry.set("dev", new DevAuthProvider());
        console.warn(
            "[auth] DEV provider registered — local development only. " +
            "This would be a security hole in a deployed environment; it's blocked by " +
            "env-variable checks in providers/index.ts.",
        );
    }
}

export function getProvider(name: string): AuthProvider | undefined {
    return registry.get(name);
}

export function enabledProviders(): string[] {
    return Array.from(registry.keys());
}
