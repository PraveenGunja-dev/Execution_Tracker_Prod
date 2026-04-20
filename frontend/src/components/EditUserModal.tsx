import React, { useState, useEffect } from 'react';

interface Project {
    id: number;
    projectName: string;
    spv: string;
    plotLocation: string;
    category: string;
    fiscalYear: string;
    key: string;
}

interface User {
    id: number;
    username: string;
    email: string;
    role: string;
    scope: string;
}

interface EditUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User;
    allProjects: Project[];
    onUpdate: (userId: number, data: { role: string, scope: string }) => void;
    isUpdating: boolean;
}

export default function EditUserModal({ isOpen, onClose, user, allProjects, onUpdate, isUpdating }: EditUserModalProps) {
    const [role, setRole] = useState(user.role.toUpperCase());
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (isOpen && user) {
            setRole(user.role.toUpperCase());

            // Parse Scope
            const scope = user.scope || 'all';
            if (scope === 'all') {
                setSelectedCategory('all');
                setSelectedProjects([]);
            } else if (scope.startsWith('{')) {
                // JSON format
                try {
                    const parsed = JSON.parse(scope);
                    setSelectedCategory(parsed.category || 'solar');
                    setSelectedProjects(parsed.projects || []);
                } catch (e) {
                    console.error("Failed to parse user scope", e);
                    setSelectedCategory('all');
                }
            } else if (scope.includes(':')) {
                // Legacy Format: category:proj1,proj2
                const [cat, projs] = scope.split(':');
                setSelectedCategory(cat);
                const names = projs.split(',');
                const matchingKeys = allProjects
                    .filter(p => p.category.toLowerCase().includes(cat) && names.includes(p.projectName))
                    .map(p => p.key);
                setSelectedProjects(matchingKeys);
            } else {
                // Legacy: 'solar' or 'wind'
                setSelectedCategory(scope);
                setSelectedProjects([]);
            }
        }
    }, [isOpen, user, allProjects]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        let newScope = 'all';
        if (selectedCategory !== 'all') {
            if (selectedProjects.length === 0) {
                newScope = selectedCategory;
            } else {
                newScope = JSON.stringify({
                    category: selectedCategory,
                    projects: selectedProjects
                });
            }
        }

        onUpdate(user.id, { role, scope: newScope });
    };

    if (!isOpen) return null;

    // Filter projects for display
    const filteredProjects = allProjects.filter(p => {
        const matchesCategory = selectedCategory === 'all' ? true : p.category.toLowerCase().includes(selectedCategory);
        const searchRegex = new RegExp(searchQuery, 'i');
        const matchesSearch = !searchQuery || searchRegex.test(p.projectName) || searchRegex.test(p.spv) || searchRegex.test(p.plotLocation) || searchRegex.test(p.fiscalYear);
        return matchesCategory && matchesSearch;
    });

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border border-gray-200 dark:border-gray-800 flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Edit User Access</h3>
                        <p className="text-xs text-gray-500">Update role and project permissions for <span className="font-semibold text-blue-600">@{user.username}</span></p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    <form onSubmit={handleSubmit} className="space-y-6">

                        {/* Role Selection */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Access Role</label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {[
                                    { id: 'VIEWER', label: 'Viewer', desc: 'Read-only' },
                                    { id: 'EDITOR', label: 'Editor', desc: 'Edit Data' },
                                    { id: 'ADMIN', label: 'Admin', desc: 'Full Control' },
                                    { id: 'SUPER_ADMIN', label: 'CEO', desc: 'Main Views' }
                                ].map((r) => (
                                    <label key={r.id} className={`
                                        cursor-pointer relative flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all
                                        ${role === r.id
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                                            : 'border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-800 text-gray-600 dark:text-gray-400'}
                                    `}>
                                        <input type="radio" name="editRole" value={r.id} className="sr-only" checked={role === r.id} onChange={() => setRole(r.id)} />
                                        <span className="font-bold text-xs">{r.label}</span>
                                        <span className="text-[9px] opacity-70 mt-1 whitespace-nowrap">{r.desc}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Project Access */}
                        <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Project Access Scope</label>

                            {/* Category Selector */}
                            <select
                                value={selectedCategory}
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                                    setSelectedCategory(e.target.value);
                                    setSelectedProjects([]); // Reset projects when category changes
                                    setSearchQuery(''); // Clear search on category change
                                }}
                                className="w-full px-4 py-2.5 text-sm border rounded-xl bg-gray-50 dark:bg-gray-800 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="all">Global Access (All Projects)</option>
                                <option value="solar">Solar Projects Only</option>
                                <option value="wind">Wind Projects Only</option>
                            </select>

                            {/* Project List (if category selected) */}
                            {selectedCategory !== 'all' && (
                                <div className="space-y-2 animate-fade-in">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs text-gray-500 px-1 gap-2">
                                        <span>Select specific projects (Optional)</span>
                                        <div className="flex gap-3 items-center w-full sm:w-auto">
                                            <input
                                                type="text"
                                                placeholder="Search projects by name, SPV..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className="flex-1 sm:w-64 px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                            {filteredProjects.length > 0 && filteredProjects.some(p => !selectedProjects.includes(p.key)) && (
                                                <button type="button" onClick={() => setSelectedProjects(prev => Array.from(new Set([...prev, ...filteredProjects.map(p => p.key)])))} className="text-blue-500 font-bold hover:underline uppercase text-[10px] whitespace-nowrap">
                                                    Select Displayed
                                                </button>
                                            )}
                                            {selectedProjects.length > 0 && (
                                                <button type="button" onClick={() => setSelectedProjects([])} className="text-red-500 font-bold hover:underline uppercase text-[10px] whitespace-nowrap">
                                                    Clear All
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 p-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 custom-scrollbar">
                                        {filteredProjects.length === 0 ? (
                                            <div className="col-span-full p-4 text-center text-sm text-gray-400">No projects found in this category</div>
                                        ) : (
                                            filteredProjects.map(p => (
                                                <label key={p.key} className={`
                                                    flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors border
                                                    ${selectedProjects.includes(p.key)
                                                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                                                        : 'hover:bg-gray-50 dark:hover:bg-gray-800 border-transparent'}
                                                `}>
                                                    <div className={`
                                                        w-4 h-4 rounded border flex items-center justify-center transition-colors
                                                        ${selectedProjects.includes(p.key)
                                                            ? 'bg-blue-500 border-blue-500 text-white'
                                                            : 'border-gray-300 dark:border-gray-600'}
                                                    `}>
                                                        {selectedProjects.includes(p.key) && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                                    </div>
                                                    <input
                                                        type="checkbox"
                                                        className="hidden"
                                                        checked={selectedProjects.includes(p.key)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedProjects([...selectedProjects, p.key]);
                                                            } else {
                                                                setSelectedProjects(selectedProjects.filter(k => k !== p.key));
                                                            }
                                                        }}
                                                    />
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{p.projectName}</span>
                                                        <span className="text-[10px] text-gray-500 truncate">{p.fiscalYear.replace('FY_', '20')} • {p.spv || 'No SPV'} • {p.plotLocation || 'No Plot'}</span>
                                                    </div>
                                                </label>
                                            ))
                                        )}
                                    </div>
                                    <p className="text-[10px] text-gray-400 text-center">
                                        {selectedProjects.length === 0
                                            ? `Access to ALL ${selectedCategory} projects`
                                            : `Restricted to ${selectedProjects.length} specific projects`}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="pt-4 flex items-center gap-3">
                            <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold text-sm transition-colors">
                                Cancel
                            </button>
                            <button type="submit" disabled={isUpdating} className="flex-1 py-2.5 bg-[#0B74B0] hover:bg-[#095a87] text-white rounded-xl font-bold text-sm shadow-lg hover:shadow-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                                {isUpdating ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        Saving...
                                    </>
                                ) : 'Save Changes'}
                            </button>
                        </div>

                    </form>
                </div>
            </div>
        </div>
    );
}
