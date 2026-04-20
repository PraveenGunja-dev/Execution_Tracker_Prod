import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { API_BASE } from '../lib/config';
import { motion } from 'framer-motion';

interface ChangeLog {
    id: number;
    user_email: string;
    action: string;
    entity_type: string;
    entity_id: string;
    details: string;
    created_at: string;
}

export default function AuditLogs() {
    const [limit, setLimit] = useState(50);

    const { data: logs = [], isLoading } = useQuery<ChangeLog[]>({
        queryKey: ['audit-logs', limit],
        queryFn: async () => {
            const token = localStorage.getItem('token');
            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch(`${API_BASE}/api/logs?limit=${limit}`, { headers });
            if (!response.ok) throw new Error('Failed to fetch logs');
            return response.json();
        },
        refetchInterval: 10000, // Refresh every 10 seconds
    });

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    const getActionBadge = (action: string) => {
        const colors: Record<string, string> = {
            'UPDATE': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
            'INSERT': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
            'DELETE': 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
            'UPLOAD': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
            'OVERWRITE_ALL': 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
            'FULL_IMPORT': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
        };
        return (
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${colors[action] || 'bg-gray-100 text-gray-700'}`}>
                {action}
            </span>
        );
    };

    if (isLoading) return <div className="p-8 text-center animate-pulse">Loading activity logs...</div>;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Recent Activity</h2>
                    <p className="text-sm text-gray-500 font-semibold mb-2">Track who updated what across the system</p>
                </div>
                <select 
                    value={limit} 
                    onChange={(e) => setLimit(Number(e.target.value))}
                    className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none"
                >
                    <option value={50}>Show 50</option>
                    <option value={100}>Show 100</option>
                    <option value={500}>Show 500</option>
                </select>
            </div>

            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-left">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                                <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-gray-500">Timestamp</th>
                                <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-gray-500">User</th>
                                <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-gray-500">Action</th>
                                <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-gray-500">Entity</th>
                                <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-gray-500">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {logs.map((log) => (
                                <motion.tr 
                                    key={log.id} 
                                    initial={{ opacity: 0 }} 
                                    animate={{ opacity: 1 }}
                                    className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                                >
                                    <td className="px-6 py-4 text-[12px] font-bold text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                        {formatDate(log.created_at)}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-[#0B74B0] flex items-center justify-center text-[10px] text-white font-black">
                                                {log.user_email[0].toUpperCase()}
                                            </div>
                                            <span className="text-sm font-bold text-gray-900 dark:text-white">{log.user_email}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 uppercase">
                                        {getActionBadge(log.action)}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-[11px] font-black text-gray-500 uppercase tracking-tight bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                                            {log.entity_type} {log.entity_id !== 'None' ? `#${log.entity_id}` : ''}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate" title={log.details}>
                                        {log.details || '—'}
                                    </td>
                                </motion.tr>
                            ))}
                            {logs.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500 font-bold">No activity logs found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
