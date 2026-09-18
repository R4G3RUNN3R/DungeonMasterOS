const RESEND_EMAIL_API_URL = "https://api.resend.com/emails";
const PASSWORD_RESET_EMAIL_TIMEOUT_MS = 10_000;

export type PasswordResetEmailInput = {
  to: string;
  token: string;
  resetRecordId: number;
  expiresInMinutes: number;
};

function configuredValue(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^replace-with-/i.test(trimmed)) return null;
  if (trimmed.includes("your-domain.example")) return null;
  return trimmed;
}

function getPasswordResetEmailConfig() {
  const apiKey = configuredValue(process.env.RESEND_API_KEY);
  const from = configuredValue(process.env.PASSWORD_RESET_FROM_EMAIL);
  const appUrl = configuredValue(process.env.APP_URL);

  if (!apiKey || !from || !appUrl) return null;

  let baseUrl: URL;
  try {
    baseUrl = new URL(appUrl);
  } catch {
    return null;
  }

  if (
    process.env.NODE_ENV === "production" &&
    baseUrl.protocol !== "https:"
  ) {
    return null;
  }

  return { apiKey, from, baseUrl };
}

export function isPasswordResetEmailConfigured(): boolean {
  return getPasswordResetEmailConfig() !== null;
}

export function buildPasswordResetUrl(token: string): string {
  const config = getPasswordResetEmailConfig();
  if (!config) {
    throw new Error("Password reset email transport is not configured.");
  }

  const resetUrl = new URL(config.baseUrl.toString());
  resetUrl.pathname = "/";
  resetUrl.search = "";
  resetUrl.hash = `/reset-password?token=${encodeURIComponent(token)}`;
  return resetUrl.toString();
}

export async function sendPasswordResetEmail(
  input: PasswordResetEmailInput,
): Promise<void> {
  const config = getPasswordResetEmailConfig();
  if (!config) {
    throw new Error("Password reset email transport is not configured.");
  }

  const resetUrl = buildPasswordResetUrl(input.token);
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    PASSWORD_RESET_EMAIL_TIMEOUT_MS,
  );

  try {
    const response = await fetch(RESEND_EMAIL_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `password-reset/${input.resetRecordId}`,
      },
      body: JSON.stringify({
        from: config.from,
        to: [input.to],
        subject: "Reset your DungeonMasterOS password",
        text: [
          "A password reset was requested for your DungeonMasterOS account.",
          "",
          `Reset your password: ${resetUrl}`,
          "",
          `This link expires in ${input.expiresInMinutes} minutes and can be used once.`,
          "If you did not request this, you can ignore this email.",
        ].join("\n"),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `Password reset email provider rejected the request with status ${response.status}.`,
      );
    }
  } finally {
    clearTimeout(timeout);
  }
}
