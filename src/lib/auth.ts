const SESSION_COOKIE_NAME = "pb_commission_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Variável de ambiente obrigatória não definida: ${name}`);
  }

  return value;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function toBase64Url(value: string): string {
  return bytesToBase64(new TextEncoder().encode(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`;

  return new TextDecoder().decode(base64ToBytes(padded));
}

function signatureToBase64Url(signatureBuffer: ArrayBuffer): string {
  return bytesToBase64(new Uint8Array(signatureBuffer))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function signPayload(payloadBase64: string): Promise<string> {
  const secret = getRequiredEnv("AUTH_SESSION_SECRET");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadBase64));

  return signatureToBase64Url(signatureBuffer);
}

export async function createSessionToken(email: string): Promise<string> {
  const payloadBase64 = toBase64Url(
    JSON.stringify({
      email,
      exp: Date.now() + SESSION_TTL_SECONDS * 1000,
    }),
  );
  const signature = await signPayload(payloadBase64);

  return `${payloadBase64}.${signature}`;
}

export async function validateSessionToken(token?: string): Promise<boolean> {
  if (!token) {
    return false;
  }

  const [payloadBase64, signature] = token.split(".");

  if (!payloadBase64 || !signature) {
    return false;
  }

  const expectedSignature = await signPayload(payloadBase64);

  if (signature !== expectedSignature) {
    return false;
  }

  try {
    const payload = JSON.parse(fromBase64Url(payloadBase64)) as { email?: string; exp?: number };

    return Boolean(payload.email) && typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
  }
}

export function getAuthConfig() {
  return {
    email: getRequiredEnv("AUTH_EMAIL"),
    password: getRequiredEnv("AUTH_PASSWORD"),
  };
}

export function getSessionCookieName() {
  return SESSION_COOKIE_NAME;
}

export function getSessionTtlSeconds() {
  return SESSION_TTL_SECONDS;
}
