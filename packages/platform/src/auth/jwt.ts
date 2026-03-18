import { SignJWT, jwtVerify } from "jose"

export type JwtPayload = {
  sub: string
  roles: string[]
  depts: string[]
  level: string
}

function secret(raw: string) {
  return new TextEncoder().encode(raw)
}

export async function sign(payload: JwtPayload, key: string, expiry: string): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiry)
    .setIssuer("opencode-enterprise")
    .sign(secret(key))
}

export async function verify(token: string, key: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, secret(key), {
    issuer: "opencode-enterprise",
  })
  return payload as unknown as JwtPayload
}

export async function refresh(token: string, key: string, expiry: string): Promise<string> {
  const payload = await verify(token, key)
  return sign(payload, key, expiry)
}
