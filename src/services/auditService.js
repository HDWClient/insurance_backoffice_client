import AxiosUtils from "../utils/AxiosUtils";

export async function listAuditLogs({ page = 0, size = 20, module: mod, action, actorId, from, to } = {}) {
  const params = { page, size };
  if (mod)     params.module   = mod;
  if (action)  params.action   = action;
  if (actorId) params.actorId  = actorId;
  if (from)    params.from     = from;
  if (to)      params.to       = to;
  const res = await AxiosUtils.get("/audit", { params });
  // Handle backends that return 200 with success:false instead of a non-2xx status
  if (res.data?.success === false) {
    const err = new Error(res.data.message ?? "Request failed");
    err.response = { status: 200, data: res.data };
    throw err;
  }
  return res.data.data;
}
