import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiService } from '../services/api';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'driver' | 'admin';
  vehicleModel: string;
  licensePlate: string;
}

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  login: (email: string, pass: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (name: string, email: string, pass: string) => Promise<void>;
  logout: () => void;
  updateProfile: (updated: Partial<UserProfile>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_USER: UserProfile = {
  id: 'usr_nv_9921',
  name: 'Alex Mercer',
  email: 'alex.mercer@nightvision.ai',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250',
  role: 'driver',
  vehicleModel: 'Lumina EV GT-9',
  licensePlate: 'NV-882-AI',
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('nv_user');
    return saved ? JSON.parse(saved) : DEMO_USER;
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem('nv_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('nv_user');
    }
  }, [user]);

  const login = async (email: string, pass: string) => {
    const res = await apiService.login(email, pass);
    if (res && res.user) {
      setUser({
        ...DEMO_USER,
        ...res.user,
        email: res.user.email || email,
        name: res.user.name || email.split('@')[0].toUpperCase(),
      });
    } else {
      const newUser: UserProfile = {
        ...DEMO_USER,
        email,
        name: email.split('@')[0].toUpperCase(),
      };
      setUser(newUser);
    }
  };

  const loginWithGoogle = async () => {
    setUser(DEMO_USER);
  };

  const register = async (name: string, email: string, pass: string) => {
    const res = await apiService.register(name, email, pass);
    if (res && res.user) {
      setUser({
        ...DEMO_USER,
        ...res.user,
        name: res.user.name || name,
        email: res.user.email || email,
      });
    } else {
      const newUser: UserProfile = {
        ...DEMO_USER,
        name,
        email,
      };
      setUser(newUser);
    }
  };

  const logout = () => {
    setUser(null);
  };

  const updateProfile = (updated: Partial<UserProfile>) => {
    if (user) {
      setUser({ ...user, ...updated });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        loginWithGoogle,
        register,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
