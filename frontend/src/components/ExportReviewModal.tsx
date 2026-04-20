
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, FileSpreadsheet, Database, Calendar, CheckCircle2 } from 'lucide-react';

interface ExportReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    data: any[];
    headers: string[];
}

export function ExportReviewModal({ isOpen, onClose, onConfirm, title, data, headers }: ExportReviewModalProps) {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-5xl bg-white dark:bg-gray-950 rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden"
                >
                    {/* Header */}
                    <div className="bg-gradient-to-r from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 px-8 py-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Database className="w-4 h-4 text-[#0B74B0]" />
                                <span className="text-[10px] font-black text-[#0B74B0] uppercase tracking-widest">Database Verification</span>
                            </div>
                            <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Export Review - {title}</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                        >
                            <X className="w-6 h-6 text-gray-400" />
                        </button>
                    </div>

                    {/* Content - Bank Statement Style */}
                    <div className="p-8 max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800">
                        <div className="mb-6 p-4 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl flex items-center gap-4 text-sm text-blue-700 dark:text-blue-300">
                            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                            <p className="font-medium">All records below have been verified against the master database and are ready for download.</p>
                        </div>

                        <div className="border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-800">
                                    <tr>
                                        {headers.map((h, i) => (
                                            <th key={i} className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 dark:divide-gray-900">
                                    {data.slice(0, 50).map((row, i) => (
                                        <tr key={i} className="hover:bg-gray-50/30 dark:hover:bg-gray-900/10 transition-colors">
                                            {headers.map((h, j) => {
                                                const val = row[h] || row[j];
                                                return (
                                                    <td key={j} className="px-4 py-3 text-xs font-bold text-gray-700 dark:text-gray-300">
                                                        {typeof val === 'number' ? val.toLocaleString(undefined, { minimumFractionDigits: 1 }) : (val || '-')}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                    {data.length > 50 && (
                                        <tr>
                                            <td colSpan={headers.length} className="px-4 py-4 text-center text-xs font-bold text-gray-400 italic bg-gray-50/20">
                                                Showing first 50 of {data.length} records. All records will be included in the final export.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="bg-gray-50/50 dark:bg-gray-900/50 px-8 py-6 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">As on: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <FileSpreadsheet className="w-4 h-4 text-gray-400" />
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Format: XLSX / CSV</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={onClose}
                                className="px-6 py-3 text-sm font-black text-gray-500 hover:text-gray-700 transition-colors uppercase tracking-widest"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={onConfirm}
                                className="flex items-center gap-2 px-8 py-3 text-sm font-black text-white bg-gradient-to-r from-[#0B74B0] to-[#04619b] rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 active:translate-y-0 px-10"
                            >
                                <Download className="w-4 h-4" />
                                DOWNLOAD STATEMENT
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
