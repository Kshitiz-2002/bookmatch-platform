import React from "react";
import { AuthContext, useAuthProvider } from "@/hooks/useAuth";

interface AuthProviderProps {
  children: React.ReactNode;
}

const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const auth = useAuthProvider();

  if (!auth.authChecked) {
    return <div>Loading...</div>; // Or your spinner component
  }

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
};

export default AuthProvider;
