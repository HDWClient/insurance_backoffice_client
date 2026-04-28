import AxiosUtils from "../utils/AxiosUtils";

// ── GET /orgs ──────────────────────────────────────────────
// Super admin: all orgs. Org user: their own org only.
export async function listOrgs() {
  const res = await AxiosUtils.get("/orgs");
  return res.data.data;
}

// ── GET /orgs/{id} ─────────────────────────────────────────
export async function getOrg(id) {
  const res = await AxiosUtils.get(`/orgs/${id}`);
  return res.data.data;
}

// ── POST /orgs ─────────────────────────────────────────────
// Super admin only. slug: lowercase alphanumeric + hyphens, 2-50 chars, immutable.
export async function createOrg({ name, slug }) {
  const res = await AxiosUtils.post("/orgs", { name, slug });
  return res.data.data;
}

// ── PUT /orgs/{id} ─────────────────────────────────────────
// Update org name only — slug is immutable
export async function updateOrg(id, { name }) {
  const res = await AxiosUtils.put(`/orgs/${id}`, { name });
  return res.data.data;
}

// ── POST /orgs/{id}/suspend ────────────────────────────────
// Sets status → inactive. Cannot suspend the default org.
export async function suspendOrg(id) {
  const res = await AxiosUtils.post(`/orgs/${id}/suspend`);
  return res.data.data;
}

// ── POST /orgs/{id}/activate ───────────────────────────────
// Reactivates a suspended org
export async function activateOrg(id) {
  const res = await AxiosUtils.post(`/orgs/${id}/activate`);
  return res.data.data;
}

// ── DELETE /orgs/{id} ──────────────────────────────────────
// Super admin only. Soft-delete — cannot delete the default org.
export async function deleteOrg(id) {
  await AxiosUtils.delete(`/orgs/${id}`);
}
