"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { API_BASE } from '../lib/config';

// ── 4 Roles ─────────────────────────────────────────────────────
// VIEWER      → read-only across all screens
// EDITOR      → can edit projects / master data
// ADMIN       → full project access + all views + admin console
// SUPER_ADMIN → CEO view (main dashboards only, no master data noise)
export type UserRole = 'VIEWER' | 'EDITOR' | 'ADMIN' | 'SUPER_ADMIN';

interface User {
    id?: number;
    username: string;
    email: string;
    role: UserRole;
    scope: string;
}

interface AuthContextType {
    user: User | null;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
    isLoading: boolean;
    isAuthenticated: boolean;
    // Convenience role helpers
    isViewer: boolean;
    isEditor: boolean;
    isAdmin: boolean;
    isSuperAdmin: boolean;
    canEdit: boolean;       // EDITOR, ADMIN, SUPER_ADMIN
    canAccessAdmin: boolean; // ADMIN, SUPER_ADMIN
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

    // ── On mount: restore from localStorage ──
    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            try {
                const parsed = JSON.parse(storedUser);
                // Normalize role
                if (parsed.role === 'USER') parsed.role = 'VIEWER';
                setUser(parsed);
            } catch {
                localStorage.removeItem('user');
            }
        }
        setIsLoading(false);
    }, []);

    // ── Traditional email/password login ─────────────────────────
    const login = async (email: string, password: string) => {
        const response = await fetch(`${API_BASE}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || data.detail || 'Login failed');
        }

        const userData: User = {
            id: data.user.id,
            username: data.user.username,
            email: data.user.email,
            role: ((data.user.role || 'VIEWER') === 'USER' ? 'VIEWER' : data.user.role).toUpperCase() as UserRole,
            scope: data.user.scope || 'all',
        };
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('token', data.access_token);
    };

    // ── Logout ───────────────────────────────────────────────────
    const logout = () => {
        setUser(null);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        navigate('/');
    };

    // ── Role helpers ─────────────────────────────────────────────
    const role = user?.role?.toUpperCase() as UserRole | undefined;

    return (
        <AuthContext.Provider value={{
            user,
            login,
            logout,
            isLoading,
            isAuthenticated: !!user,
            isViewer: role === 'VIEWER',
            isEditor: role === 'EDITOR',
            isAdmin: role === 'ADMIN' || role === 'SUPER_ADMIN',
            isSuperAdmin: role === 'SUPER_ADMIN',
            canEdit: role === 'EDITOR' || role === 'ADMIN' || role === 'SUPER_ADMIN',
            canAccessAdmin: role === 'ADMIN' || role === 'SUPER_ADMIN',
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
