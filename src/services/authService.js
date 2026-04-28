import AxiosUtils, { setActiveOrg, clearActiveOrg } from "../utils/AxiosUtils";

// ── Response shape from every auth endpoint ────────────────
// { success: boolean, data: T | null, message: string | null, errorCode: string | null }

// ── POST /auth/login/password ──────────────────────────────
// Sends email + password.
// Server sets HttpOnly access_token + refresh_token cookies — never touch them from JS.
// On success: call setActiveOrg() so every subsequent request carries X-ORG-ID.
export async function loginWithPassword(email, password) {
  const res = await AxiosUtils.post("/auth/login/password", { email, password });
  const data = res.data.data;
  // Single-org users: currentOrgId is set. Super admins: null — show org picker.
  const activeOrg = data.orgs?.find((o) => o.id === data.currentOrgId) ?? data.orgs?.[0] ?? null;
  if (activeOrg) setActiveOrg(activeOrg.id);
  return { data, activeOrg };
}

// ── POST /auth/login/otp ───────────────────────────────────
// Passwordless — OTP must be sent first via sendOtp().
export async function loginWithOtp(email, otp) {
  const res = await AxiosUtils.post("/auth/login/otp", { email, otp });
  const data = res.data.data;
  const activeOrg = data.orgs?.find((o) => o.id === data.currentOrgId) ?? data.orgs?.[0] ?? null;
  if (activeOrg) setActiveOrg(activeOrg.id);
  return { data, activeOrg };
}

// ── POST /auth/otp/send ────────────────────────────────────
// purpose: "LOGIN" | "FORGOT_PASSWORD" | "INVITE"
export async function sendOtp(email, purpose) {
  await AxiosUtils.post("/auth/otp/send", { email, purpose });
}

// ── POST /auth/otp/verify ──────────────────────────────────
// purpose: "FORGOT_PASSWORD" | "INVITE" — returns a short-lived verifyToken (not a cookie).
export async function verifyOtp(email, otp, purpose) {
  const res = await AxiosUtils.post("/auth/otp/verify", { email, otp, purpose });
  return res.data.data.verifyToken;
}

// ── POST /auth/forgot-password ─────────────────────────────
// Always returns 200 — no enumeration of whether email exists.
export async function forgotPassword(email) {
  await AxiosUtils.post("/auth/forgot-password", { email });
}

// ── POST /auth/reset-password ──────────────────────────────
// Uses verifyToken from verifyOtp(). Kills all existing sessions.
export async function resetPassword(verifyToken, newPassword) {
  await AxiosUtils.post("/auth/reset-password", { verifyToken, newPassword });
}

// ── POST /auth/invite/accept ───────────────────────────────
// Verifies the invite OTP, sets a password, activates the account, and issues a session.
export async function acceptInvite(email, otp, password) {
  const res = await AxiosUtils.post("/auth/invite/accept", { email, otp, password });
  const data = res.data.data;
  const activeOrg = data.orgs?.find((o) => o.id === data.currentOrgId) ?? data.orgs?.[0] ?? null;
  if (activeOrg) setActiveOrg(activeOrg.id);
  return { data, activeOrg };
}

// ── POST /auth/logout ──────────────────────────────────────
// Server clears both cookies via Set-Cookie Max-Age=0.
// Always succeeds — even if cookies are already gone.
export async function logout() {
  try {
    await AxiosUtils.post("/auth/logout");
  } finally {
    clearActiveOrg();
  }
}
