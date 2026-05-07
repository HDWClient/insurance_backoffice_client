import axios from "axios";

// Anonymous axios instance for public /verify/* endpoints.
// No cookies, no X-ORG-ID, no auth interceptors — these endpoints are public.
const AnonAxios = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

export default AnonAxios;
