import AxiosUtils from "../utils/AxiosUtils";

// ── GET /permissions ───────────────────────────────────────
// All system permission codes — use id values when assigning to roles
export async function listPermissions() {
  const res = await AxiosUtils.get("/permissions");
  return res.data.data; // [{ id, code, module, action }]
}

// ── GET /roles ─────────────────────────────────────────────
// All roles (system + custom) in the current org
export async function listRoles() {
  const res = await AxiosUtils.get("/roles");
  return res.data.data;
}

// ── POST /roles ────────────────────────────────────────────
// Create a custom role (starts with no permissions)
export async function createRole(name) {
  const res = await AxiosUtils.post("/roles", { name });
  return res.data.data;
}

// ── PUT /roles/{id} ────────────────────────────────────────
// Rename a custom role — system roles cannot be renamed
export async function renameRole(id, name) {
  const res = await AxiosUtils.put(`/roles/${id}`, { name });
  return res.data.data;
}

// ── DELETE /roles/{id} ─────────────────────────────────────
// Delete a custom role — must have no active user assignments
export async function deleteRole(id) {
  await AxiosUtils.delete(`/roles/${id}`);
}

// ── GET /roles/{id}/cms-users ─────────────────────────────
// Returns list of cms-users assigned to this role
export async function getRoleUsers(roleId) {
  const res = await AxiosUtils.get(`/roles/${roleId}/cms-users`);
  return res.data.data;
}

// ── DELETE /roles/{id}/cms-users ──────────────────────────
// Bulk-revoke all assignments in one shot: { userIds: [...] }
export async function bulkRevokeRoleUsers(roleId, userIds) {
  const res = await AxiosUtils.delete(`/roles/${roleId}/cms-users`, { data: { userIds } });
  return res.data.data;
}

// ── POST /roles/{id}/permissions ───────────────────────────
export async function addPermissionToRole(roleId, permissionId) {
  const res = await AxiosUtils.post(`/roles/${roleId}/permissions`, { permissionId });
  return res.data.data;
}

// ── DELETE /roles/{id}/permissions/{permId} ─────────────────
export async function removePermissionFromRole(roleId, permId) {
  const res = await AxiosUtils.delete(`/roles/${roleId}/permissions/${permId}`);
  return res.data.data;
}
