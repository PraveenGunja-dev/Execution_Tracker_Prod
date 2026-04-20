import { API_BASE } from '../lib/config';
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import { SummaryTable } from './CommissioningSummaryTable';
import { PageLoader } from './PageLoader';
import { getCummTillLabel, parseScopeString, getCurrentFiscalYear } from '../lib/utils';
import ReactECharts from 'echarts-for-react';


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



interface GroupedProject {
  sno: number;
  projectName: string;
  spv: string;
  projectType: string;
  plotLocation: string;
  category: string;
  section: string;
  capacity: number;
  plan: CommissioningProject | null;
  actual: CommissioningProject | null;
}

// Helper to get dynamic month metadata based on fiscal year
const getFiscalMonths = (fy: string) => {
  const startYear = parseInt(fy.split('_')[1].split('-')[0]) + 2000;
  return [
    { key: 'apr', label: 'APR', year: startYear.toString(), quarter: 'Q1' },
    { key: 'may', label: 'MAY', year: startYear.toString(), quarter: 'Q1' },
    { key: 'jun', label: 'JUN', year: startYear.toString(), quarter: 'Q1' },
    { key: 'jul', label: 'JUL', year: startYear.toString(), quarter: 'Q2' },
    { key: 'aug', label: 'AUG', year: startYear.toString(), quarter: 'Q2' },
    { key: 'sep', label: 'SEP', year: startYear.toString(), quarter: 'Q2' },
    { key: 'oct', label: 'OCT', year: startYear.toString(), quarter: 'Q3' },
    { key: 'nov', label: 'NOV', year: startYear.toString(), quarter: 'Q3' },
    { key: 'dec', label: 'DEC', year: startYear.toString(), quarter: 'Q3' },
    { key: 'jan', label: 'JAN', year: (startYear + 1).toString(), quarter: 'Q4' },
    { key: 'feb', label: 'FEB', year: (startYear + 1).toString(), quarter: 'Q4' },
    { key: 'mar', label: 'MAR', year: (startYear + 1).toString(), quarter: 'Q4' },
  ];
};

const getYearOptions = (fy: string) => {
  const startYear = parseInt(fy.split('_')[1].split('-')[0]) + 2000;
  return [
    { value: 'all', label: 'All' },
    { value: startYear.toString(), label: startYear.toString() },
    { value: (startYear + 1).toString(), label: (startYear + 1).toString() },
  ];
};

const QUARTER_OPTIONS = [
  { value: 'all', label: 'All Quarters' },
  { value: 'Q1', label: 'Q1 (Apr-Jun)' },
  { value: 'Q2', label: 'Q2 (Jul-Sep)' },
  { value: 'Q3', label: 'Q3 (Oct-Dec)' },
  { value: 'Q4', label: 'Q4 (Jan-Mar)' },
];

const SOLAR_SECTIONS = [
  { value: 'all', label: 'All Solar Projects' },
  { value: 'A', label: 'A. Khavda Solar' },
  { value: 'B', label: 'B. Rajasthan Solar' },
  { value: 'C', label: 'C. Rajasthan Additional' },
  { value: 'D1', label: 'D1. Khavda Copper+Merchant (Excl)' },
  { value: 'D2', label: 'D2. Khavda Internal (Excl)' },
];

function KPICard({ label, value, unit, trend, gradient }: { label: string; value: any; unit: string; trend: string; gradient: string }) {
  const getBgColor = () => {
    if (gradient.includes('blue') || gradient.includes('indigo')) return 'bg-gradient-to-br from-[#007B9E] to-[#005F7A]';
    if (gradient.includes('emerald') || gradient.includes('teal')) return 'bg-gradient-to-br from-[#007B9E] to-[#6C2B85]';
    if (gradient.includes('purple')) return 'bg-gradient-to-br from-[#6C2B85] to-[#C02741]';
    if (gradient.includes('rose') || gradient.includes('red')) return 'bg-gradient-to-br from-[#C02741] to-[#9E1F35]';
    return 'bg-gradient-to-br from-[#007B9E] to-[#005F7A]';
  };

  return (
    <div className={`${getBgColor()} p-4 rounded-xl shadow-md border border-white/10 relative overflow-hidden group`}>
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/5 rounded-full -ml-12 -mb-12 pointer-events-none" />
      <div className="flex flex-col h-full justify-between relative z-10 gap-3">
        <div className="flex justify-between items-start gap-2">
          <div className="space-y-1 sm:space-y-2 flex-1 min-w-0">
            <p className="text-[10px] font-bold text-white/90 uppercase tracking-widest leading-tight">{label}</p>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <h2 className="text-2xl sm:text-3xl font-bold text-white leading-none shadow-sm drop-shadow-sm">
                {typeof value === 'number' ? value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 }) : value}
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


export default function SolarStatusPage({ fiscalYear }: { fiscalYear: string }) {
  const isPassed = (dateStr: string | null | undefined) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return d <= today;
  };

  const queryClient = useQueryClient();
  const { isAdmin, user } = useAuth();
  const currentFY = getCurrentFiscalYear();
  const _now = new Date();
  const _cm = _now.getMonth();
  
  // Determine how many months have passed for the SELECTED FY
  const _monthsPassed = useMemo(() => {
    if (fiscalYear < currentFY) return 12; // Past FY: complete
    if (fiscalYear > currentFY) return 0;  // Future FY: not started
    // Current FY: dynamic based on today's month
    return _cm >= 3 ? _cm - 2 : _cm + 10;
  }, [fiscalYear, currentFY, _cm]);

  const ALL_MONTHS = useMemo(() => getFiscalMonths(fiscalYear), [fiscalYear]);
  const YEAR_OPTIONS = useMemo(() => getYearOptions(fiscalYear), [fiscalYear]);
  const n = (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const [selectedSection, setSelectedSection] = useState('all');
  const [viewMode, setViewMode] = useState<'yearly' | 'quarterly' | 'monthly'>('quarterly');
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedQuarter, setSelectedQuarter] = useState('all');
  const [projectTypeFilter, setProjectTypeFilter] = useState('all');
  const [capacityPointFilter, setCapacityPointFilter] = useState('all');
  const [showExportModal, setShowExportModal] = useState(false);
  const [sectionHovered, setSectionHovered] = useState<any>(null);


  // Range Selector State
  const [startMonth, setStartMonth] = useState('apr');
  const [endMonth, setEndMonth] = useState('mar');
  const [exportMonths, setExportMonths] = useState<string[]>(ALL_MONTHS.map(m => m.key));

  useEffect(() => {
    const startIndex = ALL_MONTHS.findIndex(m => m.key === startMonth);
    const endIndex = ALL_MONTHS.findIndex(m => m.key === endMonth);

    if (startIndex !== -1 && endIndex !== -1 && startIndex <= endIndex) {
      const selected = ALL_MONTHS.slice(startIndex, endIndex + 1).map(m => m.key);
      setExportMonths(selected);
    } else {
      setExportMonths([]);
    }
  }, [startMonth, endMonth]);

  // Upload modal states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);

  // Fetch projects
  const { data: rawProjects = [], isLoading: projectsLoading } = useQuery<CommissioningProject[]>({
    queryKey: ['solar-projects', fiscalYear],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/api/commissioning-projects?fiscalYear=${fiscalYear}&category=solar`);
      if (!response.ok) throw new Error('Failed to fetch projects');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false, // Prevent refetch on window focus to reduce load
  });

  const isLoading = projectsLoading;

  // Standardized Scope Parsing
  const userScope = useMemo(() => parseScopeString(user?.scope || 'all'), [user]);

  // Filter by User Scope
  const scopeFilteredProjects = useMemo(() => {
    // Admins see everything
    if (!user || user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') return rawProjects;

    return rawProjects.filter(p => {
      const cat = (p.category || '').toLowerCase();
      const name = (p.projectName || '').toLowerCase();
      const projectKey = `${p.projectName}|${p.spv || ''}|${p.plotLocation || ''}`;

      // 1. Category Filter High Level
      if (userScope.category === 'solar') {
        const isSolar = (cat.includes('solar') || name.includes('solar')) && !cat.includes('wind') && !name.includes('wind');
        if (!isSolar) return false;
      }
      if (userScope.category === 'wind') {
        const isWind = (cat.includes('wind') || name.includes('wind')) && !cat.includes('solar') && !name.includes('solar');
        if (!isWind) return false;
      }

      // 2. Specific Projects Filter
      if (userScope.projects.length > 0) {
        if (!userScope.projects.includes(projectKey)) return false;
      }

      return true;
    });
  }, [rawProjects, user, userScope]);

  // Deduplicate and filter for Solar only + APPLY DATE VERIFICATION
  const solarProjects = useMemo(() => {
    const seen = new Set();
    const solarOnly = scopeFilteredProjects.filter((p: any) => {
      const cat = (p.category || '').toLowerCase();
      const name = (p.projectName || '').toLowerCase();
      const isSolar = (cat.includes('solar') || name.includes('solar')) && !cat.includes('wind') && !name.includes('wind');
      if (!isSolar) return false;

      const key = `${p.sno}-${p.projectName}-${p.spv}-${p.category}-${p.section}-${p.planActual}-${p.capacity}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Apply COD verification to 'Actual' rows
    return solarOnly.map(p => {
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
          // Fallback to project-level COD
          (pCopy as any)[m] = isPassed(p.codPlan) ? (p[m] || 0) : 0;
        }
      });

      // Calculate cumulative achievement (passed months only)
      const cumulativeSum = mKeys.reduce((s, k) => s + ((pCopy as any)[k] || 0), 0);
      pCopy.cummTillOct = cumulativeSum;

      // Maintain totalCapacity as the sum of all months (before zeroing out)
      pCopy.totalCapacity = p.totalCapacity;

      pCopy.q1 = (pCopy.apr || 0) + (pCopy.may || 0) + (pCopy.jun || 0);
      pCopy.q2 = (pCopy.jul || 0) + (pCopy.aug || 0) + (pCopy.sep || 0);
      pCopy.q3 = (pCopy.oct || 0) + (pCopy.nov || 0) + (pCopy.dec || 0);
      pCopy.q4 = (pCopy.jan || 0) + (pCopy.feb || 0) + (pCopy.mar || 0);

      return pCopy;
    });
  }, [scopeFilteredProjects, fiscalYear]);



  // Get available quarters based on year selection
  const availableQuarters = useMemo(() => {
    if (selectedYear === 'all') return QUARTER_OPTIONS;
    if (selectedYear === '2025') return QUARTER_OPTIONS.filter(q => ['all', 'Q1', 'Q2', 'Q3'].includes(q.value));
    if (selectedYear === '2026') return QUARTER_OPTIONS.filter(q => ['all', 'Q4'].includes(q.value));
    return QUARTER_OPTIONS;
  }, [selectedYear]);

  // Reset quarter when year changes if current quarter is invalid
  useEffect(() => {
    if (selectedYear === '2026' && !['all', 'Q4'].includes(selectedQuarter)) {
      setSelectedQuarter('all');
    }
    if (selectedYear === '2025' && selectedQuarter === 'Q4') {
      setSelectedQuarter('all');
    }
  }, [selectedYear, selectedQuarter]);

  // Get visible months based on year and quarter selection
  const visibleMonths = useMemo(() => {
    let months = ALL_MONTHS;

    const yearValues = YEAR_OPTIONS.filter(o => o.value !== 'all').map(o => o.value);
    if (selectedYear === yearValues[0]) {
      months = months.filter(m => m.year === yearValues[0]);
    } else if (selectedYear === yearValues[1]) {
      months = months.filter(m => m.year === yearValues[1]);
    }

    if (selectedQuarter !== 'all') {
      months = months.filter(m => m.quarter === selectedQuarter);
    }

    return months;
  }, [selectedYear, selectedQuarter]);

  // Filter projects based on all active filters
  // Filters projects for high-level metrics (Top KPIs, Summary Table, Charts)
  // Should ignore Project Type and Capacity Point filters as per user request for "Overall Sheet"
  const overallFilteredProjects = useMemo(() => {
    return solarProjects.filter(p => {
      // Section Filter
      if (selectedSection !== 'all' && p.section !== selectedSection) return false;

      // Project Type Filter (PPA, Merchant, Group)
      if (projectTypeFilter !== 'all' && p.projectType !== projectTypeFilter) return false;

      return true;
    });
  }, [solarProjects, selectedSection, projectTypeFilter]);

  // Filters projects based on ALL active filters for the detailed projects table
  const detailedFilteredProjects = useMemo(() => {
    return solarProjects.filter(p => {
      // Section Filter
      if (selectedSection !== 'all' && p.section !== selectedSection) return false;

      // Project Type Filter (PPA, Merchant, Group)
      if (projectTypeFilter !== 'all' && p.projectType !== projectTypeFilter) return false;

      // Capacity Point Filter (Plan, Actual)
      if (capacityPointFilter !== 'all' && p.planActual !== capacityPointFilter) return false;

      return true;
    });
  }, [solarProjects, selectedSection, projectTypeFilter, capacityPointFilter]);

  // Group projects by name with Plan, Actual
  const groupedProjects = useMemo(() => {
    const groups: Record<string, { plan?: CommissioningProject; actual?: CommissioningProject }> = {};

    detailedFilteredProjects.forEach(p => {
      // Include sno in key so projects with same name/SPV but different S.No are kept separate
      const key = `${p.sno}|${p.projectName}|${p.spv}|${p.section}`;
      if (!groups[key]) groups[key] = {};

      if (p.planActual === 'Plan') groups[key].plan = p;
      if (p.planActual === 'Actual') groups[key].actual = p;
    });

    // Convert the grouped object back to an array of GroupedProject objects
    return Object.entries(groups).map(([key, group]) => {
      const [snoStr, projectName, spv, section] = key.split('|');
      const sno = parseInt(snoStr, 10);
      const refProject = group.plan || group.actual;
      return {
        sno: sno,
        projectName: projectName,
        spv: spv,
        projectType: refProject?.projectType || '',
        plotLocation: refProject?.plotLocation || '',
        category: refProject?.category || '',
        section: section,
        capacity: refProject?.capacity || 0,
        plan: group.plan || null,
        actual: group.actual || null,
      };
    }).sort((a, b) => a.projectName.localeCompare(b.projectName));
  }, [detailedFilteredProjects]);

  // Calculate row data for summary table
  const calcRowData = useCallback((projects: CommissioningProject[], months: typeof ALL_MONTHS) => {
    return {
      months: months.map(m => projects.reduce((s: number, p: CommissioningProject) => s + ((p as any)[m.key] || 0), 0)),
      total: projects.reduce((s: number, p: CommissioningProject) => s + (p.totalCapacity || 0), 0),
      cumm: projects.reduce((s: number, p: CommissioningProject) => s + (p.cummTillOct || 0), 0),
      q1: projects.reduce((s: number, p: CommissioningProject) => s + (p.q1 || 0), 0),
      q2: projects.reduce((s: number, p: CommissioningProject) => s + (p.q2 || 0), 0),
      q3: projects.reduce((s: number, p: CommissioningProject) => s + (p.q3 || 0), 0),
      q4: projects.reduce((s: number, p: CommissioningProject) => s + (p.q4 || 0), 0),
    };
  }, []);

  const summaryData = useMemo(() => {
    const included = overallFilteredProjects.filter((p: CommissioningProject) => p.includedInTotal);
    const planProjects = included.filter((p: CommissioningProject) => p.planActual === 'Plan');
    const actualProjects = included.filter((p: CommissioningProject) => p.planActual === 'Actual');

    const filterByType = (projects: CommissioningProject[], type: string) =>
      projects.filter((p: CommissioningProject) => p.projectType?.toLowerCase().includes(type.toLowerCase()));

    return {
      plan: {
        total: calcRowData(planProjects, visibleMonths),
        ppa: calcRowData(filterByType(planProjects, 'ppa'), visibleMonths),
        merchant: calcRowData(filterByType(planProjects, 'merchant'), visibleMonths),
        group: calcRowData(filterByType(planProjects, 'group'), visibleMonths),
      },
      actual: {
        total: calcRowData(actualProjects, visibleMonths),
        ppa: calcRowData(filterByType(actualProjects, 'ppa'), visibleMonths),
        merchant: calcRowData(filterByType(actualProjects, 'merchant'), visibleMonths),
        group: calcRowData(filterByType(actualProjects, 'group'), visibleMonths),
      }
    };
  }, [overallFilteredProjects, visibleMonths, calcRowData]);

  // KPIs - Only include projects marked for total inclusion for high-level metrics
  const kpis = useMemo(() => {
    const includedProjects = overallFilteredProjects.filter((p: CommissioningProject) => p.includedInTotal);
    const planProjects = includedProjects.filter((p: CommissioningProject) => p.planActual === 'Plan');
    const actualProjects = includedProjects.filter((p: CommissioningProject) => p.planActual === 'Actual');

    const totalPlan = planProjects.reduce((s: number, p: CommissioningProject) => s + (p.totalCapacity || 0), 0);
    const totalActual = actualProjects.reduce((s: number, p: CommissioningProject) => s + (p.totalCapacity || 0), 0);
    const cummActual = actualProjects.reduce((s: number, p: CommissioningProject) => s + (p.cummTillOct || 0), 0);

    // Count unique projects by name only (ignore planActual type)
    const projectCount = new Set(includedProjects.map((p: CommissioningProject) => `${p.projectName}|${p.spv}`)).size;
    const achievement = totalPlan > 0 ? (cummActual / totalPlan) * 100 : 0;

    return { totalPlan, totalActual, projectCount, achievement, cummActual };
  }, [overallFilteredProjects]);


  // Section-wise capacity breakdown
  const sectionData = useMemo(() => {
    const planProjects = overallFilteredProjects.filter((p: CommissioningProject) => p.planActual === 'Plan' && p.includedInTotal);
    return SOLAR_SECTIONS.slice(1).map(section => {
      // Match by section field (A, B, C, D1, D2)
      const sectionProjects = planProjects.filter((p: CommissioningProject) => p.section === section.value);
      return {
        name: section.label.replace('A. ', '').replace('B. ', '').replace('C. ', '').replace('D1. ', '').replace('D2. ', ''),
        value: sectionProjects.reduce((s: number, p: CommissioningProject) => s + (p.totalCapacity || 0), 0),
        color: section.value === 'A' ? '#0B74B0' : // Honolulu Blue
          section.value === 'B' ? '#75479C' : // Dark Lavender
            section.value === 'C' ? '#BD3861' : // X11 Maroon
              section.value === 'D1' ? '#0B74B0' : // Honolulu Blue
                '#75479C' // Dark Lavender
      };
    }).filter(d => d.value > 0);
  }, [overallFilteredProjects]);

  // Chart data
  const quarterlyData = useMemo(() => {
    const planProjects = overallFilteredProjects.filter((p: CommissioningProject) => p.planActual === 'Plan');
    const actualProjects = overallFilteredProjects.filter((p: CommissioningProject) => p.planActual === 'Actual');

    // For current FY, apply date-based logic to quarters
    const completedMonthIdx = _monthsPassed - 1;
    
    return ['Q1', 'Q2', 'Q3', 'Q4'].map((q, idx) => {
      const key = `q${idx + 1}` as 'q1' | 'q2' | 'q3' | 'q4';
      const qMonths = [idx * 3, idx * 3 + 1, idx * 3 + 2];
      
      // Calculate Plan based on completed months only for current FY
      let planValue = 0;
      if (fiscalYear === currentFY) {
        // Date-based: sum only completed months in this quarter
        planValue = planProjects.reduce((s: number, p: CommissioningProject) => 
          s + qMonths.reduce((sum, mIdx) => {
            if (mIdx <= completedMonthIdx) {
              return sum + ((p as any)[ALL_MONTHS[mIdx].key] || 0);
            }
            return sum;
          }, 0), 0
        );
      } else {
        // Full quarter budget for past/future FYs
        planValue = planProjects.reduce((s: number, p: CommissioningProject) => s + (p[key] || 0), 0);
      }
      
      return {
        name: q,
        Plan: planValue,
        'Actual/Fcst': actualProjects.reduce((s: number, p: CommissioningProject) => s + (p[key] || 0), 0),
      };
    });
  }, [overallFilteredProjects, fiscalYear, currentFY, _monthsPassed, ALL_MONTHS]);

  const monthlyData = useMemo(() => {
    const planProjects = overallFilteredProjects.filter((p: CommissioningProject) => p.planActual === 'Plan');
    const actualProjects = overallFilteredProjects.filter((p: CommissioningProject) => p.planActual === 'Actual');

    return ALL_MONTHS.map((m, idx) => ({
      name: m.label,
      // For current FY, show budget only for completed months
      Plan: fiscalYear === currentFY && idx >= _monthsPassed
        ? 0
        : planProjects.reduce((s: number, p: CommissioningProject) => s + ((p as any)[m.key] || 0), 0),
      'Actual/Fcst': actualProjects.reduce((s: number, p: CommissioningProject) => s + ((p as any)[m.key] || 0), 0),
    }));
  }, [overallFilteredProjects, fiscalYear, currentFY, _monthsPassed, ALL_MONTHS]);

  const yearlyData = useMemo(() => {
    const planProjects = overallFilteredProjects.filter((p: CommissioningProject) => p.planActual === 'Plan');
    const actualProjects = overallFilteredProjects.filter((p: CommissioningProject) => p.planActual === 'Actual');

    // For current FY, use date-based budget; for other FYs use full year
    const planMonths = fiscalYear < currentFY || fiscalYear > currentFY 
      ? ALL_MONTHS 
      : ALL_MONTHS.slice(0, _monthsPassed);
    
    return [{
      name: fiscalYear.replace('FY_', 'FY '),
      Plan: planProjects.reduce((s: number, p: CommissioningProject) => 
        s + planMonths.reduce((sum, m) => sum + ((p as any)[m.key] || 0), 0), 0
      ),
      'Actual/Fcst': actualProjects.reduce((s: number, p: CommissioningProject) => s + (p.totalCapacity || 0), 0),
    }];
  }, [overallFilteredProjects, fiscalYear, currentFY, _monthsPassed, ALL_MONTHS]);

  const formatNumber = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '0';
    // Round to 1 decimal place to avoid floating-point errors, then check if whole
    const rounded = Math.round(value * 10) / 10;
    if (Number.isInteger(rounded)) {
      return rounded.toLocaleString();
    }
    return rounded.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  };

  const handleExport = () => {
    const selectedMonthsData = ALL_MONTHS.filter(m => exportMonths.includes(m.key));
    const headers = ['Plan/Actual', ...selectedMonthsData.map(m => `${m.label}-${m.year}`), 'Total', 'Q1', 'Q2', 'Q3', 'Q4'];

    const rows: (string | number)[][] = [];

    const addRow = (label: string, projects: CommissioningProject[]) => {
      const monthValues = selectedMonthsData.map(m =>
        projects.reduce((s, p) => s + ((p as any)[m.key] || 0), 0)
      );
      const total = projects.reduce((s, p) => s + (p.totalCapacity || 0), 0);
      rows.push([
        label,
        ...monthValues,
        total,
        projects.reduce((s, p) => s + (p.q1 || 0), 0),
        projects.reduce((s, p) => s + (p.q2 || 0), 0),
        projects.reduce((s, p) => s + (p.q3 || 0), 0),
        projects.reduce((s, p) => s + (p.q4 || 0), 0),
      ]);
    };

    const planProjects = solarProjects.filter(p => p.planActual === 'Plan');
    const actualProjects = solarProjects.filter(p => p.planActual === 'Actual');

    addRow('Plan', planProjects);
    addRow('Plan - PPA', planProjects.filter(p => p.projectType?.toLowerCase().includes('ppa')));
    addRow('Plan - Merchant', planProjects.filter(p => p.projectType?.toLowerCase().includes('merchant')));
    addRow('Plan - Group', planProjects.filter(p => p.projectType?.toLowerCase().includes('group')));
    addRow('Actual/Fcst', actualProjects);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    // Set column widths
    ws['!cols'] = [{ wch: 18 }, ...selectedMonthsData.map(() => ({ wch: 10 })), { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Solar Summary');

    // Download
    XLSX.writeFile(wb, `AGEL_Solar_Summary_${new Date().toISOString().split('T')[0]}.xlsx`);
    setShowExportModal(false);
  };

  const handleExportDetailed = () => {
    const headers = ['S.No', 'Project Name', 'SPV', 'Type', 'Location', 'Capacity', 'Status', ...ALL_MONTHS.map(m => `${m.label}-${m.year}`), 'Q1', 'Q2', 'Q3', 'Q4', 'Total'];
    const rows: (string | number)[][] = [];

    groupedProjects.forEach((group, idx) => {
      const types: ('plan' | 'actual')[] = ['plan', 'actual'];
      types.forEach(type => {
        const p = group[type];
        if (p && (capacityPointFilter === 'all' || capacityPointFilter === p.planActual)) {
          rows.push([
            idx + 1,
            group.projectName,
            group.spv,
            group.projectType,
            group.plotLocation,
            group.capacity,
            p.planActual,
            ...ALL_MONTHS.map(m => (p as any)[m.key] || 0),
            p.q1 || 0,
            p.q2 || 0,
            p.q3 || 0,
            p.q4 || 0,
            p.totalCapacity || 0
          ]);
        }
      });
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Detailed Projects');
    XLSX.writeFile(wb, `AGEL_Solar_Detailed_${fiscalYear}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExcelUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fiscalYear', fiscalYear);

      const response = await fetch(`${API_BASE}/api/upload-excel`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setUploadResult({
          failed: 1,
          errors: [data.detail || 'Upload failed']
        });
      } else {
        setUploadResult({
          success: data.projects_imported || 0,
          sheets_found: data.sheets_found
        });
        queryClient.invalidateQueries({ queryKey: ['commissioning-projects'] });
        queryClient.invalidateQueries({ queryKey: ['solar-projects'] });
        queryClient.invalidateQueries({ queryKey: ['wind-projects'] });
      }
    } catch (error: any) {
      setUploadResult({ errors: [error.message] });
    } finally {
      setUploading(false);
    }
  };

  const handleResetData = async () => {
    if (!isAdmin) return;
    if (!confirm('Are you sure you want to RESET ALL commissioning data? This cannot be undone.')) return;

    try {
      const response = await fetch(`${API_BASE}/api/reset-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fiscalYear })
      });

      if (response.ok) {
        alert('Data reset successfully');
        queryClient.invalidateQueries({ queryKey: ['solar-projects'] });
      }
    } catch (error) {
      alert('Reset failed');
    }
  };



  if (isLoading) {
    return <PageLoader message="Loading Solar Dashboard..." />;
  }

  // Summary table row component with theme support - Enhanced Design
  const SummaryRow = ({ label, data, isHeader, colorClass }: {
    label: string;
    data: ReturnType<typeof calcRowData>;
    isHeader?: boolean;
    colorClass: string;
  }) => {
    // Background logic to ensure sticky cells obscure scrolling content but match row theme
    const stickyBgClass = isHeader
      ? 'bg-gray-50 dark:bg-gray-900'
      : 'bg-white dark:bg-gray-800 group-hover:bg-gray-50 dark:group-hover:bg-gray-700';

    return (
      <tr className={`group transition-colors ${isHeader ? 'bg-gray-50/50 dark:bg-gray-800/50' : 'hover:bg-gray-50/30 dark:hover:bg-gray-800/30'}`}>
        <td className={`px-4 py-3 whitespace-nowrap border-b border-dashed border-gray-200 dark:border-gray-700 ${isHeader ? 'font-bold' : 'pl-8 font-medium'} sticky left-0 z-20 ${stickyBgClass}`}>
          <span className={isHeader ? `${colorClass} flex items-center gap-2` : 'text-gray-500 dark:text-gray-400'}>
            {isHeader && <span className={`w-1.5 h-1.5 rounded-full ${colorClass.includes('0B74B0') ? 'bg-[#0B74B0]' : colorClass.includes('BD3861') ? 'bg-[#BD3861]' : 'bg-[#75479C]'}`}></span>}
            {label}
          </span>
        </td>
        {data.months.map((v, i) => (
          <td key={i} className="px-3 py-3 text-right tabular-nums whitespace-nowrap border-b border-dashed border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-medium text-sm">
            {formatNumber(v)}
          </td>
        ))}
        <td className={`px-3 py-3 text-right tabular-nums whitespace-nowrap border-b border-dashed border-gray-200 dark:border-gray-700 font-bold text-sm ${colorClass} sticky z-20 ${stickyBgClass}`} style={{ right: '340px' }}>
          {formatNumber(data.total)}
        </td>
        <td className={`px-3 py-3 text-right tabular-nums whitespace-nowrap border-b border-dashed border-gray-200 dark:border-gray-700 font-bold text-sm ${colorClass} sticky z-20 ${stickyBgClass}`} style={{ right: '240px' }}>
          {formatNumber(data.cumm)}
        </td>
        <td className={`px-3 py-3 text-right tabular-nums whitespace-nowrap border-b border-dashed border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-medium text-sm sticky z-20 ${stickyBgClass}`} style={{ right: '180px' }}>{formatNumber(data.q1)}</td>
        <td className={`px-3 py-3 text-right tabular-nums whitespace-nowrap border-b border-dashed border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-medium text-sm sticky z-20 ${stickyBgClass}`} style={{ right: '120px' }}>{formatNumber(data.q2)}</td>
        <td className={`px-3 py-3 text-right tabular-nums whitespace-nowrap border-b border-dashed border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-medium text-sm sticky z-20 ${stickyBgClass}`} style={{ right: '60px' }}>{formatNumber(data.q3)}</td>
        <td className={`px-3 py-3 text-right tabular-nums whitespace-nowrap border-b border-dashed border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-medium text-sm sticky z-20 ${stickyBgClass}`} style={{ right: '0px' }}>{formatNumber(data.q4)}</td>
      </tr>
    );
  };

  return (
    <div className="space-y-6 min-h-screen">
      {/* Hero Header - Enhanced Premium Design */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#BD3861] via-[#75479C] to-[#0B74B0] p-8 shadow-2xl"
      >
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Floating orbs with staggered animations */}
          <motion.div
            className="absolute -right-10 -top-10 w-64 h-64 bg-white/10 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.1, 0.2, 0.1],
              x: [0, 20, 0],
              y: [0, -10, 0]
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute -left-20 bottom-0 w-80 h-80 bg-yellow-400/10 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.05, 0.15, 0.05],
            }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          />
          <motion.div
            className="absolute right-1/4 top-1/2 w-40 h-40 bg-orange-300/20 rounded-full blur-2xl"
            animate={{
              scale: [1, 1.4, 1],
              opacity: [0.1, 0.2, 0.1],
            }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          />
          {/* Grid pattern overlay */}
          <div className="absolute inset-0 opacity-5" style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }} />
          {/* Sun icon accent */}
          <motion.div
            className="absolute right-8 top-8 opacity-20"
            animate={{ rotate: 360 }}
            transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
          >
            <svg className="w-24 h-24 text-yellow-300" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
            </svg>
          </motion.div>
        </div>

        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="text-white">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="flex items-center gap-3 mb-2"
              >
                <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl">
                  <svg className="w-6 h-6 text-yellow-300" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0z" />
                  </svg>
                </div>
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">Solar Energy</span>
              </motion.div>
              <motion.h1
                className="text-3xl font-black mb-2 tracking-tight"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                Solar Commissioning Execution
              </motion.h1>
              <motion.p
                className="opacity-80 text-sm font-medium flex items-center gap-2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
              >
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                Tracking Performance & Targets – {fiscalYear.replace('_', ' ')}
              </motion.p>
            </div>

            <motion.div
              className="flex items-center gap-3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              {/* Action Buttons */}
              <div className="flex gap-2">
                {isAdmin && (
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="h-11 px-5 bg-white/20 backdrop-blur-md border border-white/30 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white/30 hover:scale-105 transition-all flex items-center gap-2 shadow-lg"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                    Upload
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        </div>

        {/* Enhanced KPI Cards with Glassmorphism */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white/10 backdrop-blur-xl rounded-2xl p-5 border border-white/20 hover:bg-white/15 transition-all group shadow-xl"
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-[10px] font-black text-white/70 uppercase tracking-[0.15em]">Full Year Target</span>
              <div className="p-1.5 bg-[#0B74B0]/30 rounded-lg">
                <svg className="w-4 h-4 text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black text-white tracking-tight group-hover:scale-105 transition-transform">{kpis.totalPlan.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
              <span className="text-lg font-bold text-white/60">MW</span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="px-2 py-1 bg-[#0B74B0]/40 rounded-lg text-[10px] font-bold text-cyan-200 uppercase tracking-wider">
                FY {fiscalYear.replace('FY_', '')} Target
              </span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white/10 backdrop-blur-xl rounded-2xl p-5 border border-white/20 hover:bg-white/15 transition-all group shadow-xl"
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-[10px] font-black text-white/70 uppercase tracking-[0.15em]">Cumm. Actual</span>
              <div className="p-1.5 bg-[#75479C]/30 rounded-lg">
                <svg className="w-4 h-4 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black text-white tracking-tight group-hover:scale-105 transition-transform">{kpis.cummActual.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
              <span className="text-lg font-bold text-white/60">MW</span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="px-2 py-1 bg-[#75479C]/40 rounded-lg text-[10px] font-bold text-purple-200 uppercase tracking-wider">
                Status as of {getCummTillLabel(fiscalYear).replace('CUMM TILL ', '')}
              </span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="bg-white/10 backdrop-blur-xl rounded-2xl p-5 border border-white/20 hover:bg-white/15 transition-all group shadow-xl"
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-[10px] font-black text-white/70 uppercase tracking-[0.15em]">Overall Achievement</span>
              <div className="p-1.5 bg-emerald-500/30 rounded-lg">
                <svg className="w-4 h-4 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black text-white tracking-tight group-hover:scale-105 transition-transform">{kpis.achievement.toFixed(1)}</span>
              <span className="text-lg font-bold text-white/60">%</span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="px-2 py-1 bg-emerald-500/40 rounded-lg text-[10px] font-bold text-emerald-200 uppercase tracking-wider">
                Target: YTD / Total Capacity
              </span>
            </div>
          </motion.div>
        </div>

      </motion.div>



      {/* Charts Section */}
      < div className="grid grid-cols-1 lg:grid-cols-3 gap-6" >
        {/* Pie Chart */}
        < motion.div
          initial={{ opacity: 0, scale: 0.95 }
          }
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-blue-100 dark:border-gray-700 p-6"
        >
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="w-1 h-4 bg-[#0B74B0] rounded-full"></span>
            Capacity by Section
          </h3>
          <div className="h-[200px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sectionData}
                  innerRadius={60}
                  outerRadius={80}
                  cornerRadius={5}
                  dataKey="value"
                  stroke="none"
                  paddingAngle={5}
                  onMouseEnter={(_, index) => setSectionHovered(sectionData[index])}
                  onMouseLeave={() => setSectionHovered(null)}
                >
                  {sectionData.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={entry.color}
                      style={{
                        filter: sectionHovered && sectionHovered.name !== entry.name ? 'opacity(0.3)' : 'drop-shadow(0px 0px 5px rgba(0,0,0,0.2))',
                        transition: 'all 0.3s'
                      }}
                    />
                  ))}
                </Pie>
                <Tooltip content={() => null} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-4">
              <span className="text-xl font-black text-[#0B74B0] dark:text-blue-400">
                {(sectionHovered ? sectionHovered.value : kpis.totalPlan).toLocaleString(undefined, { maximumFractionDigits: 1 })}
              </span>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                {sectionHovered ? sectionHovered.name : "Total MW"}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-3 mt-4">
            {sectionData.map(d => (
              <div key={d.name} className={`flex items-center gap-1.5 transition-all ${sectionHovered && sectionHovered.name !== d.name ? 'opacity-30' : 'opacity-100'}`}>
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }}></div>
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{d.name}</span>
              </div>
            ))}
          </div>
        </motion.div >

        {/* Bar Chart */}
        < motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-blue-100 dark:border-gray-700 p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-2">
              <span className="w-1 h-4 bg-[#0B74B0] rounded-full"></span>
              {viewMode === 'yearly' ? 'Yearly' : viewMode === 'quarterly' ? 'Quarterly' : 'Monthly'} Performance
            </h3>
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setViewMode('yearly')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'yearly' ? 'bg-[#0B74B0] text-white shadow' : 'text-gray-600 dark:text-gray-400'}`}
              >
                Yearly
              </button>
              <button
                onClick={() => setViewMode('quarterly')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'quarterly' ? 'bg-[#0B74B0] text-white shadow' : 'text-gray-600 dark:text-gray-400'}`}
              >
                Quarterly
              </button>
              <button
                onClick={() => setViewMode('monthly')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'monthly' ? 'bg-[#0B74B0] text-white shadow' : 'text-gray-600 dark:text-gray-400'}`}
              >
                Monthly
              </button>
            </div>
          </div>
          <div className="h-[250px] w-full mt-2">
            <ReactECharts
              style={{ height: '100%', width: '100%' }}
              option={{
                backgroundColor: 'transparent',
                tooltip: {
                  trigger: 'axis',
                  axisPointer: { type: 'cross', label: { backgroundColor: '#6a7985' } },
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
                  boundaryGap: false,
                  data: (viewMode === 'monthly' ? monthlyData : viewMode === 'yearly' ? yearlyData : quarterlyData).map(d => d.name),
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
                    name: 'Plan',
                    type: 'line',
                    smooth: true,
                    symbol: 'none',
                    lineStyle: { width: 3, color: '#0B74B0' },
                    areaStyle: {
                      color: {
                        type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [{ offset: 0, color: 'rgba(11, 116, 176, 0.2)' }, { offset: 1, color: 'rgba(11, 116, 176, 0)' }]
                      }
                    },
                    data: (viewMode === 'monthly' ? monthlyData : viewMode === 'yearly' ? yearlyData : quarterlyData).map(d => d.Plan)
                  },
                  {
                    name: 'Actual/Fcst',
                    type: 'line',
                    smooth: true,
                    symbol: 'circle',
                    symbolSize: 8,
                    itemStyle: { color: '#75479C', borderWidth: 2, borderColor: '#fff' },
                    lineStyle: { width: 3, color: '#75479C' },
                    areaStyle: {
                      color: {
                        type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [{ offset: 0, color: 'rgba(117, 71, 156, 0.2)' }, { offset: 1, color: 'rgba(117, 71, 156, 0)' }]
                      }
                    },
                    data: (viewMode === 'monthly' ? monthlyData : viewMode === 'yearly' ? yearlyData : quarterlyData).map(d => d['Actual/Fcst'])
                  }
                ]
              }}
            />
          </div>
        </motion.div >
      </div >

      {/* AGEL Overall Solar Summary Table */}
      < motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-700"
      >
        <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border-b border-gray-200 dark:border-gray-700 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <span className="text-[#0B74B0]">1.</span>
            AGEL OVERALL SOLAR FY {fiscalYear.replace('FY_', '').split('-').map((p, i) => i === 0 ? '20' + p : p).join('-')}
          </h3>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white/50 dark:bg-gray-800/50 p-1 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-transparent border-none text-[10px] font-bold text-gray-600 dark:text-gray-400 focus:ring-0 cursor-pointer py-1 pl-2 pr-6"
              >
                {YEAR_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <div className="w-px h-3 bg-gray-200 dark:bg-gray-600"></div>
              <select
                value={selectedQuarter}
                onChange={(e) => setSelectedQuarter(e.target.value)}
                className="bg-transparent border-none text-[10px] font-bold text-gray-600 dark:text-gray-400 focus:ring-0 cursor-pointer py-1 pl-2 pr-6"
              >
                {availableQuarters.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setShowExportModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#0B74B0] to-indigo-600 hover:from-[#095a87] hover:to-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-md active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export
            </button>
          </div>
        </div>

        {/* Table with scrollable months section */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
                <th className="px-4 py-4 text-left text-[11px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[140px] border-b-2 border-dashed border-gray-300 dark:border-gray-600 sticky left-0 z-30 bg-gray-50 dark:bg-gray-800">
                  Plan / Actual
                </th>
                {visibleMonths.map(m => (
                  <th key={m.key} className="px-3 py-4 text-right text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[75px] border-b-2 border-dashed border-gray-300 dark:border-gray-600">
                    {m.label}-{m.year.slice(-2)}
                  </th>
                ))}
                <th className="px-3 py-4 text-right text-[11px] font-black text-[#0B74B0] dark:text-[#60a5fa] uppercase tracking-wider min-w-[85px] border-b-2 border-dashed border-[#0B74B0]/30 dark:border-[#0B74B0]/40 bg-[#0B74B0]/5 dark:bg-[#0B74B0]/10 sticky z-30 bg-gray-100 dark:bg-gray-900" style={{ right: '340px' }}>
                  TOTAL
                </th>
                <th className="px-3 py-4 text-right text-[11px] font-black text-[#75479C] dark:text-[#d8b4fe] uppercase tracking-wider min-w-[100px] border-b-2 border-dashed border-[#75479C]/30 dark:border-[#75479C]/40 bg-[#75479C]/5 dark:bg-[#75479C]/10 sticky z-30 bg-gray-100 dark:bg-gray-900" style={{ right: '240px' }}>
                  {getCummTillLabel(fiscalYear)}
                </th>
                <th className="px-3 py-4 text-right text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[60px] border-b-2 border-dashed border-gray-300 dark:border-gray-600 sticky z-30 bg-gray-100 dark:bg-gray-900" style={{ right: '180px' }}>Q1</th>
                <th className="px-3 py-4 text-right text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[60px] border-b-2 border-dashed border-gray-300 dark:border-gray-600 sticky z-30 bg-gray-100 dark:bg-gray-900" style={{ right: '120px' }}>Q2</th>
                <th className="px-3 py-4 text-right text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[60px] border-b-2 border-dashed border-gray-300 dark:border-gray-600 sticky z-30 bg-gray-100 dark:bg-gray-900" style={{ right: '60px' }}>Q3</th>
                <th className="px-3 py-4 text-right text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[60px] border-b-2 border-dashed border-gray-300 dark:border-gray-600 sticky z-30 bg-gray-100 dark:bg-gray-900" style={{ right: '0px' }}>Q4</th>
              </tr>
            </thead>
            <tbody>
              {/* Plan Section */}
              <SummaryRow label="Plan" data={summaryData.plan.total} isHeader colorClass="text-[#0B74B0]" />
              <SummaryRow label="PPA" data={summaryData.plan.ppa} colorClass="text-[#0B74B0]" />
              <SummaryRow label="Merchant" data={summaryData.plan.merchant} colorClass="text-[#0B74B0]" />
              <SummaryRow label="Group" data={summaryData.plan.group} colorClass="text-[#0B74B0]" />

              {/* Actual Section */}
              <SummaryRow label="Actual / Fcst" data={summaryData.actual.total} isHeader colorClass="text-[#75479C]" />
              <SummaryRow label="PPA" data={summaryData.actual.ppa} colorClass="text-[#75479C]" />
              <SummaryRow label="Merchant" data={summaryData.actual.merchant} colorClass="text-[#75479C]" />
              <SummaryRow label="Group" data={summaryData.actual.group} colorClass="text-[#75479C]" />
            </tbody>
          </table>
        </div>
      </motion.div >

      {/* Filters and Projects Table */}
      < motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-blue-100 dark:border-gray-700 p-4"
      >
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-black uppercase text-[#0B74B0] tracking-widest transition-all focus:ring-2 focus:ring-[#0B74B0]/20"
            >
              {SOLAR_SECTIONS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-4 border-l border-gray-200 dark:border-gray-700 pl-6">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Project Type</span>
              <select
                value={projectTypeFilter}
                onChange={(e) => setProjectTypeFilter(e.target.value)}
                className="px-2 py-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm font-bold text-gray-700"
              >
                <option value="all">All Types</option>
                <option value="PPA">PPA</option>
                <option value="Merchant">Merchant</option>
                <option value="Group">Group</option>
              </select>
            </div>

            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Status</span>
              <select
                value={capacityPointFilter}
                onChange={(e) => setCapacityPointFilter(e.target.value)}
                className="px-2 py-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm font-bold text-gray-700"
              >
                <option value="all">All Status</option>
                <option value="Plan">Plan</option>
                <option value="Actual">Actual / Fcst</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-6 ml-auto">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#0B74B0] shadow-sm shadow-blue-500/50"></span>
              <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Plan</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#75479C] shadow-sm shadow-indigo-500/50"></span>
              <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Actual</span>
            </div>
          </div>
          <div className="text-xs font-black text-gray-400 uppercase tracking-widest border-l border-gray-200 dark:border-gray-700 pl-6">
            Projects: <span className="text-[#0B74B0]">{groupedProjects.length}</span>
          </div>
        </div>
      </motion.div >

      {/* Projects Table */}
      < motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-blue-100 dark:border-gray-700 overflow-hidden"
      >
        <div className="p-4 border-b border-blue-100 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800 flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-[#0B74B0]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
            </svg>
            {selectedSection !== 'all' ? SOLAR_SECTIONS.find(s => s.value === selectedSection)?.label : 'Solar Projects - Plan / Actual Comparison'}
          </h3>

          <button
            onClick={handleExportDetailed}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#0B74B0] hover:bg-[#095a87] text-white rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export List
          </button>
        </div>
        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-4 text-center text-[11px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider w-14 border-b-2 border-dashed border-gray-300 dark:border-gray-600">S.No</th>
                <th className="px-4 py-4 text-left text-[11px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[180px] border-b-2 border-dashed border-gray-300 dark:border-gray-600">Project Name</th>
                <th className="px-4 py-4 text-left text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[120px] border-b-2 border-dashed border-gray-300 dark:border-gray-600">SPV</th>
                <th className="px-4 py-4 text-center text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b-2 border-dashed border-gray-300 dark:border-gray-600">Type</th>
                <th className="px-4 py-4 text-left text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b-2 border-dashed border-gray-300 dark:border-gray-600">Location</th>
                <th className="px-4 py-4 text-right text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b-2 border-dashed border-gray-300 dark:border-gray-600">Capacity</th>
                <th className="px-4 py-4 text-center text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24 border-b-2 border-dashed border-gray-300 dark:border-gray-600">Status</th>
                {visibleMonths.map(m => (
                  <th key={m.key} className="px-3 py-4 text-right text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-16 border-b-2 border-dashed border-gray-300 dark:border-gray-600">{m.label}-{m.year.slice(-2)}</th>
                ))}
                <th className="px-3 py-4 text-right text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b-2 border-dashed border-gray-300 dark:border-gray-600">Q1</th>
                <th className="px-3 py-4 text-right text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b-2 border-dashed border-gray-300 dark:border-gray-600">Q2</th>
                <th className="px-3 py-4 text-right text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b-2 border-dashed border-gray-300 dark:border-gray-600">Q3</th>
                <th className="px-3 py-4 text-right text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b-2 border-dashed border-gray-300 dark:border-gray-600">Q4</th>
                <th className="px-4 py-4 text-right text-[11px] font-black text-[#0B74B0] dark:text-[#60a5fa] uppercase tracking-wider border-b-2 border-dashed border-[#0B74B0]/30 dark:border-[#0B74B0]/40 bg-[#0B74B0]/5 dark:bg-[#0B74B0]/10">Total</th>
              </tr>
            </thead>
            <tbody>
              {groupedProjects.map((group, idx) => (
                <React.Fragment key={`${group.projectName}-${idx}`}>
                  {/* Plan Row */}
                  {(capacityPointFilter === 'all' || capacityPointFilter === 'Plan') && (
                    <tr className="hover:bg-blue-50/50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-4 py-3 text-center text-gray-500 dark:text-gray-400 font-bold text-sm border-b border-dashed border-gray-200 dark:border-gray-700" rowSpan={capacityPointFilter === 'all' ? 2 : 1}>{idx + 1}</td>
                      <td className="px-4 py-3 font-semibold text-gray-800 dark:text-white border-b border-dashed border-gray-200 dark:border-gray-700" rowSpan={capacityPointFilter === 'all' ? 2 : 1}>{group.projectName}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs font-medium border-b border-dashed border-gray-200 dark:border-gray-700" rowSpan={capacityPointFilter === 'all' ? 2 : 1}>{group.spv || '-'}</td>
                      <td className="px-4 py-3 text-center border-b border-dashed border-gray-200 dark:border-gray-700" rowSpan={capacityPointFilter === 'all' ? 2 : 1}>
                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${group.projectType?.toLowerCase().includes('ppa') ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                          {group.projectType || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs border-b border-dashed border-gray-200 dark:border-gray-700" rowSpan={capacityPointFilter === 'all' ? 2 : 1}>{group.plotLocation || '-'}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-800 dark:text-white border-b border-dashed border-gray-200 dark:border-gray-700" rowSpan={capacityPointFilter === 'all' ? 2 : 1}>{formatNumber(group.capacity)}</td>
                      <td className="px-4 py-3 text-center border-b border-dashed border-gray-200 dark:border-gray-700">
                        <span className="inline-flex px-2.5 py-1 text-[10px] font-bold uppercase rounded-md bg-[#0B74B0]/10 text-[#0B74B0] dark:bg-[#0B74B0]/30 dark:text-[#60a5fa]">Plan</span>
                      </td>
                      {visibleMonths.map(m => (
                        <td key={m.key} className="px-3 py-3 text-right tabular-nums text-gray-600 dark:text-gray-400 font-medium text-sm whitespace-nowrap border-b border-dashed border-gray-200 dark:border-gray-700">
                          {formatNumber(group.plan ? (group.plan as any)[m.key] : 0)}
                        </td>
                      ))}
                      <td className="px-3 py-3 text-right text-gray-500 font-medium text-sm border-b border-dashed border-gray-200 dark:border-gray-700">{formatNumber(group.plan?.q1)}</td>
                      <td className="px-3 py-3 text-right text-gray-500 font-medium text-sm border-b border-dashed border-gray-200 dark:border-gray-700">{formatNumber(group.plan?.q2)}</td>
                      <td className="px-3 py-3 text-right text-gray-500 font-medium text-sm border-b border-dashed border-gray-200 dark:border-gray-700">{formatNumber(group.plan?.q3)}</td>
                      <td className="px-3 py-3 text-right text-gray-500 font-medium text-sm border-b border-dashed border-gray-200 dark:border-gray-700">{formatNumber(group.plan?.q4)}</td>
                      <td className="px-4 py-3 text-right font-bold text-[#0B74B0] dark:text-[#60a5fa] border-b border-dashed border-gray-200 dark:border-gray-700 bg-[#0B74B0]/5 dark:bg-[#0B74B0]/10">{formatNumber(group.plan?.totalCapacity)}</td>
                    </tr>
                  )}
                  {/* Actual Row */}
                  {(capacityPointFilter === 'all' || capacityPointFilter === 'Actual') && (
                    <tr className="hover:bg-[#75479C]/5 dark:hover:bg-[#75479C]/10 transition-colors">
                      {capacityPointFilter !== 'all' && (
                        <>
                          <td className="px-4 py-3 text-center text-gray-500 dark:text-gray-400 font-bold text-sm border-b border-dashed border-gray-200 dark:border-gray-700" rowSpan={1}>{idx + 1}</td>
                          <td className="px-4 py-3 font-semibold text-gray-800 dark:text-white border-b border-dashed border-gray-200 dark:border-gray-700" rowSpan={1}>{group.projectName}</td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs font-medium border-b border-dashed border-gray-200 dark:border-gray-700" rowSpan={1}>{group.spv || '-'}</td>
                          <td className="px-4 py-3 text-center border-b border-dashed border-gray-200 dark:border-gray-700" rowSpan={1}>
                            <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${group.projectType?.toLowerCase().includes('ppa') ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                              {group.projectType || '-'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs border-b border-dashed border-gray-200 dark:border-gray-700" rowSpan={1}>{group.plotLocation || '-'}</td>
                          <td className="px-4 py-3 text-right font-bold text-gray-800 dark:text-white border-b border-dashed border-gray-200 dark:border-gray-700" rowSpan={1}>{formatNumber(group.capacity)}</td>
                        </>
                      )}
                      <td className="px-4 py-3 text-center border-b-2 border-dashed border-gray-300 dark:border-gray-600">
                        <span className="inline-flex px-2.5 py-1 text-[10px] font-bold uppercase rounded-md bg-[#75479C]/10 text-[#75479C] dark:bg-[#75479C]/30 dark:text-[#d8b4fe]">Actual/Fcst</span>
                      </td>
                      {visibleMonths.map(m => (
                        <td key={m.key} className="px-3 py-3 text-right tabular-nums text-gray-600 dark:text-gray-400 font-medium text-sm whitespace-nowrap border-b-2 border-dashed border-gray-300 dark:border-gray-600">
                          {formatNumber(group.actual ? (group.actual as any)[m.key] : 0)}
                        </td>
                      ))}
                      <td className="px-3 py-3 text-right text-gray-500 font-medium text-sm border-b-2 border-dashed border-gray-300 dark:border-gray-600">{formatNumber(group.actual?.q1)}</td>
                      <td className="px-3 py-3 text-right text-gray-500 font-medium text-sm border-b-2 border-dashed border-gray-300 dark:border-gray-600">{formatNumber(group.actual?.q2)}</td>
                      <td className="px-3 py-3 text-right text-gray-500 font-medium text-sm border-b-2 border-dashed border-gray-300 dark:border-gray-600">{formatNumber(group.actual?.q3)}</td>
                      <td className="px-3 py-3 text-right text-gray-500 font-medium text-sm border-b-2 border-dashed border-gray-300 dark:border-gray-600">{formatNumber(group.actual?.q4)}</td>
                      <td className="px-4 py-3 text-right font-bold text-[#75479C] dark:text-[#d8b4fe] border-b-2 border-dashed border-gray-300 dark:border-gray-600 bg-[#75479C]/5 dark:bg-[#75479C]/10">{formatNumber(group.actual?.totalCapacity)}</td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div >

      {/* Export Modal */}
      <AnimatePresence>
        {
          showExportModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
              onClick={() => setShowExportModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-xl font-bold text-gray-800 dark:text-white">Export Solar Data</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Select which months to include in the export</p>
                </div>

                <div className="p-6">
                  <div className="grid grid-cols-2 gap-6 mb-2">
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">From Range</label>
                      <div className="flex gap-2">
                        <select
                          value={ALL_MONTHS.find(m => m.key === startMonth)?.year || YEAR_OPTIONS[1].value}
                          onChange={(e) => {
                            const newYear = e.target.value;
                            const defaultMonth = newYear === YEAR_OPTIONS[1].value ? 'apr' : 'jan';
                            setStartMonth(defaultMonth);

                            // Validate End Date isn't before Start Date
                            const startIndex = ALL_MONTHS.findIndex(m => m.key === defaultMonth);
                            const endIndex = ALL_MONTHS.findIndex(m => m.key === endMonth);
                            if (startIndex > endIndex) {
                              setEndMonth(defaultMonth);
                            }
                          }}
                          className="flex-1 px-3 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-700 dark:text-white focus:ring-2 focus:ring-orange-500/20 outline-none transition-all cursor-pointer"
                        >
                          {YEAR_OPTIONS.filter(o => o.value !== 'all').map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        <select
                          value={startMonth}
                          onChange={(e) => {
                            const newStart = e.target.value;
                            setStartMonth(newStart);

                            const startIndex = ALL_MONTHS.findIndex(m => m.key === newStart);
                            const endIndex = ALL_MONTHS.findIndex(m => m.key === endMonth);
                            if (startIndex > endIndex) {
                              setEndMonth(newStart);
                            }
                          }}
                          className="flex-1 px-3 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-700 dark:text-white focus:ring-2 focus:ring-orange-500/20 outline-none transition-all cursor-pointer"
                        >
                          {ALL_MONTHS.filter(m => m.year === (ALL_MONTHS.find(x => x.key === startMonth)?.year || YEAR_OPTIONS[1].value)).map((m) => (
                            <option key={m.key} value={m.key}>{m.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">To Range</label>
                      <div className="flex gap-2">
                        <select
                          value={ALL_MONTHS.find(m => m.key === endMonth)?.year || YEAR_OPTIONS[1].value}
                          onChange={(e) => {
                            const newYear = e.target.value;
                            const defaultMonth = newYear === YEAR_OPTIONS[1].value ? 'apr' : 'jan';
                            // If switching year makes end date before start date, adjust start date
                            const startIndex = ALL_MONTHS.findIndex(m => m.key === startMonth);
                            const endIndex = ALL_MONTHS.findIndex(m => m.key === defaultMonth);

                            if (endIndex < startIndex) {
                              setStartMonth(defaultMonth);
                            }
                            setEndMonth(defaultMonth);
                          }}
                          className="flex-1 px-3 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-700 dark:text-white focus:ring-2 focus:ring-orange-500/20 outline-none transition-all cursor-pointer"
                        >
                          {YEAR_OPTIONS.filter(o => o.value !== 'all').map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        <select
                          value={endMonth}
                          onChange={(e) => {
                            const newEnd = e.target.value;
                            setEndMonth(newEnd);

                            const startIndex = ALL_MONTHS.findIndex(m => m.key === startMonth);
                            const endIndex = ALL_MONTHS.findIndex(m => m.key === newEnd);
                            if (endIndex < startIndex) {
                              setStartMonth(newEnd);
                            }
                          }}
                          className="flex-1 px-3 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-700 dark:text-white focus:ring-2 focus:ring-orange-500/20 outline-none transition-all cursor-pointer"
                        >
                          {ALL_MONTHS.filter(m => m.year === (ALL_MONTHS.find(x => x.key === endMonth)?.year || YEAR_OPTIONS[1].value)).map((m) => (
                            <option key={m.key} value={m.key}>{m.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-orange-50 dark:bg-orange-900/10 rounded-xl border border-orange-100 dark:border-orange-900/20 flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Selection</span>
                      <span className="text-sm font-black text-orange-600 dark:text-orange-400 mt-0.5">
                        {ALL_MONTHS.find(m => m.key === startMonth)?.label}-{ALL_MONTHS.find(m => m.key === startMonth)?.year}
                        <span className="mx-2 text-gray-400">-&gt;</span>
                        {ALL_MONTHS.find(m => m.key === endMonth)?.label}-{ALL_MONTHS.find(m => m.key === endMonth)?.year}
                      </span>
                    </div>
                    <div className="px-3 py-1 bg-white dark:bg-gray-800 rounded-lg text-xs font-bold text-gray-600 dark:text-gray-300 shadow-sm border border-gray-100 dark:border-gray-700">
                      {exportMonths.length} Months
                    </div>
                  </div>
                </div>

                <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                  <button
                    onClick={() => setShowExportModal(false)}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleExport}
                    disabled={exportMonths.length === 0}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Export
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )
        }
      </AnimatePresence >

      {/* Upload Excel Modal */}
      <AnimatePresence>
        {
          showUploadModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
              onClick={() => setShowUploadModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Upload Excel File</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Select an AGEL Commissioning Status Excel file to upload</p>
                </div>

                <div className="p-6">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    id="excel-upload"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleExcelUpload(file);
                      }
                    }}
                  />
                  <label
                    htmlFor="excel-upload"
                    className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-orange-300 dark:border-orange-700 rounded-xl cursor-pointer hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all"
                  >
                    {uploading ? (
                      <div className="flex flex-col items-center">
                        <div className="w-10 h-10 border-4 border-gray-200 border-t-[#0B74B0] rounded-full animate-spin mb-3"></div>
                        <p className="text-sm font-medium text-[#0B74B0] dark:text-[#60a5fa]">Uploading...</p>
                      </div>
                    ) : (
                      <>
                        <svg className="w-12 h-12 text-orange-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Click to select Excel file</p>
                        <p className="text-xs text-gray-500 mt-1">.xlsx or .xls</p>
                      </>
                    )}
                  </label>

                  {uploadResult && (
                    <div className={`mt-4 p-4 rounded-lg ${uploadResult.errors?.length ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
                      {uploadResult.success !== undefined && (
                        <p className="text-sm font-medium text-green-700 dark:text-green-400">
                          ✓ Successfully imported {uploadResult.success} projects
                        </p>
                      )}
                      {uploadResult.sheets_found && (
                        <p className="text-xs text-gray-500 mt-1">Sheets: {uploadResult.sheets_found.join(', ')}</p>
                      )}
                      {uploadResult.errors?.map((err: string, i: number) => (
                        <p key={i} className="text-sm text-red-600 dark:text-red-400">{err}</p>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowUploadModal(false);
                      setUploadResult(null);
                    }}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )
        }
      </AnimatePresence >
    </div >
  );
}
