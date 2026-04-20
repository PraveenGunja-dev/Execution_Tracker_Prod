import { API_BASE } from '../lib/config';


import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import EditUserModal from './EditUserModal';
import { getCurrentFiscalYear } from '../lib/utils';
import AuditLogs from './AuditLogs';

interface User {
    id: number;
    username: string;
    email: string;
    role: string;
    scope: string; // "all", "solar", or JSON string
    createdAt: string;
}

interface Project {
    id: number;
    projectName: string;
    spv: string;
    plotLocation: string;
    category: string;
    fiscalYear: string;
    key: string; // Composite key: FY|Name|SPV|Location
}

// Helper to parse scope string
const parseScopeString = (scope: string | null): { category: string; projects: string[] } => {
    if (!scope || scope === 'all') return { category: 'all', projects: [] };
    if (scope === 'solar' || scope === 'wind') return { category: scope, projects: [] };

    // Check for JSON format (new)
    if (scope.startsWith('{')) {
        try {
            const parsed = JSON.parse(scope);
            return { category: parsed.category, projects: parsed.projects || [] };
        } catch (e) {
            console.error("Failed to parse scope JSON", e);
            return { category: 'all', projects: [] };
        }
    }

    // Legacy format
    const [category, projectsStr] = scope.split(':');
    return { category, projects: projectsStr ? projectsStr.split(',') : [] };
};

// Helper to format scope to display
const formatScopeDisplay = (scope: string | null): string => {
    if (!scope || scope === 'all') return 'Global (All)';
    if (scope === 'solar') return 'Solar (All Projects)';
    if (scope === 'wind') return 'Wind (All Projects)';

    const { category, projects } = parseScopeString(scope);
    const catDisplay = category.charAt(0).toUpperCase() + category.slice(1);

    if (projects.length === 0) return `${catDisplay} (All Projects)`;
    return `${catDisplay}: ${projects.length} specific projects`;
};

export default function AdminPanel() {
    const { user: currentUser } = useAuth();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'users' | 'projects' | 'logs'>('users');
    const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Form states
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const [newProject, setNewProject] = useState({
        baseType: '', baseLocation: '',
        projectName: '', spv: '', projectType: '', capacity: 0,
        category: '', fiscalYear: getCurrentFiscalYear(), section: 'A',
        priority: '', plotLocation: '', plotNo: '',
        trialRun: '', chargingPlan: '', codPlan: ''
    });

    // Fetch dropdown options (DB-driven values)
    const { data: dropdownOptions } = useQuery<any>({
        queryKey: ['dropdown-options-admin'],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/api/distinct-values?fiscalYear=${getCurrentFiscalYear()}`);
            if (!res.ok) throw new Error('Failed');
            return res.json();
        },
    });

    // Fetch projects for project selection dropdown
    const { data: allProjects = [] } = useQuery<Project[]>({
        queryKey: ['all-projects-for-access'],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/api/commissioning-projects?fiscalYear=all`);
            if (!res.ok) throw new Error('Failed to fetch projects');
            const data = await res.json();
            // Get unique projects by composite key (FY + Name + SPV + Location)
            const uniqueProjects = data.reduce((acc: Project[], proj: any) => {
                const key = `${proj.fiscalYear}|${proj.projectName}|${proj.spv || ''}|${proj.plotLocation || ''}`;
                if (!acc.find(p => p.key === key)) {
                    acc.push({
                        id: proj.id,
                        projectName: proj.projectName,
                        spv: proj.spv || '',
                        plotLocation: proj.plotLocation || '',
                        category: proj.category,
                        fiscalYear: proj.fiscalYear,
                        key: key
                    });
                }
                return acc;
            }, []);
            return uniqueProjects;
        },
        enabled: !!currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN')
    });

    // Filter projects based on selected category
    const [editingUser, setEditingUser] = useState<User | null>(null);







    // Fetch users
    const { data: users = [], isLoading: loadingUsers } = useQuery<User[]>({
        queryKey: ['users'],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/api/users`);
            if (!res.ok) throw new Error('Failed to fetch users');
            return res.json();
        },
        enabled: !!currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN')
    });

    // Stats Calculation
    const totalUsers = users.length;
    const adminCount = users.filter(u => u.role === 'ADMIN' || u.role === 'SUPER_ADMIN').length;
    const editorCount = users.filter(u => u.role === 'EDITOR').length;
    const viewerCount = users.filter(u => u.role === 'VIEWER').length;



    // Delete User Mutation
    const deleteUserMutation = useMutation({
        mutationFn: async (id: number) => {
            const res = await fetch(`${API_BASE}/api/users?id=${id}`, { method: 'DELETE' });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to delete user');
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            setNotification({ type: 'success', message: 'User deleted successfully' });
            setTimeout(() => setNotification(null), 3000);
        },
        onError: (err: any) => setNotification({ type: 'error', message: err.message })
    });

    // Update User Mutation
    const updateUserMutation = useMutation({
        mutationFn: async (data: { id: number, role: string, scope: string }) => {
            const res = await fetch(`${API_BASE}/api/users`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to update user');
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            setNotification({ type: 'success', message: 'User updated successfully' });
            setEditingUser(null);
            setTimeout(() => setNotification(null), 3000);
        },
        onError: (err: any) => setNotification({ type: 'error', message: err.message })
    });

    // Create Project Mutation
    const createProjectMutation = useMutation({
        mutationFn: async (data: any) => {
            const token = localStorage.getItem('token');
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`${API_BASE}/api/manual-add-project`, {
                method: 'POST',
                headers,
                body: JSON.stringify(data)
            });
            if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed'); }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['commissioning-projects'] });
            queryClient.invalidateQueries({ queryKey: ['solar-projects'] });
            queryClient.invalidateQueries({ queryKey: ['wind-projects'] });
            setNotification({ type: 'success', message: 'Project added successfully!' });
            setNewProject({
                baseType: '', baseLocation: '',
                projectName: '', spv: '', projectType: '', capacity: 0,
                category: '', fiscalYear: getCurrentFiscalYear(), section: 'A',
                priority: '', plotLocation: '', plotNo: '',
                trialRun: '', chargingPlan: '', codPlan: ''
            });
            setTimeout(() => setNotification(null), 3000);
        },
        onError: (err: any) => setNotification({ type: 'error', message: err.message })
    });



    const handleCreateProject = (e: React.FormEvent) => {
        e.preventDefault();
        const payload = { ...newProject };
        if (newProject.baseType && newProject.baseLocation) {
            payload.category = `${newProject.baseLocation} ${newProject.baseType}`.trim();
        } else if (!payload.category) {
            payload.category = newProject.baseType || 'Solar';
        }
        createProjectMutation.mutate(payload);
    };


    if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'SUPER_ADMIN')) {
        return <div className="p-8 text-center text-red-500 font-bold bg-white rounded-xl shadow">⛔ Access Denied: Admin Privileges Required</div>;
    }

    return (
        <div className="space-y-6">
            {/* Admin Header Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Total Users</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{totalUsers}</div>
                    <div className="text-xs text-green-500 mt-1 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 block"></span> Active System
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Admins</div>
                    <div className="text-2xl font-bold text-purple-600 mt-1">{adminCount}</div>
                    <div className="text-xs text-gray-400 mt-1">Full Access</div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Editors</div>
                    <div className="text-2xl font-bold text-[#0B74B0] dark:text-[#60a5fa] mt-1">{editorCount}</div>
                    <div className="text-xs text-gray-400 mt-1">Scoped Access</div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Viewers</div>
                    <div className="text-2xl font-bold text-gray-600 dark:text-gray-300 mt-1">{viewerCount}</div>
                    <div className="text-xs text-gray-400 mt-1">Read Only</div>
                </div>
            </div>

            {/* Main Admin Card */}
            <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
                {/* Header Tab Bar */}
                <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                        <span className="p-1.5 bg-[#0B74B0]/10 dark:bg-[#0B74B0]/30 rounded-lg text-[#0B74B0] dark:text-[#60a5fa]">🛡️</span>
                        Admin Panel
                    </h2>
                    <div className="flex bg-white dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                        <button onClick={() => setActiveTab('users')}
                            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'users' ? 'bg-[#0B74B0] text-white shadow-md' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                            User Management
                        </button>
                        <button onClick={() => setActiveTab('projects')}
                            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'projects' ? 'bg-[#0B74B0] text-white shadow-md' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                            Add Projects
                        </button>
                        <button onClick={() => setActiveTab('logs')}
                            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'logs' ? 'bg-[#0B74B0] text-white shadow-md' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                            Activity Logs
                        </button>
                    </div>
                </div>

                {/* Notification Toast */}
                {notification && (
                    <div className={`mx-6 mt-4 p-4 rounded-xl text-sm font-medium flex items-center gap-3 animate-fade-in ${notification.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                        <span className="text-lg">{notification.type === 'success' ? '✅' : '⚠️'}</span>
                        {notification.message}
                    </div>
                )}

                <div className="p-6">
                    {activeTab === 'users' && (
                        <div className="space-y-4 animate-fade-in">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                                <h3 className="text-sm font-bold uppercase text-gray-500 tracking-wider flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                                    Registered Users
                                </h3>
                                <div className="relative w-full sm:w-72">
                                    <input
                                        type="text"
                                        placeholder="Search by name, email, or role..."
                                        className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B74B0]"
                                        value={userSearchTerm}
                                        onChange={e => setUserSearchTerm(e.target.value)}
                                    />
                                    <svg className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
                                <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                                    <table className="min-w-full text-sm text-left">
                                        <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 font-medium border-b border-gray-100 dark:border-gray-800 sticky top-0 z-10">
                                            <tr>
                                                <th className="px-6 py-4">User Details</th>
                                                <th className="px-6 py-4">Role & Permissions</th>
                                                <th className="px-6 py-4 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                            {users.filter(u =>
                                                u.username.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                                                u.email.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                                                u.role.toLowerCase().includes(userSearchTerm.toLowerCase())
                                            ).map(u => (
                                                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0">
                                                                {u.username.substring(0, 2).toUpperCase()}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="font-semibold text-gray-900 dark:text-white truncate">{u.username}</div>
                                                                <div className="text-xs text-gray-500 truncate">{u.email}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col gap-1.5">
                                                            <span className={`w-fit px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${u.role === 'ADMIN' || u.role === 'SUPER_ADMIN' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                                                                u.role === 'EDITOR' ? 'bg-[#0B74B0]/10 text-[#0B74B0] dark:text-[#60a5fa] border-[#0B74B0]/20' : 'bg-gray-50 text-gray-600 border-gray-200'
                                                                }`}>
                                                                {u.role}
                                                            </span>
                                                            <div className="text-xs text-gray-500 flex items-center gap-1">
                                                                <span className="opacity-50">Scope:</span>
                                                                <span className="font-medium text-gray-700 dark:text-gray-300 truncate" title={formatScopeDisplay(u.scope)}>{formatScopeDisplay(u.scope)}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right w-32">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {/* Edit Button */}
                                                            {(currentUser.role === 'SUPER_ADMIN' || (currentUser.role === 'ADMIN' && u.role !== 'SUPER_ADMIN')) && (
                                                                <button
                                                                    onClick={() => setEditingUser(u)}
                                                                    className="text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/40 p-2 rounded-lg transition-all"
                                                                    title="Edit User"
                                                                >
                                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                                </button>
                                                            )}

                                                            <button
                                                                onClick={() => {
                                                                    if (window.confirm('Are you sure you want to delete this user?')) deleteUserMutation.mutate(u.id);
                                                                }}
                                                                className="text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/40 p-2 rounded-lg transition-all"
                                                                title="Delete User"
                                                            >
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}


                    {activeTab === 'projects' && (
                        <div className="max-w-5xl mx-auto">
                            <div className="bg-white dark:bg-gray-900 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 shadow-lg">
                                <div className="bg-gradient-to-r from-[#0B74B0] to-[#095a87] px-8 py-6">
                                    <h3 className="text-xl font-bold text-white mb-1">Add New Project</h3>
                                    <p className="text-white/80 text-sm">Fill in project-level details. Plan & Actual rows will be auto-created.</p>
                                </div>
                                <div className="p-8">
                                    <form onSubmit={handleCreateProject} className="space-y-6">
                                        {/* Row 1 */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Type *</label>
                                                <select required className="w-full px-3 py-2.5 text-sm border rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[#0B74B0] outline-none dark:bg-gray-800 dark:border-gray-700"
                                                    value={newProject.baseType} onChange={e => setNewProject({ ...newProject, baseType: e.target.value, baseLocation: '' })}>
                                                    <option value="">Select...</option>
                                                    <option value="Solar">Solar</option>
                                                    <option value="Wind">Wind</option>
                                                    <option value="Hybrid">Hybrid</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Location *</label>
                                                <select required disabled={!newProject.baseType} className="w-full px-3 py-2.5 text-sm border rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[#0B74B0] outline-none dark:bg-gray-800 dark:border-gray-700 disabled:opacity-50"
                                                    value={newProject.baseLocation} onChange={e => setNewProject({ ...newProject, baseLocation: e.target.value })}>
                                                    <option value="">Select Location...</option>
                                                    {(newProject.baseType === 'Solar' ? ['Khavda', 'Rajasthan', 'Rajasthan Additional 500MW', 'Rajasthan & Non-Khavda', 'GJ', 'RJ', 'Other'] :
                                                        newProject.baseType === 'Wind' ? ['Khavda', 'Mundra', 'Non-Khavda', 'GJ', 'RJ', 'Other'] :
                                                            newProject.baseType === 'Hybrid' ? ['Khavda', 'Rajasthan', 'Other'] :
                                                                []).map(l => (
                                                                    <option key={l} value={l}>{l}</option>
                                                                ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Project Name *</label>
                                                <input required type="text" placeholder="e.g. Khavda Solar Phase 2"
                                                    className="w-full px-3 py-2.5 text-sm border rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[#0B74B0] outline-none dark:bg-gray-800 dark:border-gray-700"
                                                    value={newProject.projectName} onChange={e => setNewProject({ ...newProject, projectName: e.target.value })} />
                                            </div>
                                        </div>
                                        {/* Row 2 */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">SPV *</label>
                                                <input required type="text" placeholder="e.g. ARE56L"
                                                    className="w-full px-3 py-2.5 text-sm border rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[#0B74B0] outline-none dark:bg-gray-800 dark:border-gray-700"
                                                    value={newProject.spv} onChange={e => setNewProject({ ...newProject, spv: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Category</label>
                                                <select className="w-full px-3 py-2.5 text-sm border rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[#0B74B0] outline-none dark:bg-gray-800 dark:border-gray-700"
                                                    value={newProject.projectType} onChange={e => setNewProject({ ...newProject, projectType: e.target.value })}>
                                                    <option value="">Select...</option>
                                                    {(dropdownOptions?.types || ['PPA', 'Merchant', 'Group', 'EPC']).map((t: string) => (
                                                        <option key={t} value={t}>{t}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Capacity (MW)</label>
                                                <input required type="number" step="0.1"
                                                    className="w-full px-3 py-2.5 text-sm border rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[#0B74B0] outline-none dark:bg-gray-800 dark:border-gray-700 appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                                    value={newProject.capacity || ''} onChange={e => setNewProject({ ...newProject, capacity: parseFloat(e.target.value) || 0 })} />
                                            </div>
                                        </div>
                                        {/* Row 3 */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Plot Location</label>
                                                <input type="text" placeholder="e.g. S-08"
                                                    className="w-full px-3 py-2.5 text-sm border rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[#0B74B0] outline-none dark:bg-gray-800 dark:border-gray-700"
                                                    value={newProject.plotLocation} onChange={e => setNewProject({ ...newProject, plotLocation: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Plot No</label>
                                                <input type="text" placeholder="e.g. A12a"
                                                    className="w-full px-3 py-2.5 text-sm border rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[#0B74B0] outline-none dark:bg-gray-800 dark:border-gray-700"
                                                    value={newProject.plotNo} onChange={e => setNewProject({ ...newProject, plotNo: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Fiscal Year</label>
                                                <select className="w-full px-3 py-2.5 text-sm border rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[#0B74B0] outline-none dark:bg-gray-800 dark:border-gray-700"
                                                    value={newProject.fiscalYear} onChange={e => setNewProject({ ...newProject, fiscalYear: e.target.value })}>
                                                    <option value={getCurrentFiscalYear()}>{getCurrentFiscalYear()} (Current)</option>
                                                    <option value={`FY_${parseInt(getCurrentFiscalYear().split('_')[1].split('-')[0]) + 1}-${parseInt(getCurrentFiscalYear().split('-')[1]) + 1}`}>Next FY</option>
                                                    <option value={`FY_${parseInt(getCurrentFiscalYear().split('_')[1].split('-')[0]) - 1}-${parseInt(getCurrentFiscalYear().split('-')[1]) - 1}`}>Prev FY</option>
                                                </select>
                                            </div>
                                        </div>
                                        {/* Row 4: Milestones */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Trial Run Plan</label>
                                                <input type="text" placeholder="e.g. Apr-25"
                                                    className="w-full px-3 py-2.5 text-sm border rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[#0B74B0] outline-none dark:bg-gray-800 dark:border-gray-700"
                                                    value={newProject.trialRun} onChange={e => setNewProject({ ...newProject, trialRun: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Charging Plan</label>
                                                <input type="text" placeholder="e.g. May-25"
                                                    className="w-full px-3 py-2.5 text-sm border rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[#0B74B0] outline-none dark:bg-gray-800 dark:border-gray-700"
                                                    value={newProject.chargingPlan} onChange={e => setNewProject({ ...newProject, chargingPlan: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">COD Plan</label>
                                                <input type="text" placeholder="e.g. Jun-25"
                                                    className="w-full px-3 py-2.5 text-sm border rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[#0B74B0] outline-none dark:bg-gray-800 dark:border-gray-700"
                                                    value={newProject.codPlan} onChange={e => setNewProject({ ...newProject, codPlan: e.target.value })} />
                                            </div>
                                        </div>
                                        <div className="pt-4 flex items-center justify-between border-t border-gray-200 dark:border-gray-700">
                                            <p className="text-[10px] text-gray-400">* Required fields. 2 rows (Plan, Actual) will be auto-created.</p>
                                            <button type="submit" disabled={createProjectMutation.isPending}
                                                className="px-8 py-3 bg-[#0B74B0] hover:bg-[#095a87] text-white rounded-xl font-bold text-sm transition-all shadow-lg hover:shadow-xl disabled:opacity-50 flex items-center gap-2">
                                                {createProjectMutation.isPending ? 'Processing...' : (
                                                    <>
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                        </svg>
                                                        Create Project & Initialize Table
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'logs' && (
                        <div className="animate-fade-in">
                            <AuditLogs />
                        </div>
                    )}

                </div>
            </div>

            {/* Edit User Modal */}
            {editingUser && (
                <EditUserModal
                    isOpen={!!editingUser}
                    onClose={() => setEditingUser(null)}
                    user={editingUser}
                    allProjects={allProjects}
                    onUpdate={(id, data) => updateUserMutation.mutate({ id, ...data })}
                    isUpdating={updateUserMutation.isPending}
                />
            )}
        </div>
    );
}
