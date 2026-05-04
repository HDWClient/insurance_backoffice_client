import AxiosUtils from "../utils/AxiosUtils";

export async function sendOtp(token) {
  const res = await AxiosUtils.post("/verify/otp/send", { token });
  return res.data?.data;
}

export async function confirmOtp(token, otp) {
  const res = await AxiosUtils.post("/verify/otp/confirm", { token, otp });
  return res.data?.data;
}
