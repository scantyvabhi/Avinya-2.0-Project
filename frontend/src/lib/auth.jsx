import React, { createContext, useContext, useEffect, useState } from "react";
import api from "./api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("pm_user") || "null");
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);

  const persist = (token, u) => {
    localStorage.setItem("pm_token", token);
    localStorage.setItem("pm_user", JSON.stringify(u));
    setUser(u);
  };

  const login = async (email, password) => {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      persist(data.token, data.user);
      return data.user;
    } finally {
      setLoading(false);
    }
  };

  const register = async (payload) => {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/register", payload);
      persist(data.token, data.user);
      return data.user;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("pm_token");
    localStorage.removeItem("pm_user");
    setUser(null);
  };

  useEffect(() => {
    const t = localStorage.getItem("pm_token");
    if (t && !user) {
      api.get("/auth/me").then(({ data }) => setUser(data)).catch(() => logout());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
