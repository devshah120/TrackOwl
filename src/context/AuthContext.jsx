import { createContext, useContext, useState, useEffect } from 'react';
import { auth, getAuthToken, setAuthToken, clearAuthToken } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      verifyToken();
    }
  }, []);

  const verifyToken = async () => {
    try {
      setIsLoading(true);
      const response = await auth.verifyToken();
      setUser(response.user);
      setIsAuthenticated(true);
      setError(null);
    } catch (err) {
      clearAuthToken();
      setUser(null);
      setIsAuthenticated(false);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await auth.login(email, password);
      setAuthToken(response.token);
      setUser(response.user);
      setIsAuthenticated(true);
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (payload) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await auth.register(payload);
      setAuthToken(response.token);
      setUser(response.user);
      setIsAuthenticated(true);
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    clearAuthToken();
    setUser(null);
    setIsAuthenticated(false);
    setError(null);
  };

  const value = {
    user,
    isLoading,
    error,
    isAuthenticated,
    login,
    register,
    logout,
    verifyToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
