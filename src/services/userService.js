import AxiosUtils from "../utils/AxiosUtils";

export const CMS_USERS_BASE = "/cms-users";

// ── GET /cms-users ─────────────────────────────────────────
// page: 0-based, size: max 100
export async function listUsers({ page = 0, size = 20 } = {}) {
  const res = await AxiosUtils.get(CMS_USERS_BASE, { params: { page, size } });
  return res.data.data; // { items, page, size, totalItems, totalPages, hasNext }
}

// ── GET /cms-users/{id} ────────────────────────────────────
export async function getUser(id) {
  const res = await AxiosUtils.get(`${CMS_USERS_BASE}/${id}`);
  return res.data.data;
}

// ── POST /cms-users ────────────────────────────────────────
export async function createUser({ email, fullName, password }) {
  const res = await AxiosUtils.post(CMS_USERS_BASE, { email, fullName, password });
  return res.data.data;
}

// ── POST /cms-users/invite ─────────────────────────────────
export async function inviteUser({ email, fullName }) {
  const res = await AxiosUtils.post(`${CMS_USERS_BASE}/invite`, { email, fullName });
  return res.data.data;
}

// ── PUT /cms-users/{id} ────────────────────────────────────
export async function updateUser(id, { fullName }) {
  const res = await AxiosUtils.put(`${CMS_USERS_BASE}/${id}`, { fullName });
  return res.data.data;
}

// ── DELETE /cms-users/{id} ─────────────────────────────────
export async function deleteUser(id) {
  await AxiosUtils.delete(`${CMS_USERS_BASE}/${id}`);
}

// ── POST /cms-users/{id}/revive ────────────────────────────
export async function reviveUser(id) {
  const res = await AxiosUtils.post(`${CMS_USERS_BASE}/${id}/revive`);
  return res.data.data;
}

// ── GET /cms-users/{userId}/roles ──────────────────────────
export async function getUserRoles(userId) {
  const res = await AxiosUtils.get(`${CMS_USERS_BASE}/${userId}/roles`);
  return res.data.data;
}

// ── POST /cms-users/{userId}/roles ─────────────────────────
export async function assignRole(userId, roleId) {
  await AxiosUtils.post(`${CMS_USERS_BASE}/${userId}/roles`, { roleId });
}

// ── DELETE /cms-users/{userId}/roles/{roleId} ──────────────
export async function revokeRole(userId, roleId) {
  await AxiosUtils.delete(`${CMS_USERS_BASE}/${userId}/roles/${roleId}`);
}
