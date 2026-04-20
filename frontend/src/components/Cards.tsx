import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MagicCard } from './ui/magic-card';

const Cards = () => {
    const { user } = useAuth();
    const launchHref = user ? "/application" : "/login?redirect=/application";

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-3 max-w-7xl mx-auto">
            {/* Card 1 - Live */}
            <MagicCard className="p-6 rounded-xl shadow-lg bg-white dark:bg-[#171717] relative overflow-hidden">
                <div className="absolute right-4 top-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase bg-green-100/50 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800">
                        Live
                    </span>
                </div>
                <h3 className="text-lg font-black tracking-wide mb-3 text-gray-900 dark:text-white uppercase">Execution & Commissioning Tracker</h3>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-8 max-w-[90%]">
                    Here you can track the capacity of your energy sources in real-time and optimize your energy footprint.
                </p>
                <Link to={launchHref}>
                    <button className="bg-gradient-to-r from-[#0B74B0] to-[#04619b] text-white text-xs tracking-widest uppercase font-black py-3 px-6 rounded-xl transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 w-full md:w-auto">
                        Launch Application
                    </button>
                </Link>
            </MagicCard>

            {/* Card 2 - Live */}
            <MagicCard className="p-6 rounded-xl shadow-lg bg-white dark:bg-[#171717] relative overflow-hidden">
                <div className="absolute right-4 top-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase bg-green-100/50 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800">
                        Live
                    </span>
                </div>
                <h3 className="text-lg font-black tracking-wide mb-3 text-gray-900 dark:text-white uppercase">Capacity Tracker</h3>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-8 max-w-[90%]">
                    Commitment to sustainable practices that protect our environment for future generations.
                </p>
                <Link to={launchHref}>
                    <button className="bg-gradient-to-r from-[#0B74B0] to-[#04619b] text-white text-xs tracking-widest uppercase font-black py-3 px-6 rounded-xl transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 w-full md:w-auto">
                        Launch Application
                    </button>
                </Link>
            </MagicCard>

            {/* Card 3 - Upcoming */}
            <MagicCard className="p-6 flex flex-col justify-between rounded-xl shadow-lg bg-white dark:bg-[#171717] relative overflow-hidden">
                <div>
                    <div className="absolute right-4 top-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase bg-amber-100/50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                            Upcoming
                        </span>
                    </div>
                    <h3 className="text-lg font-black tracking-wide mb-3 text-gray-900 dark:text-white uppercase">Innovation</h3>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-8 max-w-[90%]">
                        Cutting-edge technology and research driving the future of energy and sustainability initiatives.
                    </p>
                </div>
                <button className="bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs tracking-widest uppercase font-black py-3 px-6 rounded-xl transition-all opacity-70 cursor-not-allowed w-full md:w-auto" disabled>
                    Coming Soon
                </button>
            </MagicCard>
        </div>
    );
};

export default Cards;
