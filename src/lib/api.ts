// src/lib/api.ts
import axios from "axios";

const api = axios.create({
  baseURL: "",              // ✅ baseURL 비움 (항상 절대경로로 호출)
  withCredentials: true,
});

api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem("token");
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

export default api;
