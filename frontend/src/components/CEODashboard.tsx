import { API_BASE } from '../lib/config';

import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';


const GlobalStyles = () => (
    <style>{`
        @keyframes slide {
            from { background-position: 0 0; }
            to { background-position: 40px 0; }
        }
        @keyframes float {
            0% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
            100% { transform: translateY(0px); }
        }
    `}</style>
);
import ReactECharts from 'echarts-for-react';
import { useQuery } from '@tanstack/react-query';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area, Line, ComposedChart, PieChart, Pie, Cell
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { PageLoader } from './PageLoader';
import { getCummTillLabel, parseScopeString, getCurrentFiscalYear } from '../lib/utils';

interface CommissioningProject {
    id?: number;
    fiscalYear: string;
    sno: number;
    projectName: string;
    spv: string;
    projectType: string;
    plotLocation: string;
    plotNo: string;
    capacity: number;
    planActual: string;
    apr: number | null; may: number | null; jun: number | null; jul: number | null;
    aug: number | null; sep: number | null; oct: number | null; nov: number | null;
    dec: number | null; jan: number | null; feb: number | null; mar: number | null;
    totalCapacity: number | null;
    cummTillOct: number | null;
    q1: number | null; q2: number | null; q3: number | null; q4: number | null;
    category: string;
    section: string;
    includedInTotal: boolean;
    // ─── Milestone Fields ────────────────────────────────────
    priority: string | null;
    trialRun: string | null;
    chargingPlan: string | null;
    codPlan: string | null;
    milestones?: Record<string, { mw: number; trialRun: string | null; chargingDate: string | null; codDate: string | null }[]>;
}

const monthKeys = ['apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar'] as const;

const getFiscalMonths = (fy: string) => {
    let s = 25;
    if (fy.includes('_')) s = parseInt(fy.split('_')[1].split('-')[0]);
    else if (fy.includes('-')) s = parseInt(fy.split('-')[0].slice(-2));
    const y = s + 2000;
    const yr = (n: number) => n.toString().slice(-2);
    return [
        { key: 'apr', label: 'Apr', year: yr(y) }, { key: 'may', label: 'May', year: yr(y) },
        { key: 'jun', label: 'Jun', year: yr(y) }, { key: 'jul', label: 'Jul', year: yr(y) },
        { key: 'aug', label: 'Aug', year: yr(y) }, { key: 'sep', label: 'Sep', year: yr(y) },
        { key: 'oct', label: 'Oct', year: yr(y) }, { key: 'nov', label: 'Nov', year: yr(y) },
        { key: 'dec', label: 'Dec', year: yr(y) }, { key: 'jan', label: 'Jan', year: yr(y + 1) },
        { key: 'feb', label: 'Feb', year: yr(y + 1) }, { key: 'mar', label: 'Mar', year: yr(y + 1) },
    ];
};

const getLastCompletedMonthIndex = (fy?: string) => {
    const now = new Date();
    const currentMonth = now.getMonth(); // 0=Jan, 1=Feb, ..., 11=Dec

    // FY starts in April (3)
    // Months into FY = (currentMonth - 3 + 12) % 12
    const fyMonthIdx = (currentMonth - 3 + 12) % 12;

    // Last completed is one less than current
    // If we are in April (fyMonthIdx 0), return -1 (none completed yet)
    return fyMonthIdx - 1;
};

const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr || dateStr === '—') return '—';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${d.getDate().toString().padStart(2, '0')}-${months[d.getMonth()]}`;
    } catch { return dateStr || '—'; }
};

// ─── Colors ─────────────────────────────────────────────────────
const ADANI_BLUE = '#0B74B0';
const ADANI_PURPLE = '#6C2B85';
const ADANI_GREEN = '#10B981';
const CAT_COLORS: Record<string, string> = { PPA: '#3B82F6', Merchant: '#10B981', Group: '#F59E0B', EPC: '#EC4899' };
const isPassed = (dateStr: string | null | undefined) => {
    if (!dateStr || dateStr === '—' || dateStr === '-') return false;
    
    // Check for "Jan-26" or "Jan-2026" type strings (Month-Year only)
    const monthYearRegex = /^[A-Za-z]{3}-(\d{2}|\d{4})$/;
    if (monthYearRegex.test(dateStr)) {
        // Treat as end of month
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return false;
        // Move to last day of that month
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        return lastDay.setHours(0, 0, 0, 0) <= new Date().setHours(0, 0, 0, 0);
    }

    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    return d.setHours(0, 0, 0, 0) <= new Date().setHours(0, 0, 0, 0);
};

const getMonthlyData = (projects: any[]) => {
    const included = projects.filter(p => p.includedInTotal);
    return monthKeys.map(key => {
        const plan = included
            .filter(p => p.planActual === 'Plan')
            .reduce((s, p) => s + (p[key] || 0), 0);
        const actual = included
            .filter(p => p.planActual === 'Actual')
            .reduce((s, p) => s + (p[key] || 0), 0);
        return { plan, actual };
    });
};

const today = new Date();
const _now = today;
const _cm = today.getMonth();
const currentFY = getCurrentFiscalYear();

export default function CEODashboard({ fiscalYear }: { fiscalYear: string }) {
    const { user, isLoading: isAuthLoading } = useAuth();
    const userScope = useMemo(() => parseScopeString(user?.scope || 'all'), [user]);
    const [viewMode, setViewMode] = useState<'quarterly' | 'monthly'>('quarterly');
    const fy = fiscalYear;
    const dynamicMonths = useMemo(() => getFiscalMonths(fy), [fy]);

    // ─── FILTER STATE ────────────────────────────────────────────
    const [filterType, setFilterType] = useState('');           // Solar, Wind
    const [filterLocation, setFilterLocation] = useState('');   // Specific section (e.g. Solar_A)
    const [filterCategory, setFilterCategory] = useState('');   // PPA, Merchant, Group (projectType)
    const [filterProject, setFilterProject] = useState('');     // projectName
    const [filterQuarter, setFilterQuarter] = useState('');     // Q1, Q2, Q3, Q4
    const [drilldown, setDrilldown] = useState<{ quarter: string, category?: string } | null>(null);
    const [compareModalOpen, setCompareModalOpen] = useState(false);
    const [breakdownLocation, setBreakdownLocation] = useState('');
    const [upcomingModalOpen, setUpcomingModalOpen] = useState(false);
    const [upcomingMonth, setUpcomingMonth] = useState<string>(() => {
        const idx = getLastCompletedMonthIndex(fiscalYear);
        const nextIdx = idx >= 0 ? (idx + 1) % 12 : 0; // If FY not started, default to first month (Apr)
        return getFiscalMonths(fiscalYear)[nextIdx].key;
    });

    const { data: rawProjects = [], isLoading } = useQuery<CommissioningProject[]>({
        queryKey: ['commissioning-projects', fy],
        queryFn: async () => {
            const r = await fetch(`${API_BASE}/api/commissioning-projects?fiscalYear=${fy}`);
            if (!r.ok) throw new Error('Failed');
            return r.json();
        },
        staleTime: 5 * 60 * 1000,
    });

    const allProjects = useMemo(() => {
        // Deduplicate using sno to prevent merging distinct projects
        const seen = new Set<string>();
        return rawProjects.filter(p => {
            const k = `${p.sno}-${p.projectName}-${p.spv}-${p.category}-${p.section}-${p.planActual}-${p.capacity}`;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        });
    }, [rawProjects]);

    // ─── FILTER OPTIONS (derived from data) ──────────────────────
    // Type: Solar / Wind (derived from category)
    const typeOptions = useMemo(() => {
        const types = new Set<string>();
        allProjects.filter(p => p.includedInTotal).forEach(p => {
            const cat = p.category.toLowerCase();
            if (cat.includes('solar')) types.add('Solar');
            if (cat.includes('wind')) types.add('Wind');
        });
        return [...types].sort();
    }, [allProjects]);

    const getCompKey = (p: CommissioningProject) => `${p.category.toLowerCase().includes('wind') ? 'Wind' : 'Solar'}_${p.section}`;

    const getSimplifiedLocation = (p: CommissioningProject) => {
        const key = getCompKey(p);
        if (['Solar_A'].includes(key)) return 'Solar_Khavda';
        if (['Wind_A', 'Wind_B'].includes(key)) return 'Wind_Khavda';
        if (['Solar_B', 'Solar_C'].includes(key)) return 'Solar_Rajasthan';
        if (['Wind_C', 'Wind_D'].includes(key)) return 'Wind_Mundra';
        return 'Other';
    };

    const locationGroupNames: Record<string, string> = {
        'Solar_Khavda': 'KHAVDA SOLAR',
        'Wind_Khavda': 'KHAVDA WIND',
        'Solar_Rajasthan': 'RAJASTHAN SOLAR',
        'Wind_Mundra': 'MUNDRA WIND',
        'Other': 'OTHERS / OUTSIDE KHAVDA'
    };

    const locationSectionNames: Record<string, string> = {
        'Solar_A': 'KHAVDA PHASE-I',
        'Solar_B': 'RAJASTHAN PHASE-I',
        'Solar_C': 'RAJASTHAN ADDITIONAL',
        'Solar_D1': 'KHAVDA COPPER+MERCHANT',
        'Solar_D2': 'KHAVDA INTERNAL',
        'Wind_A': 'KHAVDA WIND P-I',
        'Wind_B': 'KHAVDA WIND INTERNAL',
        'Wind_C': 'MUNDRA WIND P-I',
        'Wind_D': 'MUNDRA WIND INTERNAL',
    };

    // Simplified Location (Section) Options with Grouping Prefixes
    const locationOptions = useMemo(() => {
        let projs = allProjects;
        if (filterType) projs = projs.filter(p => p.category.toLowerCase().includes(filterType.toLowerCase()));

        const keys = new Set<string>();
        const keyToGroup = new Map<string, string>();

        projs.forEach(p => {
            const k = getCompKey(p);
            keys.add(k);
            keyToGroup.set(k, getSimplifiedLocation(p));
        });

        return [...keys].sort().map(k => {
            const groupKey = keyToGroup.get(k) || 'Other';
            const groupName = locationGroupNames[groupKey] || 'OTHERS';
            const sectionName = locationSectionNames[k] || k.replace('_', ' ');
            return {
                value: k,
                label: `${groupName} - ${sectionName}`
            };
        });
    }, [allProjects, filterType]);

    // Project: only when a single location is selected
    const projectOptions = useMemo(() => {
        if (!filterLocation) return [];
        const uniqueProjs = new Map();
        allProjects
            .filter(p => getCompKey(p) === filterLocation)
            .forEach(p => {
                if (!uniqueProjs.has(p.projectName) && p.projectName) {
                    uniqueProjs.set(p.projectName, {
                        value: p.projectName,
                        label: `${p.plotNo && p.plotNo !== '—' ? p.plotNo : '—'} (${p.capacity} MW)`
                    });
                }
            });
        return Array.from(uniqueProjs.values()).sort((a, b) => a.label.localeCompare(b.label));
    }, [allProjects, filterLocation]);

    // Reset downstream filters when upstream changes
    const handleTypeChange = (v: string) => {
        setFilterType(v);
        setFilterLocation('');
        setFilterProject('');
    };
    const handleLocationChange = (v: string) => {
        setFilterLocation(v);
        setFilterProject('');
    };

    // ─── FILTERED DATA ───────────────────────────────────────────
    const included = useMemo(() => {
        return allProjects.filter(p => {
            if (!p.includedInTotal) return false;
            if (filterType && !p.category.toLowerCase().includes(filterType.toLowerCase())) return false;
            if (filterLocation && getCompKey(p) !== filterLocation) return false;
            if (filterCategory && p.projectType !== filterCategory) return false;
            if (filterProject && p.projectName !== filterProject) return false;
            return true;
        });
    }, [allProjects, filterType, filterLocation, filterCategory, filterProject]);

    const planProjs = useMemo(() => included.filter(p => p.planActual === 'Plan'), [included]);
    const actualProjsRaw = useMemo(() => {
        // ACTUALS: Always count achievements even if the project is "Excluded" from the Plan/Budget
        return allProjects.filter(p => {
            if (p.planActual !== 'Actual') return false;
            if (filterType && !p.category.toLowerCase().includes(filterType.toLowerCase())) return false;
            if (filterLocation && getCompKey(p) !== filterLocation) return false;
            if (filterCategory && p.projectType !== filterCategory) return false;
            if (filterProject && p.projectName !== filterProject) return false;
            return true;
        });
    }, [allProjects, filterType, filterLocation, filterCategory, filterProject]);
    const actualProjs = useMemo(() => {
        return actualProjsRaw.map(p => {
            const pCopy = { ...p };
            const mFull = ['apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar'] as const;

            // Use this project's own milestones (already correctly attached by project_id from API)
            const projectMilestones = (p as any).milestones || {};

            mFull.forEach(m => {
                const monthMilestones = projectMilestones[m] || [];
                if (monthMilestones.length > 0) {
                    const completedMW = monthMilestones.reduce((sum: number, ms: any) => {
                        if (isPassed(ms.codDate)) {
                            return sum + (ms.mw || 0);
                        }
                        return sum;
                    }, 0);
                    (pCopy as any)[m] = completedMW;
                } else {
                    (pCopy as any)[m] = 0; // Strictly zero if no milestone exists
                }
            });

            // Calculate quarter sums manually from the verified monthly milestones
            (pCopy as any).q1 = ((pCopy as any).apr || 0) + ((pCopy as any).may || 0) + ((pCopy as any).jun || 0);
            (pCopy as any).q2 = ((pCopy as any).jul || 0) + ((pCopy as any).aug || 0) + ((pCopy as any).sep || 0);
            (pCopy as any).q3 = ((pCopy as any).oct || 0) + ((pCopy as any).nov || 0) + ((pCopy as any).dec || 0);
            (pCopy as any).q4 = ((pCopy as any).jan || 0) + ((pCopy as any).feb || 0) + ((pCopy as any).mar || 0);

            return pCopy;
        });
    }, [actualProjsRaw, rawProjects, fiscalYear]);

    const trialRunProjs = useMemo(() => {
        return actualProjsRaw.map(p => {
            const pCopy = { ...p };
            const mFull = ['apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar'] as const;

            // Use this project's own milestones directly
            const projectMilestones = p.milestones || {};

            mFull.forEach(m => {
                const monthMilestones = projectMilestones[m] || [];
                if (monthMilestones.length > 0) {
                    const completedMW = monthMilestones.reduce((sum, ms) => {
                        return sum + (isPassed(ms.trialRun) ? (ms.mw || 0) : 0);
                    }, 0);
                    (pCopy as any)[m] = completedMW;
                } else {
                    (pCopy as any)[m] = isPassed(p.trialRun) ? (p[m] || 0) : 0;
                }
            });
            return pCopy;
        });
    }, [actualProjsRaw, rawProjects, fiscalYear]);

    // NEW: Plan Upto Date based on Trial Run Milestone dates
    const planTrialRunProjs = useMemo(() => {
        const mKeysFull = ['apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar'] as const;
        return planProjs.map(p => {
            const pCopy = { ...p };
            
            // Priority: own milestones > matched actual milestones
            const actualMatch = actualProjsRaw.find(ap => 
                ap.projectName?.trim().toLowerCase() === p.projectName?.trim().toLowerCase() && 
                ap.spv?.trim().toLowerCase() === p.spv?.trim().toLowerCase()
            );
            const projectMilestones = p.milestones || actualMatch?.milestones || {};

            mKeysFull.forEach((m, mIdx) => {
                const monthMilestones = projectMilestones[m] || [];
                if (monthMilestones.length > 0) {
                    const plannedMW = monthMilestones.reduce((sum, ms) => {
                        return sum + (isPassed(ms.trialRun) ? (ms.mw || 0) : 0);
                    }, 0);
                    (pCopy as any)[m] = plannedMW;
                } else {
                    // Fallback to end of month unless trialRun specifically falls in this month
                    const fyKey = p.fiscalYear || currentFY;
                    const fyStart = parseInt(fyKey.split('_')[1].split('-')[0]) + 2000;
                    const yr = mIdx < 9 ? fyStart : fyStart + 1;
                    const mo = (mIdx + 3) % 12;
                    const endOfMonth = new Date(yr, mo + 1, 0);

                    const pDate = p.trialRun || (p as any).trialRunPlan || actualMatch?.trialRun;
                    const useDate = (pDate && new Date(pDate).getMonth() === mo && new Date(pDate).getFullYear() === yr) 
                        ? pDate 
                        : endOfMonth.toISOString();

                    (pCopy as any)[m] = isPassed(useDate) ? (p[m] || 0) : 0;
                }
            });
            return pCopy;
        });
    }, [planProjs, actualProjsRaw, fiscalYear, currentFY]);

    // NEW: Projected Actuals (Total Milestone Capacity regardless of completion date)
    const projectedActualsProjs = useMemo(() => {
        return actualProjsRaw.map(p => {
            const pCopy = { ...p };
            const mFull = ['apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar'] as const;

            // Use this project's own milestones directly
            const projectMilestones = p.milestones || {};

            mFull.forEach(m => {
                const monthMilestones = projectMilestones[m] || [];
                if (monthMilestones.length > 0) {
                    // SUM OF ALL MILESTONES (Planned + Done)
                    const totalMW = monthMilestones.reduce((sum, ms) => sum + (ms.mw || 0), 0);
                    (pCopy as any)[m] = totalMW;
                } else {
                    // Fallback to static DB column only if no milestones defined
                    (pCopy as any)[m] = p[m] || 0;
                }
            });
            return pCopy;
        });
    }, [actualProjsRaw, rawProjects, fiscalYear]);

    const hasActiveFilters = filterType || filterLocation || filterCategory || filterProject || filterQuarter;
    const clearAllFilters = () => { setFilterType(''); setFilterLocation(''); setFilterCategory(''); setFilterProject(''); setFilterQuarter(''); };

    // ─── KPI CALCULATIONS (Dynamic calendar date) ──
    const monthKeysFull = ['apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar'] as const;

    // Determine target months for KPIs
    const activePeriodKeys = useMemo(() => {
        if (!filterQuarter) return monthKeysFull; // Full Year Budget by default
        const qIdx = parseInt(filterQuarter.replace('Q', '')) - 1;
        return monthKeysFull.slice(qIdx * 3, qIdx * 3 + 3);
    }, [filterQuarter]);

    // Helper to get months passed for a SPECIFIC fiscal year relative to today
    const getMonthsPassedForFY = useCallback((projectFY: string) => {
        if (projectFY < currentFY) return 12; // Past FY: complete
        if (projectFY > currentFY) return 0;  // Future FY: not started
        // Current FY: dynamic based on today's month
        return _cm >= 3 ? _cm - 2 : _cm + 10;
    }, [currentFY, _cm]);

    const _monthsPassed = useMemo(() => getMonthsPassedForFY(fy), [getMonthsPassedForFY, fy]);

    // Date-based budget keys for current FY (only show budget for completed months)
    const dateBasedBudgetKeys = useMemo(() => {
        if (fy < currentFY) return monthKeysFull; // Past FY: show full budget
        if (fy > currentFY) return monthKeysFull; // Future FY: show full budget
        // Current FY: only show budget up to current date
        return monthKeysFull.slice(0, _monthsPassed);
    }, [fy, currentFY, _monthsPassed]);

    const todayDateLabel = useMemo(() => {
        if (filterQuarter) return `End of ${filterQuarter}`;
        if (fy === 'all') return `Today (${today.getDate()}-${today.toLocaleString('en-US', { month: 'short' }).toUpperCase()})`;
        if (fy < currentFY) return `End of FY ${fy.replace('FY_', '')}`;
        if (fy > currentFY) return `FY ${fy.replace('FY_', '')} Range`; // Future range
        return `${today.getDate()}-${today.toLocaleString('en-US', { month: 'short' }).toUpperCase()}-${today.getFullYear()}`;
    }, [filterQuarter, fy, currentFY, today]);

    const n = (v: number, d: number = 0) => v.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });

    const sumMonthsYTD = (projs: CommissioningProject[]) => {
        return projs.reduce((s, p) => {
            const mp = getMonthsPassedForFY(p.fiscalYear);
            // Limit by selected quarter if active
            let relevantKeys = monthKeysFull.slice(0, mp);
            if (filterQuarter) {
                const start = (parseInt(filterQuarter.replace('Q', '')) - 1) * 3;
                relevantKeys = monthKeysFull.slice(start, Math.min(start + 3, mp));
            }
            return s + relevantKeys.reduce((ks, k) => ks + ((p as any)[k] || 0), 0);
        }, 0);
    };

    const sumMonths = (projs: CommissioningProject[], keys: readonly string[]) =>
        projs.reduce((s, p) => s + keys.reduce((ks, k) => ks + ((p as any)[k] || 0), 0), 0);

    // Card 1: TOTAL BUDGET (Full selection regardless of date)
    const totalPlan = sumMonths(planProjs, activePeriodKeys);
    const ytdPlan = sumMonths(planTrialRunProjs, activePeriodKeys);

    const agelPlanProjs = planProjs.filter(p => p.projectType === 'PPA' || p.projectType === 'Merchant');
    const groupPlanProjs = planProjs.filter(p => p.projectType === 'Group');
    const epcPlanProjs = planProjs.filter(p => p.projectType === 'EPC');

    const agelPlan = sumMonths(agelPlanProjs, activePeriodKeys);
    const agelYtdPlan = sumMonths(planTrialRunProjs.filter(p => p.projectType === 'PPA' || p.projectType === 'Merchant'), activePeriodKeys);
    const groupPlan = sumMonths(groupPlanProjs, activePeriodKeys);
    const groupYtdPlan = sumMonths(planTrialRunProjs.filter(p => p.projectType === 'Group'), activePeriodKeys);
    const epcPlan = sumMonths(epcPlanProjs, activePeriodKeys);
    const epcYtdPlan = sumMonths(planTrialRunProjs.filter(p => p.projectType === 'EPC'), activePeriodKeys);

    // Card 2: ACTUAL
    const totalActual = sumMonths(actualProjs, activePeriodKeys);
    const ytdActual = sumMonthsYTD(actualProjs);

    const agelActualProjs = actualProjs.filter(p => p.projectType === 'PPA' || p.projectType === 'Merchant');
    const groupActualProjs = actualProjs.filter(p => p.projectType === 'Group');
    const epcActualProjs = actualProjs.filter(p => p.projectType === 'EPC');

    const agelActual = sumMonths(agelActualProjs, activePeriodKeys);
    const agelYtdActual = sumMonthsYTD(agelActualProjs);
    const groupActual = sumMonths(groupActualProjs, activePeriodKeys);
    const groupYtdActual = sumMonthsYTD(groupActualProjs);
    const epcActual = sumMonths(epcActualProjs, activePeriodKeys);
    const epcYtdActual = sumMonthsYTD(epcActualProjs);

    // Trial Run
    const trialRunOverall = sumMonths(trialRunProjs, activePeriodKeys);
    const trialRunAgel = sumMonths(trialRunProjs.filter(p => p.projectType === 'PPA' || p.projectType === 'Merchant'), activePeriodKeys);
    const trialRunGroup = sumMonths(trialRunProjs.filter(p => p.projectType === 'Group'), activePeriodKeys);
    const trialRunEpc = sumMonths(trialRunProjs.filter(p => p.projectType === 'EPC'), activePeriodKeys);

    // Card 4: PROJECTED (Total Expected for the selected period)
    const projectedOverall = sumMonths(projectedActualsProjs, activePeriodKeys);
    const projectedAgel = sumMonths(projectedActualsProjs.filter(p => p.projectType === 'PPA' || p.projectType === 'Merchant'), activePeriodKeys);
    const projectedGroup = sumMonths(projectedActualsProjs.filter(p => p.projectType === 'Group'), activePeriodKeys);
    const projectedEpc = sumMonths(projectedActualsProjs.filter(p => p.projectType === 'EPC'), activePeriodKeys);

    // Card 5: VARIANCE (Budget - Projected)
    const varianceOverall = totalPlan - projectedOverall;
    const varianceAgel = agelPlan - projectedAgel;
    const varianceGroup = groupPlan - projectedGroup;
    const varianceEpc = epcPlan - projectedEpc;

    const hasEPCInFY = useMemo(() => allProjects.some(p => p.projectType === 'EPC' && p.includedInTotal), [allProjects]);

    // ─── QUARTER DATA ───────────────────────────────────────────
    const quarterData = useMemo(() => {
        const completedMonthIdx = _monthsPassed - 1; // Dynamic quarter completion
        const quarters = (['q1', 'q2', 'q3', 'q4'] as const).map((qk, qi) => {
            const cats = ['PPA', 'Merchant', 'Group', 'EPC'];
            const d: any = { name: `Q${qi + 1}` };

            // Define months in this quarter (0-based indices into monthKeys: Apr=0, May=1...)
            const qMonths = [qi * 3, qi * 3 + 1, qi * 3 + 2];

            // Calculate Plan YTD (only for completed months)
            let planYTD = 0;

            cats.forEach(c => {
                // Full Quarter Plan & Actual
                d[`${c}_Plan`] = planProjs.filter(p => p.projectType === c).reduce((s, p) => s + ((p as any)[qk] || 0), 0);
                d[`${c}_Actual`] = actualProjs.filter(p => p.projectType === c).reduce((s, p) => s + ((p as any)[qk] || 0), 0);

                // Plan YTD for this category
                const catPlanYTD = planProjs.filter(p => p.projectType === c).reduce((s, p) => {
                    // Sum only completed months for this project
                    return s + qMonths.reduce((sum, mIdx) => {
                        if (mIdx <= completedMonthIdx) {
                            return sum + ((p as any)[monthKeys[mIdx]] || 0);
                        }
                        return sum;
                    }, 0);
                }, 0);
                planYTD += catPlanYTD;
            });
            d.Plan_YTD = planYTD; // Store for achievement calculation
            return d;
        });
        return quarters;
    }, [planProjs, actualProjs, _monthsPassed]); // Removed filterQuarter from dependencies if we don't want to recompute on highlight, but actually we might want to keep it if we used it inside, but we don't. Wait, the highlight is in the UI.

    // ─── MONTHLY DATA ───────────────────────────────────────────
    const monthlyData = useMemo(() => {
        let cummPlan = 0;
        let cummActual = 0;
        const allMonths = monthKeys.map((key, idx) => {
            const cats = ['PPA', 'Merchant', 'Group', 'EPC'];
            const d: any = { name: dynamicMonths[idx].label, fullName: `${dynamicMonths[idx].label} '${dynamicMonths[idx].year}` };
            let tp = 0, ta = 0;
            cats.forEach(c => {
                // Use structured DB Plan (planProjs) and Actual (actualProjs)
                const pv = planProjs.filter(p => p.projectType === c).reduce((s, p) => s + ((p as any)[key] || 0), 0);
                const av = actualProjs.filter(p => p.projectType === c).reduce((s, p) => s + ((p as any)[key] || 0), 0);
                d[`${c}_Plan`] = pv; d[`${c}_Actual`] = av;
                tp += pv; ta += av;
            });
            cummPlan += tp;
            cummActual += ta;

            d.Total_Plan = tp; d.Total_Actual = ta;
            d.Cumm_Plan = cummPlan;
            d.Cumm_Actual = cummActual;
            return d;
        });
        if (filterQuarter) {
            const qIdx = parseInt(filterQuarter.replace('Q', '')) - 1;
            const start = qIdx * 3, end = start + 3;
            return allMonths.slice(start, end);
        }
        return allMonths;
    }, [planProjs, actualProjs, dynamicMonths, filterQuarter]);

    // ─── LOCATION DATA ──────────────────────────────────────────
    const locationData = useMemo(() => {
        return Object.entries(locationGroupNames).map(([locVal, locLabel]) => {
            const lp = planTrialRunProjs.filter(p => getSimplifiedLocation(p) === locVal);
            const la = actualProjs.filter(p => getSimplifiedLocation(p) === locVal);
            const plan = sumMonths(lp, activePeriodKeys);
            const actual = sumMonths(la, activePeriodKeys);

            const cats = ['PPA', 'Merchant', 'Group', 'EPC'].map(c => {
                const cp = lp.filter(p => p.projectType === c).reduce((s, p) => s + (p.totalCapacity || 0), 0);
                const ca = la.filter(p => p.projectType === c).reduce((s, p) => s + (p.totalCapacity || 0), 0);
                return { name: c, plan: cp, actual: ca, ach: cp > 0 ? (ca / cp) * 100 : 0 };
            }).filter(c => c.plan > 0 || c.actual > 0);

            return {
                title: locLabel,
                plan,
                actual,
                ach: plan > 0 ? (actual / plan) * 100 : 0,
                cats
            };
        }).filter(d => d.plan > 0 || d.actual > 0);
    }, [planProjs, actualProjs, locationGroupNames, activePeriodKeys]);

    // ─── UPCOMING ───────────────────────────────────────────────
    const upcoming = useMemo(() => {
        return planProjs.map(pp => {
            const ap = allProjects.find(a => a.projectName === pp.projectName && a.planActual === 'Actual');
            const at = ap?.totalCapacity || 0;
            const prog = pp.capacity > 0 ? Math.min((at / pp.capacity) * 100, 100) : 0;
            return { name: pp.projectName, spv: pp.spv, capacity: pp.capacity, progress: prog, type: pp.projectType, section: pp.section };
        }).filter(p => p.progress > 0 && p.progress < 100).sort((a, b) => b.progress - a.progress).slice(0, 6);
    }, [planProjs, allProjects]);


    // ─── HELPERS ─────────────────────────────────────────────────

    // ─── DONUT COLORS ────────────────────────────────────────────
    // const DONUT_COLORS: Record<string, string> = { PPA: '#3B82F6', Merchant: '#A855F7', Group: '#F59E0B' };


    // ─── DRILLDOWN MODAL DATA ────────────────────────────────────
    const drilldownData = useMemo(() => {
        if (!drilldown) return [];
        const qKey = drilldown.quarter.toLowerCase(); // q1, q2...

        // Deduplicate allProjects by project identity (Name + SPV)
        const uniqueProjsMap = new Map();
        allProjects.forEach(p => {
            const id = `${p.projectName}-${p.spv}`;
            if (!uniqueProjsMap.has(id)) uniqueProjsMap.set(id, p);
        });
        const uniqueProjects = Array.from(uniqueProjsMap.values());

        // We need to calculate q1, q2 etc manually for Projected for this project too
        const getProjectedQVal = (p: any, q: string) => {
            const entry = projectedActualsProjs.find(pp => pp.projectName === p.projectName && pp.spv === p.spv);
            if (!entry) return 0;
            // Manual sum from months to be safe
            if (q === 'q1') return ((entry as any).apr || 0) + ((entry as any).may || 0) + ((entry as any).jun || 0);
            if (q === 'q2') return ((entry as any).jul || 0) + ((entry as any).aug || 0) + ((entry as any).sep || 0);
            if (q === 'q3') return ((entry as any).oct || 0) + ((entry as any).nov || 0) + ((entry as any).dec || 0);
            if (q === 'q4') return ((entry as any).jan || 0) + ((entry as any).feb || 0) + ((entry as any).mar || 0);
            return 0;
        };

        return uniqueProjects.filter(p => {
            if (drilldown.category && p.projectType !== drilldown.category) return false;
            const planEntry = planProjs.find(pp => pp.projectName === p.projectName && pp.spv === p.spv);
            const actualEntry = actualProjs.find(ap => ap.projectName === p.projectName && ap.spv === p.spv);
            const projVal = getProjectedQVal(p, qKey);

            const planVal = (planEntry as any)?.[qKey] || 0;
            const actualVal = (actualEntry as any)?.[qKey] || 0;

            return planVal > 0 || actualVal > 0 || projVal > 0;
        }).map(p => {
            const planEntry = planProjs.find(pp => pp.projectName === p.projectName && pp.spv === p.spv);
            const actualEntry = actualProjs.find(ap => ap.projectName === p.projectName && ap.spv === p.spv);
            return {
                ...p,
                planVal: (planEntry as any)?.[qKey] || 0,
                actualVal: (actualEntry as any)?.[qKey] || 0,
                projectedVal: getProjectedQVal(p, qKey),
            };
        }).sort((a, b) => b.projectedVal - a.projectedVal || b.actualVal - a.actualVal || b.planVal - a.planVal);
    }, [drilldown, allProjects, planProjs, actualProjs, projectedActualsProjs]);

    if (isAuthLoading) return <PageLoader message="Authenticating..." />;
    if (isLoading) return <PageLoader message="Loading CEO Dashboard..." />;

    return (
        <div className="max-w-full overflow-visible rounded-md space-y-6 font-sans relative pb-20">
            <GlobalStyles />
            {/* ─── HEADER & FILTERS ──────────────────────────────────── */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="p-1.5 bg-gradient-to-br from-[#0B74B0] to-[#064E77] rounded-md flex-shrink-0 shadow-md">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-sm sm:text-[26px] font-black text-[#1F2937] dark:text-white tracking-tight flex items-center gap-3">
                            Commissioning Dashboard
                        </h1>
                        <p className="text-[11px] sm:text-[12px] text-[#6B7280] dark:text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                            {fy === 'all' ? 'All Fiscal Years' : `FY ${fy.replace('FY_', '')}`} • Plan vs Actual Execution
                        </p>
                    </div>
                </div>

                {/* ─── FILTER BAR ────────────────────────────────────────── */}
                <div className="px-3 py-1.5 ">
                    <div className="flex items-center ml-auto gap-3 flex-wrap">
                        <FilterPill
                            icon={<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
                            label="Type"
                            value={filterType}
                            options={typeOptions}
                            onChange={handleTypeChange}
                        />
                        <FilterPill
                            icon={<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                            label="All Locations"
                            value={filterLocation}
                            options={locationOptions}
                            onChange={handleLocationChange}
                        />
                        <FilterPill
                            icon={<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
                            label="All Categories"
                            value={filterCategory}
                            options={['PPA', 'Merchant', 'Group', 'EPC']}
                            onChange={setFilterCategory}
                        />
                        <FilterPill
                            icon={<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                            label="All Quarters"
                            value={filterQuarter}
                            options={['Q1', 'Q2', 'Q3', 'Q4']}
                            onChange={setFilterQuarter}
                        />
                        {filterLocation && projectOptions.length > 0 && (
                            <FilterPill
                                icon={<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>}
                                label="All Projects"
                                value={filterProject}
                                options={projectOptions}
                                onChange={setFilterProject}
                            />
                        )}
                        <div className="flex items-center gap-2 xl:ml-auto">
                            {hasActiveFilters && (
                                <button
                                    onClick={clearAllFilters}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-red-200 dark:border-red-900/30 shadow-sm"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                    Reset
                                </button>
                            )}
                        </div>
                        <button
                            onClick={() => setUpcomingModalOpen(true)}
                            className="px-6 py-3 text-[16px] cursor-pointer font-black uppercase tracking-wider bg-[#10B981] text-white hover:bg-[#059669] rounded-xl transition-colors whitespace-nowrap border border-[#10B981] shadow-sm ml-auto"
                        >
                            Upcoming Commissioning
                        </button>
                    </div>
                </div>
            </div>
            {/* ─── KPI CARDS (5) ──────────────────────────────────────── */}
            <div className="flex flex-wrap gap-4">
                <DetailKPICard
                    label="BUDGET"
                    overall={totalPlan}
                    agel={agelPlan}
                    group={groupPlan}
                    epc={epcPlan}
                    showEPC={hasEPCInFY}
                    col1Label="Total (MW)"
                    col2Label={`Upto ${todayDateLabel}`}
                    overall2={ytdPlan}
                    agel2={agelYtdPlan}
                    group2={groupYtdPlan}
                    epc2={epcYtdPlan}
                    gradient="from-[#0B74B0] to-[#064E77]"
                    tooltip="Total assigned capacity budget for the current fiscal year."
                />
                <DetailKPICard
                    label="ACTUAL"
                    overall={trialRunOverall}
                    agel={trialRunAgel}
                    group={trialRunGroup}
                    epc={trialRunEpc}
                    showEPC={hasEPCInFY}
                    col1Label="Trial Run"
                    col2Label="COD (YTD)"
                    overall2={ytdActual}
                    agel2={agelYtdActual}
                    group2={groupYtdActual}
                    epc2={epcYtdActual}
                    gradient="from-[#10B981] to-[#059669]"
                    tooltip="Trial Run vs full COD completion up to today."
                />
                <DetailKPICard
                    label="BALANCE"
                    overall={totalPlan - totalActual}
                    agel={agelPlan - agelActual}
                    group={groupPlan - groupActual}
                    epc={epcPlan - epcActual}
                    showEPC={hasEPCInFY}
                    col1Label="Total"
                    col2Label={`Upto ${todayDateLabel}`}
                    overall2={ytdPlan - ytdActual}
                    agel2={agelYtdPlan - agelYtdActual}
                    group2={groupYtdPlan - groupYtdActual}
                    epc2={epcYtdPlan - epcYtdActual}
                    gradient="from-[#6C2B85] to-[#4A1D5E]"
                    tooltip="budget - actual"
                />
                <DetailKPICard
                    label="PROJECTED"
                    overall={projectedOverall}
                    agel={projectedAgel}
                    group={projectedGroup}
                    epc={projectedEpc}
                    showEPC={hasEPCInFY}
                    col1Label="Actual + Forecast"
                    gradient="from-[#EC4899] to-[#AD1457]"
                    tooltip="actual done + forecast which is yet to complete"
                />
                <DetailKPICard
                    label="SHORTFALL"
                    overall={varianceOverall}
                    agel={varianceAgel}
                    group={varianceGroup}
                    epc={varianceEpc}
                    showEPC={hasEPCInFY}
                    col1Label="Budget - Projected"
                    gradient="from-[#B91C1C] to-[#7F1D1D]"
                    tooltip="Expected gap at the end of the fiscal year (Budget - Projected)."
                />
            </div>

            {/* ─── SECTION DIVIDER ───────────────────────────────────── */}
            {/* <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-300 dark:bg-gray-700" />
                <h2 className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Execution Analytics
                </h2>
                <div className="flex-1 h-px bg-gray-300 dark:bg-gray-700" />
            </div> */}

            {/* ─── CATEGORY BREAKDOWN ────────────────────────────────── */}
            <ChartCard
                title={`${viewMode === 'monthly' ? 'Month' : 'Quarter'}-wise & Category-wise Breakdown`}
                className="w-full"
                controls={
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex bg-[#F3F4F6] dark:bg-gray-800 p-1 rounded-md border border-[#D1D5DB] dark:border-gray-700">
                            {(['quarterly', 'monthly'] as const).map(v => (
                                <button key={v} onClick={() => setViewMode(v)}
                                    className={`h-7 px-3 rounded text-[10px] sm:text-xs font-medium transition-colors whitespace-nowrap ${viewMode === v ? 'bg-[#0B74B0] text-white shadow-sm' : 'text-[#4B5563] dark:text-gray-400 hover:bg-white dark:hover:bg-gray-700'}`}>
                                    {v.charAt(0).toUpperCase() + v.slice(1)}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => setCompareModalOpen(true)}
                            className="h-9 px-4 flex items-center gap-2 text-[10px] sm:text-xs font-black uppercase tracking-widest bg-[#0B74B0] text-white hover:bg-[#095a87] rounded-lg transition-all shadow-md active:scale-95 group border border-white/10"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2m0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            Compare
                        </button>
                    </div>
                }
            >
                {viewMode === 'quarterly' ? (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 w-full overflow-hidden">
                            {quarterData.map((qd, qi) => {
                                const cats = ['PPA', 'Merchant', 'Group', 'EPC'] as const;
                                const plan = cats.reduce((s, c) => s + (qd[`${c}_Plan`] || 0), 0);
                                const actual = cats.reduce((s, c) => s + (qd[`${c}_Actual`] || 0), 0);
                                const planYTD = qd.Plan_YTD || 0;

                                // Show achievement relative to FULL quarter plan instead of YTD for better visibility
                                const pct = plan > 0 ? ((actual / plan) * 100) : (actual > 0 ? 100 : 0);
                                const pctColor = pct >= 100 ? '#10B981' : pct >= 70 ? '#F59E0B' : '#EF4444';

                                const roseData = cats.map(c => ({
                                    value: qd[`${c}_Plan`] || 0, // Size based on PLAN
                                    name: c,
                                    itemStyle: { color: CAT_COLORS[c], opacity: 0.8 },
                                    actualValue: qd[`${c}_Actual`] || 0, // Data for tooltip
                                })).filter(d => d.value > 0 || d.actualValue > 0);

                                const isActive = !filterQuarter || filterQuarter === qd.name;
                                return (
                                    <div key={qi}
                                        className={`rounded-xl border p-3 shadow-sm transition-all duration-300 relative overflow-hidden flex flex-col justify-between h-full ${isActive
                                            ? 'cursor-pointer hover:shadow-lg group'
                                            : 'cursor-default grayscale-[0.3] pointer-events-none'
                                            } ${filterQuarter === qd.name
                                                ? 'bg-blue-50/30 dark:bg-blue-900/10 border-blue-500 ring-2 ring-blue-500/50 shadow-blue-100 dark:shadow-blue-900/20 scale-[1.02] z-10'
                                                : 'bg-white dark:bg-gray-800/80 border-gray-100 dark:border-gray-700/50 opacity-50'
                                            } ${!filterQuarter ? 'opacity-100' : ''}`}
                                        onClick={() => isActive && setDrilldown({ quarter: `q${qi + 1}` })}
                                    >
                                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                                        {/* Drilldown Hint - Only show if active */}
                                        {isActive && (
                                            <div className="absolute top-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all text-[11px] text-blue-600 font-bold bg-blue-50 px-2.5 py-0.5 rounded-full pointer-events-none z-10 shadow-sm border border-blue-100 tracking-wide uppercase">
                                                Click Details &rarr;
                                            </div>
                                        )}

                                        <div className="flex justify-between items-start mb-2 border-b border-gray-100 dark:border-gray-700/50 pb-1.5">
                                            <div>
                                                <h4 className="text-3xl font-black text-[#1F2937] dark:text-white tracking-tight uppercase flex items-center gap-2">
                                                    {qd.name}
                                                    <span className="text-[14px] font-bold text-[#9CA3AF] tracking-widest bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">FY {fy.replace('FY_', '')}</span>
                                                </h4>
                                            </div>
                                            <div className="px-3 py-1 rounded-full dark:bg-gray-700 dark:border-gray-600 flex items-center gap-1 bg-gray-50 border border-gray-100">
                                                <span className="text-2xl font-black" style={{ color: pctColor }}>{pct.toFixed(0)}%</span>
                                            </div>
                                        </div>

                                        {/* Plan vs Actual summary */}
                                        <div className="flex items-center justify-between mb-1.5 px-1">
                                            <div>
                                                <p className="text-[16px] text-[#9CA3AF] mb-2 uppercase font-black tracking-widest mb-0.5">Target Plan</p>
                                                <p className="text-3xl sm:text-4xl font-black text-[#1F2937] dark:text-gray-100 leading-none">{n(plan)}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[16px] text-[#9CA3AF] mb-2 uppercase font-black tracking-widest mb-0.5">COD </p>
                                                <p className="text-3xl sm:text-4xl font-black leading-none" style={{ color: pctColor }}>{n(actual)}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between gap-2 flex-1 relative pt-2">
                                            {/* LEFT SIDE: Category List (No bars) */}
                                            <div className="space-y-0.5 flex-1 pr-1">
                                                {cats.map(c => {
                                                    const cp = qd[`${c}_Plan`] || 0;
                                                    const ca = qd[`${c}_Actual`] || 0;
                                                    if (cp === 0 && ca === 0) return null;

                                                    return (
                                                        <div key={c} className="flex items-center group/bar cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/70 p-1 -mx-1 rounded transition-colors border border-transparent hover:border-gray-100 dark:hover:border-gray-600"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setDrilldown({ quarter: `q${qi + 1}`, category: c });
                                                            }}
                                                        >
                                                            <div className="flex items-center gap-2 w-[110px] flex-shrink-0">
                                                                <span className="w-3 h-3 rounded flex-shrink-0" style={{ background: CAT_COLORS[c] }} />
                                                                <span className="text-[17px] font-black text-[#6B7280] dark:text-gray-400 uppercase tracking-widest">{c}</span>
                                                            </div>
                                                            <div className="font-black flex items-center gap-3 ml-auto">
                                                                <span className="text-green-600 dark:text-green-600 text-[30px]">{n(ca, 0)}</span>
                                                                <span className="text-gray-300 dark:text-gray-600 font-medium text-[26px]">/</span>
                                                                <span className="text-gray-500 dark:text-gray-500 font-bold text-[24px]">{n(cp, 0)}</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* RIGHT SIDE: Donut Chart */}
                                            <div className="w-[150px] h-[150px] flex-shrink-0 relative mr-[-15px]">
                                                <ReactECharts
                                                    style={{ height: '100%', width: '100%' }}
                                                    opts={{ devicePixelRatio: 2 }}
                                                    onEvents={{
                                                        click: (e: any) => {
                                                            if (e.event && e.event.event) {
                                                                e.event.event.stopPropagation();
                                                            }
                                                            setDrilldown({ quarter: `q${qi + 1}`, category: e.name });
                                                        }
                                                    }}
                                                    option={{
                                                        tooltip: {
                                                            trigger: 'item',
                                                            triggerOn: 'mousemove', // Mouse move directly
                                                            appendToBody: true,     // Prevents tooltip overflow clipping
                                                            backgroundColor: 'rgba(255, 255, 255, 0.98)',
                                                            borderColor: '#E5E7EB',
                                                            borderWidth: 1,
                                                            padding: [12, 16],
                                                            confine: false,         // Body append means we don't need confining to parent container
                                                            enterable: false,       // Prevent tooltip from getting stuck
                                                            hideDelay: 100,
                                                            transitionDuration: 0.2,
                                                            textStyle: { color: '#1F2937', fontSize: 13, fontFamily: 'var(--font-adani), ui-sans-serif, system-ui, sans-serif' },
                                                            extraCssText: 'font-family: var(--font-adani), ui-sans-serif, system-ui, sans-serif; border: 1px solid #D1D5DB; border-radius: 8px;',
                                                            formatter: (p: any) =>
                                                                `<div style="font-weight:900;font-size:18px;margin-bottom:8px;border-bottom:1px solid #F3F4F6;padding-bottom:6px;color:#1F2937">
                                                                    ${p.name.toUpperCase()}
                                                                 </div>
                                                                 <div style="color:${p.color};font-weight:900;font-size:24px;margin-bottom:4px">
                                                                    <span style="font-size:14px;font-weight:800;color:#6B7280;margin-right:8px">PLAN</span> ${n(p.value)} MW
                                                                 </div>
                                                                 <div style="color:#10B981;font-weight:800;font-size:22px">
                                                                    <span style="font-size:14px;font-weight:800;color:#6B7280;margin-right:8px">ACTUAL COD</span> ${n(p.data.actualValue || 0)} MW
                                                                 </div>
                                                                 <div style="font-size:12px;color:#9CA3AF;margin-top:10px;padding-top:6px;border-top:1px dashed #E5E7EB;text-transform:uppercase;letter-spacing:1px;font-weight:700">
                                                                    Click to view projects
                                                                 </div>`
                                                        },
                                                        color: [
                                                            {
                                                                type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                                                                colorStops: [{ offset: 0, color: '#60A5FA' }, { offset: 1, color: '#2563EB' }]
                                                            },
                                                            {
                                                                type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                                                                colorStops: [{ offset: 0, color: '#34D399' }, { offset: 1, color: '#059669' }]
                                                            },
                                                            {
                                                                type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                                                                colorStops: [{ offset: 0, color: '#FBBF24' }, { offset: 1, color: '#D97706' }]
                                                            }
                                                        ],
                                                        series: [{
                                                            name: qd.name,
                                                            type: 'pie',
                                                            radius: ['50%', '92%'], // Even larger radius
                                                            center: ['50%', '50%'],
                                                            avoidLabelOverlap: false,
                                                            itemStyle: {
                                                                borderRadius: 4,
                                                                borderColor: '#fff',
                                                                borderWidth: 2
                                                            },
                                                            label: { show: false },
                                                            emphasis: {
                                                                scale: false, // Disable scale so hover doesn't crop!
                                                                label: { show: false }
                                                            },
                                                            labelLine: { show: false },
                                                            data: roseData.length > 0 ? roseData : [{ value: 0, name: '', itemStyle: { color: 'none' } }],
                                                            animationType: 'scale',
                                                            animationEasing: 'elasticOut',
                                                            animationDuration: 800
                                                        }]
                                                    }}
                                                    notMerge={false}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex items-center justify-center gap-8 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                            <LegendItem color={CAT_COLORS.PPA} label="PPA" type="rect" />
                            <LegendItem color={CAT_COLORS.Merchant} label="Merchant" type="rect" />
                            <LegendItem color={CAT_COLORS.Group} label="Group" type="rect" />
                            <LegendItem color={CAT_COLORS.EPC} label="EPC" type="rect" />
                        </div>
                    </>
                ) : (
                    <div className="w-full">
                        <ResponsiveContainer width="100%" height={260}>
                            <ComposedChart data={monthlyData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                                <defs>
                                    {[
                                        ['ppaGrad', '#3B82F6'], ['merchantGrad', '#C026D3'],
                                        ['groupGrad', '#F97316'], ['epcGrad', '#EC4899'], ['totalGrad', '#06B6D4']
                                    ].map(([id, color]) => (
                                        <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={color} stopOpacity={0.2} />
                                            <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                                        </linearGradient>
                                    ))}
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.05} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 700 }} dy={5} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 9, fontWeight: 700 }} width={35} />
                                <Tooltip cursor={{ stroke: '#E5E7EB', strokeWidth: 1 }} content={({ active, payload }) => {
                                    if (!active || !payload?.length) return null;
                                    const dp = payload[0]?.payload;
                                    const cats = ['PPA', 'Merchant', 'Group'];
                                    const cc: Record<string, string> = { PPA: '#3B82F6', Merchant: '#C026D3', Group: '#F97316' };
                                    return (
                                        <div className="bg-white dark:bg-gray-800 px-5 py-4 rounded-xl border border-[#E5E7EB] dark:border-gray-700 min-w-[320px] shadow-xl">
                                            <p className="text-[16px] font-black text-[#1F2937] dark:text-white mb-3 pb-2 border-b border-[#F3F4F6] dark:border-gray-700">{dp?.fullName}</p>
                                            {cats.map(c => (
                                                <div key={c} className="flex items-start gap-3 mb-3">
                                                    <div className="w-3 h-3 rounded-full mt-1 flex-shrink-0" style={{ background: cc[c] }} />
                                                    <div className="flex-1">
                                                        <span className="text-[13px] font-bold text-[#374151] dark:text-gray-200 uppercase tracking-widest">{c}</span>
                                                        <div className="flex gap-5 text-[14px] text-[#9CA3AF] mt-0.5">
                                                            <span>Plan: <strong className="text-[#374151] dark:text-gray-300">{n(dp?.[`${c}_Plan`] || 0, 1)}</strong></span>
                                                            <span>Actual: <strong className="text-[#10B981] dark:text-[#34D399]">{n(dp?.[`${c}_Actual`] || 0, 1)}</strong></span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            <div className="mt-3 pt-3 border-t border-[#F3F4F6] dark:border-gray-700 text-[15px] font-bold text-[#374151] dark:text-gray-200">
                                                Total: <span className="text-[#0B74B0] dark:text-[#3B82F6]">{n(dp?.Total_Actual || 0, 1)}</span> / {n(dp?.Total_Plan || 0, 1)} MW
                                            </div>
                                            <div className="mt-1.5 pt-1.5 text-[14px] font-bold text-gray-500">
                                                Upto that month: <span className="text-[#06B6D4]">{n(dp?.Cumm_Actual || 0, 1)}</span> / {n(dp?.Cumm_Plan || 0, 1)}
                                            </div>
                                        </div>
                                    );
                                }} />
                                <Line type="monotone" dataKey="PPA_Plan" stroke="#3B82F6" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3, fill: '#3B82F6', strokeWidth: 0 }} />
                                <Line type="monotone" dataKey="Merchant_Plan" stroke="#10B981" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3, fill: '#10B981', strokeWidth: 0 }} />
                                <Line type="monotone" dataKey="Group_Plan" stroke="#F59E0B" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3, fill: '#F59E0B', strokeWidth: 0 }} />
                                <Line type="monotone" dataKey="EPC_Plan" stroke="#EC4899" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3, fill: '#EC4899', strokeWidth: 0 }} />
                                <Area type="monotone" dataKey="PPA_Actual" stroke="#3B82F6" strokeWidth={2.5} fill="url(#ppaGrad)" dot={{ r: 4, fill: '#3B82F6', strokeWidth: 2, stroke: '#fff' }} />
                                <Area type="monotone" dataKey="Merchant_Actual" stroke="#10B981" strokeWidth={2.5} fill="url(#merchantGrad)" dot={{ r: 4, fill: '#10B981', strokeWidth: 2, stroke: '#fff' }} />
                                <Area type="monotone" dataKey="Group_Actual" stroke="#F59E0B" strokeWidth={2.5} fill="url(#groupGrad)" dot={{ r: 4, fill: '#F59E0B', strokeWidth: 2, stroke: '#fff' }} />
                                <Area type="monotone" dataKey="EPC_Actual" stroke="#EC4899" strokeWidth={2.5} fill="url(#epcGrad)" dot={{ r: 4, fill: '#EC4899', strokeWidth: 2, stroke: '#fff' }} />
                                <Area type="monotone" dataKey="Total_Actual" stroke="#06B6D4" strokeWidth={2.5} fill="url(#totalGrad)" dot={{ r: 4, fill: '#06B6D4', strokeWidth: 2, stroke: '#fff' }} />
                            </ComposedChart>
                        </ResponsiveContainer>

                        {/* Monthly View Legend moved "down" */}
                        <div className="flex items-center justify-center gap-x-6 gap-y-2 flex-wrap mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                            {[
                                { color: '#3B82F6', label: 'PPA Plan', type: 'dash' as const },
                                { color: '#10B981', label: 'Merchant Plan', type: 'dash' as const },
                                { color: '#F59E0B', label: 'Group Plan', type: 'dash' as const },
                                { color: '#EC4899', label: 'EPC Plan', type: 'dash' as const },
                                { color: '#3B82F6', label: 'PPA Actual', type: 'line' as const },
                                { color: '#10B981', label: 'Merchant Actual', type: 'line' as const },
                                { color: '#F59E0B', label: 'Group Actual', type: 'line' as const },
                                { color: '#EC4899', label: 'EPC Actual', type: 'line' as const },
                                { color: '#06B6D4', label: 'Total Actual', type: 'line' as const }
                            ].map(item => (
                                <LegendItem key={item.label} color={item.color} label={item.label} type={item.type} />
                            ))}
                        </div>
                    </div>
                )}
            </ChartCard>

            {/* ─── SECTION DIVIDER ───────────────────────────────────── */}
            <div className="flex items-center gap-3 mt-4 mb-3">
                <div className="flex-1 h-px bg-gray-300 dark:bg-gray-700" />
                <h2 className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest whitespace-nowrap">Location Breakdown</h2>
                <div className="flex-1 h-px bg-gray-300 dark:bg-gray-700" />
            </div>

            {/* ─── LOCATION BREAKDOWN ───────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {locationData.map((data) => {
                    const achColor = data.ach >= 100 ? '#10B981' : data.ach >= 50 ? '#0B74B0' : '#F59E0B';
                    return (
                        <div key={data.title} className="bg-white dark:bg-[#111827] rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-200 shadow-sm hover:shadow-md">
                            {/* Card Top Accent */}
                            <div className="h-0.5 w-full" style={{ background: achColor }} />

                            <div className="p-4">
                                {/* Header */}
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: `${achColor}15`, border: `1px solid ${achColor}30` }}>
                                            <svg className="w-3.5 h-3.5" style={{ color: achColor }} viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                                            </svg>
                                        </div>
                                        <h3 className="text-xs font-bold text-gray-900 dark:text-white leading-tight truncate">{data.title}</h3>
                                    </div>
                                    <div className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider" style={{ background: `${achColor}15`, color: achColor }}>
                                        {data.ach.toFixed(1)}%
                                    </div>
                                </div>

                                {/* Metrics Row */}
                                <div className="grid grid-cols-2 gap-2 mb-3">
                                    <div className="bg-gray-50 dark:bg-gray-900/60 rounded-lg p-2.5 border border-gray-100 dark:border-gray-800/50">
                                        <p className="text-[8px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Plan</p>
                                        <div className="flex items-baseline gap-0.5">
                                            <span className="text-base font-black text-gray-900 dark:text-white">{n(data.plan, 1)}</span>
                                            <span className="text-[8px] font-bold text-gray-400 dark:text-gray-600 uppercase">MW</span>
                                        </div>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-900/60 rounded-lg p-2.5 border border-gray-100 dark:border-gray-800/50">
                                        <p className="text-[8px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Actual</p>
                                        <div className="flex items-baseline gap-0.5">
                                            <span className="text-base font-black" style={{ color: achColor }}>{n(data.actual, 1)}</span>
                                            <span className="text-[8px] font-bold text-gray-400 dark:text-gray-600 uppercase">MW</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-1000"
                                        style={{ width: `${Math.min(data.ach, 100)}%`, background: achColor }}
                                    />
                                </div>

                                {/* Category Breakdown Mini Row */}
                                {data.cats.length > 0 && (
                                    <div className="flex items-center gap-2.5 mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-800/60">
                                        {data.cats.map(cat => (
                                            <div key={cat.name} className="flex items-center gap-1">
                                                <div className="w-1.5 h-1.5 rounded-full" style={{ background: CAT_COLORS[cat.name] }} />
                                                <span className="text-[9px] font-semibold text-gray-400 dark:text-gray-500">{cat.name}</span>
                                                <span className="text-[9px] font-bold text-gray-600 dark:text-gray-400">{n(cat.actual, 0)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ─── UPCOMING COMMISSIONING MODAL ────────────────────────────────────── */}
            {upcomingModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80">
                    <div className="bg-white dark:bg-gray-800 w-full max-w-[95vw] max-h-[90vh] rounded-2xl overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                            <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Upcoming Commissioning</h3>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 relative">
                                    <span className="text-xs font-bold text-gray-500 uppercase">Month:</span>
                                    <CustomMonthSelect
                                        value={upcomingMonth}
                                        onChange={setUpcomingMonth}
                                        options={dynamicMonths}
                                    />
                                </div>
                                <button onClick={() => setUpcomingModalOpen(false)} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-6">
                            <UpcomingSection
                                title="Khavda Solar"
                                allProjects={allProjects}
                                month={upcomingMonth}
                                filterFn={(p: any) => isKhavda(p) && (p.category || '').toLowerCase().includes('solar')}
                                fiscalYear={fiscalYear}
                            />
                            <UpcomingSection
                                title="Khavda Wind"
                                allProjects={allProjects}
                                month={upcomingMonth}
                                filterFn={(p: any) => isKhavda(p) && (p.category || '').toLowerCase().includes('wind')}
                                fiscalYear={fiscalYear}
                            />
                            <UpcomingSection
                                title="Outside Khavda"
                                allProjects={allProjects}
                                month={upcomingMonth}
                                filterFn={(p: any) => !isKhavda(p)}
                                fiscalYear={fiscalYear}
                            />
                        </div>
                    </div>
                </div>
            )}

            {drilldown && (
                <DrilldownModal drilldown={drilldown} drilldownData={drilldownData} onClose={() => setDrilldown(null)} n={n} />
            )}

            {compareModalOpen && (
                <ComparisonModal onClose={() => setCompareModalOpen(false)} n={n} />
            )}
        </div>
    );
}

function DrilldownModal({ drilldown, drilldownData, onClose, n }: any) {
    const [filterType, setFilterType] = useState('All Types');
    const [filterCategory, setFilterCategory] = useState('All Categories');
    const [filterPlot, setFilterPlot] = useState('All Plots');

    const enhancedData = useMemo(() => {
        return drilldownData.map((row: any) => ({
            ...row,
            derivedType: (row.category || '').toLowerCase().includes('wind') ? 'Wind' : 'Solar'
        }));
    }, [drilldownData]);

    const typeOptions = ['All Types', ...Array.from(new Set(enhancedData.map((r: any) => r.derivedType)))];
    const catOptions = ['All Categories', ...Array.from(new Set(enhancedData.map((r: any) => r.projectType)))];
    const plotOptions = ['All Plots', ...Array.from(new Set(enhancedData.map((r: any) => r.plotNo || '—')))];

    const filteredData = useMemo(() => {
        return enhancedData.filter((r: any) => {
            if (filterType !== 'All Types' && r.derivedType !== filterType) return false;
            if (filterCategory !== 'All Categories' && r.projectType !== filterCategory) return false;
            if (filterPlot !== 'All Plots' && (r.plotNo || '—') !== filterPlot) return false;
            return true;
        });
    }, [enhancedData, filterType, filterCategory, filterPlot]);

    const solarPlan = enhancedData.filter((r: any) => r.derivedType === 'Solar').reduce((s: number, r: any) => s + r.planVal, 0);
    const solarActual = enhancedData.filter((r: any) => r.derivedType === 'Solar').reduce((s: number, r: any) => s + r.actualVal, 0);
    const solarProj = enhancedData.filter((r: any) => r.derivedType === 'Solar').reduce((s: number, r: any) => s + r.projectedVal, 0);
    const windPlan = enhancedData.filter((r: any) => r.derivedType === 'Wind').reduce((s: number, r: any) => s + r.planVal, 0);
    const windActual = enhancedData.filter((r: any) => r.derivedType === 'Wind').reduce((s: number, r: any) => s + r.actualVal, 0);
    const windProj = enhancedData.filter((r: any) => r.derivedType === 'Wind').reduce((s: number, r: any) => s + r.projectedVal, 0);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 w-full max-w-[95vw] rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 gap-4">
                    <div className="flex items-center gap-6">
                        <h3 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                            <span className="w-3 h-9 bg-[#0B74B0] rounded-full" />
                            {drilldown.quarter.toUpperCase()} Breakdown {drilldown.category ? `— ${drilldown.category}` : ''}
                        </h3>
                        {/* Totals Summary */}
                        <div className="flex items-center gap-8 p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 ml-2">
                            <div className="flex items-end gap-2">
                                <span className="text-[14px] font-black text-gray-400 uppercase tracking-widest mb-1">Solar :</span>
                                <div className="flex items-baseline gap-1.5">
                                    <span className="text-[28px] font-black text-[#10B981] leading-none" title="Actual COD">{n(solarActual, 1)}</span>
                                    <span className="text-[18px] font-bold text-gray-400 opacity-60">/</span>
                                    <span className="text-[24px] font-black text-[#EC4899] leading-none" title="Projected">{n(solarProj, 1)}</span>
                                    <span className="text-[18px] font-bold text-gray-400 opacity-30">/</span>
                                    <span className="text-[22px] font-black text-[#0B74B0] leading-none" title="Target Plan">{n(solarPlan, 1)}</span>
                                    <span className="text-[13px] font-bold text-gray-400 ml-1">MW</span>
                                </div>
                            </div>
                            <div className="flex items-end gap-2 border-l border-gray-100 dark:border-gray-800 pl-8">
                                <span className="text-[14px] font-black text-gray-400 uppercase tracking-widest mb-1">Wind :</span>
                                <div className="flex items-baseline gap-1.5">
                                    <span className="text-[28px] font-black text-[#10B981] leading-none" title="Actual COD">{n(windActual, 1)}</span>
                                    <span className="text-[18px] font-bold text-gray-400 opacity-60">/</span>
                                    <span className="text-[24px] font-black text-[#EC4899] leading-none" title="Projected">{n(windProj, 1)}</span>
                                    <span className="text-[18px] font-bold text-gray-400 opacity-30">/</span>
                                    <span className="text-[22px] font-black text-[#0B74B0] leading-none" title="Target Plan">{n(windPlan, 1)}</span>
                                    <span className="text-[13px] font-bold text-gray-400 ml-1">MW</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto mt-2 sm:mt-0">
                        {/* Filters */}
                        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-[15px] font-bold px-3 py-1.5 outline-none text-[#0B74B0] uppercase tracking-wide cursor-pointer hover:border-blue-400 min-w-[100px]">
                            {typeOptions.map((o: any) => <option key={o} value={o}>{o}</option>)}
                        </select>
                        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-[15px] font-bold px-3 py-1.5 outline-none text-purple-700 uppercase tracking-wide cursor-pointer hover:border-purple-400 min-w-[120px]">
                            {catOptions.map((o: any) => <option key={o} value={o}>{o}</option>)}
                        </select>
                        <select value={filterPlot} onChange={e => setFilterPlot(e.target.value)} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-[15px] font-bold px-3 py-1.5 outline-none text-gray-800 dark:text-gray-200 uppercase tracking-wide max-w-[140px] truncate cursor-pointer hover:border-gray-400">
                            {plotOptions.map((o: any) => <option key={o} value={o}>{o}</option>)}
                        </select>

                        <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors ml-2 bg-gray-100 dark:bg-gray-800">
                            <span className="text-xl leading-none">&times;</span>
                        </button>
                    </div>
                </div>
                <div className="flex-1 overflow-auto p-0 scrollbar-thin">
                    <table className="w-full text-left border-collapse font-sans min-w-[800px]">
                        <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10 border-b border-gray-100 dark:border-gray-700">
                            <tr>
                                <th className="py-4 px-5 text-[14px] font-black text-gray-400 uppercase tracking-widest min-w-[120px]">Project Name</th>
                                <th className="py-4 px-5 text-[14px] font-black text-gray-400 uppercase tracking-widest">SPV</th>
                                <th className="py-4 px-5 text-[14px] font-black text-gray-400 uppercase tracking-widest text-center">Type</th>
                                <th className="py-4 px-5 text-[14px] font-black text-gray-400 uppercase tracking-widest text-center">Category</th>
                                <th className="py-4 px-5 text-[14px] font-black text-gray-400 uppercase tracking-widest text-center min-w-[80px]">Plot No</th>
                                <th className="py-4 px-5 text-[14px] font-black text-gray-400 uppercase tracking-widest text-right">Capacity (MW)</th>
                                <th className="py-4 px-5 text-[14px] font-black text-gray-400 uppercase tracking-widest text-right">Plan (MW)</th>
                                <th className="py-4 px-5 text-[14px] font-black text-gray-400 uppercase tracking-widest text-right">Proj (MW)</th>
                                <th className="py-4 px-5 text-[14px] font-black text-gray-400 uppercase tracking-widest text-right">Actual COD</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                            {filteredData.length > 0 ? filteredData.map((row: any, idx: number) => {
                                return (
                                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
                                        <td className="py-4 px-5 text-[19px] font-black text-gray-800 dark:text-gray-200 group-hover:text-[#0B74B0]">{row.projectName}</td>
                                        <td className="py-4 px-5 text-[15px] font-medium text-gray-500 uppercase tracking-tight">{row.spv}</td>
                                        <td className="py-4 px-5 text-center">
                                            <span className="text-[17px] font-bold text-gray-500 uppercase">{row.derivedType}</span>
                                        </td>
                                        <td className="py-4 px-5 text-center">
                                            <span className={`text-[15px] font-bold px-3 py-1 rounded-full border tracking-wide uppercase ${row.projectType === 'PPA' ? 'bg-blue-50/80 text-blue-700 border-blue-200/50' :
                                                row.projectType === 'Merchant' ? 'bg-purple-50/80 text-purple-700 border-purple-200/50' :
                                                    'bg-amber-50/80 text-amber-700 border-amber-200/50'
                                                }`}>{row.projectType}</span>
                                        </td>
                                        <td className="py-4 px-5 text-[16px] font-medium text-gray-500 text-center">{row.plotNo || '—'}</td>
                                        <td className="py-4 px-5 text-[19px] font-medium text-gray-600 dark:text-gray-400 text-right">{n(row.capacity || 0)}</td>
                                        <td className="py-4 px-5 text-[19px] font-medium text-gray-600 dark:text-gray-400 text-right">{n(row.planVal)}</td>
                                        <td className="py-4 px-5 text-[19px] font-medium text-[#EC4899] text-right" title="Actual + Forecast">{n(row.projectedVal)}</td>
                                        <td className="py-4 px-5 text-[20px] font-black text-[#10B981] dark:text-[#34D399] text-right">{n(row.actualVal)}</td>
                                    </tr>
                                );
                            }) : (
                                <tr><td colSpan={8} className="text-center py-16 text-[15px] font-medium text-gray-500">No projects found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function ComparisonModal({ onClose, n }: any) {
    const [compA, setCompA] = useState({ fy: 'FY_24-25', q: [] as string[], m: '' });
    const [compB, setCompB] = useState({ fy: 'FY_25-26', q: [] as string[], m: '' });

    const { data: dataA = [] } = useQuery({
        queryKey: ['commissioning-projects', compA.fy],
        queryFn: () => fetch(`${API_BASE}/api/commissioning-projects?fiscalYear=${compA.fy}`).then(r => r.json())
    });

    const { data: dataB = [] } = useQuery({
        queryKey: ['commissioning-projects', compB.fy],
        queryFn: () => fetch(`${API_BASE}/api/commissioning-projects?fiscalYear=${compB.fy}`).then(r => r.json())
    });

    const transformProjects = useCallback((data: any[], fy: string) => {
        return data.filter(p => p.planActual === 'Actual').map(p => {
            const pCopy = { ...p };

            // Use this project's own milestones directly
            const projectMilestones = p.milestones || {};

            const mFull = ['apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar'] as const;
            mFull.forEach(m => {
                const mss = projectMilestones[m] || [];
                if (mss.length > 0) {
                    pCopy[m] = mss.reduce((s: number, ms: any) => isPassed(ms.codDate) ? s + (ms.mw || 0) : s, 0);
                } else {
                    pCopy[m] = 0; // Strictly zero if no milestone exists
                }
            });
            return pCopy;
        });
    }, []);

    const calculateStats = (projects: any[], filters: any) => {
        let actualProjectsVetted = transformProjects(projects, filters.fy);
        let planProjects = projects.filter(p => p.planActual === 'Plan' && p.includedInTotal);
        let actualProjects = actualProjectsVetted.filter(p => p.includedInTotal);

        const sum = (projs: any[], keys: string[]) =>
            projs.reduce((s, p) => s + keys.reduce((ks, k) => ks + (p[k] || 0), 0), 0);

        let keys = monthKeys as unknown as string[];
        if (filters.m) keys = [filters.m.toLowerCase()];
        else if (filters.q && filters.q.length > 0) {
            keys = [];
            filters.q.forEach((q: string) => {
                const idx = parseInt(q.replace('Q', '')) - 1;
                keys.push(monthKeys[idx * 3] as unknown as string, monthKeys[idx * 3 + 1] as unknown as string, monthKeys[idx * 3 + 2] as unknown as string);
            });
        }

        const plan = sum(planProjects, keys);
        const actual = sum(actualProjects, keys);
        const ach = plan > 0 ? (actual / plan) * 100 : 0;

        return { plan, actual, ach };
    };

    const statsA = calculateStats(dataA, compA);
    const statsB = calculateStats(dataB, compB);

    const fyears = ['23-24', '24-25', '25-26', '26-27'];
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
    const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];

    const getPeriodLabel = (f: any) => {
        if (f.m) return `${f.m} ${f.fy.replace('FY_', 'FY ')}`;
        if (f.q && f.q.length > 0) return `${f.q.join(' & ')} ${f.fy.replace('FY_', 'FY ')}`;
        return f.fy.replace('FY_', 'FY ');
    };

    const labelA = getPeriodLabel(compA);
    const labelB = getPeriodLabel(compB);



    const monthlyA = getMonthlyData(transformProjects(dataA, compA.fy));
    const monthlyB = getMonthlyData(transformProjects(dataB, compB.fy));

    const activeMonthsA = new Set();
    if (compA.m) activeMonthsA.add(compA.m);
    else if (compA.q && compA.q.length > 0) {
        compA.q.forEach((q: string) => {
            const idx = parseInt(q.replace('Q', '')) - 1;
            activeMonthsA.add(months[idx * 3]);
            activeMonthsA.add(months[idx * 3 + 1]);
            activeMonthsA.add(months[idx * 3 + 2]);
        });
    } else months.forEach(m => activeMonthsA.add(m));

    const activeMonthsB = new Set();
    if (compB.m) activeMonthsB.add(compB.m);
    else if (compB.q && compB.q.length > 0) {
        compB.q.forEach((q: string) => {
            const idx = parseInt(q.replace('Q', '')) - 1;
            activeMonthsB.add(months[idx * 3]);
            activeMonthsB.add(months[idx * 3 + 1]);
            activeMonthsB.add(months[idx * 3 + 2]);
        });
    } else months.forEach(m => activeMonthsB.add(m));

    const chartData = months.map((m, i) => ({
        month: m,
        planA: monthlyA[i].plan,
        actualA: monthlyA[i].actual,
        planB: monthlyB[i].plan,
        actualB: monthlyB[i].actual,
    })).filter(d => activeMonthsA.has(d.month) || activeMonthsB.has(d.month));

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-2 sm:p-4" onClick={onClose}>
            <div className="bg-white dark:bg-[#0F172A] w-full max-w-[95vw] rounded-3xl flex flex-col border border-gray-200 dark:border-gray-800 relative" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="px-8 py-5 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0F172A] flex justify-between items-center rounded-t-3xl">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                            <svg className="w-5 h-5 text-[#0B74B0]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2m0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                                <div className="w-2 h-8 bg-[#0B74B0]" />
                                Performance Comparison
                            </h2>
                            <p className="text-[12px] font-bold text-gray-400 uppercase tracking-widest mt-1">Comparative Analytics & Benchmarking</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-xl font-light text-gray-400 hover:text-gray-600 transition-colors">&times;</button>
                </div>

                <div className="p-4 space-y-4 max-h-[85vh] overflow-y-auto scrollbar-thin">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <PeriodSelectCard
                            title="Baseline Period"
                            label={labelA}
                            comp={compA}
                            setComp={setCompA}
                            stats={statsA}
                            fyears={fyears}
                            quarters={quarters}
                            months={months}
                            n={n}
                            accentColor="#0B74B0"
                        />
                        <PeriodSelectCard
                            title="Comparison Period"
                            label={labelB}
                            comp={compB}
                            setComp={setCompB}
                            stats={statsB}
                            fyears={fyears}
                            quarters={quarters}
                            months={months}
                            n={n}
                            accentColor="#75479C"
                        />
                    </div>

                    {/* Chart & Variance Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-10 gap-3">
                        {/* Visual Graph Card */}
                        <div className="lg:col-span-7 bg-white dark:bg-[#1E293B] rounded-2xl p-4 border border-gray-200 dark:border-gray-800 relative overflow-visible">
                            <div className="flex justify-between items-center mb-4 border-b border-gray-50 dark:border-gray-700 pb-2">
                                <h5 className="text-[12px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                    <div className="w-1 h-3 bg-[#0B74B0]" />
                                    Comparative Analytics
                                </h5>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2 text-[12px] font-black text-gray-500 uppercase tracking-widest">
                                        <div className="w-3 h-3 bg-[#0B74B0] rounded-sm" /> BASELINE (Plan / Actual)
                                    </div>
                                    <div className="flex items-center gap-2 text-[12px] font-black text-gray-500 uppercase tracking-widest">
                                        <div className="w-3 h-3 bg-[#75479C] rounded-sm" /> COMPARISON (Plan / Actual)
                                    </div>
                                </div>
                            </div>
                            <div className="w-full h-[350px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorActualA" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#0B74B0" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#0B74B0" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="colorActualB" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#75479C" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#75479C" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.05} />
                                        <XAxis
                                            dataKey="month"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 11, fontWeight: 700, fill: '#94A3B8' }}
                                            dy={10}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 11, fontWeight: 700, fill: '#CBD5E1' }}
                                        />
                                        <Tooltip
                                            cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
                                            content={({ active, payload, label }: any) => {
                                                if (active && payload && payload.length) {
                                                    return (
                                                        <div className="bg-[#0F172A] border border-gray-700/50 p-4 rounded-xl shadow-2xl min-w-[220px]">
                                                            <p className="text-white font-black mb-3 text-[15px] tracking-wide">{label}</p>
                                                            {payload.map((entry: any, index: number) => (
                                                                <div key={index} className="flex items-center justify-between gap-6 text-[12px] font-bold my-2" style={{ color: entry.color }}>
                                                                    <span className="block opacity-90">{entry.name} :</span>
                                                                    <span className="font-black text-[14px]">{n(entry.value, 1)} MW</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        {/* Period A */}
                                        <Area
                                            type="monotone"
                                            dataKey="actualA"
                                            stroke="#0B74B0"
                                            strokeWidth={3}
                                            fillOpacity={1}
                                            fill="url(#colorActualA)"
                                            name={`${labelA} Actual`}
                                            dot={{ r: 3, fill: '#0B74B0', strokeWidth: 2, stroke: '#fff' }}
                                            activeDot={{ r: 5, strokeWidth: 0 }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="planA"
                                            stroke="#0B74B0"
                                            strokeWidth={2}
                                            strokeDasharray="5 5"
                                            dot={false}
                                            name={`${labelA} Plan`}
                                        />
                                        {/* Period B */}
                                        <Area
                                            type="monotone"
                                            dataKey="actualB"
                                            stroke="#75479C"
                                            strokeWidth={3}
                                            fillOpacity={1}
                                            fill="url(#colorActualB)"
                                            name={`${labelB} Actual`}
                                            dot={{ r: 3, fill: '#75479C', strokeWidth: 2, stroke: '#fff' }}
                                            activeDot={{ r: 5, strokeWidth: 0 }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="planB"
                                            stroke="#75479C"
                                            strokeWidth={2}
                                            strokeDasharray="5 5"
                                            dot={false}
                                            name={`${labelB} Plan`}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Variance Summary Column */}
                        <div className="lg:col-span-3 flex flex-col gap-4">
                            <h5 className="text-[14px] font-bold text-gray-400 uppercase tracking-widest text-center border-b border-gray-50 dark:border-gray-700 pb-2">Analysis Δ</h5>

                            <VarianceCard
                                title="Plan Variance"
                                value={statsB.plan - statsA.plan}
                                unit="MW"
                                positive={statsB.plan >= statsA.plan}
                            />

                            <VarianceCard
                                title="Actual Variance"
                                value={statsB.actual - statsA.actual}
                                unit="MW"
                                positive={statsB.actual >= statsA.actual}
                            />
                        </div>
                    </div>

                </div>
            </div>

        </div>
    );
}

function VarianceCard({ title, value, unit, positive, fixed = 0 }: any) {
    const isZero = value === 0;
    return (
        <div className="bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 flex flex-col flex-1 justify-center">
            <p className="text-[14px] font-black text-gray-400 uppercase mb-3 tracking-wider">{title}</p>
            <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-2">
                    <p className={`text-4xl font-black tabular-nums tracking-tight ${isZero ? 'text-gray-400' : positive ? 'text-[#109E6D]' : 'text-[#D94F4F]'}`}>
                        {value > 0 ? '+' : ''}{value.toLocaleString(undefined, { minimumFractionDigits: fixed, maximumFractionDigits: fixed })}
                    </p>
                    <span className="text-[13px] font-bold text-gray-400 uppercase">{unit}</span>
                </div>
                <div className={`text-[18px] font-black ${isZero ? 'text-gray-400' : positive ? 'text-[#109E6D]' : 'text-[#D94F4F]'}`}>
                    {isZero ? '' : positive ? '▲' : '▼'}
                </div>
            </div>
        </div>
    );
}



// ─── Sub-Components (matching CommissioningDashboard style) ──────

function DetailKPICard({ label, overall, agel, group, epc, showEPC, gradient, col1Label = "Total (MW)", col2Label, overall2, agel2, group2, epc2, tooltip }: any) {
    const n = (v: number, d: number = 0) => v.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
    const has2 = col2Label !== undefined;

    const Row = ({ rowLabel, val1, val2, first }: { rowLabel: string; val1: number; val2?: number; first?: boolean }) => (
        <div className={`flex items-center ${first ? '' : 'border-t border-white/10 pt-1.5'}`}>
            <p className="text-[14px] font-black text-white/95 uppercase tracking-wider w-[85px] shrink-0">{rowLabel}</p>
            <div className="flex-1 min-w-0 text-right pr-4">
                <span className="text-3xl sm:text-4xl font-black text-white tabular-nums">{n(val1)}</span>
            </div>
            {has2 && (
                <div className="flex-1 min-w-0 text-right">
                    <span className="text-3xl sm:text-4xl font-black text-white/90 tabular-nums">{n(val2 ?? 0)}</span>
                </div>
            )}
        </div>
    );

    return (
        <div className={`bg-gradient-to-br ${gradient} px-4 py-3 rounded-xl border border-white/10 relative group flex flex-col justify-between hover:z-50 transition-all flex-1 min-w-[300px] max-w-[420px] shadow-lg`}>
            <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
                <div className="absolute top-0 right-0 -m-6 w-24 h-24 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
            </div>
            <div className="relative z-10 space-y-2">
                {/* Title + column headers */}
                <div className="border-b border-white/20 pb-2">
                    <div className="flex items-center gap-2">
                        <p className="text-lg sm:text-xl font-black text-white uppercase tracking-[0.18em]">{label}</p>
                        {tooltip && (
                            <div className="relative group/tooltip z-30">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-white/50 hover:text-white cursor-pointer transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3 hidden group-hover/tooltip:block w-64 p-4 bg-[#111827] shadow-[0_20px_50px_rgba(0,0,0,0.4)] z-[9999] normal-case font-black border border-white/10 text-center animate-in fade-in zoom-in-95 duration-200 text-white text-[13px] leading-relaxed rounded-xl">
                                    <div className="absolute left-1/2 -translate-x-1/2 top-full -mt-1 border-8 border-transparent border-t-[#111827]" />
                                    {tooltip}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center mt-1">
                        <div className="w-[85px] shrink-0" />
                        <div className="flex-1 text-right pr-4">
                            <span className="text-[12px] font-black text-white/70 uppercase tracking-widest">{col1Label}</span>
                        </div>
                        {has2 && (
                            <div className="flex-1 text-right">
                                <span className="text-[12px] font-black text-white/70 uppercase tracking-widest">{col2Label}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Rows */}
                <div className="flex flex-col gap-1.5">
                    <Row rowLabel="Overall" val1={overall} val2={overall2} first />
                    <Row rowLabel="AGEL" val1={agel} val2={agel2} />
                    <Row rowLabel="Group" val1={group} val2={group2} />
                    {showEPC && <Row rowLabel="EPC" val1={epc} val2={epc2} />}
                </div>
            </div>
        </div>
    );
}

function ChartCard({ title, children, controls, className = "" }: {
    title: string; children: React.ReactNode; controls?: React.ReactNode; className?: string;
}) {
    return (
        <div className={`bg-white dark:bg-[#1F2937] border-t-2 border-t-[#0B74B0] border border-[#D1D5DB] dark:border-gray-700 rounded-lg p-3 sm:p-4 transition-shadow overflow-visible flex flex-col ${className}`}>
            <div className="flex flex-wrap justify-between items-start gap-y-2 gap-x-4 mb-3 min-h-[28px] border-b border-[#F3F4F6] dark:border-gray-700 pb-2">
                <h3 className="text-md font-black text-[#1F2937] dark:text-white leading-tight tracking-wide uppercase">{title}</h3>
                {controls && (
                    <div className="flex flex-wrap items-center justify-end gap-3 flex-grow sm:flex-grow-0 relative z-[60]">
                        {controls}
                    </div>
                )}
            </div>
            <div className="flex-1 w-full relative">{children}</div>
        </div>
    );
}

function LegendItem({ color, label, type }: { key?: string; color: string; label: string; type: 'rect' | 'dash' | 'line' }) {
    return (
        <div className="flex items-center gap-2">
            {type === 'rect' && <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />}
            {type === 'dash' && <svg width="14" height="4"><line x1="0" y1="2" x2="14" y2="2" stroke={color} strokeWidth="2" strokeDasharray="3 2" /></svg>}
            {type === 'line' && <div className="w-4 h-0.5 rounded-full" style={{ background: color }} />}
            <span className="text-[14px] font-black text-[#4B5563] dark:text-gray-300 uppercase tracking-wider">{label}</span>
        </div>
    );
}

export type OptionType = string | { value: string; label: string };

function FilterPill({ icon, label, value, options, onChange }: {
    icon: React.ReactNode; label: string; value: string; options: OptionType[]; onChange: (v: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const active = !!value;

    const getOptValue = (o: OptionType) => typeof o === 'string' ? o : o.value;
    const getOptLabel = (o: OptionType) => typeof o === 'string' ? o : o.label;

    const displayValue = useMemo(() => {
        const opt = options.find(o => getOptValue(o) === value);
        return opt ? getOptLabel(opt) : value;
    }, [value, options]);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const select = (v: string) => { onChange(v); setOpen(false); };

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(!open)}
                className={`flex items-center gap-2.5 pl-3.5 pr-2.5 py-2.5 rounded-xl border transition-all text-[14px] font-black uppercase tracking-wider whitespace-nowrap ${active
                    ? 'bg-[#0B74B0]/10 border-[#0B74B0]/30 text-[#0B74B0] dark:bg-[#0B74B0]/20 dark:border-[#0B74B0]/40 dark:text-[#4DA8D8]'
                    : 'bg-white dark:bg-gray-800 border-[#E5E7EB] dark:border-gray-700 text-[#374151] dark:text-gray-300 hover:border-[#0B74B0]/20 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
            >
                <span className="flex-shrink-0 opacity-80 scale-90">{icon}</span>
                <span>{displayValue || label}</span>
                <svg className={`w-3.5 h-3.5 flex-shrink-0 opacity-50 transition-transform stroke-[2.5] ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {open && (
                <div className="absolute left-0 top-full mt-1.5 z-[100] min-w-[180px] max-h-[280px] overflow-y-auto bg-white dark:bg-[#1F2937] rounded-lg border border-[#E5E7EB] dark:border-gray-600 ring-4 ring-black/5 shadow-2xl">
                    <div
                        onClick={() => select('')}
                        className={`px-4 py-3 text-[13px] cursor-pointer flex items-center justify-between transition-colors ${!value
                            ? 'bg-[#0B74B0]/10 text-[#0B74B0] font-black'
                            : 'text-[#374151] dark:text-gray-300 hover:bg-[#F3F4F6] dark:hover:bg-gray-700/60 font-bold'
                            }`}
                    >
                        <span className="uppercase tracking-wide">{label}</span>
                        {!value && <svg className="w-4 h-4 text-[#0B74B0]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <div className="h-px bg-[#E5E7EB] dark:bg-gray-700" />
                    {options.map((o, idx) => {
                        const val = getOptValue(o);
                        const lab = getOptLabel(o);
                        return (
                            <div
                                key={val + idx}
                                onClick={() => select(val)}
                                className={`px-4 py-3 text-[13px] cursor-pointer flex items-center justify-between transition-colors ${value === val
                                    ? 'bg-[#0B74B0]/10 text-[#0B74B0] font-black'
                                    : 'text-[#374151] dark:text-gray-300 hover:bg-[#F3F4F6] dark:hover:bg-gray-700/60 font-bold'
                                    }`}
                            >
                                <span className="uppercase tracking-wide">{lab}</span>
                                {value === val && <svg className="w-4 h-4 text-[#0B74B0]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function CustomMonthSelect({ value, options, onChange }: any) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handle = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', handle);
        return () => document.removeEventListener('mousedown', handle);
    }, []);

    const selected = options.find((o: any) => o.key === value) || options[0];

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center justify-between gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-xs font-bold px-2 py-1 outline-none text-[#0B74B0] min-w-[90px]"
            >
                <span>{selected.label} '{selected.year}</span>
                <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {open && (
                <div className="absolute right-0 top-full mt-1 z-[250] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-xl py-1 min-w-[100px] max-h-48 overflow-y-auto scrollbar-thin">
                    {options.map((o: any) => (
                        <div
                            key={o.key}
                            onClick={() => { onChange(o.key); setOpen(false); }}
                            className={`px-3 py-1.5 text-xs cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30 whitespace-nowrap ${value === o.key ? 'text-[#0B74B0] font-black bg-blue-50/50 dark:bg-blue-900/20' : 'text-gray-700 dark:text-gray-300 font-medium'}`}
                        >
                            {o.label} '{o.year}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function MiniSelect({ value, options, onChange, label, className = "" }: any) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handle = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', handle);
        return () => document.removeEventListener('mousedown', handle);
    }, []);

    return (
        <div ref={ref} className={`relative ${className}`}>
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-[13px] font-bold text-gray-700 dark:text-gray-300 hover:border-blue-400 transition-colors"
            >
                <span className="truncate">{value || label}</span>
                <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {open && (
                <div className="absolute left-0 right-0 top-full mt-1 z-[150] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-48 overflow-y-auto scrollbar-thin">
                    {options.map((o: any) => (
                        <div
                            key={o}
                            onClick={() => { onChange(o); setOpen(false); }}
                            className={`px-3 py-2 text-[13px] cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30 font-medium ${value === o ? 'text-blue-600 bg-blue-50/50 dark:bg-blue-900/20' : 'text-gray-600 dark:text-gray-400'}`}
                        >
                            {o}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function MiniMultiSelect({ values, options, onChange, label, className = "" }: any) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handle = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', handle);
        return () => document.removeEventListener('mousedown', handle);
    }, []);

    const displayVal = values.length === 0 ? "Full Year" : values.join(', ');

    const toggle = (o: string) => {
        if (o === "Full Year") {
            onChange([]);
        } else {
            if (values.includes(o)) {
                onChange(values.filter((v: string) => v !== o));
            } else {
                onChange([...values, o]);
            }
        }
    };

    return (
        <div ref={ref} className={`relative ${className}`}>
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-[13px] font-bold text-gray-700 dark:text-gray-300 hover:border-blue-400 transition-colors"
            >
                <span className="truncate">{displayVal}</span>
                <svg className={`w-4 h-4 transition-transform flex-shrink-0 ml-1 ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {open && (
                <div className="absolute left-0 right-0 top-full mt-1 z-[160] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-48 overflow-y-auto scrollbar-thin">
                    <div
                        onClick={() => { onChange([]); setOpen(false); }}
                        className={`px-3 py-2.5 text-[13px] cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center gap-2 font-medium ${values.length === 0 ? 'text-blue-600 bg-blue-50/50 dark:bg-blue-900/20' : 'text-gray-600 dark:text-gray-400'}`}
                    >
                        <div className={`w-4 h-4 border rounded-sm flex items-center justify-center flex-shrink-0 ${values.length === 0 ? 'bg-blue-500 border-blue-500' : 'border-gray-400 dark:border-gray-600'}`}>
                            {values.length === 0 && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        Full Year
                    </div>
                    {options.filter((o: any) => o !== "Full Year").map((o: any) => (
                        <div
                            key={o}
                            onClick={() => toggle(o)}
                            className={`px-3 py-2.5 text-[13px] cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center gap-2 font-medium ${values.includes(o) ? 'text-blue-600 bg-blue-50/50 dark:bg-blue-900/20' : 'text-gray-600 dark:text-gray-400'}`}
                        >
                            <div className={`w-4 h-4 border rounded-sm flex items-center justify-center flex-shrink-0 ${values.includes(o) ? 'bg-blue-500 border-blue-500' : 'border-gray-400 dark:border-gray-600'}`}>
                                {values.includes(o) && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>}
                            </div>
                            {o}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function PeriodSelectCard({ title, label, comp, setComp, stats, fyears, quarters, months, n, accentColor }: any) {
    return (
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-gray-200 dark:border-gray-800 flex flex-col relative">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/20">
                <h4 className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">{title}</h4>
                <div className="px-3 py-1 rounded bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                    <span className="text-[11px] font-bold" style={{ color: accentColor }}>{label}</span>
                </div>
            </div>

            <div className="p-4 space-y-4">
                {/* 3 Filters in a single line */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                        <label className="text-[14px] font-bold text-gray-400 uppercase ml-1">Fiscal Year</label>
                        <MiniSelect
                            value={comp.fy.replace('FY_', 'FY ')}
                            options={fyears.map((y: string) => `FY ${y}`)}
                            onChange={(v: string) => setComp({ ...comp, fy: v.replace('FY ', 'FY_') })}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[14px] font-bold text-gray-400 uppercase ml-1">Period</label>
                        <MiniMultiSelect
                            values={comp.q || []}
                            options={["Full Year", ...quarters]}
                            onChange={(v: string[]) => setComp({ ...comp, q: v, m: '' })}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[14px] font-bold text-gray-400 uppercase ml-1">Month</label>
                        <MiniSelect
                            value={comp.m || "Entire Period"}
                            options={["Entire Period", ...(comp.q && comp.q.length === 1 ? months.slice((parseInt(comp.q[0].replace('Q', '')) - 1) * 3, parseInt(comp.q[0].replace('Q', '')) * 3) : months)]}
                            onChange={(v: string) => setComp({ ...comp, m: v === "Entire Period" ? "" : v })}
                        />
                    </div>
                </div>

                {/* Metrics in single-single line (side by side cards) */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-xl bg-gray-50/50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-800 flex flex-col justify-center">
                        <p className="text-[14px] font-bold text-gray-400 uppercase mb-2">Target Plan</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-5xl font-black text-gray-900 dark:text-white leading-none tabular-nums">{n(stats.plan)}</span>
                            <span className="text-[16px] font-bold text-gray-400 uppercase">MW</span>
                        </div>
                    </div>

                    <div className="p-4 rounded-xl bg-gray-50/50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-800 flex flex-col justify-center">
                        <p className="text-[14px] font-bold text-gray-400 uppercase mb-2">Actual</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-5xl font-black text-gray-900 dark:text-white leading-none tabular-nums" style={{ color: accentColor }}>{n(stats.actual)}</span>
                            <span className="text-[16px] font-bold text-gray-400 uppercase">MW</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

const isKhavda = (p: any) => {
    const cat = (p.category || '').toLowerCase();
    const loc = (p.plotLocation || '').toLowerCase();
    const sec = (p.section || '').toLowerCase();
    return cat.includes('khavda') || loc.includes('khavda') || sec.startsWith('a') || sec.startsWith('d');
};

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

function UpcomingSection({ title, allProjects, month, filterFn, fiscalYear }: any) {
    const projects = useMemo(() => {
        const finalRows: any[] = [];
        const projectGroups = new Map();

        // 1. Group by sno (unique project ID across Plan/Actual)
        allProjects.forEach((p: any) => {
            if (!p.sno) return;
            const key = `${p.sno}`;
            if (!projectGroups.has(key)) {
                projectGroups.set(key, { planRow: null, actualRow: null });
            }
            if (p.planActual === 'Plan') projectGroups.get(key).planRow = p;
            else projectGroups.get(key).actualRow = p;
        });

        // 2. For each project group, generate rows
        projectGroups.forEach((group) => {
            const { planRow, actualRow } = group;
            const refP = actualRow || planRow;
            if (!refP || !filterFn(refP)) return;

            const planCap = planRow ? (planRow[month] || 0) : 0;
            // Only use milestones from Actual row (Plan rows are for Budget only)
            const milestones = actualRow?.milestones?.[month] || [];

            // Always enforce milestone-based COD date checks for all months.
            if (milestones.length > 0) {
                milestones.forEach((ms: any, idx: number) => {
                    const completedMW = isPassed(ms.codDate) ? (ms.mw || 0) : 0;

                    finalRows.push({
                        ...refP,
                        actualCap: ms.mw || 0,
                        completedCap: completedMW,
                        chargingDate: ms.chargingDate,
                        trialRunDate: ms.trialRun,
                        codDate: ms.codDate,
                        priority: ms.priority && ms.priority !== '—' ? ms.priority : refP.priority,
                        planCap: idx === 0 ? planCap : 0,
                    });
                });
            } else {
                const actualCap = actualRow ? (actualRow[month] || 0) : 0;
                if (planCap > 0 || actualCap > 0) {
                    let completedMW = 0;
                    if (actualRow) {
                        completedMW = isPassed(actualRow.codDate) ? actualCap : 0;
                    }
                    finalRows.push({
                        ...refP,
                        actualCap: actualCap,
                        completedCap: completedMW,
                        planCap: planCap,
                        chargingDate: refP.chargingDate,
                        trialRunDate: refP.trialRun,
                        codDate: refP.codDate,
                    });
                }
            }
        });

        return finalRows.sort((a, b) => {
            const nameComp = (a.projectName || '').localeCompare(b.projectName || '');
            if (nameComp !== 0) return nameComp;
            return (a.codDate || '').localeCompare(b.codDate || '');
        });
    }, [allProjects, month, filterFn, fiscalYear]);

    const breakdown = useMemo(() => {
        const res = {
            PPA: { db: 0, verified: 0 },
            Merchant: { db: 0, verified: 0 },
            Group: { db: 0, verified: 0 }
        };
        projects.forEach(p => {
            const t = p.projectType;
            if (t === 'PPA' || t === 'Merchant' || t === 'Group') {
                res[t].db += p.actualCap;
                res[t].verified += p.completedCap;
            }
        });
        return res;
    }, [projects]);

    const totalActual = projects.reduce((s: number, p: any) => s + p.actualCap, 0);
    const completedActual = projects.reduce((s: number, p: any) => s + p.completedCap, 0);

    if (projects.length === 0) return null;

    return (
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex justify-between items-center">
                <h4 className="font-black text-gray-800 dark:text-gray-100 uppercase tracking-wide text-sm">{title}</h4>

                <div className="flex items-center gap-6">
                    {/* Breakdown */}
                    <div className="flex items-center gap-4 border-r border-gray-200 dark:border-gray-700 pr-6">
                        {['PPA', 'Merchant', 'Group'].map(key => {
                            const val = (breakdown as any)[key];
                            if (val.db === 0 && val.verified === 0) return null;
                            return (
                                <div key={key} className="flex flex-col items-end">
                                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">{key}</span>
                                    <div className="text-[14px] font-black leading-none">
                                        <span className="text-gray-700 dark:text-gray-200">{val.db.toFixed(0)}</span>
                                        <span className="text-gray-400 mx-0.5">/</span>
                                        <span className="text-green-600 dark:text-green-500">{val.verified.toFixed(0)}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Total Summary */}
                    <div className="text-right">
                        <span className="text-[12px] text-gray-500 uppercase font-bold block mb-0.5">Anticipated / COD Done</span>
                        <div className="font-black text-[18px]">
                            <span className="text-[#0B74B0] dark:text-[#4DA8D8]">{totalActual.toFixed(0)}</span>{" "}
                            <span className="text-gray-400">/</span>{" "}
                            <span className="text-green-600 dark:text-green-500">{completedActual.toFixed(0)}</span>{" "}
                            <span className="text-[11px] text-gray-500">MW</span>
                        </div>
                    </div>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                        <tr className="bg-white dark:bg-[#111827] text-[12px] text-gray-500 uppercase tracking-widest border-b border-gray-100 dark:border-gray-700">
                            <th className="py-2.5 px-4 font-bold">Project Name</th>
                            <th className="py-2.5 px-4 font-bold">SPV</th>
                            <th className="py-2.5 px-4 font-bold">Plot No</th>
                            <th className="py-2.5 px-4 font-bold text-right">Total Cap</th>
                            <th className="py-2.5 px-4 font-bold">Category</th>
                            <th className="py-2.5 px-4 font-bold text-center">Priority</th>
                            <th className="py-2.5 px-4 font-bold text-right text-gray-400 uppercase tracking-widest" title="Database Actual / COD Verified">Commissioning <span className="lowercase normal-case tracking-normal opacity-70 cursor-pointer">(DB / COD)</span></th>
                            <th className="py-2.5 px-4 font-bold text-center">Charging Date</th>
                            <th className="py-2.5 px-4 font-bold text-center">Trial Run</th>
                            <th className="py-2.5 px-4 font-bold text-center">COD Date</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-[#1F2937]">
                        {projects.map((p: any, i: number) => {
                            const priority = p.priority?.toUpperCase();
                            const pColors = PRIORITY_COLORS[priority];

                            return (
                                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                    <td className="py-3 px-4 text-[16px] font-black text-gray-800 dark:text-gray-100">{p.projectName || '—'}</td>
                                    <td className="py-3 px-4 text-[14px] font-medium text-gray-600 dark:text-gray-300">{p.spv || '—'}</td>
                                    <td className="py-3 px-4 text-[14px] font-medium text-gray-600 dark:text-gray-300">{p.plotNo || '—'}</td>
                                    <td className="py-3 px-4 text-[15px] font-black text-right text-gray-800 dark:text-gray-100">
                                        {(p.capacity || 0).toFixed(0)} <span className="text-[12px] text-gray-400">MW</span>
                                    </td>
                                    <td className="py-3 px-4 text-[14px] font-bold text-gray-700 dark:text-gray-200">
                                        {p.projectType || '—'}
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        {pColors ? (
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-black border ${pColors.bg} ${pColors.text} ${pColors.border}`}>
                                                {priority}
                                            </span>
                                        ) : (
                                            <span className="text-[13px] font-bold text-gray-400">—</span>
                                        )}
                                    </td>
                                    <td className="py-3 px-4 text-[13px] font-black text-right">
                                        <span className="text-[#0B74B0] dark:text-[#4DA8D8] text-[18px]">{p.actualCap.toFixed(0)}</span>
                                        <span className="text-gray-400 mx-1">/</span>
                                        <span className="text-green-600 dark:text-green-500 text-[18px]">{p.completedCap.toFixed(0)}</span>
                                    </td>
                                    <td className={`py-3 px-4 text-[14px] font-bold text-center ${isPassed(p.chargingDate) ? 'text-green-600 dark:text-green-500' : 'text-gray-700 dark:text-gray-300'}`}>{p.chargingDate ? formatDate(p.chargingDate) : '—'}</td>
                                    <td className={`py-3 px-4 text-[14px] font-bold text-center ${isPassed(p.trialRunDate) ? 'text-green-600 dark:text-green-500' : 'text-gray-700 dark:text-gray-300'}`}>{p.trialRunDate ? formatDate(p.trialRunDate) : '—'}</td>
                                    <td className={`py-3 px-4 text-[14px] font-bold text-center ${isPassed(p.codDate) ? 'text-green-600 dark:text-green-500' : 'text-gray-700 dark:text-gray-300'}`}>{p.codDate ? formatDate(p.codDate) : '—'}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
