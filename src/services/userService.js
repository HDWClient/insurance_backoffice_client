import AxiosUtils from "../utils/AxiosUtils";

// ── GET /users ─────────────────────────────────────────────
// page: 0-based, size: max 100
export async function listUsers({ page = 0, size = 20 } = {}) {
  const res = await AxiosUtils.get("/users", { params: { page, size } });
  return res.data.data; // { items, page, size, totalItems, totalPages, hasNext }
}

// ── GET /users/{id} ────────────────────────────────────────
export async function getUser(id) {
  const res = await AxiosUtils.get(`/users/${id}`);
  return res.data.data;
}

// ── POST /users ────────────────────────────────────────────
// Creates an active user with a known password
export async function createUser({ email, fullName, password }) {
  const res = await AxiosUtils.post("/users", { email, fullName, password });
  return res.data.data;
}

// ── POST /users/invite ─────────────────────────────────────
// Creates a pending_verification user and sends an invite OTP
export async function inviteUser({ email, fullName }) {
  const res = await AxiosUtils.post("/users/invite", { email, fullName });
  return res.data.data;
}

// ── PUT /users/{id} ────────────────────────────────────────
export async function updateUser(id, { fullName }) {
  const res = await AxiosUtils.put(`/users/${id}`, { fullName });
  return res.data.data;
}

// ── DELETE /users/{id} ─────────────────────────────────────
// Soft-delete — status becomes inactive
export async function deleteUser(id) {
  await AxiosUtils.delete(`/users/${id}`);
}

// ── POST /users/{id}/revive ────────────────────────────────
// Reactivates an inactive user
export async function reviveUser(id) {
  const res = await AxiosUtils.post(`/users/${id}/revive`);
  return res.data.data;
}

// ── GET /users/{userId}/roles ──────────────────────────────
export async function getUserRoles(userId) {
  const res = await AxiosUtils.get(`/users/${userId}/roles`);
  return res.data.data;
}

// ── POST /users/{userId}/roles ─────────────────────────────
export async function assignRole(userId, roleId) {
  await AxiosUtils.post(`/users/${userId}/roles`, { roleId });
}

// ── DELETE /users/{userId}/roles/{roleId} ──────────────────
export async function revokeRole(userId, roleId) {
  await AxiosUtils.delete(`/users/${userId}/roles/${roleId}`);
}
