
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { API_BASE } from '../lib/config';
import { useQuery } from '@tanstack/react-query';

interface CommissioningProject {
    id?: number;
    sno: number;
    projectName: string;
    spv: string;
    projectType: string;
    plotLocation: string;
    capacity: number;
    planActual: string;
    totalCapacity: number | null;
    category: string;
    section: string;
    includedInTotal: boolean;
}

export default function ChatbotPanel() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { role: 'assistant', content: 'Hello! I am your AGEL Data Assistant. How can I help you navigate the dashboard today?' }
    ]);

    const suggestions = [
        "What is the current FY target?",
        "How many projects are critical?",
        "How do I filter solar projects?",
        "Where can I see the Wind totals?",
        "Can I filter by SPV?",
        "How do I export this data?",
        "What is Included in Total?"
    ];

    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = React.useRef<null | HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    React.useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSendMessage = async (text: string) => {
        if (!text.trim()) return;

        // Add user message
        const userMsg = { role: 'user', content: text };
        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        setIsLoading(true);

        try {
            const response = await fetch(`${API_BASE}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text }),
            });
            const data = await response.json();
            setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
        } catch (error) {
            console.error('Chat Error:', error);
            setMessages(prev => [...prev, { role: 'assistant', content: "I'm sorry, I'm having trouble responding right now." }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSendMessage(inputValue);
        }
    };

    return (
        <div className="fixed bottom-8 right-8 z-[10000]">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="absolute bottom-20 right-0 w-[400px] h-[600px] bg-white/90 dark:bg-gray-900/90 backdrop-blur-2xl border border-white/20 dark:border-gray-800 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden"
                    >
                        {/* Chat Header - Exact Adani Logo Gradient */}
                        <div className="p-6 bg-gradient-to-r from-[#007B9E] via-[#6C2B85] to-[#C02741] flex items-center justify-between shadow-lg">
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-white/15 rounded-xl relative flex items-center justify-center w-10 h-10 border border-white/20 shadow-inner">
                                    <svg viewBox="0 0 100 100" className="w-full h-full text-white fill-current">
                                        {/* Head Shape */}
                                        <path d="M25,40 Q25,20 50,20 Q75,20 75,40 L75,60 Q75,70 65,70 L35,70 Q25,70 25,60 Z" />
                                        {/* Visor Area - Adani Dark Blue */}
                                        <rect x="35" y="42" width="30" height="14" rx="7" fill="#00355f" />
                                        {/* Eyes - Adani Green */}
                                        <circle cx="44" cy="49" r="2.5" fill="#8cc63f" />
                                        <circle cx="56" cy="49" r="2.5" fill="#8cc63f" />
                                        {/* Headphones */}
                                        <rect x="18" y="45" width="7" height="20" rx="3.5" />
                                        <rect x="75" y="45" width="7" height="20" rx="3.5" />
                                        {/* Microphone Arm */}
                                        <path d="M78.5,65 Q78.5,80 65,80 L60,80" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
                                        {/* Adani Red accent */}
                                        <circle cx="58" cy="80" r="3.5" fill="#ee3124" />
                                    </svg>
                                </div>
                                <div>
                                    <h4 className="text-white font-black leading-none">AGEL Data Assistant</h4>
                                    <p className="text-blue-100 text-[10px] font-bold uppercase tracking-widest mt-1">Dashboard Support</p>
                                </div>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="text-white/60 hover:text-white transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                            {messages.map((m, i) => (
                                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] p-4 rounded-3xl text-sm font-medium break-words shadow-sm ${m.role === 'user'
                                        ? 'bg-[#0B74B0] text-white rounded-br-none'
                                        : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-none'
                                        }`}>
                                        {m.content}
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-3xl rounded-bl-none flex gap-2">
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Suggested Pills */}
                        <div className="px-6 pb-2 flex flex-wrap gap-2">
                            {suggestions.map(s => (
                                <button
                                    key={s}
                                    onClick={() => handleSendMessage(s)}
                                    className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-[10px] font-bold text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-full transition-all"
                                >
                                    {s}
                                </button>
                            ))}
                        </div>

                        {/* Input Area */}
                        <div className="p-6 border-t border-gray-100 dark:border-gray-800">
                            <div className="relative">
                                <input
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Ask for an insight..."
                                    className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl py-4 pl-6 pr-14 text-sm font-medium focus:ring-2 focus:ring-blue-500 transition-all dark:text-white"
                                />
                                <button
                                    onClick={() => handleSendMessage(inputValue)}
                                    disabled={isLoading || !inputValue.trim()}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-[#0B74B0] text-white rounded-xl hover:bg-[#095a87] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Pulse Trigger Button - Exact Adani Logo Gradient */}
            <motion.button
                whileHover={{ scale: 1.1, rotate: 5 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsOpen(!isOpen)}
                className="w-16 h-16 bg-gradient-to-br from-[#007B9E] via-[#6C2B85] to-[#C02741] rounded-full shadow-[0_10px_40px_-10px_rgba(108,43,133,0.5)] flex items-center justify-center relative overflow-hidden group border border-white/20"
            >
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                {isOpen ? (
                    <svg className="w-8 h-8 text-white relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                ) : (
                    <div className="relative flex items-center justify-center w-12 h-12">
                        <svg viewBox="0 0 100 100" className="w-full h-full text-white fill-current drop-shadow-xl">
                            {/* Head Shape */}
                            <path d="M25,40 Q25,20 50,20 Q75,20 75,40 L75,60 Q75,70 65,70 L35,70 Q25,70 25,60 Z" />
                            {/* Visor Area - Adani Dark Blue */}
                            <rect x="35" y="42" width="30" height="14" rx="7" fill="#00355f" />
                            {/* Eyes - Adani Green */}
                            <circle cx="44" cy="49" r="2.5" fill="#8cc63f" />
                            <circle cx="56" cy="49" r="2.5" fill="#8cc63f" />
                            {/* Headphones */}
                            <rect x="18" y="45" width="7" height="20" rx="3.5" />
                            <rect x="75" y="45" width="7" height="20" rx="3.5" />
                            {/* Microphone Arm */}
                            <path d="M78.5,65 Q78.5,80 65,80 L60,80" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
                            {/* Adani Yellow Accent */}
                            <circle cx="58" cy="80" r="3.5" fill="#fff200" />
                        </svg>
                    </div>
                )}
            </motion.button>
        </div>
    );
}
