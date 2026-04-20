import { API_BASE } from '../lib/config';

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, AreaChart, Area, LineChart, Line
} from 'recharts';
import { SummaryTable } from './CommissioningSummaryTable';
import { ExportReviewModal } from './ExportReviewModal';
import ReactECharts from 'echarts-for-react';
import * as XLSX from 'xlsx';
import {
    LayoutDashboard,
    Wind,
    Sun,
    TrendingUp,
    AlertCircle,
    CheckCircle2,
    Calendar,
    ChevronRight,
    Search,
    Filter,
    ArrowUpRight,
    ArrowDownRight,
    LogOut,
    Plus,
    FileSpreadsheet,
    Database
} from 'lucide-react';
import EditableProjectTable from './EditableProjectTable';
import AdminPanel from './AdminPanel';
import { useAuth } from '../context/AuthContext';
import { PageLoader } from './PageLoader';
import { getCummTillLabel, parseScopeString, getCurrentFiscalYear } from '../lib/utils';


// Interfaces
interface CommissioningProject {
    id?: number;
    sno: number;
    projectName: string;
    spv: string;
    projectType: string;
    plotLocation: string;
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
    // Milestone fields for date verification
    priority?: string | null;
    codPlan?: string | null;
    milestones?: Record<string, { mw: number; codDate: string | null }[]>;
}

// Premium Color Palette
const COLORS = {
    plan: 'url(#gradientPlan)',
    actual: 'url(#gradientActual)',
    solar: '#FDBA74',     // Light Orange
    wind: '#67E8F9',      // Light Cyan
    ppa: '#C084FC',       // Light Purple
    merchant: '#F472B6',  // Light Pink
    group: '#2DD4BF',     // Light Teal
    ahead: '#10B981',
    behind: '#F43F5E',
};

const GRADIENTS = (
    <defs>
        <linearGradient id="gradientPlan" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#2563EB" stopOpacity={0.8} />
        </linearGradient>
        <linearGradient id="gradientActual" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10B981" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#059669" stopOpacity={0.8} />
        </linearGradient>
        <filter id="shadow" height="130%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
            <feOffset dx="0" dy="2" result="offsetblur" />
            <feComponentTransfer>
                <feFuncA type="linear" slope="0.2" />
            </feComponentTransfer>
            <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
            </feMerge>
        </filter>
    </defs>
);

// Helper to get dynamic month metadata based on fiscal year
const getFiscalMonths = (fy: string) => {
    // fy = "FY_25-26" or "2025-26"
    let startYearShort = 25;
    if (fy.includes('_')) {
        startYearShort = parseInt(fy.split('_')[1].split('-')[0]);
    } else if (fy.includes('-')) {
        startYearShort = parseInt(fy.split('-')[0].slice(-2));
    }
    const startYear = startYearShort + 2000;

    return [
        { key: 'apr', label: 'APR', year: startYear.toString().slice(-2) },
        { key: 'may', label: 'MAY', year: startYear.toString().slice(-2) },
        { key: 'jun', label: 'JUN', year: startYear.toString().slice(-2) },
        { key: 'jul', label: 'JUL', year: startYear.toString().slice(-2) },
        { key: 'aug', label: 'AUG', year: startYear.toString().slice(-2) },
        { key: 'sep', label: 'SEP', year: startYear.toString().slice(-2) },
        { key: 'oct', label: 'OCT', year: startYear.toString().slice(-2) },
        { key: 'nov', label: 'NOV', year: startYear.toString().slice(-2) },
        { key: 'dec', label: 'DEC', year: startYear.toString().slice(-2) },
        { key: 'jan', label: 'JAN', year: (startYear + 1).toString().slice(-2) },
        { key: 'feb', label: 'FEB', year: (startYear + 1).toString().slice(-2) },
        { key: 'mar', label: 'MAR', year: (startYear + 1).toString().slice(-2) },
    ];
};


const monthKeys = ['apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar'];


const SECTION_OPTIONS = [
    { value: 'all', label: 'All Sections' },
    { value: 'Khavda Solar Projects', label: 'Khavda Solar' },
    { value: 'Rajasthan Solar Projects', label: 'Rajasthan Solar' },
    { value: 'Rajasthan Solar Additional 500MW', label: 'Rajasthan Addl' },
    { value: 'Khavda Wind Projects', label: 'Khavda Wind' },
    { value: 'Mundra Wind 76MW', label: 'Mundra Wind' },
];

export default function CommissioningDashboard({ fiscalYear }: { fiscalYear: string }) {
    const isPassed = (dateStr: string | null | undefined) => {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return false;
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return d <= today;
    };

    const n = (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

    const { user, isLoading: isAuthLoading } = useAuth();
    const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
    const navigate = useNavigate();
    const userScope = useMemo(() => parseScopeString(user?.scope || 'all'), [user]);
    const [activeDashboard, setActiveDashboard] = useState<'overview' | 'solar' | 'wind' | 'models' | 'deviation' | 'manage' | 'admin'>('overview');


    const [achieveView, setAchieveView] = useState<'yearly' | 'quarterly' | 'monthly'>('yearly');
    const [achieveCategory, setAchieveCategory] = useState('All Categories');
    const [achieveProject, setAchieveProject] = useState('All Projects');
    const [timelineView, setTimelineView] = useState<'yearly' | 'quarterly' | 'monthly'>('quarterly');
    const [deviationView, setDeviationView] = useState<'yearly' | 'quarterly' | 'monthly'>('quarterly');

    const [mainTimelineStatus, setMainTimelineStatus] = useState('All Projects');
    const [mainTimelineProject, setMainTimelineProject] = useState('All Projects');
    const [mainTimelineSPV, setMainTimelineSPV] = useState('All SPVs');

    const [solarQMode, setSolarQMode] = useState('Absolute');
    const [solarMMode, setSolarMMode] = useState('Monthly');
    const [windQMode, setWindQMode] = useState('Absolute');
    const [windMMode, setWindMMode] = useState('Monthly');
    const [modelMetric, setModelMetric] = useState('Capacity Share');
    const [modelDrill, setModelDrill] = useState('Project Select');

    const [categoryFilter, setCategoryFilter] = useState<'all' | 'solar' | 'wind'>('all');
    const [selectedSections, setSelectedSections] = useState<string[]>(['all']);
    const [isSolarExportOpen, setIsSolarExportOpen] = useState(false);
    const [isWindExportOpen, setIsWindExportOpen] = useState(false);

    const [selectedModels, setSelectedModels] = useState<string[]>(['all']);

    // Local Chart States for specific card dropdowns
    const [techMixStatus, setTechMixStatus] = useState('All Projects');
    const [techMixProject, setTechMixProject] = useState('All Projects');
    const [techMixCategory, setTechMixCategory] = useState('All Categories');
    const [techMixView, setTechMixView] = useState('yearly');
    const [techMixHovered, setTechMixHovered] = useState<any>(null);

    // Business Model Split Chart - separate state
    const [bizModelCategory, setBizModelCategory] = useState('All Categories');
    const [bizModelProject, setBizModelProject] = useState('All Projects');
    const [bizModelView, setBizModelView] = useState('yearly');
    const [bizModelHovered, setBizModelHovered] = useState<any>(null);

    // Status Type Filter (Plan/Actual) - Main toggle
    const [selectedStatusType, setSelectedStatusType] = useState<'Plan' | 'Actual'>('Actual');
    const [timelineBusinessModel, setTimelineBusinessModel] = useState('All Models');
    const [timelineCategory, setTimelineCategory] = useState('All Categories');

    // Solar Dashboard specific
    const [solarCategory, setSolarCategory] = useState('All Categories');
    const [solarBusinessModel, setSolarBusinessModel] = useState('All Models');

    // Wind Dashboard specific
    const [windCategory, setWindCategory] = useState('All Categories');
    const [windBusinessModel, setWindBusinessModel] = useState('All Models');

    // Models Dashboard
    const [modelsCategory, setModelsCategory] = useState('All Categories');
    const [modelsTechnology, setModelsTechnology] = useState('All');
    const [modelsProject, setModelsProject] = useState('All Projects');

    // KPI scope derived from global category filter
    const globalKpiScope = categoryFilter === 'all' ? 'Overall' : categoryFilter === 'solar' ? 'Solar' : 'Wind';

    // Use the prop directly for API calls
    const apiFiscalYear = fiscalYear;
    const currentFY = getCurrentFiscalYear();
    const _now = new Date();
    const _cm = _now.getMonth();

    // Determine how many months have passed for the SELECTED FY
    const _monthsPassed = useMemo(() => {
        if (apiFiscalYear < currentFY) return 12; // Past FY: complete
        if (apiFiscalYear > currentFY) return 0;  // Future FY: not started
        // Current FY: dynamic based on today's month
        return _cm >= 3 ? _cm - 2 : _cm + 10;
    }, [apiFiscalYear, currentFY, _cm]);

    const dateSublabel = useMemo(() => {
        if (apiFiscalYear < currentFY) return `FY ${apiFiscalYear.replace('FY_', '')} Total`;
        if (apiFiscalYear > currentFY) return `FY ${apiFiscalYear.replace('FY_', '')} Range`;
        const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
        const now = new Date();
        const day = now.getDate().toString().padStart(2, '0');
        const month = months[now.getMonth()];
        const year = now.getFullYear();
        return `Upto ${day}-${month}-${year}`;
    }, [apiFiscalYear, currentFY]);



    const dynamicMonths = useMemo(() => getFiscalMonths(apiFiscalYear), [apiFiscalYear]);
    const dynamicMonthLabels = useMemo(() =>
        dynamicMonths.map(m => `${m.label}-${m.year}`),
        [dynamicMonths]);

    const { data: rawProjects = [], isLoading } = useQuery<CommissioningProject[]>({
        queryKey: ['commissioning-projects', apiFiscalYear],
        queryFn: async () => {
            const response = await fetch(`${API_BASE}/api/commissioning-projects?fiscalYear=${apiFiscalYear}`);
            if (!response.ok) throw new Error('Failed to fetch projects');
            return response.json();
        },
        staleTime: 5 * 60 * 1000,
    });

    // Deduplicate projects and APPLY DATE VERIFICATION
    const allProjects = useMemo(() => {
        const seen = new Set();
        const deduped = rawProjects.filter(p => {
            const key = `${p.sno}-${p.projectName}-${p.spv}-${p.category}-${p.section}-${p.planActual}-${p.capacity}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        // Apply COD verification to 'Actual' rows
        return deduped.map(p => {
            if (p.planActual !== 'Actual') return p;

            const pCopy = { ...p };
            const mKeys = ['apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar'];

            // Use this project's own milestones (already correctly attached by project_id from API)
            const projectMilestones = p.milestones || {};

            mKeys.forEach(m => {
                const monthMilestones = projectMilestones[m] || [];
                if (monthMilestones.length > 0) {
                    const completedMW = monthMilestones.reduce((sum, ms) => {
                        return sum + (isPassed(ms.codDate) ? (ms.mw || 0) : 0);
                    }, 0);
                    (pCopy as any)[m] = completedMW;
                } else {
                    (pCopy as any)[m] = isPassed(p.codPlan) ? (p[m] || 0) : 0;
                }
            });

            // Calculate cumulative achievement (passed months only)
            const cumulativeSum = mKeys.reduce((s, k) => s + ((pCopy as any)[k] || 0), 0);
            pCopy.cummTillOct = cumulativeSum;

            // Maintain totalCapacity as the sum of all months (before zeroing out)
            // or simply the original capacity if preferred. 
            // In these datasets, p.totalCapacity is usually the full year sum.
            pCopy.totalCapacity = p.totalCapacity;

            pCopy.q1 = (pCopy.apr || 0) + (pCopy.may || 0) + (pCopy.jun || 0);
            pCopy.q2 = (pCopy.jul || 0) + (pCopy.aug || 0) + (pCopy.sep || 0);
            pCopy.q3 = (pCopy.oct || 0) + (pCopy.nov || 0) + (pCopy.dec || 0);
            pCopy.q4 = (pCopy.jan || 0) + (pCopy.feb || 0) + (pCopy.mar || 0);

            return pCopy;
        });
    }, [rawProjects, apiFiscalYear]);

    const filteredProjects = useMemo(() => {
        return allProjects.filter(p => {
            if (!p.includedInTotal) return false;
            const cat = (p.category || '').toLowerCase();
            const sec = (p.section || '').toLowerCase();
            const name = (p.projectName || '').toLowerCase();

            if (categoryFilter === 'solar') {
                const isSolar = (cat.includes('solar') || name.includes('solar')) && !cat.includes('wind') && !name.includes('wind');
                if (!isSolar) return false;
            }
            if (categoryFilter === 'wind') {
                const isWind = (cat.includes('wind') || name.includes('wind')) && !cat.includes('solar') && !name.includes('solar');
                if (!isWind) return false;
            }

            if (activeDashboard === 'overview' && selectedSections.length > 0 && !selectedSections.includes('all')) {
                if (!selectedSections.includes(p.projectName)) return false;
            }
            return true;
        });
    }, [allProjects, categoryFilter, selectedSections, activeDashboard]);

    const solarExportRecords = useMemo(() => {
        return allProjects.filter(p => p.category?.toLowerCase().includes('solar') && p.planActual === 'Plan').map(p => {
            const actual = allProjects.find(ap => ap.projectName === p.projectName && ap.planActual === 'Actual');
            return {
                'Project Name': p.projectName,
                'Fiscal Year': fiscalYear.replace('FY_', ''),
                'Category': 'Solar',
                'Planned Capacity (MW)': p.capacity,
                'Actual Achieved (MW)': actual?.totalCapacity || 0,
                'Achievement %': p.capacity > 0 ? ((actual?.totalCapacity || 0) / p.capacity * 100).toFixed(1) + '%' : '0%',
                'Status': (actual?.totalCapacity || 0) >= p.capacity ? 'Completed' : 'On-Going',
                'Verified': 'TRUE'
            };
        });
    }, [allProjects, fiscalYear]);

    const windExportRecords = useMemo(() => {
        return allProjects.filter(p => p.category?.toLowerCase().includes('wind') && p.planActual === 'Plan').map(p => {
            const actual = allProjects.find(ap => ap.projectName === p.projectName && ap.planActual === 'Actual');
            return {
                'Project Name': p.projectName,
                'Fiscal Year': fiscalYear.replace('FY_', ''),
                'Category': 'Wind',
                'Planned Capacity (MW)': p.capacity,
                'Actual Achieved (MW)': actual?.totalCapacity || 0,
                'Achievement %': p.capacity > 0 ? ((actual?.totalCapacity || 0) / p.capacity * 100).toFixed(1) + '%' : '0%',
                'Status': (actual?.totalCapacity || 0) >= p.capacity ? 'Completed' : 'On-Going',
                'Verified': 'TRUE'
            };
        });
    }, [allProjects, fiscalYear]);

    const handleDownloadSolar = () => {
        const ws = (XLSX.utils as any).json_to_sheet(solarExportRecords);
        const wb = (XLSX.utils as any).book_new();
        (XLSX.utils as any).book_append_sheet(wb, ws, "Solar_Portfolio");
        XLSX.writeFile(wb, `Solar_Portfolio_Statement_${fiscalYear}.xlsx`);
        setIsSolarExportOpen(false);
    };

    const handleDownloadWind = () => {
        const ws = (XLSX.utils as any).json_to_sheet(windExportRecords);
        const wb = (XLSX.utils as any).book_new();
        (XLSX.utils as any).book_append_sheet(wb, ws, "Wind_Portfolio");
        XLSX.writeFile(wb, `Wind_Portfolio_Statement_${fiscalYear}.xlsx`);
        setIsWindExportOpen(false);
    };

    const getKPIData = useCallback((scope: string) => {
        let projs = allProjects.filter(p => p.includedInTotal);

        const isSolar = (p: CommissioningProject) => {
            const cat = (p.category || '').toLowerCase();
            const name = (p.projectName || '').toLowerCase();
            return (cat.includes('solar') || name.includes('solar')) && !cat.includes('wind') && !name.includes('wind');
        };

        const isWind = (p: CommissioningProject) => {
            const cat = (p.category || '').toLowerCase();
            const name = (p.projectName || '').toLowerCase();
            return (cat.includes('wind') || name.includes('wind')) && !cat.includes('solar') && !name.includes('solar');
        };

        if (scope === 'Solar') projs = projs.filter(isSolar);
        if (scope === 'Wind') projs = projs.filter(isWind);
        if (scope !== 'Overall' && scope !== 'Solar' && scope !== 'Wind') projs = projs.filter(p => p.projectName === scope);

        // Calculate Summations dynamically based on calendar date
        const monthKeysFull = ['apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar'] as const;
        const cummKeys = monthKeysFull.slice(0, _monthsPassed);

        const getCumm = (list: CommissioningProject[]) =>
            list.reduce((sum, p) => sum + cummKeys.reduce((kSum, key) => kSum + ((p as any)[key] || 0), 0), 0);

        const planProjs = projs.filter(p => p.planActual === 'Plan');
        const actualProjs = projs.filter(p => p.planActual === 'Actual');

        const planFull = planProjs.reduce((s, p) => s + (p.totalCapacity || 0), 0);
        const actualFull = actualProjs.reduce((s, p) => s + (p.totalCapacity || 0), 0);

        const planCumm = getCumm(planProjs);
        const actualCumm = getCumm(actualProjs);

        // Count unique projects
        const uniqueProjects = new Set(projs.map(p => `${p.projectName}|${p.spv}`)).size;

        // Updated to use fixed values as per requirements
        const totalPlanValue = planFull;
        const totalActualValue = actualFull;
        const cummActualValue = actualCumm;

        // Overall Achievement based on cumulative actual vs total plan
        const achievement = planFull > 0 ? (actualCumm / planFull) * 100 : 0;

        return {
            totalPlanValue,
            totalActualValue,
            cummActualValue,
            projectsCount: uniqueProjects,
            achievement,
            planFull, actualFull,
            planCumm, actualCumm
        };
    }, [allProjects]);

    const formatNumber = (val: any) => {
        if (val === null || val === undefined) return '-';
        return Number(val).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    };

    const overallKpi = useMemo(() => getKPIData('Overall'), [getKPIData]);
    const kpi1 = useMemo(() => getKPIData(globalKpiScope), [getKPIData, globalKpiScope]);
    const kpi2 = useMemo(() => getKPIData(globalKpiScope), [getKPIData, globalKpiScope]);
    const kpi3 = useMemo(() => getKPIData(globalKpiScope), [getKPIData, globalKpiScope]);
    const kpi4 = useMemo(() => getKPIData(globalKpiScope), [getKPIData, globalKpiScope]);

    // Category Options - pulled from actual project data
    const categoryOptions = useMemo(() => {
        const categories = allProjects
            .filter(p => p.includedInTotal)
            .map(p => p.category)
            .filter(Boolean);
        const uniqueCategories = Array.from(new Set(categories)).sort();
        return ['All Categories', ...uniqueCategories];
    }, [allProjects]);

    // Business Model Options
    const businessModelOptions = ['All Models', 'PPA', 'Merchant', 'Group'];

    const projectOptions = useMemo(() => {
        const included = allProjects.filter(p => p.includedInTotal);
        const names = Array.from(new Set(included.map(p => p.projectName))).sort();
        return ['All Projects', ...names];
    }, [allProjects]);

    const spvOptions = useMemo(() => {
        const included = allProjects.filter(p => p.includedInTotal);
        const names = Array.from(new Set(included.map(p => p.spv))).filter(Boolean).sort();
        return ['All SPVs', ...names];
    }, [allProjects]);

    // Helper to filter by category
    const filterByCategory = (projects: CommissioningProject[], cat: string) => {
        if (cat === 'All Categories') return projects;
        return projects.filter(p => p.category === cat);
    };

    // Helper to filter by business model
    const filterByBusinessModel = (projects: CommissioningProject[], model: string) => {
        if (model === 'All Models') return projects;
        return projects.filter(p => p.projectType === model);
    };

    const filteredTimelineProjects = useMemo(() => {
        let projs = allProjects.filter(p => p.includedInTotal);
        if (mainTimelineProject !== 'All Projects') projs = projs.filter(p => p.projectName === mainTimelineProject);
        if (mainTimelineSPV !== 'All SPVs') projs = projs.filter(p => p.spv === mainTimelineSPV);
        projs = filterByCategory(projs, timelineCategory);

        // Apply business model filter
        projs = filterByBusinessModel(projs, timelineBusinessModel);

        return projs;
    }, [allProjects, mainTimelineProject, mainTimelineSPV, timelineCategory, timelineBusinessModel]);


    const yearlyData = useMemo(() => {
        // For current FY, use date-based budget; for other FYs use full year
        const planMonths = apiFiscalYear < currentFY || apiFiscalYear > currentFY 
            ? monthKeys 
            : monthKeys.slice(0, _monthsPassed);
        
        return [{
            name: apiFiscalYear.replace('FY_', 'FY '),
            'Target Plan': filteredTimelineProjects.filter(p => p.planActual === 'Plan').reduce((s, p) => 
                s + planMonths.reduce((sum, key) => sum + ((p as any)[key] || 0), 0), 0
            ),
            'Actual Commissioning': filteredTimelineProjects.filter(p => p.planActual === 'Actual').reduce((s, p) => s + (p.totalCapacity || 0), 0),
        }];
    }, [filteredTimelineProjects, apiFiscalYear, currentFY, _monthsPassed]);

    const quarterlyData = useMemo(() => {
        // For current FY, apply date-based logic to quarters
        const completedMonthIdx = _monthsPassed - 1;
        
        return ['Q1', 'Q2', 'Q3', 'Q4'].map((q, idx) => {
            const key = `q${idx + 1}` as 'q1' | 'q2' | 'q3' | 'q4';
            const qMonths = [idx * 3, idx * 3 + 1, idx * 3 + 2];
            
            // Calculate Plan based on completed months only for current FY
            let planValue = 0;
            if (apiFiscalYear === currentFY) {
                // Date-based: sum only completed months in this quarter
                planValue = filteredTimelineProjects.filter(p => p.planActual === 'Plan').reduce((s, p) => 
                    s + qMonths.reduce((sum, mIdx) => {
                        if (mIdx <= completedMonthIdx) {
                            return sum + ((p as any)[monthKeys[mIdx]] || 0);
                        }
                        return sum;
                    }, 0), 0
                );
            } else {
                // Full quarter budget for past/future FYs
                planValue = filteredTimelineProjects.filter(p => p.planActual === 'Plan').reduce((s, p) => s + ((p as any)[key] || 0), 0);
            }
            
            return {
                name: q,
                'Target Plan': planValue,
                'Actual Commissioning': filteredTimelineProjects.filter(p => p.planActual === 'Actual').reduce((s, p) => s + ((p as any)[key] || 0), 0),
            };
        });
    }, [filteredTimelineProjects, apiFiscalYear, currentFY, _monthsPassed]);

    const monthlyData = useMemo(() => {
        return monthKeys.map((key, idx) => {
            // For current FY, show budget only for completed months
            const isFutureMonth = apiFiscalYear === currentFY && idx >= _monthsPassed;
            const planVal = filteredTimelineProjects.filter(p => p.planActual === 'Plan').reduce((s, p) => 
                s + (isFutureMonth ? 0 : ((p as any)[key] || 0)), 0
            );
            const actualVal = filteredTimelineProjects.filter(p => p.planActual === 'Actual').reduce((s, p) => s + ((p as any)[key] || 0), 0);
            return {
                name: dynamicMonthLabels[idx],
                'Target Plan': planVal,
                'Actual Commissioning': actualVal,
                Deviation: actualVal - planVal,
            };
        });
    }, [filteredTimelineProjects, dynamicMonthLabels, apiFiscalYear, currentFY, _monthsPassed]);

    const gaugeData = useMemo(() => {
        let projs = allProjects.filter(p => p.includedInTotal);
        if (achieveCategory !== 'All Categories') projs = projs.filter(p => p.category === achieveCategory);
        if (achieveProject !== 'All Projects') projs = projs.filter(p => p.projectName === achieveProject);

        let plan = 0;
        let actual = 0;
        let periodName = 'Yearly';

        // Current Period configuration based on "As on 31-Oct-25"
        const now = new Date();
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthShort = lastMonthDate.toLocaleString('en-US', { month: 'short' }).toLowerCase();
        const lastMonthIdx = monthKeys.indexOf(lastMonthShort);

        // All views use Full FY Plan as target to ensure achievement never exceeds 100%
        const fullFYPlan = projs.filter(p => p.planActual === 'Plan').reduce((s, p) => s + (p.totalCapacity || 0), 0);

        if (achieveView === 'yearly') {
            // Overall Status: Actual YTD vs Full FY Target
            plan = fullFYPlan;
            const cummKeysAch = monthKeys.slice(0, _monthsPassed);
            actual = projs.filter(p => p.planActual === 'Actual').reduce((s, p) =>
                s + cummKeysAch.reduce((kSum, key) => kSum + ((p as any)[key] || 0), 0), 0
            );
            periodName = 'FULL FY TARGET';
        } else if (achieveView === 'quarterly') {
            // Q3: Actual Q3 progress vs Full FY Target
            plan = fullFYPlan;
            actual = projs.filter(p => p.planActual === 'Actual').reduce((s, p) => s + (p.q3 || 0), 0);
            periodName = 'Q3 vs FY TARGET';
        } else if (achieveView === 'monthly') {
            // October: Actual October vs Full FY Target
            plan = fullFYPlan;
            actual = projs.filter(p => p.planActual === 'Actual').reduce((s, p) => s + (p.oct || 0), 0);
            periodName = 'OCT vs FY TARGET';
        }

        return {
            plan,
            actual,
            periodName,
            achievement: plan > 0 ? (actual / plan) * 100 : 0,
            chart: [
                { name: 'Completed', value: actual, color: '#10B981' },
                { name: 'Remaining', value: Math.max(0, plan - actual), color: '#3B82F620' },
            ]
        };
    }, [allProjects, achieveView, achieveCategory, achieveProject, fiscalYear]);

    const techSplitData = useMemo(() => {
        // Fixed to Actual as per requirements
        let projects = allProjects.filter(p => p.planActual === 'Actual' && p.includedInTotal);
        projects = filterByCategory(projects, techMixCategory);
        if (techMixProject !== 'All Projects') {
            projects = projects.filter(p => p.projectName === techMixProject);
        } else if (techMixStatus !== 'All Projects') {
            const isCompleted = techMixStatus === 'Completed';
            projects = projects.filter(p => {
                const actual = allProjects.find(ap => ap.projectName === p.projectName && ap.planActual === 'Actual');
                return isCompleted ? (actual?.totalCapacity || 0) >= p.capacity : (actual?.totalCapacity || 0) < p.capacity;
            });
        }

        // Use appropriate value based on status type - fixed to Actual
        const getValueByPeriod = (p: CommissioningProject) => {
            if (techMixView === 'yearly') {
                // For Actual, show cumulative till date
                return (p.cummTillOct || 0);
            }

            if (techMixView === 'quarterly') return p.q3 || 0;
            if (techMixView === 'monthly') return p.oct || 0;
            return (p.cummTillOct || 0);
        };

        const solar = projects.filter(p => p.category?.toLowerCase().includes('solar')).reduce((s, p) => s + getValueByPeriod(p), 0);
        const wind = projects.filter(p => p.category?.toLowerCase().includes('wind')).reduce((s, p) => s + getValueByPeriod(p), 0);

        return {
            data: [
                { name: 'Solar', value: solar, color: '#0B74B0' },
                { name: 'Wind', value: wind, color: '#06B6D4' },
            ].filter(d => d.value > 0),
            total: solar + wind
        };
    }, [allProjects, techMixProject, techMixStatus, techMixCategory, techMixView]);


    const modelSplitData = useMemo(() => {
        // Use 'Plan' as the baseline to avoid double-counting the same capacity
        let projects = allProjects.filter(p => p.planActual === 'Plan' && p.includedInTotal);

        // Apply filters
        if (activeDashboard === 'models') {
            if (modelsTechnology !== 'All') {
                projects = projects.filter(p => p.category?.toLowerCase().includes(modelsTechnology.toLowerCase()));
            }
            projects = filterByCategory(projects, modelsCategory);
            if (modelsProject !== 'All Projects') {
                projects = projects.filter(p => p.projectName === modelsProject);
            }
        } else {
            projects = filterByCategory(projects, bizModelCategory);
            if (bizModelProject !== 'All Projects') {
                projects = projects.filter(p => p.projectName === bizModelProject);
            }
        }

        const models = ['PPA', 'Merchant', 'Group'];
        const colors: Record<string, string> = {
            'PPA': COLORS.ppa,
            'Merchant': COLORS.merchant,
            'Group': COLORS.group
        };

        const metric = activeDashboard === 'models' ? modelMetric : 'Capacity Share';

        return models.map(m => {
            const val = projects.filter(p => p.projectType === m).reduce((s, p) =>
                s + (metric === 'Project Count' ? 1 : (p.totalCapacity || 0)), 0
            );
            return { name: m, value: val, color: colors[m] || '#CBD5E1' };
        }).filter(d => d.value > 0);
    }, [allProjects, bizModelCategory, bizModelProject, modelsTechnology, modelsCategory, modelsProject, activeDashboard, modelMetric]);

    const cumulativeData = useMemo(() => {
        let cumPlan = 0;
        let cumActual = 0;
        return monthlyData.map(m => {
            cumPlan += m['Target Plan'];
            cumActual += m['Actual Commissioning'];
            return {
                name: m.name,
                'Target Plan': cumPlan,
                'Actual Commissioning': cumActual,
            };
        });
    }, [monthlyData]);

    const solarData = useMemo(() => {
        let solarProjects = allProjects.filter(p => p.includedInTotal && p.category && p.category.toLowerCase().includes('solar'));
        solarProjects = filterByCategory(solarProjects, solarCategory);
        if (solarBusinessModel !== 'All Models') {
            solarProjects = solarProjects.filter(p => p.projectType === solarBusinessModel);
        }
        if (!selectedSections.includes('all')) {
            solarProjects = solarProjects.filter(p => selectedSections.includes(p.category));
        }

        const planProjects = solarProjects.filter(p => p.planActual === 'Plan');
        const actualProjects = solarProjects.filter(p => p.planActual === 'Actual');
        // Use totalCapacity (sum of months) for correct totals
        const totalPlan = planProjects.reduce((s, p) => s + (p.totalCapacity || 0), 0);
        const totalActual = actualProjects.reduce((s, p) => s + (p.cummTillOct || 0), 0);

        const quarterlyAbs = ['Q1', 'Q2', 'Q3', 'Q4'].map((q, idx) => {
            const key = `q${idx + 1}` as 'q1' | 'q2' | 'q3' | 'q4';
            return {
                name: q,
                'Target Plan': planProjects.reduce((s, p) => s + ((p as any)[key] || 0), 0),
                'Actual Commissioning': actualProjects.reduce((s, p) => s + ((p as any)[key] || 0), 0),
            };
        });

        const monthlyAbs = monthKeys.map((key, idx) => ({
            name: dynamicMonthLabels[idx],
            'Target Plan': planProjects.reduce((s, p) => s + ((p as any)[key] || 0), 0),
            'Actual Commissioning': actualProjects.reduce((s, p) => s + ((p as any)[key] || 0), 0),
        }));

        // Cumulative transforms
        let cPQ = 0, cAQ = 0;
        const quarterlyCum = quarterlyAbs.map(d => ({
            name: d.name,
            'Target Plan': (cPQ += d['Target Plan']),
            'Actual Commissioning': (cAQ += d['Actual Commissioning'])
        }));

        let cPM = 0, cAM = 0;
        const monthlyCum = monthlyAbs.map(d => ({
            name: d.name,
            'Target Plan': (cPM += d['Target Plan']),
            'Actual Commissioning': (cAM += d['Actual Commissioning'])
        }));

        return {
            totalPlan, totalActual,
            quarterly: solarQMode === 'Absolute' ? quarterlyAbs : quarterlyCum,
            monthly: solarMMode === 'Monthly' ? monthlyAbs : monthlyCum,
            projectCount: new Set(planProjects.map(p => p.projectName)).size
        };
    }, [allProjects, solarCategory, solarBusinessModel, selectedSections, solarQMode, solarMMode, dynamicMonthLabels]);

    const windData = useMemo(() => {
        let windProjects = allProjects.filter(p => p.includedInTotal && p.category && p.category.toLowerCase().includes('wind'));
        windProjects = filterByCategory(windProjects, windCategory);
        if (windBusinessModel !== 'All Models') {
            windProjects = windProjects.filter(p => p.projectType === windBusinessModel);
        }
        if (!selectedSections.includes('all')) {
            windProjects = windProjects.filter(p => selectedSections.includes(p.section));
        }

        const planProjects = windProjects.filter(p => p.planActual === 'Plan');
        const actualProjects = windProjects.filter(p => p.planActual === 'Actual');
        const totalPlan = planProjects.reduce((s, p) => s + (p.totalCapacity || 0), 0);
        const totalActual = actualProjects.reduce((s, p) => s + (p.cummTillOct || 0), 0);

        const quarterlyAbs = ['Q1', 'Q2', 'Q3', 'Q4'].map((q, idx) => {
            const key = `q${idx + 1}` as 'q1' | 'q2' | 'q3' | 'q4';
            return {
                name: q,
                'Target Plan': planProjects.reduce((s, p) => s + ((p as any)[key] || 0), 0),
                'Actual Commissioning': actualProjects.reduce((s, p) => s + ((p as any)[key] || 0), 0),
            };
        });

        const monthlyAbs = monthKeys.map((key, idx) => ({
            name: dynamicMonthLabels[idx],
            'Target Plan': planProjects.reduce((s, p) => s + ((p as any)[key] || 0), 0),
            'Actual Commissioning': actualProjects.reduce((s, p) => s + ((p as any)[key] || 0), 0),
        }));

        // Cumulative transforms
        let cPQ = 0, cAQ = 0;
        const quarterlyCum = quarterlyAbs.map(d => ({
            name: d.name,
            'Target Plan': (cPQ += d['Target Plan']),
            'Actual Commissioning': (cAQ += d['Actual Commissioning'])
        }));

        let cPM = 0, cAM = 0;
        const monthlyCum = monthlyAbs.map(d => ({
            name: d.name,
            'Target Plan': (cPM += d['Target Plan']),
            'Actual Commissioning': (cAM += d['Actual Commissioning'])
        }));

        return {
            totalPlan, totalActual,
            quarterly: windQMode === 'Absolute' ? quarterlyAbs : quarterlyCum,
            monthly: windMMode === 'Monthly' ? monthlyAbs : monthlyCum,
            projectCount: new Set(planProjects.map(p => p.projectName)).size
        };
    }, [allProjects, windCategory, windBusinessModel, selectedSections, windQMode, windMMode, dynamicMonthLabels]);

    const deviationChartData = useMemo(() => {
        let projects = allProjects;

        // Apply Global Category Slicer (Solar/Wind)
        if (categoryFilter !== 'all') {
            projects = projects.filter(p => p.category?.toLowerCase().includes(categoryFilter));
        }

        // Apply Timeline specific filters
        projects = filterByCategory(projects, timelineCategory);
        projects = filterByBusinessModel(projects, timelineBusinessModel);

        const planProjects = projects.filter(p => p.planActual === 'Plan' && p.includedInTotal);
        const actualProjects = projects.filter(p => p.planActual === 'Actual' && p.includedInTotal);

        const getSourceData = () => {
            if (deviationView === 'monthly') {
                return monthKeys.map((key, idx) => ({
                    name: dynamicMonthLabels[idx],
                    'Target Plan': planProjects.reduce((s, p) => s + ((p as any)[key] || 0), 0),
                    'Actual Commissioning': actualProjects.reduce((s, p) => s + ((p as any)[key] || 0), 0),
                }));
            }
            if (deviationView === 'yearly') {
                return [{
                    name: apiFiscalYear.replace('FY_', 'FY '),
                    'Target Plan': planProjects.reduce((s, p) => s + (p.totalCapacity || 0), 0),
                    'Actual Commissioning': actualProjects.reduce((s, p) => s + (p.totalCapacity || 0), 0),
                }];
            }
            return ['Q1', 'Q2', 'Q3', 'Q4'].map((q, idx) => {
                const key = `q${idx + 1}` as 'q1' | 'q2' | 'q3' | 'q4';
                return {
                    name: q,
                    'Target Plan': planProjects.reduce((s, p) => s + ((p as any)[key] || 0), 0),
                    'Actual Commissioning': actualProjects.reduce((s, p) => s + ((p as any)[key] || 0), 0),
                };
            });
        }

        return getSourceData().map(q => ({
            name: q.name,
            Deviation: (q as any)['Actual Commissioning'] - (q as any)['Target Plan'],
        }));
    }, [allProjects, categoryFilter, timelineCategory, timelineBusinessModel, deviationView]);

    const criticalProjects = useMemo(() => {
        const planProjects = allProjects.filter(p => p.planActual === 'Plan' && p.includedInTotal);
        return planProjects.map(pp => {
            const actual = allProjects.find(ap => ap.projectName === pp.projectName && ap.planActual === 'Actual');
            const diff = (actual?.totalCapacity || 0) - (pp.capacity || 0);
            return {
                name: pp.projectName,
                plan: pp.capacity,
                actual: actual?.totalCapacity || 0,
                diff,
                status: diff >= 0 ? 'Ahead' : 'Behind',
                category: pp.category
            };
        }).sort((a, b) => a.diff - b.diff).slice(0, 5);
    }, [allProjects]);

    // NOTE: Viewer mode - no login required to view the dashboard
    // Users can optionally log in via the header button for elevated access

    if (isAuthLoading) return <PageLoader message="Authenticating..." />;
    // Allow public access - don't block if no user logged in

    if (isLoading) return <PageLoader message="Initializing Dashboard..." />;

    return (
        <div className="min-h-screen max-w-full overflow-x-hidden p-3 rounded-md space-y-4 sm:space-y-6 font-sans">
            {/* Corporate Header - Adani THeMED */}
            <div className="z-[90] bg-white dark:bg-[#1F2937] border-b border-[#D1D5DB] dark:border-gray-700 sticky top-0 px-4 py-3 shadow-md mb-6 rounded-xl">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    {/* Left: Logo, Title, FY selector - all inline */}
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-[#0B74B0] rounded-lg flex-shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                            <h1 className="text-base sm:text-lg font-semibold text-[#1F2937] dark:text-white whitespace-nowrap">
                                Commissioning Tracker
                            </h1>

                        </div>
                    </div>

                    {/* Right: Global Filters Group */}
                    <div className="flex items-center gap-3">
                        {/* Category Filter - Horizontal Toggle removed as per user request */}

                    </div>
                </div>

                {/* Navigation Tabs - Clean aligned style */}
                <div className="mt-3 pt-3 border-t border-[#D1D5DB] dark:border-gray-700">
                    <nav className="flex items-center gap-1 bg-[#F5F7FA] dark:bg-gray-800 p-1 rounded-lg border border-[#D1D5DB] dark:border-gray-700 w-fit overflow-x-auto max-w-full">
                        {[
                            { id: 'overview', label: 'Overview' },
                            { id: 'solar', label: 'Solar' },
                            { id: 'wind', label: 'Wind' },
                            { id: 'admin', label: 'Admin Panel', adminOnly: true },
                        ].filter(tab => {
                            // 1. Restriction by Scope (Solar/Wind)
                            if (tab.id === 'solar' && userScope.category === 'wind') return false;
                            if (tab.id === 'wind' && userScope.category === 'solar') return false;

                            // 2. Restriction by Role
                            if (tab.adminOnly && !isAdmin) return false;

                            // Hiding Admin Panel as requested
                            if (tab.id === 'admin') return false;

                            return true;
                        }).map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => {
                                    setActiveDashboard(tab.id as any);
                                    // Also update categoryFilter to match the tab
                                    if (tab.id === 'solar') setCategoryFilter('solar');
                                    else if (tab.id === 'wind') setCategoryFilter('wind');
                                    else if (tab.id === 'overview') setCategoryFilter('all');
                                }}
                                className={`h-8 px-3 sm:px-4 rounded-md text-xs font-medium transition-all flex items-center whitespace-nowrap ${activeDashboard === tab.id
                                    ? 'bg-[#0B74B0] text-white shadow-sm'
                                    : 'text-[#4B5563] dark:text-gray-400 hover:bg-white dark:hover:bg-gray-700 hover:text-[#1F2937]'}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>
            </div>

            {/* Regular Dashboard Content */}
            {(
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-4">
                        <KPICard
                            label="STARTING PLAN (TOTAL)"
                            value={kpi1.totalPlanValue}
                            unit="MW"
                            trend={`FY ${apiFiscalYear.replace('FY_', '')} Target`}
                            gradient="from-[#0B74B0] to-indigo-700"
                        />
                        <KPICard
                            label="CUMULATIVE ACTUAL"
                            value={kpi1.cummActualValue}
                            unit="MW"
                            trend={
                                apiFiscalYear < currentFY ? `FY ${apiFiscalYear.replace('FY_', '')} Total` :
                                    apiFiscalYear > currentFY ? `FY ${apiFiscalYear.replace('FY_', '')} Range` :
                                        `Status as of ${getCummTillLabel(apiFiscalYear).replace('CUMM TILL ', '')}`
                            }
                            gradient="from-[#75479C] to-[#603582]"
                        />
                        <KPICard
                            label="OVERALL ACHIEVEMENT"
                            value={kpi1.achievement.toFixed(1)}
                            unit="%"
                            trend="YTD / Total Capacity"
                            gradient="from-[#10B981] to-[#059669]"
                        />
                    </div>

                    {/* Section Divider */}
                    <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-gray-300 dark:bg-gray-700" />
                        <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Portfolio Analytics
                        </h2>
                        <div className="flex-1 h-px bg-gray-300 dark:bg-gray-700" />
                    </div>


                    <div className="space-y-4 w-full">
                        {activeDashboard === 'overview' && (
                            <div className="space-y-4 w-full">
                                {/* Row 1: Three Pie Charts */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                    {/* Pie Chart 1: Achievement Gauge */}
                                    <ChartContainer
                                        title={`${achieveCategory === 'All Categories' ? 'Overall' : achieveCategory} Achievement`}
                                        controls={
                                            <div className="flex flex-col gap-2 items-center w-full mt-2 sm:mt-0 sm:w-auto relative z-[60]">
                                                <div className="flex flex-wrap justify-end gap-1 w-full">
                                                    <CardSelect label="" options={categoryOptions} value={achieveCategory} onChange={setAchieveCategory} />
                                                    <CardSelect label="" options={projectOptions} value={achieveProject} onChange={setAchieveProject} />
                                                </div>
                                                <div className="scale-90 origin-right">
                                                    <ViewPivot active={achieveView} onChange={setAchieveView} label="" />
                                                </div>
                                            </div>
                                        }
                                    >
                                        <div className="mb-2 text-center">
                                            <span className="text-[10px] font-bold text-[#0B74B0] dark:text-blue-400 uppercase tracking-widest bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full border border-blue-100 dark:border-blue-800 shadow-sm inline-block">
                                                {gaugeData.periodName} Target: {gaugeData.plan.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} MW
                                            </span>
                                        </div>
                                        <div className="h-[180px] relative">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie data={gaugeData.chart} innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value" stroke="none">
                                                        {gaugeData.chart.map((e, i) => <Cell key={i} fill={e.color} style={{ filter: 'url(#shadow)' }} />)}
                                                    </Pie>
                                                </PieChart>
                                            </ResponsiveContainer>
                                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-4 text-center">
                                                <div className="flex flex-col items-center leading-tight">
                                                    <span className="text-3xl font-black text-[#1F2937] dark:text-white">
                                                        {gaugeData.achievement.toFixed(1)}
                                                        <span className="text-sm ml-0.5 font-bold text-gray-400">%</span>
                                                    </span>
                                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mt-0.5">Achievement</span>
                                                </div>
                                                <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-800 w-24 flex flex-col items-center">
                                                    <span className="text-[12px] font-bold text-[#10B981]">{gaugeData.actual.toLocaleString(undefined, { maximumFractionDigits: 1 })} MW</span>
                                                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Achieved</span>
                                                </div>
                                            </div>
                                        </div>
                                    </ChartContainer>

                                    {/* Pie Chart 2: Technology Mix (Solar vs Wind) */}
                                    <ChartContainer
                                        title="Technology Mix"
                                        controls={
                                            <div className="flex flex-col gap-2 items-center w-full mt-2 sm:mt-0 sm:w-auto relative z-[60]">
                                                <div className="flex flex-wrap justify-end gap-1 w-full">
                                                    <CardSelect label="" options={categoryOptions} value={techMixCategory} onChange={setTechMixCategory} />
                                                    <CardSelect label="" options={projectOptions} value={techMixProject} onChange={setTechMixProject} />
                                                </div>
                                                <div className="scale-90 origin-right">
                                                    <ViewPivot active={techMixView} onChange={setTechMixView} label="" />
                                                </div>
                                            </div>
                                        }
                                    >
                                        <div className="h-[180px] relative">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={techSplitData.data}
                                                        innerRadius={55}
                                                        outerRadius={75}
                                                        dataKey="value"
                                                        stroke="none"
                                                        animationBegin={0}
                                                        animationDuration={800}
                                                        onMouseEnter={(_, index) => setTechMixHovered(techSplitData.data[index])}
                                                        onMouseLeave={() => setTechMixHovered(null)}
                                                    >
                                                        {techSplitData.data.map((e, i) => (
                                                            <Cell
                                                                key={i}
                                                                fill={e.color}
                                                                style={{
                                                                    filter: techMixHovered && techMixHovered.name !== e.name ? 'opacity(0.3)' : 'url(#shadow)',
                                                                    transition: 'all 0.3s'
                                                                }}
                                                            />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip content={() => null} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                                <span className="text-xl font-bold text-gray-800 dark:text-white leading-none">
                                                    {(techMixHovered ? techMixHovered.value : techSplitData.total).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                                </span>
                                                <span className="text-[8px] font-semibold text-gray-400 uppercase mt-0.5">
                                                    {techMixHovered ? techMixHovered.name : "Total MW"}
                                                </span>
                                            </div>
                                        </div>
                                        {/* Legend */}
                                        <div className="flex justify-center gap-6 mt-2">
                                            {techSplitData.data.map(d => {
                                                const perc = techSplitData.total > 0 ? (d.value / techSplitData.total) * 100 : 0;
                                                return (
                                                    <div key={d.name} className={`flex flex-col items-center transition-all ${techMixHovered && techMixHovered.name !== d.name ? 'opacity-30' : 'opacity-100'}`}>
                                                        <div className="flex items-center gap-1 mb-0.5">
                                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                                                            <span className="text-[9px] font-semibold text-gray-500 uppercase">{d.name}</span>
                                                        </div>
                                                        <span className="text-xs font-bold text-gray-900 dark:text-white">{perc.toFixed(1)}%</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </ChartContainer>

                                    {/* Pie Chart 3: Business Model Split (PPA / Merchant / Group) */}
                                    <ChartContainer
                                        title="Business Model Split"
                                        controls={
                                            <div className="flex flex-col gap-2 items-center w-full mt-2 sm:mt-0 sm:w-auto relative z-[60]">
                                                <div className="flex flex-wrap justify-end gap-1 w-full">
                                                    <CardSelect label="" options={categoryOptions} value={bizModelCategory} onChange={setBizModelCategory} />
                                                    <CardSelect label="" options={projectOptions} value={bizModelProject} onChange={setBizModelProject} />
                                                </div>
                                            </div>
                                        }
                                    >
                                        <div className="h-[180px] relative">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={modelSplitData}
                                                        innerRadius={55}
                                                        outerRadius={75}
                                                        dataKey="value"
                                                        stroke="none"
                                                        animationBegin={0}
                                                        animationDuration={800}
                                                        onMouseEnter={(_, index) => setBizModelHovered(modelSplitData[index])}
                                                        onMouseLeave={() => setBizModelHovered(null)}
                                                    >
                                                        {modelSplitData.map((e, i) => (
                                                            <Cell
                                                                key={i}
                                                                fill={e.color}
                                                                style={{
                                                                    filter: bizModelHovered && bizModelHovered.name !== e.name ? 'opacity(0.3)' : 'url(#shadow)',
                                                                    transition: 'all 0.3s'
                                                                }}
                                                            />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip content={() => null} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                                <span className="text-xl font-bold text-gray-800 dark:text-white leading-none">
                                                    {(bizModelHovered ? bizModelHovered.value : modelSplitData.reduce((s, d) => s + d.value, 0)).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                                </span>
                                                <span className="text-[8px] font-semibold text-gray-400 uppercase mt-0.5">
                                                    {bizModelHovered ? bizModelHovered.name : "Total MW"}
                                                </span>
                                            </div>
                                        </div>
                                        {/* Legend */}
                                        <div className="flex justify-center gap-4 mt-2">
                                            {modelSplitData.map(d => {
                                                const total = modelSplitData.reduce((s, x) => s + x.value, 0);
                                                const perc = total > 0 ? (d.value / total) * 100 : 0;
                                                return (
                                                    <div key={d.name} className={`flex flex-col items-center transition-all ${bizModelHovered && bizModelHovered.name !== d.name ? 'opacity-30' : 'opacity-100'}`}>
                                                        <div className="flex items-center gap-1 mb-0.5">
                                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                                                            <span className="text-[9px] font-semibold text-gray-500 uppercase">{d.name}</span>
                                                        </div>
                                                        <span className="text-xs font-bold text-gray-900 dark:text-white">{perc.toFixed(1)}%</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </ChartContainer>
                                </div>

                                {/* Row 2: Quarterly Performance + Deviation Side by Side */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    {/* Quarterly Performance Bar Chart */}
                                    <ChartContainer
                                        title={timelineView === 'monthly' ? "Monthly Timeline" : timelineView === 'quarterly' ? "Quarterly Performance" : "Annual Summary"}
                                        controls={
                                            <div className="flex flex-wrap items-center gap-1">
                                                <CardSelect label="" options={categoryOptions} value={timelineCategory} onChange={setTimelineCategory} />
                                                <CardSelect label="" options={businessModelOptions} value={timelineBusinessModel} onChange={setTimelineBusinessModel} />
                                                <ViewPivot active={timelineView} onChange={setTimelineView} label="" />
                                            </div>
                                        }
                                    >
                                        <div className="h-[240px] w-full">
                                            <ReactECharts
                                                style={{ height: '100%', width: '100%' }}
                                                option={{
                                                    backgroundColor: 'transparent',
                                                    tooltip: {
                                                        trigger: 'axis',
                                                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                                        borderColor: '#eee',
                                                        borderWidth: 1,
                                                        textStyle: { color: '#1f2937', fontWeight: 600 },
                                                        formatter: (params: any) => {
                                                            let html = `<div style="margin-bottom:5px; font-weight:900; color:#111827">${params[0].name}</div>`;
                                                            params.forEach((p: any) => {
                                                                html += `<div style="display:flex; justify-content:space-between; gap:20px; margin-bottom:3px">
                                                                    <span style="font-weight:700; color:#6B7280">${p.seriesName}</span>
                                                                    <span style="font-weight:900; color:${p.color}">${n(p.value)} MW</span>
                                                                </div>`;
                                                            });
                                                            return html;
                                                        }
                                                    },
                                                    legend: {
                                                        bottom: 0,
                                                        icon: 'roundRect',
                                                        textStyle: { color: '#9CA3AF', fontWeight: 700 }
                                                    },
                                                    grid: { top: '10%', left: '3%', right: '4%', bottom: '15%', containLabel: true },
                                                    xAxis: {
                                                        type: 'category',
                                                        data: (timelineView === 'monthly' ? monthlyData : timelineView === 'yearly' ? yearlyData : quarterlyData).map(d => d.name),
                                                        axisLine: { show: false },
                                                        axisTick: { show: false },
                                                        axisLabel: { color: '#9CA3AF', fontWeight: 700 }
                                                    },
                                                    yAxis: {
                                                        type: 'value',
                                                        splitLine: { lineStyle: { type: 'dashed', color: 'rgba(0,0,0,0.05)' } },
                                                        axisLabel: { color: '#9CA3AF', fontWeight: 700 }
                                                    },
                                                    series: [
                                                        {
                                                            name: 'Target Plan',
                                                            type: 'bar',
                                                            barGap: '20%',
                                                            itemStyle: {
                                                                color: {
                                                                    type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                                                                    colorStops: [{ offset: 0, color: '#3B82F6' }, { offset: 1, color: '#2563EB' }]
                                                                },
                                                                borderRadius: [4, 4, 0, 0]
                                                            },
                                                            data: (timelineView === 'monthly' ? monthlyData : timelineView === 'yearly' ? yearlyData : quarterlyData).map(d => d['Target Plan'])
                                                        },
                                                        {
                                                            name: 'Actual Commissioning',
                                                            type: 'bar',
                                                            itemStyle: {
                                                                color: {
                                                                    type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                                                                    colorStops: [{ offset: 0, color: '#10B981' }, { offset: 1, color: '#059669' }]
                                                                },
                                                                borderRadius: [4, 4, 0, 0]
                                                            },
                                                            data: (timelineView === 'monthly' ? monthlyData : timelineView === 'yearly' ? yearlyData : quarterlyData).map(d => d['Actual Commissioning'])
                                                        }
                                                    ]
                                                }}
                                            />
                                        </div>
                                    </ChartContainer>

                                    {/* Deviation Chart */}
                                    <ChartContainer
                                        title="Deviation Analysis (Actual − Plan)"
                                        controls={
                                            <ViewPivot active={deviationView} onChange={setDeviationView} label="" />
                                        }
                                    >
                                        <ResponsiveContainer width="100%" height={240}>
                                            <BarChart data={deviationChartData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} width={40} />
                                                <Tooltip
                                                    cursor={{ fill: '#fef2f2' }}
                                                    content={({ active, payload, label }) => {
                                                        if (active && payload && payload.length) {
                                                            const val = payload[0].value as number;
                                                            return (
                                                                <div className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-xl border-2" style={{ borderColor: val >= 0 ? '#10B981' : '#F43F5E' }}>
                                                                    <p className="font-bold text-sm">{label}</p>
                                                                    <p className={`text-lg font-black ${val >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                                        {val >= 0 ? '+' : ''}{val.toLocaleString()} MW
                                                                    </p>
                                                                    <p className="text-[9px] font-bold text-gray-400 uppercase">
                                                                        {val >= 0 ? 'Ahead' : 'Behind'}
                                                                    </p>
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    }} />
                                                <Bar dataKey="Deviation" radius={[4, 4, 0, 0]} barSize={28}>
                                                    {deviationChartData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.Deviation >= 0 ? '#10B981' : '#F43F5E'} fillOpacity={0.85} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </ChartContainer>
                                </div>
                            </div>
                        )}

                        {activeDashboard === 'solar' && (
                            <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-700 shadow-sm space-y-6">
                                <div className="flex flex-wrap justify-between items-center gap-4">
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                        <span className="w-1 h-5 bg-[#0B74B0] rounded-sm" />
                                        Solar Portfolio Analysis
                                    </h3>
                                    <div className="flex flex-wrap gap-2 relative z-50">
                                        <CardSelect label="Category" options={categoryOptions} value={solarCategory} onChange={setSolarCategory} />
                                        <CardSelect label="Model" options={businessModelOptions} value={solarBusinessModel} onChange={setSolarBusinessModel} />
                                        <MultiSlicer label="Projects" options={SECTION_OPTIONS.filter(s => s.label.includes('Solar'))} selected={selectedSections} onChange={setSelectedSections} />
                                    </div>
                                </div>

                                {/* Solar Summary */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                                    <div className="text-center">
                                        <p className="text-xs font-medium text-gray-500 uppercase">Starting Plan (Total)</p>
                                        <p className="text-xl font-bold text-gray-900 dark:text-white">{solarData.totalPlan.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span className="text-sm text-gray-400">MW</span></p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xs font-medium text-gray-500 uppercase">Cumulative Actual ({dateSublabel})</p>
                                        <p className="text-xl font-bold text-gray-900 dark:text-white">{solarData.totalActual.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span className="text-sm text-gray-400">MW</span></p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xs font-medium text-gray-500 uppercase">Overall Achievement</p>
                                        <p className="text-xl font-bold text-gray-900 dark:text-white">{solarData.totalPlan > 0 ? ((solarData.totalActual / solarData.totalPlan) * 100).toFixed(1) : 0}%</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xs font-medium text-gray-500 uppercase">Projects</p>
                                        <p className="text-xl font-bold text-gray-900 dark:text-white">{solarData.projectCount}</p>
                                    </div>
                                </div>

                                {/* Filter Tags */}
                                <div className="flex flex-wrap gap-2 text-xs">
                                    <span className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded font-medium">FY {fiscalYear.replace('FY_', '')}</span>
                                    <span className="bg-blue-100 dark:bg-blue-900/30 text-[#0B74B0] dark:text-blue-300 px-2 py-1 rounded font-medium">Solar</span>
                                    <span className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded font-medium">
                                        {solarBusinessModel === 'All Models' ? 'All Models' : solarBusinessModel}
                                    </span>
                                    <span className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded font-medium">
                                        {solarCategory === 'All Categories' ? 'All Categories' : solarCategory}
                                    </span>
                                </div>


                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    <ChartContainer
                                        title={`Solar - Quarterly ${solarQMode}`}
                                        controls={<CardSelect label="VIEW MODE" options={['Absolute', 'Cumulative']} value={solarQMode} onChange={setSolarQMode} />}
                                    >
                                        <ResponsiveContainer width="100%" height={250}>
                                            <BarChart data={solarData.quarterly}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                                <YAxis axisLine={false} tickLine={false} />
                                                <Tooltip formatter={(v: any) => `${v.toLocaleString(undefined, { maximumFractionDigits: 4 })} MW`} />
                                                <Bar dataKey="Target Plan" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={20} />
                                                <Bar dataKey="Actual Commissioning" fill="#10B981" radius={[4, 4, 0, 0]} barSize={20} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </ChartContainer>
                                    <ChartContainer
                                        title={`Solar - Monthly ${solarMMode}`}
                                        controls={<CardSelect label="VIEW MODE" options={['Monthly', 'Cumulative']} value={solarMMode} onChange={setSolarMMode} />}
                                    >
                                        <ResponsiveContainer width="100%" height={250}>
                                            <AreaChart data={solarData.monthly}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                                <YAxis axisLine={false} tickLine={false} />
                                                <Tooltip formatter={(v: any) => `${v.toLocaleString(undefined, { maximumFractionDigits: 4 })} MW`} />
                                                <Area type="monotone" dataKey="Target Plan" stroke="#3B82F6" fill="#93C5FD" strokeWidth={3} />
                                                <Area type="monotone" dataKey="Actual Commissioning" stroke="#10B981" fill="#A7F3D0" strokeWidth={3} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </ChartContainer>
                                </div>


                                <div className="bg-white dark:bg-gray-950 border border-gray-100 dark:border-gray-800 rounded-[2.5rem] p-8 shadow-sm">
                                    <div className="flex items-center justify-between mb-6">
                                        <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest">Solar Project Portfolio Breakdown</h4>
                                        <button
                                            onClick={() => setIsSolarExportOpen(true)}
                                            className="flex items-center gap-2 px-4 py-2 text-[10px] font-black text-[#0B74B0] hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30 transition-all uppercase tracking-widest"
                                        >
                                            <FileSpreadsheet className="w-3 h-3" />
                                            Export
                                        </button>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
                                                    <th className="px-4 py-4 text-left text-[11px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b-2 border-dashed border-gray-300 dark:border-gray-600">Project Name</th>
                                                    <th className="px-4 py-4 text-right text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b-2 border-dashed border-gray-300 dark:border-gray-600">Target Capacity</th>
                                                    <th className="px-4 py-4 text-right text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b-2 border-dashed border-gray-300 dark:border-gray-600">Actual Achieved</th>
                                                    <th className="px-4 py-4 text-center text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b-2 border-dashed border-gray-300 dark:border-gray-600">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {allProjects.filter(p => (selectedSections.includes('all') || selectedSections.includes(p.category)) && p.category?.toLowerCase().includes('solar') && p.planActual === 'Plan').map(p => {
                                                    const actual = allProjects.find(ap => ap.projectName === p.projectName && ap.planActual === 'Actual');
                                                    return (
                                                        <tr key={p.projectName} className="group hover:bg-blue-50/50 dark:hover:bg-gray-800/30 transition-colors">
                                                            <td className="px-4 py-3 text-sm font-bold text-gray-800 dark:text-gray-200 group-hover:text-[#0B74B0] dark:group-hover:text-[#60a5fa] transition-colors uppercase border-b border-dashed border-gray-200 dark:border-gray-700">{p.projectName}</td>
                                                            <td className="px-4 py-3 text-right text-sm font-black text-gray-900 dark:text-white border-b border-dashed border-gray-200 dark:border-gray-700">{p.capacity} MW</td>
                                                            <td className="px-4 py-3 text-right text-sm font-black text-gray-900 dark:text-white border-b border-dashed border-gray-200 dark:border-gray-700">{actual?.totalCapacity || 0} MW</td>
                                                            <td className="px-4 py-3 text-center border-b border-dashed border-gray-200 dark:border-gray-700">
                                                                <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${(actual?.totalCapacity || 0) >= p.capacity ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                                                                    {(actual?.totalCapacity || 0) >= p.capacity ? 'Completed' : 'On-Going'}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeDashboard === 'wind' && (
                            <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-700 shadow-sm space-y-6">
                                <div className="flex flex-wrap justify-between items-center gap-4">
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                        <span className="w-1 h-5 bg-cyan-500 rounded-sm" />
                                        Wind Portfolio Analysis
                                    </h3>
                                    <div className="flex flex-wrap gap-2 relative z-50">
                                        <CardSelect label="Category" options={categoryOptions} value={windCategory} onChange={setWindCategory} />
                                        <CardSelect label="Model" options={businessModelOptions} value={windBusinessModel} onChange={setWindBusinessModel} />
                                        <MultiSlicer label="Projects" options={SECTION_OPTIONS.filter(s => s.label.includes('Wind'))} selected={selectedSections} onChange={setSelectedSections} />
                                    </div>
                                </div>

                                {/* Wind Summary */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                                    <div className="text-center">
                                        <p className="text-xs font-medium text-gray-500 uppercase">Starting Plan (Total)</p>
                                        <p className="text-xl font-bold text-gray-900 dark:text-white">{windData.totalPlan.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span className="text-sm text-gray-400">MW</span></p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xs font-medium text-gray-500 uppercase">Cumulative Actual ({dateSublabel})</p>
                                        <p className="text-xl font-bold text-gray-900 dark:text-white">{windData.totalActual.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span className="text-sm text-gray-400">MW</span></p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xs font-medium text-gray-500 uppercase">Overall Achievement</p>
                                        <p className="text-xl font-bold text-gray-900 dark:text-white">{windData.totalPlan > 0 ? ((windData.totalActual / windData.totalPlan) * 100).toFixed(1) : 0}%</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xs font-medium text-gray-500 uppercase">Projects</p>
                                        <p className="text-xl font-bold text-gray-900 dark:text-white">{windData.projectCount}</p>
                                    </div>
                                </div>

                                {/* Filter Tags */}
                                <div className="flex flex-wrap gap-2 text-xs">
                                    <span className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded font-medium">FY {fiscalYear.replace('FY_', '')}</span>
                                    <span className="bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 px-2 py-1 rounded font-medium">Wind</span>
                                    <span className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded font-medium">
                                        {windBusinessModel === 'All Models' ? 'All Models' : windBusinessModel}
                                    </span>
                                    <span className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded font-medium">
                                        {windCategory === 'All Categories' ? 'All Categories' : windCategory}
                                    </span>
                                </div>


                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    <ChartContainer
                                        title={`Wind - Quarterly ${windQMode}`}
                                        controls={<CardSelect label="VIEW MODE" options={['Absolute', 'Cumulative']} value={windQMode} onChange={setWindQMode} />}
                                    >
                                        <ResponsiveContainer width="100%" height={250}>
                                            <BarChart data={windData.quarterly}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                                <YAxis axisLine={false} tickLine={false} />
                                                <Tooltip formatter={(v: any) => `${v.toLocaleString(undefined, { maximumFractionDigits: 4 })} MW`} />
                                                <Bar dataKey="Target Plan" fill="#06B6D4" radius={[6, 6, 0, 0]} barSize={32} />
                                                <Bar dataKey="Actual Commissioning" fill="#10B981" radius={[6, 6, 0, 0]} barSize={32} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </ChartContainer>
                                    <ChartContainer
                                        title={`Wind - Monthly ${windMMode}`}
                                        controls={<CardSelect label="VIEW MODE" options={['Monthly', 'Cumulative']} value={windMMode} onChange={setWindMMode} />}
                                    >
                                        <ResponsiveContainer width="100%" height={250}>
                                            <AreaChart data={windData.monthly}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                                <YAxis axisLine={false} tickLine={false} />
                                                <Tooltip formatter={(v: any) => `${v.toLocaleString(undefined, { maximumFractionDigits: 4 })} MW`} />
                                                <Area type="monotone" dataKey="Target Plan" stroke="#06B6D4" fill="#A5F3FC" strokeWidth={3} />
                                                <Area type="monotone" dataKey="Actual Commissioning" stroke="#10B981" fill="#A7F3D0" strokeWidth={3} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </ChartContainer>
                                </div>

                                <div className="bg-white dark:bg-gray-950 border border-gray-100 dark:border-gray-800 rounded-[2.5rem] p-8 shadow-sm">
                                    <div className="flex items-center justify-between mb-6">
                                        <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest">Wind Project Portfolio Breakdown</h4>
                                        <button
                                            onClick={() => setIsWindExportOpen(true)}
                                            className="flex items-center gap-2 px-4 py-2 text-[10px] font-black text-[#06B6D4] hover:bg-cyan-50 dark:hover:bg-cyan-900/10 rounded-xl border border-cyan-100 dark:border-cyan-900/30 transition-all uppercase tracking-widest"
                                        >
                                            <FileSpreadsheet className="w-3 h-3" />
                                            Export
                                        </button>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
                                                    <th className="px-4 py-4 text-left text-[11px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b-2 border-dashed border-gray-300 dark:border-gray-600">Project Name</th>
                                                    <th className="px-4 py-4 text-right text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b-2 border-dashed border-gray-300 dark:border-gray-600">Target Capacity</th>
                                                    <th className="px-4 py-4 text-right text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b-2 border-dashed border-gray-300 dark:border-gray-600">Actual Achieved</th>
                                                    <th className="px-4 py-4 text-center text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b-2 border-dashed border-gray-300 dark:border-gray-600">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {allProjects.filter(p => (selectedSections.includes('all') || selectedSections.includes(p.category)) && p.category?.toLowerCase().includes('wind') && p.planActual === 'Plan').map(p => {
                                                    const actual = allProjects.find(ap => ap.projectName === p.projectName && ap.planActual === 'Actual');
                                                    return (
                                                        <tr key={p.projectName} className="group hover:bg-cyan-50/50 dark:hover:bg-gray-800/30 transition-colors">
                                                            <td className="px-4 py-3 text-sm font-bold text-gray-800 dark:text-gray-200 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors uppercase border-b border-dashed border-gray-200 dark:border-gray-700">{p.projectName}</td>
                                                            <td className="px-4 py-3 text-right text-sm font-black text-gray-900 dark:text-white border-b border-dashed border-gray-200 dark:border-gray-700">{p.capacity} MW</td>
                                                            <td className="px-4 py-3 text-right text-sm font-black text-gray-900 dark:text-white border-b border-dashed border-gray-200 dark:border-gray-700">{actual?.totalCapacity || 0} MW</td>
                                                            <td className="px-4 py-3 text-center border-b border-dashed border-gray-200 dark:border-gray-700">
                                                                <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${(actual?.totalCapacity || 0) >= p.capacity ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                                                                    {(actual?.totalCapacity || 0) >= p.capacity ? 'Completed' : 'On-Going'}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeDashboard === 'models' && (
                            <div className="space-y-6">
                                {/* Models Dashboard Header */}
                                <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                                    <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                            <span className="w-1 h-5 bg-purple-500 rounded-sm" />
                                            Business Model Analysis
                                        </h3>
                                        <div className="flex flex-wrap gap-2 relative z-[60]">
                                            <GlobalSlicer label="Technology" options={['All', 'Solar', 'Wind']} value={modelsTechnology} onChange={setModelsTechnology} />
                                            <CardSelect label="Category" options={categoryOptions} value={modelsCategory} onChange={setModelsCategory} />
                                            <CardSelect label="Project" options={projectOptions} value={modelsProject} onChange={setModelsProject} />
                                        </div>
                                    </div>
                                    {/* Filter Tags */}
                                    <div className="flex flex-wrap gap-2 text-xs">
                                        <span className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded font-medium">FY {fiscalYear.replace('FY_', '')}</span>
                                        <span className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded font-medium">
                                            {modelsTechnology === 'All' ? 'Solar + Wind' : modelsTechnology}
                                        </span>
                                        <span className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded font-medium">
                                            {modelsCategory === 'All Categories' ? 'All Categories' : modelsCategory}
                                        </span>
                                    </div>

                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    <ChartContainer
                                        title="Business Model Distribution"
                                        controls={<CardSelect label="Metric" options={['Capacity Share', 'Project Count']} value={modelMetric} onChange={setModelMetric} />}
                                    >

                                        <ResponsiveContainer width="100%" height={300}>
                                            <PieChart>
                                                <Pie data={modelSplitData} innerRadius={80} outerRadius={110} dataKey="value" stroke="none">
                                                    {modelSplitData.map((e, i) => <Cell key={i} fill={e.color} />)}
                                                </Pie>
                                                <Tooltip formatter={(v: any) => `${v.toLocaleString()} MW`} />
                                                <Legend verticalAlign="bottom" iconType="circle" />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </ChartContainer>
                                    <div className="lg:col-span-2">
                                        <ChartContainer
                                            title="📊 Model vs Target Breakdown"
                                            controls={<CardSelect label="DRILL DOWN" options={['Project Drill-down', 'Phase Breakdown']} value={modelDrill} onChange={setModelDrill} />}
                                        >
                                            <div className="h-[300px] overflow-y-auto custom-scrollbar">
                                                {modelDrill === 'Project Drill-down' ? (
                                                    <div className="space-y-4 pr-2">
                                                        {allProjects.filter(p => p.planActual === 'Plan' && p.includedInTotal && (modelsProject === 'All Projects' || p.projectName === modelsProject) && (modelsTechnology === 'All' || p.category?.toLowerCase().includes(modelsTechnology.toLowerCase()))).slice(0, 10).map(p => (
                                                            <div key={p.projectName} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-gray-100 dark:border-gray-700">
                                                                <div className="flex flex-col">
                                                                    <span className="text-xs font-black text-gray-800 dark:text-gray-200 uppercase">{p.projectName}</span>
                                                                    <span className="text-[10px] font-bold text-gray-400 uppercase">{p.projectType} • {p.category}</span>
                                                                </div>
                                                                <div className="text-right flex flex-col items-end">
                                                                    <span className="text-sm font-black text-[#0B74B0]">{p.capacity} MW</span>
                                                                    <div className="w-20 h-1 bg-gray-200 dark:bg-gray-700 rounded-full mt-1 overflow-hidden">
                                                                        <div className="h-full bg-[#0B74B0]" style={{ width: '100%' }} />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 h-full">
                                                        {modelSplitData.map(m => (
                                                            <div key={m.name} className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-[2rem] flex flex-col justify-center items-center shadow-inner hover:shadow-md transition-all border border-transparent hover:border-gray-200 dark:hover:border-gray-700 group">
                                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{m.name}</span>
                                                                <span className="text-3xl font-black group-hover:scale-110 transition-transform" style={{ color: m.color }}>{m.value.toLocaleString()} MW</span>
                                                                <div className="mt-4 w-full h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                                                                    <motion.div initial={{ width: 0 }} animate={{ width: `${(m.value / (overallKpi.planFull || 1)) * 100}%` }} className="h-full" style={{ backgroundColor: m.color }} />
                                                                </div>
                                                                <span className="mt-2 text-[10px] font-bold text-gray-500 uppercase tracking-tighter">{((m.value / (overallKpi.planFull || 1)) * 100).toFixed(1)}% of total</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </ChartContainer>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeDashboard === 'deviation' && (
                            <div className="space-y-4 w-full">
                                {/* Deviation Dashboard Header with Summary Stats */}
                                <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
                                    <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                            <span className="w-1 h-5 bg-rose-500 rounded-sm" />
                                            Deviation Analysis
                                        </h3>
                                        <div className="flex flex-wrap gap-2 relative z-[60]">
                                            <GlobalSlicer label="" options={['All', 'Solar', 'Wind']} value={categoryFilter === 'all' ? 'All' : categoryFilter === 'solar' ? 'Solar' : 'Wind'} onChange={(v: string) => setCategoryFilter(v.toLowerCase() as any)} />
                                            <CardSelect label="" options={businessModelOptions} value={timelineBusinessModel} onChange={setTimelineBusinessModel} />
                                            <CardSelect label="" options={categoryOptions} value={timelineCategory} onChange={setTimelineCategory} />
                                        </div>
                                    </div>

                                    {/* Deviation Summary Stats */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                                            <p className="text-[10px] font-medium text-gray-500 uppercase">Total Deviation</p>
                                            <p className={`text-lg font-bold ${(overallKpi.actualCumm - overallKpi.planCumm) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {(overallKpi.actualCumm - overallKpi.planCumm) >= 0 ? '+' : ''}{(overallKpi.actualCumm - overallKpi.planCumm).toLocaleString()} <span className="text-xs">MW</span>
                                            </p>
                                        </div>
                                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                                            <p className="text-[10px] font-medium text-gray-500 uppercase">Periods Behind</p>
                                            <p className="text-lg font-bold text-rose-600">{deviationChartData.filter(d => d.Deviation < 0).length}</p>
                                        </div>
                                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                                            <p className="text-[10px] font-medium text-gray-500 uppercase">Periods Ahead</p>
                                            <p className="text-lg font-bold text-emerald-600">{deviationChartData.filter(d => d.Deviation >= 0).length}</p>
                                        </div>
                                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                                            <p className="text-[10px] font-medium text-gray-500 uppercase">Achievement %</p>
                                            <p className="text-lg font-bold text-[#0B74B0] dark:text-[#60a5fa]">{overallKpi.achievement.toFixed(1)}%</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Single Deviation Chart */}
                                <ChartContainer
                                    title="Deviation by Period (Actual − Plan)"
                                    controls={
                                        <ViewPivot active={deviationView} onChange={setDeviationView} />
                                    }
                                >
                                    <ResponsiveContainer width="100%" height={400}>
                                        <BarChart data={deviationChartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                            <Tooltip
                                                cursor={{ fill: '#fef2f2' }}
                                                content={({ active, payload, label }) => {
                                                    if (active && payload && payload.length) {
                                                        const val = payload[0].value as number;
                                                        return (
                                                            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-2xl border-2" style={{ borderColor: val >= 0 ? '#10B981' : '#F43F5E' }}>
                                                                <p className="font-black text-lg">{label}</p>
                                                                <p className={`text-2xl font-black ${val >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                                    {val >= 0 ? '+' : ''}{val.toLocaleString()} MW
                                                                </p>
                                                                <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">
                                                                    {val >= 0 ? 'Ahead of Schedule' : 'Action Required'}
                                                                </p>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }} />
                                            <Bar dataKey="Deviation" radius={[6, 6, 0, 0]} barSize={50}>
                                                {deviationChartData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.Deviation >= 0 ? '#10B981' : '#F43F5E'} fillOpacity={0.85} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </ChartContainer>
                            </div>
                        )}
                    </div>

                    {/* AGEL OVERALL EXECUTIVE SUMMARY TABLE - (1 + 2) */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="w-full mt-8"
                    >
                        <SummaryTable
                            title={`AGEL OVERALL FY ${fiscalYear.replace('FY_', '').split('-').map((p, i) => i === 0 ? '20' + p : p).join('-')} (1 + 2)`}
                            projects={allProjects.filter(p => p.includedInTotal)}
                            monthColumns={monthKeys}
                            monthLabels={dynamicMonthLabels}
                            cummTillLabel={getCummTillLabel(fiscalYear)}
                            formatNumber={(val: number | null | undefined) => {
                                if (val === null || val === undefined) return '-';
                                return val.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
                            }}
                        />
                    </motion.div>
                    <ExportReviewModal
                        isOpen={isSolarExportOpen}
                        onClose={() => setIsSolarExportOpen(false)}
                        onConfirm={handleDownloadSolar}
                        title="Solar Portfolio"
                        data={solarExportRecords}
                        headers={['Project Name', 'Fiscal Year', 'Capacity (MW)', 'Actual', 'Achievement %', 'Status']}
                    />
                    <ExportReviewModal
                        isOpen={isWindExportOpen}
                        onClose={() => setIsWindExportOpen(false)}
                        onConfirm={handleDownloadWind}
                        title="Wind Portfolio"
                        data={windExportRecords}
                        headers={['Project Name', 'Fiscal Year', 'Capacity (MW)', 'Actual', 'Achievement %', 'Status']}
                    />
                </>
            )}
        </div>
    );
}


// Sub-components
// Sub-components
function GlobalSlicer({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const buttonRef = React.useRef<HTMLButtonElement>(null);

    const handleOpen = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsOpen(!isOpen);
    };

    return (
        <div className="relative flex flex-col gap-1 items-start">
            {label && <span className="text-[10px] font-medium text-[#6B7280] dark:text-gray-400 uppercase">{label}</span>}
            <button
                ref={buttonRef}
                onClick={handleOpen}
                className="flex items-center gap-2 bg-[#F5F7FA] dark:bg-gray-800 hover:bg-white dark:hover:bg-gray-700 border border-[#D1D5DB] dark:border-gray-600 rounded-md px-3 py-1.5 text-xs font-medium text-[#1F2937] dark:text-gray-200 transition-colors cursor-pointer"
            >
                {value}
                <span className={`text-[10px] text-[#6B7280] transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-[200]" onClick={() => setIsOpen(false)} />
                    <div className="absolute top-full mt-1 right-0 min-w-[120px] bg-white dark:bg-gray-800 border border-[#D1D5DB] dark:border-gray-700 rounded-md shadow-lg p-1 z-[210]">
                        <div className="max-h-60 overflow-y-auto">
                            {options.map(o => (
                                <button
                                    key={o}
                                    onClick={() => { onChange(o.toLowerCase() as any); setIsOpen(false); }}
                                    className={`w-full text-left px-3 py-1.5 text-xs font-medium rounded transition-colors ${value.toLowerCase() === o.toLowerCase() ? 'bg-[#0B74B0] text-white' : 'text-[#1F2937] dark:text-gray-200 hover:bg-[#F5F7FA] dark:hover:bg-gray-700'}`}
                                >
                                    {o}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}




function ViewPivot({ active, onChange, label = "Period" }: { active: string; onChange: (v: any) => void; label?: string }) {
    return (
        <div className="flex flex-col items-start gap-1">
            {label && <span className="text-[10px] font-medium text-[#6B7280] dark:text-gray-400 uppercase">{label}</span>}
            <div className="h-8 bg-[#F3F4F6] dark:bg-gray-800 p-1 rounded-md flex items-center border border-[#D1D5DB] dark:border-gray-700 box-border">
                {['yearly', 'quarterly', 'monthly'].map((v) => (
                    <button
                        key={v}
                        onClick={() => onChange(v as any)}
                        className={`h-full px-3 rounded text-[10px] sm:text-xs font-medium transition-colors whitespace-nowrap flex items-center ${active === v
                            ? 'bg-[#0B74B0] text-white shadow-sm'
                            : 'text-[#4B5563] dark:text-gray-400 hover:bg-white dark:hover:bg-gray-700'}`}
                    >
                        {v.charAt(0).toUpperCase() + v.slice(1)}
                    </button>
                ))}
            </div>
        </div>
    );
}


function MultiSlicer({ label, options, selected, onChange }: { label: string; options: any[]; selected: string[]; onChange: (v: string[]) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const buttonRef = React.useRef<HTMLButtonElement>(null);

    const handleOpen = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setIsOpen(!isOpen);
    };

    return (
        <div className="relative flex flex-col gap-1">
            <span className="text-[10px] font-medium text-[#6B7280] dark:text-gray-400 uppercase">{label}</span>
            <button
                ref={buttonRef}
                onClick={handleOpen}
                className="h-8 flex items-center justify-between gap-2 bg-white dark:bg-gray-800 hover:bg-[#F9FAFB] dark:hover:bg-gray-700 border border-[#D1D5DB] dark:border-gray-600 rounded-md px-3 text-xs font-medium text-[#1F2937] dark:text-gray-200 transition-colors min-w-[100px] cursor-pointer"
            >
                <span className="truncate">{selected.includes('all') ? 'All' : `${selected.length} Selected`}</span>
                <span className={`text-[10px] text-[#6B7280] transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-[200]" onClick={() => setIsOpen(false)} />
                    <div className="absolute top-full mt-1 left-0 w-48 bg-white dark:bg-gray-800 border border-[#D1D5DB] dark:border-gray-700 rounded-md shadow-lg p-1 z-[210]">
                        <div className="max-h-60 overflow-y-auto">
                            <div className="flex border-b border-gray-100 dark:border-gray-700 mb-1 pb-1">
                                <button
                                    onClick={() => { onChange(['all']); setIsOpen(false); }}
                                    className={`flex-1 text-left px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded transition-colors ${selected.includes('all') ? 'bg-[#0B74B0] text-white' : 'text-[#374151] dark:text-gray-200 hover:bg-[#F3F4F6] dark:hover:bg-gray-700'}`}
                                >
                                    Show All
                                </button>
                                <button
                                    onClick={() => {
                                        const allValues = options.map(o => o.value);
                                        onChange(allValues);
                                    }}
                                    className="px-3 py-1.5 text-[10px] font-bold text-[#0B74B0] hover:underline uppercase tracking-wider"
                                >
                                    Select All
                                </button>
                            </div>
                            {options.map((o) => (
                                <div key={o.value} className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#F3F4F6] dark:hover:bg-gray-700 rounded cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selected.includes(o.value)}
                                        onChange={(e) => {
                                            const next = e.target.checked
                                                ? [...selected.filter(i => i !== 'all'), o.value]
                                                : selected.filter(i => i !== o.value);
                                            onChange(next.length === 0 ? ['all'] : next);
                                        }}
                                        className="rounded border-gray-300 text-[#0B74B0] focus:ring-[#0B74B0] w-3 h-3"
                                    />
                                    <span className="text-xs font-medium text-[#374151] dark:text-gray-300">{o.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}


function CardSelect({ label, options, value, onChange, variant = 'light' }: { label: string; options: string[]; value: string; onChange?: (v: string) => void; variant?: 'light' | 'dark' }) {
    const [isOpen, setIsOpen] = useState(false);
    const buttonRef = React.useRef<HTMLButtonElement>(null);

    const handleOpen = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setIsOpen(!isOpen);
    };

    // Light variant: for white backgrounds
    // Dark variant: for colored/dark backgrounds
    const labelClass = variant === 'dark'
        ? "text-[10px] font-medium text-white/70 uppercase mb-1"
        : "text-[10px] font-medium text-[#6B7280] uppercase mb-1";

    const buttonClass = variant === 'dark'
        ? "h-8 w-[150px] flex items-center justify-between gap-2 bg-white/20 hover:bg-white/30 border border-white/30 rounded-md px-3 text-xs font-medium text-white transition-colors"
        : "h-8 w-[150px] flex items-center justify-between gap-2 bg-[#F5F7FA] dark:bg-gray-800 hover:bg-white dark:hover:bg-gray-700 border border-[#D1D5DB] dark:border-gray-600 rounded-md px-3 text-xs font-medium text-[#1F2937] dark:text-gray-200 transition-colors";

    const arrowClass = variant === 'dark'
        ? `text-[10px] text-white/60 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`
        : `text-[10px] text-[#6B7280] transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`;

    return (
        <div className="relative flex flex-col items-start">
            {label && <span className={labelClass}>{label}</span>}
            <button
                ref={buttonRef}
                onClick={handleOpen}
                className={`${buttonClass} cursor-pointer`}
            >
                <span className="truncate flex-1 text-left" title={value}>{value}</span>
                <span className={arrowClass}>▼</span>
            </button>
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-[200]" onClick={() => setIsOpen(false)} />
                    <div className="absolute top-full mt-1 right-0 min-w-[140px] bg-white dark:bg-gray-800 border border-[#D1D5DB] dark:border-gray-700 rounded-md shadow-lg p-1 z-[210]">
                        <div className="max-h-60 overflow-y-auto">
                            {options.map(o => (
                                <button
                                    key={o}
                                    onClick={() => { onChange?.(o); setIsOpen(false); }}
                                    className={`w-full text-left px-3 py-1.5 text-xs font-medium rounded transition-colors ${value === o ? 'bg-[#0B74B0] text-white' : 'text-[#1F2937] dark:text-gray-200 hover:bg-[#F5F7FA] dark:hover:bg-gray-700'}`}
                                >
                                    {o}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}




function KPICard({ label, value, unit, trend, gradient }: { label: string; value: any; unit: string; trend: string; gradient: string }) {
    // Map gradient to Adani logo brand colors - Blue (#007B9E) → Purple (#6C2B85) → Magenta (#C02741)
    const getBgColor = () => {
        if (gradient.includes('blue') || gradient.includes('indigo')) return 'bg-gradient-to-br from-[#007B9E] to-[#005F7A]'; // Adani Blue (from logo)
        if (gradient.includes('emerald') || gradient.includes('teal')) return 'bg-gradient-to-br from-[#007B9E] to-[#6C2B85]'; // Adani Blue to Purple
        if (gradient.includes('purple')) return 'bg-gradient-to-br from-[#6C2B85] to-[#C02741]'; // Adani Purple to Magenta
        if (gradient.includes('rose') || gradient.includes('red')) return 'bg-gradient-to-br from-[#C02741] to-[#9E1F35]'; // Adani Magenta (from logo)
        return 'bg-gradient-to-br from-[#007B9E] to-[#005F7A]';
    };

    return (
        <div className={`${getBgColor()} p-4 rounded-xl shadow-md border border-white/10 relative overflow-hidden group`}>
            {/* Glossy Effect overlay */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/5 rounded-full -ml-12 -mb-12 pointer-events-none" />

            <div className="flex flex-col h-full justify-between relative z-10 gap-3">
                <div className="flex justify-between items-start gap-2">
                    <div className="space-y-1 sm:space-y-2 flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-white/90 uppercase tracking-widest leading-tight">{label}</p>
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                            <h2 className="text-2xl sm:text-3xl font-bold text-white leading-none shadow-sm drop-shadow-sm">
                                {typeof value === 'number' ? value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : value}
                            </h2>
                            <span className="text-sm font-medium text-white/80">{unit}</span>
                        </div>
                    </div>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-lg py-1.5 px-3 self-start max-w-full border border-white/10 shadow-sm">
                    <span className="text-[10px] sm:text-[11px] font-semibold text-white block truncate tracking-wide">{trend}</span>
                </div>
            </div>
        </div>
    );
}

function ChartContainer({ title, children, controls, className = "" }: { title: string; children: React.ReactNode; controls?: React.ReactNode; className?: string }) {
    // Remove emojis from title for corporate look
    const cleanTitle = title.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{231A}-\u{231B}]|[\u{23E9}-\u{23F3}]|[\u{23F8}-\u{23FA}]|[\u{25AA}-\u{25AB}]|[\u{25B6}]|[\u{25C0}]|[\u{25FB}-\u{25FE}]|[\u{2614}-\u{2615}]|[\u{2648}-\u{2653}]|[\u{267F}]|[\u{2693}]|[\u{26A1}]|[\u{26AA}-\u{26AB}]|[\u{26BD}-\u{26BE}]|[\u{26C4}-\u{26C5}]|[\u{26CE}]|[\u{26D4}]|[\u{26EA}]|[\u{26F2}-\u{26F3}]|[\u{26F5}]|[\u{26FA}]|[\u{26FD}]|[\u{2702}]|[\u{2705}]|[\u{2708}-\u{270D}]|[\u{270F}]|[\u{2712}]|[\u{2714}]|[\u{2716}]|[\u{271D}]|[\u{2721}]|[\u{2728}]|[\u{2733}-\u{2734}]|[\u{2744}]|[\u{2747}]|[\u{274C}]|[\u{274E}]|[\u{2753}-\u{2755}]|[\u{2757}]|[\u{2763}-\u{2764}]|[\u{2795}-\u{2797}]|[\u{27A1}]|[\u{27B0}]|[\u{27BF}]|[\u{2934}-\u{2935}]|[\u{2B05}-\u{2B07}]|[\u{2B1B}-\u{2B1C}]|[\u{2B50}]|[\u{2B55}]|[\u{3030}]|[\u{303D}]|[\u{3297}]|[\u{3299}]/gu, '').replace(/▣/g, '').trim();

    return (
        <div className={`bg-white dark:bg-[#1F2937] border-t-4 border-t-[#0B74B0] border border-[#D1D5DB] dark:border-gray-700 rounded-lg p-3 sm:p-4 lg:p-6 shadow-md hover:shadow-lg transition-shadow overflow-visible flex flex-col ${className}`}>
            <div className="flex flex-wrap justify-between items-start gap-y-2 gap-x-4 mb-4 sm:mb-6 min-h-[32px] border-b border-gray-100 dark:border-gray-700 pb-2">
                <h3 className="text-sm sm:text-base font-bold text-[#1F2937] dark:text-white flex items-start gap-2">
                    <span className="leading-tight">{cleanTitle}</span>
                </h3>
                {controls && (
                    <div className="flex flex-wrap items-center justify-end gap-2 flex-grow sm:flex-grow-0 relative z-[60]">
                        {controls}
                    </div>
                )}
            </div>
            <div className="flex-1 w-full relative">
                {children}
            </div>
        </div>
    );
}

// Custom Styles
const style = `
                        .custom-scrollbar::-webkit-scrollbar {
                            width: 4px;
  }
                        .custom-scrollbar::-webkit-scrollbar-track {
                            background: transparent;
  }
                        .custom-scrollbar::-webkit-scrollbar-thumb {
                            background: #E2E8F0;
                        border-radius: 10px;
  }
                        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                            background: #CBD5E1;
  }
                        `;

if (typeof document !== 'undefined') {
    const styleTag = document.createElement('style');
    styleTag.innerHTML = style;
    document.head.appendChild(styleTag);
}