import { API_BASE } from '../lib/config';
import { getCurrentFiscalYear } from '../lib/utils';

import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import SearchableDropdown from './SearchableDropdown';
import EditableProjectTable from './EditableProjectTable';
import AdminPanel from './AdminPanel';

// Define the structure for dropdown options
interface DropdownOptions {
    groups: string[];
    ppaMerchants: string[];
    types: string[];
    locationCodes: string[];
    locations: string[];
    connectivities: string[];
    sections: string[];
    categories: string[];
    priorities: string[];  // P1, P2, P3 etc.
}

// Define the structure for location relationships
interface LocationRelationship {
    location: string;
    locationCode: string;
}

// Define the structure for a manual project entry
interface NewProjectData {
    baseType: string;
    baseLocation: string;
    category: string;
    section: string;
    projectName: string;
    spv: string;
    projectType: string;
    capacity: number;
    fiscalYear: string;
    priority: string;
    plotLocation: string;
    plotNo: string;
}

export default function MasterDataTable({ fiscalYear, setFiscalYear }: { fiscalYear: string; setFiscalYear: (year: string) => void }) {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'groups' | 'locations' | 'projects' | 'manage' | 'admin'>('manage');

    const [newProject, setNewProject] = useState<NewProjectData>({
        baseType: '',
        baseLocation: '',
        category: '',
        section: 'A',
        projectName: '',
        spv: '',
        projectType: '',
        capacity: 0,
        fiscalYear: getCurrentFiscalYear(),
        priority: '',
        plotLocation: '',
        plotNo: ''
    });

    // --- EXISTING DROPDOWN OPTION STATES ---
    const [newOption, setNewOption] = useState({
        category: 'types',
        value: ''
    });

    const [editingOption, setEditingOption] = useState<{
        category: keyof DropdownOptions;
        index: number;
        value: string;
    } | null>(null);

    // --- EXISTING RELATIONSHIP STATES ---
    const [newRelationship, setNewRelationship] = useState<LocationRelationship>({
        location: '',
        locationCode: ''
    });

    const [editingRelationship, setEditingRelationship] = useState<{
        index: number;
        relationship: LocationRelationship;
    } | null>(null);

    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean;
        message: string;
        onConfirm: () => void;
        onCancel: () => void;
    } | null>(null);

    // --- DATA FETCHING ---
    const { data: masterData, isLoading, error } = useQuery({
        queryKey: ['masterData', fiscalYear],
        queryFn: async () => {
            // 1) Fetch configured dropdown options (The source of truth for management)
            const dropdownResponse = await fetch(`${API_BASE}/api/dropdown-options?fiscalYear=${fiscalYear}`);
            if (!dropdownResponse.ok) throw new Error('Failed to fetch dropdown options');
            const configuredOptions = await dropdownResponse.json();

            // 2) Also fetch distinct values currently in use in projects (Good for auto-fill/context)
            const distinctResponse = await fetch(`${API_BASE}/api/distinct-values?fiscalYear=${fiscalYear}`);
            if (!distinctResponse.ok) throw new Error('Failed to fetch distinct values');
            const distinctData = await distinctResponse.json();

            // 3) Fetch location relationships
            const relResponse = await fetch(`${API_BASE}/api/location-relationships?fiscalYear=${fiscalYear}`);
            if (!relResponse.ok) throw new Error('Failed to fetch location relationships');
            const relationships = await relResponse.json();

            // Merge configured options with distinct values to ensurer nothing is missed
            // Configured options take precedence
            return {
                dropdownOptions: {
                    groups: configuredOptions.groups || distinctData.groups || [],
                    ppaMerchants: configuredOptions.ppaMerchants || distinctData.ppaMerchants || [],
                    types: configuredOptions.types || distinctData.types || [],
                    locationCodes: configuredOptions.locationCodes || [],
                    locations: configuredOptions.locations || distinctData.locations || [],
                    connectivities: configuredOptions.connectivities || [],
                    sections: configuredOptions.sections || distinctData.sections || ['A', 'B', 'C', 'D'],
                    categories: configuredOptions.categories || distinctData.categories || ['Solar', 'Wind'],
                    priorities: configuredOptions.priorities || distinctData.priorities || ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10']
                },
                locationRelationships: relationships || []
            };
        },
        staleTime: 5 * 60 * 1000,
    });

    // --- MUTATIONS ---
    const addProjectMutation = useMutation({
        mutationFn: async (project: NewProjectData) => {
            const response = await fetch(`${API_BASE}/api/manual-add-project`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(project),
            });
            if (!response.ok) throw new Error(await response.text());
            return response.json();
        },
        onSuccess: () => {
            alert('Project added successfully! It will now show up in the Commissioning Status page.');
            queryClient.invalidateQueries({ queryKey: ['commissioning-projects'] });
            setNewProject({ ...newProject, projectName: '', capacity: 0 }); // Reset partial form
        },
        onError: (err) => alert('Error adding project: ' + err.message)
    });

    const saveDropdownOptionsMutation = useMutation({
        mutationFn: async (options: DropdownOptions) => {
            const response = await fetch(`${API_BASE}/api/dropdown-options?fiscalYear=${fiscalYear}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(options),
            });
            if (!response.ok) throw new Error(await response.text());
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['masterData', fiscalYear] });
        }
    });

    const saveLocationRelationshipsMutation = useMutation({
        mutationFn: async (relationships: LocationRelationship[]) => {
            const response = await fetch(`${API_BASE}/api/location-relationships?fiscalYear=${fiscalYear}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(relationships),
            });
            if (!response.ok) throw new Error(await response.text());
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['masterData', fiscalYear] });
            alert('Location mappings saved successfully!');
        }
    });

    const cloneFiscalYearMutation = useMutation({
        mutationFn: async ({ from, to }: { from: string, to: string }) => {
            const response = await fetch(`${API_BASE}/api/clone-fiscal-year`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fromFY: from, toFY: to }),
            });
            if (!response.ok) throw new Error(await response.text());
            return response.json();
        },
        onSuccess: (data) => {
            alert(data.message || 'Data carried over successfully!');
            queryClient.invalidateQueries({ queryKey: ['masterData'] });
            queryClient.invalidateQueries({ queryKey: ['commissioning-projects'] });
        },
        onError: (err) => alert('Error carrying over data: ' + err.message)
    });

    // --- EXTRACT DATA ---
    const dropdownOptions = masterData?.dropdownOptions || {
        groups: [], ppaMerchants: [], types: [], locationCodes: [], locations: [], connectivities: [], sections: [], categories: [], priorities: []
    };
    const locationRelationships = masterData?.locationRelationships || [];

    // --- HANDLERS ---
    const handleAddProject = () => {
        if (!newProject.projectName.trim() || !newProject.spv || !newProject.section) {
            alert('Please fill in all mandatory fields (Name, SPV, Section).');
            return;
        }

        // Auto-map fiscal year
        const projectToSave = { ...newProject, fiscalYear };
        if (projectToSave.baseType && projectToSave.baseLocation) {
            projectToSave.category = `${projectToSave.baseLocation} ${projectToSave.baseType}`.trim();
        } else if (!projectToSave.category) {
            projectToSave.category = projectToSave.baseType || 'Solar';
        }
        addProjectMutation.mutate(projectToSave);
    };

    const handleCloneFY = () => {
        if (fiscalYear === 'FY_24-25') {
            alert('Please select a target year (e.g., FY 25-26 or FY 26-27) to carry over data TO.');
            return;
        }

        const from = fiscalYear === 'FY_26-27' ? 'FY_25-26' : 'FY_24-25';
        if (confirm(`This will copy all project definitions and dropdown options from ${from} to ${fiscalYear}. Monthly values will be reset to 0. Continue?`)) {
            cloneFiscalYearMutation.mutate({ from, to: fiscalYear });
        }
    };

    const handleAddOption = () => {
        if (!newOption.value.trim()) return;
        const cat = newOption.category as keyof DropdownOptions;
        if (dropdownOptions[cat].includes(newOption.value)) return;

        const updated = { ...dropdownOptions, [cat]: [...dropdownOptions[cat], newOption.value] };
        saveDropdownOptionsMutation.mutate(updated);
        setNewOption({ ...newOption, value: '' });
    };

    const handleDeleteOption = (category: keyof DropdownOptions, index: number) => {
        if (!window.confirm('Are you sure you want to delete this option?')) return;
        const updated = { ...dropdownOptions, [category]: dropdownOptions[category].filter((_: string, i: number) => i !== index) };
        saveDropdownOptionsMutation.mutate(updated);
    };

    if (isLoading) return <div className="p-8 text-center text-gray-500">Loading Master Data...</div>;

    return (
        <div className="p-0">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Master Data Management</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Manage structure, dropdowns, and project definitions</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Fiscal Year:</span>
                    <select
                        value={fiscalYear}
                        onChange={(e) => setFiscalYear(e.target.value)}
                        className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="FY_25-26">FY 25-26</option>
                        <option value="FY_26-27">FY 26-27</option>
                        <option value="FY_24-25">FY 24-25</option>
                    </select>
                    <button
                        onClick={handleCloneFY}
                        disabled={cloneFiscalYearMutation.isPending}
                        className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-md text-sm font-bold shadow-sm flex items-center gap-2"
                        title="Copy project names and dropdowns from previous year"
                    >
                        {cloneFiscalYearMutation.isPending ? 'Copying...' : '🔄 Carry Over from Prev Year'}
                    </button>
                </div>
            </div>

            <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
                <nav className="flex space-x-8">
                    {[
                        { id: 'manage', label: '✏️ Manage Data', color: 'green' },
                        ...(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' ? [
                            { id: 'admin', label: '🛡️ Admin', color: 'red' }
                        ] : [])
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id
                                ? 'border-[#0B74B0] text-[#0B74B0] dark:border-[#60a5fa] dark:text-[#60a5fa]'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* --- ADD NEW PROJECT TAB --- */}
            {activeTab === 'projects' && (
                <div className="max-w-5xl bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Create New Project Definition</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Fill in all project-level details. Plan & Actual rows will be auto-created.</p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {/* Row 1 */}
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Type *</label>
                            <select required className="w-full px-3 py-2.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-[#0B74B0] outline-none"
                                value={newProject.baseType} onChange={e => setNewProject({ ...newProject, baseType: e.target.value, baseLocation: '' })}>
                                <option value="">Select...</option>
                                <option value="Solar">Solar</option>
                                <option value="Wind">Wind</option>
                                <option value="Hybrid">Hybrid</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Location *</label>
                            <select required disabled={!newProject.baseType} className="w-full px-3 py-2.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-[#0B74B0] outline-none disabled:opacity-50"
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
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Project Name *</label>
                            <input required type="text" placeholder="e.g. Khavda Solar Phase 2"
                                className="w-full px-3 py-2.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-[#0B74B0] outline-none"
                                value={newProject.projectName} onChange={e => setNewProject({ ...newProject, projectName: e.target.value })} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-5">
                        {/* Row 2 */}
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">SPV *</label>
                            <input required type="text" placeholder="e.g. ARE56L"
                                className="w-full px-3 py-2.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-[#0B74B0] outline-none"
                                value={newProject.spv} onChange={e => setNewProject({ ...newProject, spv: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Category</label>
                            <select className="w-full px-3 py-2.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-[#0B74B0] outline-none"
                                value={newProject.projectType} onChange={e => setNewProject({ ...newProject, projectType: e.target.value })}>
                                <option value="">Select...</option>
                                {(dropdownOptions?.types || ['PPA', 'Merchant', 'Group']).map((t: string) => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Capacity (MW)</label>
                            <input required type="number" step="0.1"
                                className="w-full px-3 py-2.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-[#0B74B0] outline-none appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                value={newProject.capacity || ''} onChange={e => setNewProject({ ...newProject, capacity: parseFloat(e.target.value) || 0 })} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-5">
                        {/* Row 3 */}
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Plot Location</label>
                            <input type="text" placeholder="e.g. S-08"
                                className="w-full px-3 py-2.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-[#0B74B0] outline-none"
                                value={newProject.plotLocation} onChange={e => setNewProject({ ...newProject, plotLocation: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Plot No</label>
                            <input type="text" placeholder="e.g. A12a"
                                className="w-full px-3 py-2.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-[#0B74B0] outline-none"
                                value={newProject.plotNo} onChange={e => setNewProject({ ...newProject, plotNo: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Fiscal Year</label>
                            <select className="w-full px-3 py-2.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-[#0B74B0] outline-none"
                                value={newProject.fiscalYear} onChange={e => setNewProject({ ...newProject, fiscalYear: e.target.value })}>
                                <option value="FY_25-26">FY 25-26 (Current)</option>
                                <option value="FY_26-27">FY 26-27 (Next)</option>
                                <option value="FY_24-25">FY 24-25 (Prev)</option>
                            </select>
                        </div>
                    </div>

                    <div className="mt-8 flex items-center justify-between">
                        <p className="text-[10px] text-gray-400">* Required fields. 2 rows (Plan, Actual) will be auto-created.</p>
                        <button
                            onClick={handleAddProject}
                            disabled={addProjectMutation.isPending}
                            className="px-6 py-2.5 bg-[#0B74B0] hover:bg-[#095a87] text-white rounded-lg font-bold text-sm shadow-md transition-all flex items-center gap-2"
                        >
                            {addProjectMutation.isPending ? 'Saving...' : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Create Project & Initialize Table
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* --- DROPDOWN OPTIONS TAB --- */}
            {activeTab === 'groups' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Object.entries(dropdownOptions).map(([cat, opts]) => (
                        <div key={cat} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                                <h5 className="font-bold text-sm text-gray-700 dark:text-gray-300 capitalize">{cat.replace(/([A-Z])/g, ' $1')}</h5>
                                <span className="text-[10px] bg-[#0B74B0]/10 text-[#0B74B0] px-2 py-0.5 rounded-full font-bold">{(opts as string[]).length}</span>
                            </div>
                            <div className="p-4">
                                <div className="flex gap-2 mb-4">
                                    <input
                                        type="text"
                                        className="flex-1 text-xs px-2 py-1.5 border rounded dark:bg-gray-900 dark:border-gray-700 outline-none focus:ring-1 focus:ring-blue-500"
                                        placeholder="Add new..."
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const val = (e.target as HTMLInputElement).value;
                                                if (val.trim()) {
                                                    const updated = { ...dropdownOptions, [cat]: [...(opts as string[]), val.trim()] };
                                                    saveDropdownOptionsMutation.mutate(updated);
                                                    (e.target as HTMLInputElement).value = '';
                                                }
                                            }
                                        }}
                                    />
                                </div>
                                <ul className="space-y-1 max-h-48 overflow-y-auto">
                                    {(opts as string[]).map((opt, i) => (
                                        <li key={i} className="group flex justify-between items-center text-xs text-gray-600 dark:text-gray-400 py-1.5 px-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors">
                                            <span>{opt}</span>
                                            <button
                                                onClick={() => handleDeleteOption(cat as any, i)}
                                                className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* --- LOCATIONS TAB --- */}
            {activeTab === 'locations' && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="p-6">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Location Mappings</h3>
                                <p className="text-sm text-gray-500">Map literal project locations to their standardized tracking codes.</p>
                            </div>
                            <button
                                onClick={() => saveLocationRelationshipsMutation.mutate(locationRelationships)}
                                disabled={saveLocationRelationshipsMutation.isPending}
                                className="px-4 py-2 bg-[#0B74B0] hover:bg-[#095a87] text-white rounded-lg text-sm font-bold shadow-sm transition-all"
                            >
                                {saveLocationRelationshipsMutation.isPending ? 'Saving...' : 'Save All Mappings'}
                            </button>
                        </div>

                        <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-900">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Location Name</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Standard Code</th>
                                        <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                    {/* Add New Row */}
                                    <tr className="bg-blue-50/30 dark:bg-blue-900/10">
                                        <td className="px-6 py-4">
                                            <input
                                                type="text"
                                                value={newRelationship.location}
                                                onChange={(e) => setNewRelationship({ ...newRelationship, location: e.target.value })}
                                                placeholder="e.g. Khavda Phase 1"
                                                className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-700 dark:bg-gray-900"
                                            />
                                        </td>
                                        <td className="px-6 py-4">
                                            <input
                                                type="text"
                                                value={newRelationship.locationCode}
                                                onChange={(e) => setNewRelationship({ ...newRelationship, locationCode: e.target.value })}
                                                placeholder="e.g. Khavda"
                                                className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-700 dark:bg-gray-900"
                                            />
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => {
                                                    if (!newRelationship.location || !newRelationship.locationCode) return;
                                                    const updated = [...locationRelationships, newRelationship];
                                                    saveLocationRelationshipsMutation.mutate(updated);
                                                    setNewRelationship({ location: '', locationCode: '' });
                                                }}
                                                className="text-[#0B74B0] hover:text-[#095a87] font-bold text-xs"
                                            >
                                                Add Mapping
                                            </button>
                                        </td>
                                    </tr>
                                    {locationRelationships.map((rel: LocationRelationship, idx: number) => (
                                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">{rel.location}</td>
                                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">{rel.locationCode}</td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => {
                                                        if (!confirm('Delete this mapping?')) return;
                                                        const updated = locationRelationships.filter((_: any, i: number) => i !== idx);
                                                        saveLocationRelationshipsMutation.mutate(updated);
                                                    }}
                                                    className="text-red-500 hover:text-red-700 text-xs"
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MANAGE DATA TAB --- */}
            {activeTab === 'manage' && (
                <EditableProjectTable
                    fiscalYear={fiscalYear}
                    categoryFilter="all"
                />
            )}

            {/* --- ADMIN TAB --- */}
            {activeTab === 'admin' && (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
                <AdminPanel />
            )}
        </div>
    );
}
