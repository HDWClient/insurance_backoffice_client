import AnonAxios from "../utils/AnonAxios";

export async function sendOtp(token) {
  const res = await AnonAxios.post("/verify/otp/send", { token });
  return res.data?.data;
}

export async function confirmOtp(token, otp) {
  const res = await AnonAxios.post("/verify/otp/confirm", { token, otp });
  return res.data?.data;
}

export async function promote(token) {
  const res = await AnonAxios.post("/verify/promote", { token });
  return res.data?.data;
}

export async function reject(token, reason) {
  const body = { token };
  if (reason?.trim()) body.reason = reason.trim();
  const res = await AnonAxios.post("/verify/reject", body);
  return res.data?.data;
}
