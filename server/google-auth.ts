export type GoogleProfile = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture: string;
};

type GoogleTokenResponse = {
  id_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleTokenInfoResponse = {
  aud?: string;
  sub?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  picture?: string;
  error?: string;
  error_description?: string;
};

export function getGoogleClientConfig() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  };
}

export function isGoogleAuthConfigured(): boolean {
  const { clientId, clientSecret } = getGoogleClientConfig();
  return !!(clientId && clientSecret);
}

export function getGoogleRedirectUri(): string {
  if (process.env.GOOGLE_OAUTH_REDIRECT_URL) {
    return process.env.GOOGLE_OAUTH_REDIRECT_URL;
  }
  const appUrl = process.env.APP_URL || "http://localhost:5000";
  return new URL("/api/auth/google/callback", appUrl).toString();
}

export function getGooglePostLoginRedirect(): string {
  return "/dashboard";
}

export function getGoogleFailureRedirect(_reason: "state" | "failed"): string {
  return "/login";
}

export function buildGoogleAuthorizationUrl(state: string): string {
  const { clientId } = getGoogleClientConfig();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", getGoogleRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export function generateGoogleUsernameBase(email: string, name: string): string {
  const rawBase = (name || email.split("@")[0] || "player")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
  return rawBase || "player";
}

export async function exchangeGoogleCodeForProfile(code: string): Promise<GoogleProfile> {
  const { clientId, clientSecret } = getGoogleClientConfig();
  if (!clientId || !clientSecret) {
    throw new Error("Google auth is not configured.");
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: getGoogleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });

  const tokenPayload = await tokenResponse.json() as GoogleTokenResponse;
  if (!tokenResponse.ok || !tokenPayload.id_token) {
    const detail = tokenPayload.error_description || tokenPayload.error || "Google token exchange failed.";
    throw new Error(detail);
  }

  const tokenInfoResponse = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokenPayload.id_token)}`,
  );
  const tokenInfo = await tokenInfoResponse.json() as GoogleTokenInfoResponse;
  if (!tokenInfoResponse.ok || tokenInfo.error) {
    throw new Error(tokenInfo.error_description || tokenInfo.error || "Google token verification failed.");
  }

  if (tokenInfo.aud !== clientId) {
    throw new Error("Google token audience did not match this application.");
  }

  const emailVerified = tokenInfo.email_verified === true || tokenInfo.email_verified === "true";
  if (!tokenInfo.sub || !tokenInfo.email || !emailVerified) {
    throw new Error("Google account email must be verified.");
  }

  return {
    sub: tokenInfo.sub,
    email: tokenInfo.email.toLowerCase(),
    emailVerified,
    name: tokenInfo.name || tokenInfo.email.split("@")[0],
    picture: tokenInfo.picture || "",
  };
}
