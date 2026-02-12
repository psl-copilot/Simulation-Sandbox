export interface JwtPayloadWithClaims {
  claims?: string[];
}
export interface JWTPayload {
  tenantId?: string;
  [key: string]: unknown;
}
