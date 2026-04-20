import { API_BASE } from '../lib/config';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

interface CommissioningProject {
    id?: number;
    sno: number;
    projectName: string;
    spv: string;
    projectType: string;
    plotLocation: string;
    plotNo: string;
    capacity: number;
    planActual: string;
    apr: number | null;
    may: number | null;
    jun: number | null;
    jul: number | null;
    aug: number | null;
    sep: number | null;
    oct: number | null;
    nov: number | null;
    dec: number | null;
    jan: number | null;
    feb: number | null;
    mar: number | null;
    totalCapacity: number | null;
    cummTillOct: number | null;
    q1: number | null;
    q2: number | null;
    q3: number | null;
    q4: number | null;
    category: string;
    section: string;
    includedInTotal: boolean;
    priority?: string;
    trialRun?: string;
    chargingPlan?: string;
    codPlan?: string;
    milestones?: Record<string, MilestoneData[]>;
}

interface MilestoneData {
    mw: number;
    priority: string | null;
    trialRun: string | null;
    chargingDate: string | null;
    codDate: string | null;
}

interface EditableProjectTableProps {
    fiscalYear?: string;
    categoryFilter?: 'all' | 'solar' | 'wind';
}

const monthKeys = ['apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar'] as const;

const getMonthLabels = (fy: string) => {
    const startYear = parseInt(fy.split('_')[1].split('-')[0]) + 2000;
    return [
        `Apr-${startYear}`, `May-${startYear}`, `Jun-${startYear}`,
        `Jul-${startYear}`, `Aug-${startYear}`, `Sep-${startYear}`,
        `Oct-${startYear}`, `Nov-${startYear}`, `Dec-${startYear}`,
        `Jan-${startYear + 1}`, `Feb-${startYear + 1}`, `Mar-${startYear + 1}`
    ];
};

// Priority badge color mapping
const PRIORITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    P1: { bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-700 dark:text-red-300', border: 'border-red-200 dark:border-red-800' },
    P2: { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800' },
    P3: { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800' },
    P4: { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800' },
    P5: { bg: 'bg-violet-100 dark:bg-violet-900/40', text: 'text-violet-700 dark:text-violet-300', border: 'border-violet-200 dark:border-violet-800' },
    P6: { bg: 'bg-fuchsia-100 dark:bg-fuchsia-900/40', text: 'text-fuchsia-700 dark:text-fuchsia-300', border: 'border-fuchsia-200 dark:border-fuchsia-800' },
    P7: { bg: 'bg-indigo-100 dark:bg-indigo-900/40', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-200 dark:border-indigo-800' },
    P8: { bg: 'bg-cyan-100 dark:bg-cyan-900/40', text: 'text-cyan-700 dark:text-cyan-300', border: 'border-cyan-200 dark:border-cyan-800' },
    P9: { bg: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-800' },
    P10: { bg: 'bg-slate-100 dark:bg-slate-900/40', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-200 dark:border-slate-800' },
};

// Helper: format date for display (DD-MMM-YY)
const formatDateDisplay = (dateStr: string | null): string => {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${d.getDate().toString().padStart(2, '0')}-${months[d.getMonth()]}-${d.getFullYear().toString().slice(-2)}`;
    } catch { return ''; }
};

// ─── Milestone Status Indicator (compact dots in table) ─────
const MilestoneStatus = ({ milestones }: { milestones: Record<string, MilestoneData[]> | null }) => {
    if (!milestones) return <span className="text-gray-300 text-[10px]">—</span>;

    const totalMonths = monthKeys.length;
    let trCount = 0, chCount = 0, codCount = 0;
    monthKeys.forEach(m => {
        const mss = milestones[m] || [];
        if (mss.some(ms => ms.trialRun)) trCount++;
        if (mss.some(ms => ms.chargingDate)) chCount++;
        if (mss.some(ms => ms.codDate)) codCount++;
    });

    const items = [
        { label: 'TR', count: trCount, color: 'purple' },
        { label: 'CH', count: chCount, color: 'orange' },
        { label: 'COD', count: codCount, color: 'sky' },
    ];

    return (
        <div className="flex items-center gap-1">
            {items.map(it => (
                <div
                    key={it.label}
                    title={`${it.label}: ${it.count}/${totalMonths} months completed`}
                    className={`relative w-[22px] h-[22px] rounded-full flex items-center justify-center text-[7px] font-black border transition-all ${it.count > 0
                        ? `bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700`
                        : `bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 border-gray-200 dark:border-gray-700`
                        }`}
                >
                    {it.count > 0 ? it.count : it.label[0]}
                </div>
            ))}
        </div>
    );
};


// ═════════════════════════════════════════════════════════════
// ─── PROJECT EDIT MODAL ─────────────────────────────────────
// ═════════════════════════════════════════════════════════════
const ProjectEditModal = ({
    project,
    fiscalYear,
    monthLabels,
    onSave,
    onClose,
    isSaving,
}: {
    project: CommissioningProject;
    fiscalYear: string;
    monthLabels: string[];
    onSave: (id: number, updates: Partial<CommissioningProject>, milestones: Record<string, MilestoneData[]>) => void;
    onClose: () => void;
    isSaving: boolean;
}) => {
    const [edited, setEdited] = useState<Partial<CommissioningProject>>({ ...project });
    const [milestones, setMilestones] = useState<Record<string, MilestoneData[]>>({});
    const [loadingMilestones, setLoadingMilestones] = useState(true);

    // Fetch milestones for this project
    useEffect(() => {
        if (!project.id) return;
        setLoadingMilestones(true);
        fetch(`${API_BASE}/api/project-milestones?projectId=${project.id}&fiscalYear=${fiscalYear}`)
            .then(r => r.json())
            .then(data => {
                // Backfill from project monthly values if no milestones exist or only empty defaults exist
                const backfilled: Record<string, MilestoneData[]> = {};
                monthKeys.forEach(m => {
                    const backendRows = data[m] || [];
                    // A row is "empty" if MW is 0 and no dates are set
                    const hasRealData = backendRows.some(r => (r.mw > 0) || r.trialRun || r.chargingDate || r.codDate);
                    
                    if (hasRealData) {
                        backfilled[m] = backendRows;
                    } else {
                        // Use project's existing monthly capacity as the first tranche
                        const val = (project as any)[m] || 0;
                        backfilled[m] = [{ 
                            mw: val, 
                            priority: val > 0 ? 'P1' : null,
                            trialRun: null, 
                            chargingDate: null, 
                            codDate: null 
                        }];
                    }
                });
                setMilestones(backfilled);
                setLoadingMilestones(false);
            })
            .catch(() => setLoadingMilestones(false));
    }, [project.id, fiscalYear]);

    const handleChange = (field: keyof CommissioningProject, value: any) => {
        setEdited(prev => ({ ...prev, [field]: value }));
    };

    const milestoneStats = useMemo(() => {
        let tr = 0, ch = 0, cod = 0;
        monthKeys.forEach(m => {
            const mss = milestones[m] || [];
            if (mss.some(ms => ms.trialRun)) tr++;
            if (mss.some(ms => ms.chargingDate)) ch++;
            if (mss.some(ms => ms.codDate)) cod++;
        });
        return { tr, ch, cod };
    }, [milestones]);

    const handleMilestoneChange = (month: string, index: number, field: keyof MilestoneData, value: any) => {
        setMilestones(prev => {
            const current = [...(prev[month] || [])];
            if (!current[index]) return prev;
            
            let updatedRow = { ...current[index], [field]: value };
            
            // Auto-default priority to P1 if any value is filled but priority is empty
            if (['mw', 'chargingDate', 'trialRun', 'codDate'].includes(field)) {
                const hasValue = field === 'mw' ? (Number(value) > 0) : !!value;
                if (hasValue && !updatedRow.priority) {
                    updatedRow.priority = 'P1';
                }
            }

            current[index] = updatedRow;
            
            // If MW was changed, also update the project overall monthly field
            if (field === 'mw') {
                const totalMW = current.reduce((s, ms) => s + (ms.mw || 0), 0);
                handleChange(month as any, totalMW);
            }
            
            return { ...prev, [month]: current };
        });
    };

    const addMilestoneRow = (month: string) => {
        setMilestones(prev => ({
            ...prev,
            [month]: [
                ...(prev[month] || []),
                { mw: 0, priority: null, trialRun: null, chargingDate: null, codDate: null }
            ]
        }));
    };

    const removeMilestoneRow = (month: string, index: number) => {
        setMilestones(prev => {
            const current = (prev[month] || []).filter((_, i) => i !== index);
            if (current.length === 0) {
                current.push({ mw: 0, priority: null, trialRun: null, chargingDate: null, codDate: null });
            }
            
            // Update project monthly field
            const totalMW = current.reduce((s, ms) => s + (ms.mw || 0), 0);
            handleChange(month as any, totalMW);
            
            return { ...prev, [month]: current };
        });
    };

    const handleSave = () => {
        if (!project.id) return;
        const { priority, ...updates } = edited; // Strip top-level priority
        onSave(project.id, updates, milestones);
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                transition={{ type: 'spring', duration: 0.4 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-[95vw] max-h-[95vh] overflow-hidden border border-gray-200 dark:border-gray-700"
            >
                {/* ─── Modal Header ─── */}
                <div className="bg-gradient-to-r from-[#0B74B0] to-[#064E77] px-6 py-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-black text-white tracking-tight">{project.projectName}</h2>
                        <p className="text-xs text-white/70 font-semibold mt-0.5">
                            {project.category} • {project.planActual} • {project.spv || 'No SPV'}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-white/80 hover:text-white transition-colors p-1">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="overflow-y-auto max-h-[calc(92vh-140px)] p-6 space-y-6">

                    {/* ─── Section 1: Project Identity + Priority ─── */}
                    <div>
                        <h3 className="text-sm font-black text-gray-800 dark:text-white uppercase tracking-widest mb-3 flex items-center gap-2">
                            <span className="w-1.5 h-4 bg-[#0B74B0] rounded-full"></span>
                            Project Info
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <label className="text-[12px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Project Name</label>
                                <input
                                    type="text"
                                    value={edited.projectName || ''}
                                    onChange={(e) => handleChange('projectName', e.target.value)}
                                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B74B0] text-gray-900 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="text-[12px] font-bold text-gray-500 uppercase tracking-wider block mb-1">SPV</label>
                                <input
                                    type="text"
                                    value={edited.spv || ''}
                                    onChange={(e) => handleChange('spv', e.target.value)}
                                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B74B0] text-gray-900 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="text-[12px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Type</label>
                                <select
                                    value={edited.projectType || ''}
                                    onChange={(e) => handleChange('projectType', e.target.value)}
                                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B74B0] text-gray-900 dark:text-white"
                                >
                                    <option value="PPA">PPA</option>
                                    <option value="Merchant">Merchant</option>
                                    <option value="Group">Group</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[12px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Capacity (MW)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={edited.capacity ?? ''}
                                    onChange={(e) => handleChange('capacity', e.target.value === '' ? null : parseFloat(e.target.value))}
                                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B74B0] text-gray-900 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="text-[12px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Plot / Location</label>
                                <input
                                    type="text"
                                    value={edited.plotLocation || ''}
                                    onChange={(e) => handleChange('plotLocation', e.target.value)}
                                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B74B0] text-gray-900 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="text-[12px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Plot No</label>
                                <input
                                    type="text"
                                    value={(edited as any).plotNo || ''}
                                    onChange={(e) => handleChange('plotNo' as any, e.target.value)}
                                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B74B0] text-gray-900 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="text-[12px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Status</label>
                                <select
                                    value={edited.planActual || ''}
                                    onChange={(e) => handleChange('planActual', e.target.value)}
                                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B74B0] text-gray-900 dark:text-white"
                                >
                                    <option value="Plan">Plan</option>
                                    <option value="Actual">Actual</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[12px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Trial Run Plan</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Apr-25"
                                    value={edited.trialRun || ''}
                                    onChange={(e) => handleChange('trialRun', e.target.value)}
                                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B74B0] text-gray-900 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="text-[12px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Charging Plan</label>
                                <input
                                    type="text"
                                    placeholder="e.g. May-25"
                                    value={edited.chargingPlan || ''}
                                    onChange={(e) => handleChange('chargingPlan', e.target.value)}
                                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B74B0] text-gray-900 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="text-[12px] font-bold text-gray-500 uppercase tracking-wider block mb-1">COD Plan</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Jun-25"
                                    value={edited.codPlan || ''}
                                    onChange={(e) => handleChange('codPlan', e.target.value)}
                                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B74B0] text-gray-900 dark:text-white"
                                />
                            </div>
                        </div>
                    </div>

                    {/* ─── Section 2: Monthly Capacity + Milestones Grid ─── */}
                    <div>
                        <h3 className="text-sm font-black text-gray-800 dark:text-white uppercase tracking-widest mb-3 flex items-center gap-2">
                            <span className="w-1.5 h-4 bg-emerald-500 rounded-full"></span>
                            Monthly Capacity & Milestone Dates
                            <span className="ml-auto text-[10px] font-semibold text-gray-400 normal-case tracking-normal">
                                TR: {milestoneStats.tr}/12 • CH: {milestoneStats.ch}/12 • COD: {milestoneStats.cod}/12
                            </span>
                        </h3>

                        {loadingMilestones ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#0B74B0]"></div>
                                <span className="ml-2 text-sm text-gray-500">Loading milestones...</span>
                            </div>
                        ) : (
                            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-50 dark:bg-gray-800/80">
                                            <th className="px-3 py-2.5 text-left text-[12px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 min-w-[100px]">Month</th>
                                            <th className="px-3 py-2.5 text-center text-[12px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 min-w-[100px]">Priority</th>
                                            <th className="px-3 py-2.5 text-center text-[12px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 min-w-[100px]">MW</th>
                                            <th className="px-3 py-2.5 text-center text-[12px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 bg-orange-50/50 dark:bg-orange-900/20 min-w-[150px]">Charging</th>
                                            <th className="px-3 py-2.5 text-center text-[12px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 bg-purple-50/50 dark:bg-purple-900/20 min-w-[150px]">Trial Run</th>
                                            <th className="px-3 py-2.5 text-center text-[12px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 bg-sky-50/50 dark:bg-sky-900/20 min-w-[150px]">COD</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                        {monthKeys.map((m, idx) => {
                                            const mss = milestones[m] || [{ mw: 0, priority: null, trialRun: null, chargingDate: null, codDate: null }];
                                            const rowBg = idx % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-900/30';

                                            return (
                                                <React.Fragment key={m}>
                                                    {mss.map((ms, msIdx) => (
                                                        <tr key={`${m}-${msIdx}`} className={`${rowBg} hover:bg-gray-100/50 dark:hover:bg-gray-800/30 transition-colors`}>
                                                            {/* Month (only on first row of month) */}
                                                            <td className="px-3 py-2 font-bold text-gray-700 dark:text-gray-300 text-sm align-top">
                                                                {msIdx === 0 ? (
                                                                    <div className="flex flex-col gap-1">
                                                                        <span>{monthLabels[idx]}</span>
                                                                        <button 
                                                                            onClick={() => addMilestoneRow(m)}
                                                                            className="w-fit text-[11px] font-black text-[#0B74B0] hover:underline uppercase tracking-tighter"
                                                                        >
                                                                            + Add Go
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[10px] text-gray-400 font-bold ml-2">Go {msIdx + 1}</span>
                                                                        <button 
                                                                            onClick={() => removeMilestoneRow(m, msIdx)}
                                                                            className="text-red-400 hover:text-red-600"
                                                                        >
                                                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                            </svg>
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </td>

                                                            {/* Tranche Priority */}
                                                            <td className="px-2 py-1.5 text-center">
                                                                <input
                                                                    type="text"
                                                                    placeholder="—"
                                                                    value={ms.priority || ''}
                                                                    onChange={(e) => handleMilestoneChange(m, msIdx, 'priority', e.target.value.toUpperCase())}
                                                                    className={`w-full px-2 py-1.5 text-[12px] text-center border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B74B0] font-black uppercase transition-all ${ms.priority ? `${PRIORITY_COLORS[ms.priority]?.bg || 'bg-blue-50'} ${PRIORITY_COLORS[ms.priority]?.text || 'text-blue-600'} ${PRIORITY_COLORS[ms.priority]?.border || 'border-blue-200'}` : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}
                                                                />
                                                            </td>

                                                            {/* MW Capacity - individual for this go */}
                                                            <td className="px-2 py-1.5 text-center">
                                                                <input
                                                                    type="number"
                                                                    step="0.1"
                                                                    value={ms.mw ?? ''}
                                                                    onChange={(e) => handleMilestoneChange(m, msIdx, 'mw', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                                                    className={`w-full px-2 py-1.5 text-xs text-center border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B74B0] font-semibold ${(ms.mw ?? 0) > 0
                                                                        ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white'
                                                                        : 'bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800 text-gray-400'
                                                                        }`}
                                                                />
                                                            </td>

                                                            {/* Charging Date */}
                                                            <td className="px-2 py-1.5 text-center bg-orange-50/30 dark:bg-orange-900/10">
                                                                <div className="relative">
                                                                    <input
                                                                        type="date"
                                                                        value={ms.chargingDate ? String(ms.chargingDate).slice(0, 10) : ''}
                                                                        onChange={(e) => handleMilestoneChange(m, msIdx, 'chargingDate', e.target.value)}
                                                                        className={`w-full px-2 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400 ${ms.chargingDate
                                                                            ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 font-bold'
                                                                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                                                                            }`}
                                                                    />
                                                                    {ms.chargingDate && (
                                                                        <span className="absolute right-7 top-1/2 -translate-y-1/2 text-emerald-500 text-xs font-bold">✓</span>
                                                                    )}
                                                                </div>
                                                            </td>

                                                            {/* Trial Run Date */}
                                                            <td className="px-2 py-1.5 text-center bg-purple-50/30 dark:bg-purple-900/10">
                                                                <div className="relative">
                                                                    <input
                                                                        type="date"
                                                                        value={ms.trialRun ? String(ms.trialRun).slice(0, 10) : ''}
                                                                        onChange={(e) => handleMilestoneChange(m, msIdx, 'trialRun', e.target.value)}
                                                                        className={`w-full px-2 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-400 ${ms.trialRun
                                                                            ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 font-bold'
                                                                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                                                                            }`}
                                                                    />
                                                                    {ms.trialRun && (
                                                                        <span className="absolute right-7 top-1/2 -translate-y-1/2 text-emerald-500 text-xs font-bold">✓</span>
                                                                    )}
                                                                </div>
                                                            </td>

                                                            {/* COD Date */}
                                                            <td className="px-2 py-1.5 text-center bg-sky-50/30 dark:bg-sky-900/10">
                                                                <div className="relative">
                                                                    <input
                                                                        type="date"
                                                                        value={ms.codDate ? String(ms.codDate).slice(0, 10) : ''}
                                                                        onChange={(e) => handleMilestoneChange(m, msIdx, 'codDate', e.target.value)}
                                                                        className={`w-full px-2 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-400 ${ms.codDate
                                                                            ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 font-bold'
                                                                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                                                                            }`}
                                                                    />
                                                                    {ms.codDate && (
                                                                        <span className="absolute right-7 top-1/2 -translate-y-1/2 text-emerald-500 text-xs font-bold">✓</span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                    {/* Total row */}
                                    <tfoot>
                                        <tr className="bg-[#0B74B0]/5 dark:bg-[#0B74B0]/10 border-t-2 border-[#0B74B0]/20">
                                            <td className="px-3 py-2.5 font-black text-[#0B74B0] text-sm">TOTAL</td>
                                            <td className="px-3 py-2.5"></td>
                                            <td className="px-3 py-2.5 text-center font-black text-[#0B74B0] text-base">
                                                {monthKeys.reduce((s, m) => s + ((edited as any)[m] || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                            </td>
                                            <td className="px-3 py-2.5 text-center text-[12px] font-bold text-orange-600 bg-orange-50/30 dark:bg-orange-900/10">
                                                {milestoneStats.ch}/12
                                            </td>
                                            <td className="px-3 py-2.5 text-center text-[12px] font-bold text-purple-600 bg-purple-50/30 dark:bg-purple-900/10">
                                                {milestoneStats.tr}/12
                                            </td>
                                            <td className="px-3 py-2.5 text-center text-[12px] font-bold text-sky-600 bg-sky-50/30 dark:bg-sky-900/10">
                                                {milestoneStats.cod}/12
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* ─── Modal Footer ─── */}
                <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => { if (project.id) onSave(project.id, edited, milestones); }}
                        disabled={isSaving}
                        className="px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-[#0B74B0] to-[#064E77] hover:from-[#095a87] hover:to-[#053d5e] rounded-lg transition-all disabled:opacity-50 shadow-md shadow-[#0B74B0]/20 active:scale-95"
                    >
                        {isSaving ? (
                            <span className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Saving...
                            </span>
                        ) : 'Save Changes'}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
};


// ═════════════════════════════════════════════════════════════
// ─── MAIN TABLE COMPONENT ───────────────────────────────────
// ═════════════════════════════════════════════════════════════
export default function EditableProjectTable({ fiscalYear = 'FY_25-26', categoryFilter = 'all' }: EditableProjectTableProps) {
    const monthLabels = useMemo(() => getMonthLabels(fiscalYear), [fiscalYear]);
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [editModalProject, setEditModalProject] = useState<CommissioningProject | null>(null);
    const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'Plan' | 'Actual'>('all');
    const [priorityFilter, setPriorityFilter] = useState<'all' | 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6' | 'P7' | 'P8' | 'P9' | 'P10'>('all');
    const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; project: CommissioningProject | null }>({ show: false, project: null });
    // Cache milestones by project ID for table display
    const [milestonesCache, setMilestonesCache] = useState<Record<number, Record<string, MilestoneData[]>>>({});

    // Permission check
    const canEditProject = useCallback((project: CommissioningProject) => {
        if (!user) return false;
        if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') return true;
        if (user.role === 'VIEWER') return false;
        if (user.role === 'EDITOR') {
            const scope = user.scope || 'all';
            if (scope === 'all') return true;
            if (scope.startsWith('{')) {
                try {
                    const parsed = JSON.parse(scope);
                    const allowedCategory = parsed.category || '';
                    const allowedProjects = parsed.projects || [];
                    if (!project.category.toLowerCase().includes(allowedCategory.toLowerCase())) return false;
                    if (allowedProjects.length > 0) {
                        const key = `${project.projectName}|${project.spv || ''}|${project.plotLocation || ''}`;
                        return allowedProjects.includes(key);
                    }
                    return true;
                } catch (e) { return false; }
            }
            return project.category.toLowerCase().includes(scope.toLowerCase());
        }
        return false;
    }, [user]);

    // Fetch projects
    const { data: projects = [], isLoading, error } = useQuery<CommissioningProject[]>({
        queryKey: ['commissioning-projects', fiscalYear],
        queryFn: async () => {
            const response = await fetch(`${API_BASE}/api/commissioning-projects?fiscalYear=${fiscalYear}`);
            if (!response.ok) throw new Error('Failed to fetch projects');
            return response.json();
        },
    });

    // Update mutation — saves both project fields AND milestones
    const updateMutation = useMutation({
        mutationFn: async ({ id, updates, milestones }: { id: number; updates: Partial<CommissioningProject>; milestones: Record<string, MilestoneData[]> }) => {
            // 1) Update project fields
            const token = localStorage.getItem('token');
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            if (Object.keys(updates).length > 0) {
                const response = await fetch(`${API_BASE}/api/commissioning-projects/${id}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(updates),
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to update project');
                }
            }

            // 2) Save milestones
            const msResponse = await fetch(`${API_BASE}/api/project-milestones`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ projectId: id, fiscalYear, milestones }),
            });
            if (!msResponse.ok) {
                const errorData = await msResponse.json();
                throw new Error(errorData.error || 'Failed to save milestones');
            }

            return { id, milestones };
        },
        onSuccess: (data) => {
            // Force refetch across ALL pages (CEO Dashboard, Dashboard, Solar, Wind, Master Data)
            queryClient.invalidateQueries({ queryKey: ['commissioning-projects'], refetchType: 'all' });
            queryClient.invalidateQueries({ queryKey: ['solar-projects'], refetchType: 'all' });
            queryClient.invalidateQueries({ queryKey: ['wind-projects'], refetchType: 'all' });
            queryClient.invalidateQueries({ queryKey: ['masterData'], refetchType: 'all' });
            // Update milestones cache
            if (data.id && data.milestones) {
                setMilestonesCache(prev => ({ ...prev, [data.id]: data.milestones }));
            }
            setNotification({ type: 'success', message: 'Project & milestones updated!' });
            setEditModalProject(null);
            setTimeout(() => setNotification(null), 3000);
        },
        onError: (error: Error) => {
            setNotification({ type: 'error', message: error.message });
            setTimeout(() => setNotification(null), 5000);
        },
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            const token = localStorage.getItem('token');
            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch(`${API_BASE}/api/commissioning-projects?id=${id}`, { 
                method: 'DELETE',
                headers
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to delete project');
            }
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['commissioning-projects'] });
            queryClient.invalidateQueries({ queryKey: ['solar-projects'] });
            queryClient.invalidateQueries({ queryKey: ['wind-projects'] });
            setNotification({ type: 'success', message: 'Project deleted successfully' });
            setDeleteConfirm({ show: false, project: null });
            setTimeout(() => setNotification(null), 3000);
        },
        onError: (error: Error) => {
            setNotification({ type: 'error', message: error.message });
            setTimeout(() => setNotification(null), 5000);
        },
    });

    // Filter projects
    const filteredProjects = useMemo(() => {
        return projects.map(p => {
            // Simply sum the monthly fields for a foolproof total
            const sumOfMonths = monthKeys.reduce((s, m) => s + (Number((p as any)[m]) || 0), 0);
            
            return {
                ...p,
                totalCapacity: sumOfMonths
            };
        }).filter(p => {
            if (categoryFilter !== 'all') {
                const cat = (p.category || '').toLowerCase();
                if (categoryFilter === 'solar' && !cat.includes('solar')) return false;
                if (categoryFilter === 'wind' && !cat.includes('wind')) return false;
            }
            if (statusFilter !== 'all' && p.planActual !== statusFilter) return false;
            if (priorityFilter !== 'all') {
                const allP = p.milestones ? Object.values(p.milestones).flat().map(t => t.priority) : [];
                if (!allP.includes(priorityFilter)) return false;
            }
            if (searchTerm) {
                const search = searchTerm.toLowerCase();
                const fields = [
                    p.projectName, p.spv, p.category, p.section, 
                    p.projectType, p.plotLocation, p.plotNo, 
                    p.planActual, (p as any).capacity?.toString()
                ];
                return fields.some(f => f?.toLowerCase().includes(search));
            }
            return true;
        });
    }, [projects, categoryFilter, statusFilter, priorityFilter, searchTerm]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600 dark:text-gray-400">Loading projects...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 text-center text-red-600 dark:text-red-400">
                Error loading projects: {(error as Error).message}
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
            {/* Header */}
            <div className="bg-gradient-to-r from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 border-b border-gray-200 dark:border-gray-800 px-6 py-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#0B74B0] dark:text-[#60a5fa]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Manage Projects
                    </h3>

                    {/* Filters */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search projects..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-8 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute left-2.5 top-2.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="all">All Status</option>
                            <option value="Plan">Plan</option>
                            <option value="Actual">Actual</option>
                        </select>
                    </div>
                </div>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Showing {filteredProjects.length} of {projects.length} projects
                </p>
            </div>

            {/* Notification Toast */}
            <AnimatePresence>
                {notification && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className={`mx-6 mt-4 p-3 rounded-lg flex items-center gap-2 ${notification.type === 'success'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                            }`}
                    >
                        {notification.type === 'success' ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        )}
                        {notification.message}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ─── Data Table ─── */}
            <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
                <table className="min-w-full text-[14px]">
                    <thead className="bg-gray-50 dark:bg-gray-900/50 sticky top-0 z-20">
                        <tr>
                            <th className="px-3 py-4 text-left text-[11px] font-black text-gray-500 uppercase tracking-widest border-b border-gray-200 dark:border-gray-700 sticky left-0 bg-gray-50 dark:bg-gray-900/50 z-10">Actions</th>
                            <th className="px-3 py-4 text-left text-[11px] font-black text-gray-500 uppercase tracking-widest border-b border-gray-200 dark:border-gray-700">S.No</th>
                            <th className="px-3 py-4 text-left text-[11px] font-black text-gray-500 uppercase tracking-widest border-b border-gray-200 dark:border-gray-700 min-w-[200px]">Project Name</th>
                            <th className="px-3 py-4 text-left text-[11px] font-black text-gray-500 uppercase tracking-widest border-b border-gray-200 dark:border-gray-700">SPV</th>
                            <th className="px-3 py-4 text-left text-[11px] font-black text-gray-500 uppercase tracking-widest border-b border-gray-200 dark:border-gray-700">Category</th>
                            <th className="px-3 py-4 text-left text-[11px] font-black text-gray-500 uppercase tracking-widest border-b border-gray-200 dark:border-gray-700">Plot No</th>
                            <th className="px-3 py-4 text-left text-[11px] font-black text-gray-500 uppercase tracking-widest border-b border-gray-200 dark:border-gray-700">Type</th>
                            <th className="px-3 py-4 text-left text-[11px] font-black text-gray-500 uppercase tracking-widest border-b border-gray-200 dark:border-gray-700">Status</th>
                            <th className="px-3 py-4 text-center text-[11px] font-black text-gray-500 uppercase tracking-widest border-b border-gray-200 dark:border-gray-700">Capacity</th>
                            {monthLabels.map((m, idx) => (
                                <th key={idx} className="px-2 py-4 text-center text-[11px] font-black text-gray-500 uppercase tracking-widest border-b border-gray-200 dark:border-gray-700 min-w-[65px]">{m.split('-')[0]}</th>
                            ))}
                            <th className="px-3 py-4 text-center text-[11px] font-black text-[#0B74B0] dark:text-[#60a5fa] uppercase tracking-widest border-b border-gray-200 dark:border-gray-700 bg-[#0B74B0]/10 dark:bg-[#0B74B0]/20">Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {filteredProjects.map((project, idx) => {
                            const rowBg = idx % 2 === 0 ? 'bg-white dark:bg-gray-950' : 'bg-gray-50/50 dark:bg-gray-900/30';
                            
                            // Derive summary priority from all monthly tranches
                            let summaryPriority = '';
                            if (project.milestones) {
                                const allTranches = Object.values(project.milestones).flat();
                                const priorities = allTranches.map(t => t.priority).filter(Boolean) as string[];
                                if (priorities.includes('P1')) summaryPriority = 'P1';
                                else if (priorities.includes('P2')) summaryPriority = 'P2';
                                else if (priorities.includes('P3')) summaryPriority = 'P3';
                                else if (priorities.length > 0) summaryPriority = priorities[0];
                            }
                            const pv = summaryPriority.toUpperCase();
                            const pColor = PRIORITY_COLORS[pv];

                            return (
                                <tr key={project.id || idx} className={`${rowBg} hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors`}>
                                    {/* Actions */}
                                    <td className="px-3 py-2 whitespace-nowrap sticky left-0 z-10" style={{ backgroundColor: 'inherit' }}>
                                        {canEditProject(project) ? (
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => setEditModalProject(project)}
                                                    className="px-2 py-1 text-[10px] font-semibold bg-[#0B74B0] hover:bg-[#095a87] text-white rounded transition-colors"
                                                >
                                                    Edit
                                                </button>
                                                {user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' ? (
                                                    <button
                                                        onClick={() => setDeleteConfirm({ show: true, project })}
                                                        className="px-2 py-1 text-[10px] font-semibold bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
                                                    >
                                                        Del
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => alert("Direct deletion is restricted. Please request an Administrator to approve & delete this project.")}
                                                        className="px-2 py-1 text-[10px] font-semibold bg-gray-400 hover:bg-gray-500 text-white rounded transition-colors cursor-pointer"
                                                        title="Admin approval required"
                                                    >
                                                        Del
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-[10px] text-gray-400 italic">View</span>
                                        )}
                                    </td>

                                    <td className="px-3 py-3 text-gray-600 dark:text-gray-400">{project.sno}</td>
                                    <td className="px-3 py-3 font-black text-gray-900 dark:text-white text-[15px] group-hover:text-[#0B74B0] transition-colors max-w-[250px] truncate">{project.projectName}</td>
                                    <td className="px-3 py-3 text-gray-600 dark:text-gray-400 text-[13px] font-medium uppercase tracking-tight">{project.spv || '—'}</td>
                                    <td className="px-3 py-3 text-[13px]">
                                        <span className={`px-2 py-0.5 rounded-full border shadow-sm font-bold uppercase tracking-wide text-[11px] ${project.category?.toLowerCase().includes('solar') ? 'bg-amber-50/80 text-amber-700 border-amber-200/50' : project.category?.toLowerCase().includes('wind') ? 'bg-sky-50/80 text-sky-700 border-sky-200/50' : 'bg-gray-50/80 text-gray-600 border-gray-200/50'}`}>{project.category || '—'}</span>
                                    </td>
                                    <td className="px-3 py-3 text-gray-600 dark:text-gray-400 text-[13px] font-medium">{project.plotNo || '—'}</td>
                                    <td className="px-3 py-3 text-[13px]">
                                        <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-bold border border-gray-200/50">{project.projectType}</span>
                                    </td>
                                    <td className="px-3 py-3">
                                        <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-widest ${project.planActual === 'Plan' ? 'bg-[#0B74B0]/10 text-[#0B74B0] border border-[#0B74B0]/20' : 'bg-purple-100 text-purple-700 border border-purple-200'}`}>{project.planActual}</span>
                                    </td>
                                    <td className="px-3 py-3 text-center text-gray-900 dark:text-white font-black text-[15px]">
                                        {project.capacity?.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) || '—'}
                                    </td>
                                    {/* Monthly */}
                                    {monthKeys.map(m => {
                                        const val = (project as any)[m];
                                        return (
                                            <td key={m} className={`px-1 py-3 text-center text-[13px] font-medium transition-all ${val != null && val !== 0 ? 'text-gray-900 dark:text-white font-black' : 'text-gray-300'}`}>
                                                {val != null && val !== 0 ? val.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—'}
                                            </td>
                                        );
                                    })}

                                    <td className="px-3 py-3 text-center font-black text-[15px] text-[#0B74B0] dark:text-[#60a5fa] bg-[#0B74B0]/5 dark:bg-[#0B74B0]/10 border-l border-[#0B74B0]/10">
                                        {project.totalCapacity?.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) || '—'}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {filteredProjects.length === 0 && (
                <div className="p-12 text-center text-gray-500 dark:text-gray-400">
                    No projects found matching your filters.
                </div>
            )}

            {/* ─── Edit Modal ─── */}
            <AnimatePresence>
                {editModalProject && (
                    <ProjectEditModal
                        project={editModalProject}
                        fiscalYear={fiscalYear}
                        monthLabels={monthLabels}
                        onSave={(id, updates, milestones) => updateMutation.mutate({ id, updates, milestones })}
                        onClose={() => setEditModalProject(null)}
                        isSaving={updateMutation.isPending}
                    />
                )}
            </AnimatePresence>

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {deleteConfirm.show && deleteConfirm.project && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]"
                        onClick={() => setDeleteConfirm({ show: false, project: null })}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4"
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Delete Project</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">This action cannot be undone</p>
                                </div>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6">
                                <p className="text-sm text-gray-600 dark:text-gray-300">
                                    Are you sure you want to delete <span className="font-bold text-gray-900 dark:text-white">"{deleteConfirm.project.projectName}"</span>?
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    Status: {deleteConfirm.project.planActual} | Category: {deleteConfirm.project.category}
                                </p>
                            </div>
                            <div className="flex gap-3 justify-end">
                                <button onClick={() => setDeleteConfirm({ show: false, project: null })} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">Cancel</button>
                                <button
                                    onClick={() => { if (deleteConfirm.project?.id) deleteMutation.mutate(deleteConfirm.project.id); }}
                                    disabled={deleteMutation.isPending}
                                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                                >
                                    {deleteMutation.isPending ? 'Deleting...' : 'Delete Project'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
