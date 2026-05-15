import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const api = axios.create({ baseURL: API });

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("pm_token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem("pm_token");
      localStorage.removeItem("pm_user");
      if (!window.location.pathname.startsWith("/login") &&
          !window.location.pathname.startsWith("/register") &&
          window.location.pathname !== "/") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

export default api;
