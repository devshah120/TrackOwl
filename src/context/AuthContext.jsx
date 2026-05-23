import { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = getAuthToken();
        console.log('🔍 Checking auth on mount, token exists:', !!token);
        if (token) {
          try {
            console.log('🔐 Token found, calling verify endpoint...');
            const response = await auth.verifyToken();
            console.log('✅ Token verified:', response);
            setUser(response.user);
            setIsAuthenticated(true);
            setError(null);
          } catch (err) {
            console.error('❌ Token verification failed:', err);
            clearAuthToken();
            setUser(null);
            setIsAuthenticated(false);
            setError(err.message);
          }
        } else {
          console.log('⚠️ No token found on mount');
          setIsAuthenticated(false);
        }
      } finally {
        setIsLoading(false);
        setIsInitialized(true);
      }
    };
    checkAuth();
  }, []);

  const verifyToken = useCallback(async () => {
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
  }, []);

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
    isInitialized,
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
