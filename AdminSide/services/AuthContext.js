import React, { createContext, useContext } from "react";

const AuthContext = createContext(null);

export const AuthProvider = ({ user, appUser, role, children }) => {
  return (
    <AuthContext.Provider value={{ user, appUser, role }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
