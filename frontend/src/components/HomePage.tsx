import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NeuralBackground } from './NeutralBackground';
import { motion } from 'framer-motion';
import { API_BASE } from '../lib/config';

const HomePage = () => {
    const [theme, setTheme] = useState('dark');
    const { user, login } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            setTheme(savedTheme);
        } else {
            setTheme('dark');
        }
    }, []);

    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [theme]);

    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
    };

    const handleEnter = () => {
        if (user) {
            // Already logged in — go straight to the app
            navigate('/application');
        } else {
            // Redirect to standard login page since SSO is disabled
            navigate('/login');
        }
    };

    return (
        <main className="relative flex flex-col items-center justify-center min-h-screen bg-white dark:bg-[#0c0c0c] transition-colors duration-300 font-sans overflow-hidden">
            <NeuralBackground theme={theme} />

            {/* Theme Toggle Button */}
            <div className="fixed top-8 right-8 z-50">
                <button
                    onClick={toggleTheme}
                    className="p-3.5 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-md shadow-2xl border border-gray-100 dark:border-gray-700 hover:scale-110 hover:shadow-blue-500/20 transition-all active:scale-95 text-gray-800 dark:text-gray-200 cursor-pointer group"
                    aria-label="Toggle theme"
                >
                    {theme === 'light' ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 group-hover:rotate-12 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-400 group-hover:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                    )}
                </button>
            </div>

            {/* Container for balanced layout */}
            <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 w-full max-w-7xl">

                {/* 1. Visual Focal Point (Logo) */}
                <div className="relative mb-8 sm:mb-10 animate-in fade-in zoom-in duration-1000 flex items-center justify-center">
                    <img
                        src={`${import.meta.env.BASE_URL}Adani-hori.png`}
                        alt="Adani"
                        className="w-56 sm:w-72 lg:w-[400px] object-contain drop-shadow-xl"
                    />
                </div>

                {/* 2. Textual Information */}
                <div className="flex flex-col items-center mt-8 sm:mt-12 space-y-4 animate-in slide-in-from-bottom-8 duration-1000 delay-200 fill-mode-both">
                    <h1 className="text-4xl md:text-6xl tracking-wide font-black text-gray-900 dark:text-white leading-[1.1] tracking-tighter uppercase max-w-5xl">
                        Execution & Commissioning <br />
                        <span className="text-2xl md:text-5xl tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-[#0B74B0] via-[#75479C] to-[#BD3861] drop-shadow-sm">
                            Tracker Portal
                        </span>
                    </h1>

                    <div className="h-1.5 w-24 bg-gradient-to-r from-[#0B74B0] via-[#75479C] to-[#BD3861] rounded-full my-4 shadow-sm"></div>

                    <p className="text-xs sm:text-lg text-gray-500 dark:text-gray-400 font-black uppercase tracking-[0.4em] max-w-3xl opacity-80">
                        Adani Green Energy Portfolio Analytics
                    </p>
                </div>

                {/* 3. Primary Action — Login */}
                <div className="mt-10 animate-in slide-in-from-bottom-12 duration-1000 delay-500 fill-mode-both w-full max-w-sm">
                    {!user ? (
                        <div className=" backdrop-blur-xl rounded-3xl shadow-2xl flex flex-col items-center">
                            {/* The ONLY Login Action */}
                            <button
                                onClick={() => window.location.href = `${API_BASE}/api/sso/login`}
                                className="w-full max-w-xs py-6 bg-linear-to-r from-[#0B74B0] via-[#75479C] to-[#BD3861] text-white text-sm font-black uppercase tracking-[0.3em] rounded-xl hover:scale-[1.05] transition-all active:scale-95 cursor-pointer shadow-[0_20px_40px_rgba(11,116,176,0.4)] border border-white/20"
                            >
                                Login with Adani SSO
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => window.location.href = `/execution-tracker/application`}
                            className="relative group px-16 py-5 bg-gradient-to-r from-[#0B74B0] via-[#75479C] to-[#BD3861] text-white text-sm font-black uppercase tracking-[0.3em] rounded-full shadow-[0_20px_40px_rgba(11,116,176,0.3)] hover:shadow-[0_25px_50px_rgba(11,116,176,0.5)] hover:-translate-y-2 transition-all duration-300 active:translate-y-0 cursor-pointer overflow-hidden border border-white/20"
                        >
                            <span className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity"></span>
                            Enter Application
                        </button>
                    )}
                </div>
            </div>

            {/* Premium Background Elements */}
            <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#0B74B0]/15 via-transparent to-transparent opacity-70 pointer-events-none"></div>
            <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:100px_100px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_50%,#000_80%,transparent_100%)] pointer-events-none"></div>
            <div className="absolute -top-24 -left-24 w-[600px] h-[600px] bg-[#0B74B0]/5 rounded-full blur-[150px] pointer-events-none animate-pulse duration-[8000ms]"></div>
            <div className="absolute -bottom-24 -right-24 w-[600px] h-[600px] bg-[#75479C]/5 rounded-full blur-[150px] pointer-events-none animate-pulse duration-[10000ms] delay-1000"></div>
        </main>
    );
};

export default HomePage;
