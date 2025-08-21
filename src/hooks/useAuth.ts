import { useState, useEffect, createContext, useContext } from "react";
import { authAPI, removeAuthToken, getAuthToken } from "@/lib/api";
import { User } from "@/types";
import dotenv from 'dotenv';
dotenv.config();

const API_BASE_URL = process.env.API_BASE_URL;

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const useAuthProvider = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const token = getAuthToken();
    const storedUser = localStorage.getItem("user");

    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
      // Optionally refresh from API:
      fetchUser();
    } else {
      setIsLoading(false);
      setAuthChecked(true);
    }
  }, []);

  const fetchUser = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/users/me`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        localStorage.setItem("user", JSON.stringify(data.user));
      } else {
        removeAuthToken();
        localStorage.removeItem("user");
      }
    } catch (err) {
      removeAuthToken();
      localStorage.removeItem("user");
    } finally {
      setIsLoading(false);
      setAuthChecked(true);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await authAPI.login(email, password);

      // Persist token right away
      localStorage.setItem("accessToken", response.accessToken);

      // Update context state
      setUser(response.user);

      // Return so caller can use it directly if needed
      return { accessToken: response.accessToken, user: response.user };
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  };

  const register = async (name: string, email: string, password: string) => {
    try {
      const response = await authAPI.register(name, email, password);

      // Persist the token immediately
      localStorage.setItem("accessToken", response.accessToken);
      setUser(response.user);

      // Return so caller can also use them if needed
      return { accessToken: response.accessToken, user: response.user };
    } catch (error) {
      console.error("Registration failed:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setUser(null);
    }
  };

  return {
    user,
    isLoading,
    login,
    register,
    logout,
    isAuthenticated: !!user,
    authChecked
  };
};

export { AuthContext };
