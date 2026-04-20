
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const UserManual = () => {
    const [activeSection, setActiveSection] = useState('overview');

    const sections = [
        {
            id: 'overview',
            title: 'Application Overview',
            icon: '📋',
            content: (
                <div className="space-y-6">
                    <h3 className="text-2xl font-black text-gray-900 dark:text-white">AGEL CEO Tracker</h3>
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                        The <strong>AGEL CEO Tracker</strong> is a comprehensive project commissioning monitoring system designed for <strong>Adani Green Energy Limited</strong>.
                        It provides real-time visibility into Solar and Wind project commissioning progress across the entire portfolio.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-5 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/30 dark:to-blue-800/20 rounded-2xl border border-blue-200 dark:border-blue-700">
                            <h4 className="font-black text-[#0B74B0] mb-3 flex items-center gap-2 text-lg">
                                <span>🎯</span> Purpose
                            </h4>
                            <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-2">
                                <li className="flex items-start gap-2"><span className="text-blue-500">•</span> Track monthly commissioning targets vs actuals</li>
                                <li className="flex items-start gap-2"><span className="text-blue-500">•</span> Monitor Plan and Actual/Forecast values</li>
                                <li className="flex items-start gap-2"><span className="text-blue-500">•</span> Analyze deviations and portfolio health</li>
                                <li className="flex items-start gap-2"><span className="text-blue-500">•</span> Support executive decision-making</li>
                            </ul>
                        </div>
                        <div className="p-5 bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-900/30 dark:to-emerald-800/20 rounded-2xl border border-emerald-200 dark:border-emerald-700">
                            <h4 className="font-black text-emerald-600 mb-3 flex items-center gap-2 text-lg">
                                <span>📊</span> Key Metrics
                            </h4>
                            <ul className="text-sm text-emerald-800 dark:text-emerald-300 space-y-2">
                                <li className="flex items-start gap-2"><span className="text-emerald-500">•</span> Total Capacity (MW)</li>
                                <li className="flex items-start gap-2"><span className="text-emerald-500">•</span> Cumulative Commissioning Till Date</li>
                                <li className="flex items-start gap-2"><span className="text-emerald-500">•</span> Quarterly Breakdowns (Q1-Q4)</li>
                                <li className="flex items-start gap-2"><span className="text-emerald-500">•</span> Monthly Progress by Project/SPV</li>
                            </ul>
                        </div>
                    </div>

                    <div className="p-5 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
                        <h4 className="font-black text-gray-700 dark:text-gray-200 mb-3">Technology Stack</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="text-center p-3 bg-white dark:bg-gray-900 rounded-xl">
                                <span className="text-2xl">⚛️</span>
                                <p className="text-xs font-bold mt-1 text-gray-600 dark:text-gray-400">Next.js 14</p>
                            </div>
                            <div className="text-center p-3 bg-white dark:bg-gray-900 rounded-xl">
                                <span className="text-2xl">🎨</span>
                                <p className="text-xs font-bold mt-1 text-gray-600 dark:text-gray-400">Tailwind CSS</p>
                            </div>
                            <div className="text-center p-3 bg-white dark:bg-gray-900 rounded-xl">
                                <span className="text-2xl">📦</span>
                                <p className="text-xs font-bold mt-1 text-gray-600 dark:text-gray-400">JSON Database</p>
                            </div>
                            <div className="text-center p-3 bg-white dark:bg-gray-900 rounded-xl">
                                <span className="text-2xl">🔐</span>
                                <p className="text-xs font-bold mt-1 text-gray-600 dark:text-gray-400">JWT Auth</p>
                            </div>
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 'user-roles',
            title: 'User Roles & Permissions',
            icon: '👥',
            content: (
                <div className="space-y-6">
                    <p className="text-gray-600 dark:text-gray-400">
                        The platform implements role-based access control (RBAC) to ensure data integrity and security. Each user is assigned one of three roles:
                    </p>

                    <div className="space-y-4">
                        {/* ADMIN */}
                        <div className="p-6 bg-gradient-to-r from-purple-50 to-purple-100/50 dark:from-purple-900/30 dark:to-purple-800/20 rounded-2xl border border-purple-200 dark:border-purple-700">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="p-3 bg-purple-600 text-white rounded-xl font-black text-sm">ADMIN</div>
                                <div>
                                    <p className="font-black text-purple-800 dark:text-purple-300 text-lg">Full System Control</p>
                                    <p className="text-xs text-purple-600 dark:text-purple-400">Complete administrative access</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="text-sm text-purple-700 dark:text-purple-300 space-y-1">
                                    <p className="font-bold">✅ Can Do:</p>
                                    <ul className="text-xs space-y-1 ml-4">
                                        <li>• Create, edit, delete users</li>
                                        <li>• Add new projects</li>
                                        <li>• Carry forward fiscal years</li>
                                        <li>• Edit all data values</li>
                                        <li>• Access Admin Panel</li>
                                        <li>• Export data to Excel</li>
                                    </ul>
                                </div>
                                <div className="text-sm text-purple-700 dark:text-purple-300 space-y-1">
                                    <p className="font-bold">📍 Access Areas:</p>
                                    <ul className="text-xs space-y-1 ml-4">
                                        <li>• Dashboard</li>
                                        <li>• Solar & Wind Pages</li>
                                        <li>• Master Data (Full Control)</li>
                                        <li>• Admin Panel</li>
                                        <li>• User Management</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* EDITOR */}
                        <div className="p-6 bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-900/30 dark:to-blue-800/20 rounded-2xl border border-blue-200 dark:border-blue-700">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="p-3 bg-[#0B74B0] text-white rounded-xl font-black text-sm">EDITOR</div>
                                <div>
                                    <p className="font-black text-blue-800 dark:text-blue-300 text-lg">Data Manager</p>
                                    <p className="text-xs text-blue-600 dark:text-blue-400">Edit commissioning values</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                                    <p className="font-bold">✅ Can Do:</p>
                                    <ul className="text-xs space-y-1 ml-4">
                                        <li>• Edit monthly values (Plan, Actual)</li>
                                        <li>• View all dashboards & tables</li>
                                        <li>• Export data to Excel</li>
                                        <li>• Filter & search projects</li>
                                    </ul>
                                </div>
                                <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                                    <p className="font-bold">❌ Cannot Do:</p>
                                    <ul className="text-xs space-y-1 ml-4">
                                        <li>• Manage users</li>
                                        <li>• Add/delete projects</li>
                                        <li>• Carry forward fiscal years</li>
                                        <li>• Access Admin Panel</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* VIEWER */}
                        <div className="p-6 bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-800/50 dark:to-gray-700/30 rounded-2xl border border-gray-200 dark:border-gray-600">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="p-3 bg-gray-500 text-white rounded-xl font-black text-sm">VIEWER</div>
                                <div>
                                    <p className="font-black text-gray-800 dark:text-gray-200 text-lg">Read-Only Access</p>
                                    <p className="text-xs text-gray-600 dark:text-gray-400">View dashboards & reports</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                                    <p className="font-bold">✅ Can Do:</p>
                                    <ul className="text-xs space-y-1 ml-4">
                                        <li>• View all dashboards</li>
                                        <li>• View Solar & Wind tables</li>
                                        <li>• Export data to Excel</li>
                                        <li>• Filter & search projects</li>
                                    </ul>
                                </div>
                                <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                                    <p className="font-bold">❌ Cannot Do:</p>
                                    <ul className="text-xs space-y-1 ml-4">
                                        <li>• Edit any data values</li>
                                        <li>• Access Master Data editing</li>
                                        <li>• Manage users or projects</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 'navigation',
            title: 'Navigation & Features',
            icon: '🧭',
            content: (
                <div className="space-y-6">
                    <p className="text-gray-600 dark:text-gray-400">
                        The application is organized into distinct sections accessible from the sidebar navigation:
                    </p>

                    <div className="space-y-4">
                        <div className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                            <div className="flex items-center gap-3 mb-3">
                                <span className="text-2xl">📊</span>
                                <h4 className="font-black text-gray-800 dark:text-white text-lg">Dashboard</h4>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                The main overview showing combined Solar + Wind portfolio summary with:
                            </p>
                            <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1 grid grid-cols-2 gap-2">
                                <li>• Total Capacity Cards</li>
                                <li>• Technology Mix Charts</li>
                                <li>• Plan vs Actual Tables</li>
                                <li>• Commissioning Progress Summary</li>
                            </ul>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-5 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-2xl border border-amber-200 dark:border-amber-700">
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="text-2xl">☀️</span>
                                    <h4 className="font-black text-amber-800 dark:text-amber-300">Solar</h4>
                                </div>
                                <p className="text-xs text-amber-700 dark:text-amber-400">
                                    Dedicated view for Solar projects with section-level filtering (Khavda, Non-Khavda, etc.) and inline editing capabilities.
                                </p>
                            </div>
                            <div className="p-5 bg-gradient-to-br from-cyan-50 to-sky-50 dark:from-cyan-900/20 dark:to-sky-900/20 rounded-2xl border border-cyan-200 dark:border-cyan-700">
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="text-2xl">💨</span>
                                    <h4 className="font-black text-cyan-800 dark:text-cyan-300">Wind</h4>
                                </div>
                                <p className="text-xs text-cyan-700 dark:text-cyan-400">
                                    Dedicated view for Wind projects with location-based filtering and comprehensive monthly/quarterly tracking.
                                </p>
                            </div>
                        </div>

                        <div className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                            <div className="flex items-center gap-3 mb-3">
                                <span className="text-2xl">📁</span>
                                <h4 className="font-black text-gray-800 dark:text-white text-lg">Master Data</h4>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                Central hub for data management (Admin/Editor access):
                            </p>
                            <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                                <li>• <strong>Manage Data Tab:</strong> View and edit raw project data in a spreadsheet-like interface</li>
                                <li>• <strong>Admin Tab:</strong> Add new projects, manage users, carry forward fiscal years (Admin only)</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 'how-to-use',
            title: 'How to Use',
            icon: '📖',
            content: (
                <div className="space-y-6">
                    {/* Login */}
                    <div className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
                        <h4 className="font-black text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                            <span className="bg-[#0B74B0] text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                            Login & Authentication
                        </h4>
                        <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-2 ml-8 list-decimal">
                            <li>Navigate to the application URL</li>
                            <li>Enter your <strong>Username</strong> and <strong>Password</strong></li>
                            <li>Click <strong>Login</strong> to access your dashboard</li>
                            <li>Your role (Admin/Editor/Viewer) determines available features</li>
                        </ol>
                    </div>

                    {/* Viewing Data */}
                    <div className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
                        <h4 className="font-black text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                            <span className="bg-[#0B74B0] text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                            Viewing Project Data
                        </h4>
                        <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-2 ml-8 list-decimal">
                            <li>Select <strong>Fiscal Year</strong> from the header dropdown</li>
                            <li>Navigate to <strong>Solar</strong> or <strong>Wind</strong> page from sidebar</li>
                            <li>Use <strong>Section Filter</strong> to narrow down projects</li>
                            <li>Scroll horizontally to view all months (label and summary columns are frozen)</li>
                            <li>View summary rows for Plan and Actual totals</li>
                        </ol>
                    </div>

                    {/* Editing Data */}
                    <div className="p-5 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-200 dark:border-amber-700">
                        <h4 className="font-black text-amber-800 dark:text-amber-300 mb-3 flex items-center gap-2">
                            <span className="bg-amber-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
                            Editing Values (Editor/Admin)
                        </h4>
                        <ol className="text-sm text-amber-700 dark:text-amber-400 space-y-2 ml-8 list-decimal">
                            <li><strong>Double-click</strong> any editable cell in the project table</li>
                            <li>Enter the new value (in MW)</li>
                            <li>Press <strong>Enter</strong> to save or <strong>Escape</strong> to cancel</li>
                            <li>The summary tables and quarterly totals update automatically</li>
                        </ol>
                        <p className="text-xs text-amber-600 dark:text-amber-500 mt-3 italic">
                            💡 Tip: Quarterly values (Q1-Q4) are auto-calculated from monthly inputs.
                        </p>
                    </div>

                    {/* Exporting Data */}
                    <div className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
                        <h4 className="font-black text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                            <span className="bg-[#0B74B0] text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">4</span>
                            Exporting to Excel
                        </h4>
                        <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-2 ml-8 list-decimal">
                            <li>Click the <strong>Export</strong> button on any summary table</li>
                            <li>Select the <strong>Month Range</strong> (From/To)</li>
                            <li>Click <strong>Export Excel</strong></li>
                            <li>The .xlsx file downloads with filtered data</li>
                        </ol>
                    </div>
                </div>
            )
        },
        {
            id: 'fiscal-year',
            title: 'Fiscal Year Management',
            icon: '📅',
            content: (
                <div className="space-y-6">
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                        The application operates on the Indian Fiscal Year (April to March). The <strong>Global Fiscal Year Selector</strong> in the header synchronizes all pages.
                    </p>

                    <div className="p-5 bg-orange-50 dark:bg-orange-900/20 rounded-2xl border border-orange-200 dark:border-orange-700">
                        <h4 className="font-black text-orange-800 dark:text-orange-300 mb-3">Fiscal Year Selector</h4>
                        <p className="text-sm text-orange-700 dark:text-orange-400 mb-4">
                            Changing the fiscal year in the header instantly updates:
                        </p>
                        <ul className="grid grid-cols-2 gap-3">
                            <li className="flex items-center gap-2 text-xs font-semibold text-orange-700 dark:text-orange-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" /> Dashboard Analytics
                            </li>
                            <li className="flex items-center gap-2 text-xs font-semibold text-orange-700 dark:text-orange-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" /> Month Headers (Apr-Mar)
                            </li>
                            <li className="flex items-center gap-2 text-xs font-semibold text-orange-700 dark:text-orange-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" /> Summary Tables
                            </li>
                            <li className="flex items-center gap-2 text-xs font-semibold text-orange-700 dark:text-orange-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" /> Master Data Filtering
                            </li>
                        </ul>
                    </div>

                    <div className="p-5 border-l-4 border-[#0B74B0] bg-[#0B74B0]/5 dark:bg-[#0B74B0]/10 rounded-r-xl">
                        <h4 className="font-black text-[#0B74B0] mb-3">Carry Forward (Admin Only)</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                            At the start of a new fiscal year, Admins can clone project definitions:
                        </p>
                        <ul className="text-sm space-y-2 text-gray-700 dark:text-gray-300 list-disc list-inside">
                            <li>Copies all Project Names, SPVs, and Capacities</li>
                            <li><strong>Resets all monthly values to 0</strong> for the new year</li>
                            <li>Maintains project hierarchy and categorization</li>
                        </ul>
                    </div>

                    <div className="p-4 bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-200 dark:border-rose-700">
                        <p className="text-xs text-rose-600 dark:text-rose-400 font-bold flex items-center gap-2">
                            <span>⚠️</span> Carry Forward is only accessible via: Master Data → Admin Tab → Carry Forward
                        </p>
                    </div>
                </div>
            )
        },
        {
            id: 'table-features',
            title: 'Table Features',
            icon: '📋',
            content: (
                <div className="space-y-6">
                    <p className="text-gray-600 dark:text-gray-400">
                        The summary tables include several usability enhancements for better data analysis:
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
                            <h4 className="font-black text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                                <span>📌</span> Frozen Columns
                            </h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                                When scrolling horizontally, the <strong>Label</strong> column (left) and <strong>Summary Columns</strong> (Total, Cumm, Q1-Q4) remain fixed for easy reference.
                            </p>
                        </div>
                        <div className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
                            <h4 className="font-black text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                                <span>🎨</span> Color Coding
                            </h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                                <span className="text-[#0B74B0] font-bold">Blue</span> = Plan Data,
                                <span className="text-[#75479C] font-bold ml-2">Purple</span> = Actual Data
                            </p>
                        </div>
                        <div className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
                            <h4 className="font-black text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                                <span>📊</span> Cumulative Till Date
                            </h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                                The "CUMM TILL" column shows cumulative commissioning up to <strong>yesterday's date</strong>, dynamically updated.
                            </p>
                        </div>
                        <div className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
                            <h4 className="font-black text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                                <span>⬇️</span> Excel Export
                            </h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                                Export any table to Excel with customizable month range selection for offline analysis.
                            </p>
                        </div>
                    </div>

                    <div className="p-5 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
                        <h4 className="font-black text-gray-700 dark:text-gray-200 mb-3">Table Legend</h4>
                        <div className="flex flex-wrap gap-4 text-xs">
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded border-2 border-dashed border-gray-300"></div>
                                <span className="text-gray-600 dark:text-gray-400">Dashed borders for visual separation</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded bg-gray-50 dark:bg-gray-700"></div>
                                <span className="text-gray-600 dark:text-gray-400">Shaded rows for category headers</span>
                            </div>
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 'support',
            title: 'Support & Help',
            icon: '🆘',
            content: (
                <div className="space-y-6">
                    <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl border border-blue-200 dark:border-blue-700">
                        <h4 className="font-black text-[#0B74B0] mb-4 text-lg">Contact Support</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                            For technical issues, data discrepancies, or access requests, please contact:
                        </p>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 text-sm">
                                <span className="text-xl">📧</span>
                                <span className="text-gray-700 dark:text-gray-300">it.support@adani.com</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <span className="text-xl">📞</span>
                                <span className="text-gray-700 dark:text-gray-300">Internal IT Helpdesk</span>
                            </div>
                        </div>
                    </div>

                    <div className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
                        <h4 className="font-black text-gray-800 dark:text-white mb-3">Common Issues</h4>
                        <div className="space-y-3">
                            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
                                <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Q: Data not loading?</p>
                                <p className="text-xs text-gray-500 mt-1">A: Check your internet connection and try refreshing the page. If the issue persists, contact IT.</p>
                            </div>
                            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
                                <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Q: Cannot edit cells?</p>
                                <p className="text-xs text-gray-500 mt-1">A: Ensure you have Editor or Admin role. Viewers cannot edit data.</p>
                            </div>
                            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
                                <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Q: Wrong fiscal year data?</p>
                                <p className="text-xs text-gray-500 mt-1">A: Check the Fiscal Year selector in the header. Ensure the correct year is selected.</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-700 text-center">
                        <p className="text-sm text-emerald-700 dark:text-emerald-400 font-bold">
                            💡 Pro Tip: Bookmark this User Manual page for quick reference!
                        </p>
                    </div>
                </div>
            )
        }
    ];

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-12">
            {/* Hero Section */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0B74B0] via-[#095a87] to-indigo-900 p-8 sm:p-12 text-white shadow-2xl">
                <div className="relative z-10 max-w-2xl">
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-4xl sm:text-5xl font-black mb-4 tracking-tight"
                    >
                        User Manual & <br />Documentation
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-lg text-blue-100/80 font-medium"
                    >
                        Complete guide to the AGEL CEO Tracker — covering user roles, features, navigation, and step-by-step instructions.
                    </motion.p>
                </div>
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/20 rounded-full -ml-32 -mb-32 blur-2xl" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Navigation Sidebar */}
                <div className="lg:col-span-3 space-y-2">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-4 mb-4">Manual Sections</p>
                    {sections.map((section) => (
                        <button
                            key={section.id}
                            onClick={() => setActiveSection(section.id)}
                            className={`w-full text-left px-5 py-3 rounded-2xl transition-all flex items-center gap-3 font-bold text-sm ${activeSection === section.id
                                ? 'bg-[#0B74B0] text-white shadow-lg shadow-blue-500/20'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800 hover:shadow-sm'
                                }`}
                        >
                            <span className="text-lg">{section.icon}</span>
                            {section.title}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="lg:col-span-9">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeSection}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                            className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 sm:p-12 border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/50 dark:shadow-none min-h-[500px]"
                        >
                            {sections.find(s => s.id === activeSection)?.content}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-6 flex items-center gap-4 text-center justify-center border border-gray-100 dark:border-gray-700">
                <span className="text-2xl">🤝</span>
                <p className="text-sm font-bold text-gray-500 dark:text-gray-400">
                    Need more help? Contact the <span className="text-[#0B74B0]">IT Support Team</span> or check the Admin Console.
                </p>
            </div>
        </div>
    );
};

export default UserManual;
