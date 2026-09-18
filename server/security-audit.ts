import {
  insertSecurityEventRecord,
  type SecurityEventRecord,
} from "./storage";

export type SecurityEventType =
  | "AUTH_REGISTER_SUCCESS"
  | "AUTH_LOGIN_SUCCESS"
  | "AUTH_LOGIN_FAILED"
  | "AUTH_GOOGLE_SUCCESS"
  | "AUTH_GOOGLE_FAILED"
  | "AUTH_LOGOUT"
  | "AUTH_SESSION_REVOKED"
  | "PASSWORD_CHANGED"
  | "PASSWORD_RESET"
  | "ACCESS_ROLE_CHANGED"
  | "ENTITLEMENTS_CHANGED"
  | "DUNGEON_MASTER_GRANTED"
  | "DUNGEON_MASTER_REVOKED";

export type SecurityEventMetadataValue =
  | string
  | number
  | boolean
  | null;

export type SecurityEventMetadata = Record<
  string,
  SecurityEventMetadataValue
>;

export type SecurityEventInput = {
  eventType: SecurityEventType;
  actorUserId?: number | null;
  subjectUserId?: number | null;
  metadata?: SecurityEventMetadata;
};

const FORBIDDEN_METADATA_KEY =
  /(password|passphrase|token|secret|cookie|authorization|api.?key|email)/i;
const MAX_METADATA_BYTES = 2_048;

export function encodeSecurityEventMetadata(
  metadata: SecurityEventMetadata = {},
): string {
  for (const key of Object.keys(metadata)) {
    if (FORBIDDEN_METADATA_KEY.test(key)) {
      throw new Error(`Sensitive security-event metadata key is not allowed: ${key}`);
    }
  }

  const encoded = JSON.stringify(metadata);
  if (Buffer.byteLength(encoded, "utf8") > MAX_METADATA_BYTES) {
    throw new Error("Security-event metadata exceeds the allowed size.");
  }

  return encoded;
}

export function recordSecurityEvent(
  input: SecurityEventInput,
): SecurityEventRecord {
  return insertSecurityEventRecord({
    actorUserId: input.actorUserId ?? null,
    subjectUserId: input.subjectUserId ?? null,
    eventType: input.eventType,
    metadata: encodeSecurityEventMetadata(input.metadata),
    createdAt: new Date().toISOString(),
  });
}

export function safeRecordSecurityEvent(input: SecurityEventInput): void {
  try {
    recordSecurityEvent(input);
  } catch (error) {
    console.error(
      `Security audit write failed for ${input.eventType}.`,
      error,
    );
  }
}
