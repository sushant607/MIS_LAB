import { useState, useEffect } from 'react';
import { apiService } from '@/services/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    const initializeAuth = () => {
      const token = localStorage.getItem('auth_token');
      const userId = localStorage.getItem('user_id');
      const userName = localStorage.getItem('user_name');
      const userEmail = localStorage.getItem('user_email');
      const userRole = localStorage.getItem('user_role');
      const userDepartment = localStorage.getItem('user_department');

      if (token && userId && userName && userEmail && userRole && userDepartment) {
        setAuthState({
          user: {
            id: userId,
            name: userName,
            email: userEmail,
            role: userRole,
            department: userDepartment,
          },
          token,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        setAuthState(prev => ({
          ...prev,
          isLoading: false,
        }));
      }
    };

    initializeAuth();
  }, []);

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_name');
    localStorage.removeItem('user_email');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_department');
    
    setAuthState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
  };

  const checkConnection = async (): Promise<boolean> => {
    try {
      await apiService.healthCheck();
      return true;
    } catch (error) {
      console.error('Backend connection failed:', error);
      return false;
    }
  };

  return {
    ...authState,
    logout,
    checkConnection,
  };
};
