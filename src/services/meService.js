import AxiosUtils from "../utils/AxiosUtils";

// ── GET /me/permissions ────────────────────────────────────
// Returns the permissions the calling user holds in the active org.
// Normalises both formats the API may return:
//   • string[]  → ["ROLE_MANAGE", "USER_READ", ...]
//   • object[]  → [{ id, code, module, action }, ...]
// Always returns [{ code, module, action }] so the dashboard can build
// tabs and gate UI without any extra parsing.
export async function getMyPermissions() {
  const res  = await AxiosUtils.get("/me/permissions");
  const data = res.data?.data;

  // Response format: { MODULE: [ACTION, ...] }
  // e.g. { "ROLE": ["MANAGE", "ASSIGN"], "ORG": ["READ", "UPDATE"], ... }
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const result = [];
    for (const [module, actions] of Object.entries(data)) {
      if (Array.isArray(actions)) {
        for (const action of actions) {
          result.push({ code: `${module}_${action}`, module, action });
        }
      }
    }
    return result;
  }

  return [];
}
