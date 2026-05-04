import AxiosUtils from "../utils/AxiosUtils";

export async function uploadBulkFile(file) {
  const form = new FormData();
  form.append("file", file);
  // Setting Content-Type to undefined lets the browser auto-set
  // multipart/form-data with the correct boundary. Never set it manually.
  const res = await AxiosUtils.post("/bulk/upload", form, {
    headers: { "Content-Type": undefined },
  });
  return res.data.data;
}

export async function listJobs({ status, page = 0, size = 50 } = {}) {
  const params = { page, size };
  if (status) params.status = status;
  const res = await AxiosUtils.get("/bulk", { params });
  return res.data.data;
}

export async function getJob(idOrJobNumber) {
  const res = await AxiosUtils.get(`/bulk/${idOrJobNumber}`);
  return res.data.data;
}

export async function getJobRows(idOrJobNumber, { status, page = 0, size = 20 } = {}) {
  const params = { page, size };
  if (status) params.status = status;
  const res = await AxiosUtils.get(`/bulk/${idOrJobNumber}/rows`, { params });
  return res.data.data;
}

export async function getJobErrors(idOrJobNumber) {
  const res = await AxiosUtils.get(`/bulk/${idOrJobNumber}/errors`);
  return res.data.data;
}

export async function resendInvite(idOrJobNumber, rowId) {
  const res = await AxiosUtils.post(`/bulk/${idOrJobNumber}/rows/${rowId}/resend-invite`);
  return res.data.data;
}
