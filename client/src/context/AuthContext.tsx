import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { authApi } from '../api/client';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isMasterAdmin: boolean;
  isCollegeMember: boolean;
  isCampusExecutive: boolean;
  userCollege?: string;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('upvolt_token'));
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('upvolt_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const verifyAuth = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const res = await authApi.getMe();
        if (res.success && res.user) {
          setUser(res.user);
          localStorage.setItem('upvolt_user', JSON.stringify(res.user));
        }
      } catch (err) {
        logout();
      } finally {
        setIsLoading(false);
      }
    };

    verifyAuth();

    const handleUnauthorized = () => {
      logout();
    };
    window.addEventListener('upvolt_unauthorized', handleUnauthorized);
    return () => window.removeEventListener('upvolt_unauthorized', handleUnauthorized);
  }, [token]);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('upvolt_token', newToken);
    localStorage.setItem('upvolt_user', JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('upvolt_token');
    localStorage.removeItem('upvolt_user');
  };

  const refreshUser = async () => {
    try {
      const res = await authApi.getMe();
      if (res.success && res.user) {
        setUser(res.user);
        localStorage.setItem('upvolt_user', JSON.stringify(res.user));
      }
    } catch (err) {
      console.error('Failed to refresh user profile', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isMasterAdmin: user?.role === 'MASTER_ADMIN',
        isCollegeMember: user?.role === 'COLLEGE_MEMBER',
        isCampusExecutive: user?.role === 'CAMPUS_EXECUTIVE',
        userCollege: user?.college,
        isLoading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
