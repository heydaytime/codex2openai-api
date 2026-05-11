import { createRemoteJWKSet, jwtVerify } from "jose";

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? "";

const JWKS = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
  )
);

export interface AuthUser {
  uid: string;
  email: string;
  name?: string;
  picture?: string;
  provider?: string;
}

export async function verifyFirebaseToken(
  token: string
): Promise<AuthUser | null> {
  if (!FIREBASE_PROJECT_ID) {
    throw new Error("FIREBASE_PROJECT_ID is not configured");
  }

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    });

    if (!payload.sub || !payload.email) return null;

    const firebase = payload.firebase as
      | { sign_in_provider?: string }
      | undefined;

    return {
      uid: payload.sub,
      email: payload.email as string,
      name: (payload.name as string) ?? undefined,
      picture: (payload.picture as string) ?? undefined,
      provider: firebase?.sign_in_provider ?? undefined,
    };
  } catch {
    return null;
  }
}

export function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7);
}
