type FirebaseTokenPayload = {
  aud: string;
  auth_time?: number;
  email?: string;
  exp: number;
  iat: number;
  iss: string;
  name?: string;
  sub: string;
  user_id?: string;
  [key: string]: unknown;
};

type JsonWebKeySet = {
  keys: Array<JsonWebKey & { kid?: string }>;
};

let cachedKeys: { expiresAt: number; value: JsonWebKeySet } | null = null;

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
  claims: FirebaseTokenPayload;
};

export async function verifyFirebaseRequest(
  request: Request,
): Promise<AuthenticatedUser> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new AuthError("Authentication is required.", 401);
  }

  const token = authorization.slice("Bearer ".length);
  const segments = token.split(".");
  if (segments.length !== 3) {
    throw new AuthError("The authentication token is invalid.", 401);
  }

  const header = decodeJson<{ alg?: string; kid?: string }>(segments[0]);
  const payload = decodeJson<FirebaseTokenPayload>(segments[1]);
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!projectId) {
    throw new AuthError("Firebase project configuration is unavailable.", 500);
  }
  if (header.alg !== "RS256" || !header.kid) {
    throw new AuthError("The authentication token algorithm is invalid.", 401);
  }

  const now = Math.floor(Date.now() / 1000);
  if (
    payload.aud !== projectId ||
    payload.iss !== `https://securetoken.google.com/${projectId}` ||
    !payload.sub ||
    payload.exp <= now ||
    payload.iat > now + 60
  ) {
    throw new AuthError("The authentication token has expired or is invalid.", 401);
  }

  const keys = await getGoogleKeys();
  const jwk = keys.keys.find((item) => item.kid === header.kid);
  if (!jwk) {
    cachedKeys = null;
    throw new AuthError("The authentication signing key is unavailable.", 401);
  }

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const signature = decodeBase64Url(segments[2]);
  const signedContent = new TextEncoder().encode(
    `${segments[0]}.${segments[1]}`,
  );
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    signature.buffer as ArrayBuffer,
    signedContent.buffer as ArrayBuffer,
  );
  if (!valid) {
    throw new AuthError("The authentication token signature is invalid.", 401);
  }

  return {
    id: payload.user_id ?? payload.sub,
    email: payload.email ?? "",
    name: payload.name ?? payload.email ?? "KMM user",
    claims: payload,
  };
}

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

async function getGoogleKeys(): Promise<JsonWebKeySet> {
  if (cachedKeys && cachedKeys.expiresAt > Date.now()) return cachedKeys.value;

  const response = await fetch(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
    { cf: { cacheTtl: 3600, cacheEverything: true } } as RequestInit,
  );
  if (!response.ok) {
    throw new AuthError("Unable to validate the authentication token.", 503);
  }

  const value = (await response.json()) as JsonWebKeySet;
  const maxAge = Number(
    response.headers.get("cache-control")?.match(/max-age=(\d+)/)?.[1] ?? 3600,
  );
  cachedKeys = {
    value,
    expiresAt: Date.now() + Math.max(60, maxAge - 60) * 1000,
  };
  return value;
}

function decodeJson<T>(value: string): T {
  try {
    return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as T;
  } catch {
    throw new AuthError("The authentication token is malformed.", 401);
  }
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}
