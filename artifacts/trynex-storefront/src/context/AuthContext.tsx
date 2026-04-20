import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { getApiBaseUrl } from "@/lib/utils";

interface CustomerProfile {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  isGuest?: boolean;
}

interface AuthContextType {
  customer: CustomerProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: { name: string; email: string; phone?: string; password: string }) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: (credential: string) => Promise<{ success: boolean; error?: string }>;
  loginWithFacebook: (accessToken: string) => Promise<{ success: boolean; error?: string }>;
  loginAsGuest: (info?: { name?: string; phone?: string }) => Promise<{ success: boolean; error?: string }>;
  updateProfile: (data: { name?: string; phone?: string }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function getApiUrl(path: string): string {
  return `${getApiBaseUrl()}/api${path}`;
}

async function safeJsonParse(resp: Response): Promise<Record<string, unknown>> {
  const text = await resp.text();
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.includes("Cannot") ? "Server is updating. Please try again in a minute." : "Unexpected server response" };
  }
}

async function apiPost(url: string, body: Record<string, unknown>, extraHeaders?: Record<string, string>): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...extraHeaders },
    body: JSON.stringify(body),
  });
  const data = await safeJsonParse(resp);
  return { ok: resp.ok, data };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const getToken = () => localStorage.getItem("trynex_customer_token");
  const setToken = (token: string) => localStorage.setItem("trynex_customer_token", token);
  const clearToken = () => localStorage.removeItem("trynex_customer_token");

  const fetchMe = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      const resp = await fetch(getApiUrl("/auth/me"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await safeJsonParse(resp);
        if (data.customer) setCustomer(data.customer as CustomerProfile);
        else { clearToken(); setCustomer(null); }
      } else {
        clearToken();
        setCustomer(null);
      }
    } catch {
      setCustomer(null);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const login = async (email: string, password: string) => {
    try {
      const { ok, data } = await apiPost(getApiUrl("/auth/login"), { email, password });
      if (!ok) return { success: false, error: (data.message as string) || "Login failed" };
      setToken(data.token as string);
      setCustomer(data.customer as CustomerProfile);
      return { success: true };
    } catch {
      return { success: false, error: "Could not connect to server. Please check your internet and try again." };
    }
  };

  const register = async (info: { name: string; email: string; phone?: string; password: string }) => {
    try {
      const { ok, data } = await apiPost(getApiUrl("/auth/register"), info as unknown as Record<string, unknown>);
      if (!ok) return { success: false, error: (data.message as string) || "Registration failed" };
      setToken(data.token as string);
      setCustomer(data.customer as CustomerProfile);
      return { success: true };
    } catch {
      return { success: false, error: "Could not connect to server. Please check your internet and try again." };
    }
  };

  const loginWithGoogle = async (credential: string) => {
    try {
      const { ok, data } = await apiPost(getApiUrl("/auth/google"), { credential });
      if (!ok) return { success: false, error: (data.message as string) || "Google login failed" };
      setToken(data.token as string);
      setCustomer(data.customer as CustomerProfile);
      return { success: true };
    } catch {
      return { success: false, error: "Could not connect to server. Please check your internet and try again." };
    }
  };

  const loginWithFacebook = async (accessToken: string) => {
    try {
      const { ok, data } = await apiPost(getApiUrl("/auth/facebook"), { accessToken });
      if (!ok) return { success: false, error: (data.message as string) || "Facebook login failed" };
      setToken(data.token as string);
      setCustomer(data.customer as CustomerProfile);
      return { success: true };
    } catch {
      return { success: false, error: "Could not connect to server. Please check your internet and try again." };
    }
  };

  const loginAsGuest = async (info?: { name?: string; phone?: string }) => {
    try {
      const { ok, data } = await apiPost(getApiUrl("/auth/guest"), (info ?? {}) as Record<string, unknown>);
      if (!ok) return { success: false, error: (data.message as string) || "Guest sign-in failed" };
      setToken(data.token as string);
      const c = data.customer as CustomerProfile;
      setCustomer({ ...c, isGuest: true });
      return { success: true };
    } catch {
      return { success: false, error: "Could not connect to server. Please check your internet and try again." };
    }
  };

  const updateProfile = async (profileData: { name?: string; phone?: string }) => {
    const token = getToken();
    if (!token) return { success: false, error: "Not authenticated" };
    try {
      const resp = await fetch(getApiUrl("/auth/profile"), {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(profileData),
      });
      const result = await safeJsonParse(resp);
      if (!resp.ok) return { success: false, error: (result.message as string) || "Update failed" };
      setCustomer(result.customer as CustomerProfile);
      return { success: true };
    } catch {
      return { success: false, error: "Could not connect to server" };
    }
  };

  const logout = async () => {
    const token = getToken();
    try {
      await fetch(getApiUrl("/auth/logout"), {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {}
    clearToken();
    setCustomer(null);
  };

  return (
    <AuthContext.Provider value={{
      customer,
      isLoading,
      isAuthenticated: !!customer,
      login,
      register,
      loginWithGoogle,
      loginWithFacebook,
      loginAsGuest,
      updateProfile,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
