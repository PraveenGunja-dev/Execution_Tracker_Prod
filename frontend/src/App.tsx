import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ReactQueryProvider from './components/ReactQueryProvider';
import { AuthProvider } from './context/AuthContext';
import ApplicationPage from './components/ApplicationPage';
import LoginPage from './components/LoginPage';
import HomePage from './components/HomePage';

export default function App() {
    // Explicitly set basename for production subpath
    const isProd = !window.location.hostname.includes("localhost") && !window.location.hostname.includes("127.0.0.1");
    const basename = isProd ? "/execution-tracker" : "";

    return (
        <BrowserRouter basename={basename}>
            <ReactQueryProvider>
                <AuthProvider>
                    <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/application" element={<ApplicationPage />} />
                        <Route path="/login" element={<LoginPage />} />
                        {/* Catch-all */}
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </AuthProvider>
            </ReactQueryProvider>
        </BrowserRouter>
    );
}
