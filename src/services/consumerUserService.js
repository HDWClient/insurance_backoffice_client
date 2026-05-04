import AxiosUtils from "../utils/AxiosUtils";

export async function listConsumerUsers({ search, status, uploadId, page = 0, size = 20 } = {}) {
  const params = { page, size };
  if (search)   params.search   = search;
  if (status)   params.status   = status;
  if (uploadId) params.uploadId = uploadId;
  const res = await AxiosUtils.get("/users", { params });
  return res.data.data;
}

export async function getConsumerUser(userProfileId) {
  const res = await AxiosUtils.get(`/users/${userProfileId}`);
  return res.data.data;
}

export async function getConsumerUserStats() {
  const res = await AxiosUtils.get("/users/stats");
  return res.data.data;
}

export async function updateConsumerUserStatus(userProfileId, { status, reason }) {
  const body = { status };
  if (reason) body.reason = reason;
  const res = await AxiosUtils.put(`/users/${userProfileId}/status`, body);
  return res.data.data;
}
