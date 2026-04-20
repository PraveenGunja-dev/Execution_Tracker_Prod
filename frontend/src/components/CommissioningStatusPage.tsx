import { API_BASE } from '../lib/config';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { getCummTillLabel } from '../lib/utils';

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
  plotNo?: string;
  priority?: string;
  trialRun?: string;
  chargingPlan?: string;
  codPlan?: string;
}


import { SummaryTable } from './CommissioningSummaryTable';
import { ExportReviewModal } from './ExportReviewModal';
import { FileSpreadsheet, Database } from 'lucide-react';

interface CommissioningSummary {
  id?: number;
  category: string;
  summaryType: string;
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
  total: number | null;
  cummTillOct: number | null;
  q1: number | null;
  q2: number | null;
  q3: number | null;
  q4: number | null;
}

// Month columns for table headers
const monthColumns = ['apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar'];

// Section display name mapping - comprehensive for both Solar and Wind
const sectionDisplayNames: Record<string, string> = {
  // Solar Sections
  'A': 'A. Khavda Solar Projects',
  'B': 'B. Rajasthan Solar Projects',
  'C': 'C. Rajasthan Solar Additional 500MW',
  'D1': 'D1. Khavda Solar Copper + Merchant 50MW (Excluded)',
  'D2': 'D2. Khavda Solar Internal 650MW (Excluded)',
  // Wind Sections  
  'A_Wind': 'A. Khavda Wind Projects',
  'B_Wind': 'B. Khavda Wind Internal 421MW (Excluded)',
  'C_Wind': 'C. Mundra Wind 76MW',
  'D_Wind': 'D. Mundra Wind Internal 224.4MW (Excluded)',
};

// Category display name mapping for cleaner dropdown labels WITH section prefixes
const categoryDisplayNames: Record<string, string> = {
  // Solar Categories
  'Khavda Solar': 'A. Khavda Solar Projects',
  'Rajasthan Solar': 'B. Rajasthan Solar Projects',
  'Rajasthan Solar Additional 500MW': 'C. Rajasthan Solar Additional 500MW',
  'Khavda Solar Copper+Merchant 50MW': 'D1. Khavda Solar Copper (Excluded)',
  'Khavda Solar Internal 650MW': 'D2. Khavda Solar Internal (Excluded)',
  // Wind Categories
  'Khavda Wind': 'A. Khavda Wind Projects',
  'Khavda Wind Internal 421MW': 'B. Khavda Wind Internal (Excluded)',
  'Mundra Wind 76MW': 'C. Mundra Wind 76MW',
  'Mundra Wind Internal 224.4MW': 'D. Mundra Wind Internal (Excluded)',
};

const getCategoryDisplayName = (category: string): string => {
  return categoryDisplayNames[category] || category;
};

// Section inclusion/exclusion rules for calculations
const SECTION_INCLUSION_RULES: Record<string, boolean> = {
  'A. Khavda Solar Projects': true,
  'B. Rajasthan Solar Projects': true,
  'C. Rajasthan Solar Additional 500MW': true,
  'A. Khavda Wind Projects': true,
  'C. Mundra Wind 76MW': true,
  'D1. Khavda Solar Copper + Merchant 50MW': false,
  'D2. Khavda Solar Internal 650MW': false,
  'B. Khavda Wind Internal 421MW': false,
  'D. Mundra Wind Internal 224.4MW': false,
};

const getSectionDisplayName = (section: string): string => {
  return sectionDisplayNames[section] || `Section ${section}`;
};

// Base Hierarchy Definition without titles
const HIERARCHY_BASE = {
  SOLAR: {
    key: 'Solar',
    color: 'from-orange-500 to-amber-500',
    bgLight: 'bg-orange-50 dark:bg-gray-800/80',
    borderColor: 'border-orange-200 dark:border-orange-500',
    textColor: 'text-orange-900 dark:text-orange-100',
    sections: ['A', 'B', 'C', 'D1', 'D2']
  },
  WIND: {
    key: 'Wind',
    color: 'from-cyan-500 to-teal-500',
    bgLight: 'bg-cyan-50 dark:bg-gray-800/80',
    borderColor: 'border-cyan-200 dark:border-cyan-500',
    textColor: 'text-cyan-900 dark:text-cyan-100',
    sections: ['A', 'C', 'D', 'B']
  }
};

export default function CommissioningStatusPage({ fiscalYear }: { fiscalYear: string }) {
  const queryClient = useQueryClient();
  const { user, isAdmin, isSuperAdmin, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('overview');

  // Dynamic Month Labels
  const dynamicMonthLabels = useMemo(() => {
    const startYear = parseInt(fiscalYear.split('_')[1].split('-')[0]);
    return [
      `Apr-${startYear}`, `May-${startYear}`, `Jun-${startYear}`,
      `Jul-${startYear}`, `Aug-${startYear}`, `Sep-${startYear}`,
      `Oct-${startYear}`, `Nov-${startYear}`, `Dec-${startYear}`,
      `Jan-${startYear + 1}`, `Feb-${startYear + 1}`, `Mar-${startYear + 1}`
    ];
  }, [fiscalYear]);

  // Dynamic Hierarchy with Titles
  const HIERARCHY = useMemo(() => {
    const fyDisplay = fiscalYear.replace('FY_', '').split('-').map((p, i) => i === 0 ? '20' + p : p).join('-');
    return {
      SOLAR: {
        ...HIERARCHY_BASE.SOLAR,
        title: `● AGEL Overall Solar FY ${fyDisplay} (A + B + C)`
      },
      WIND: {
        ...HIERARCHY_BASE.WIND,
        title: `◆ AGEL Overall Wind FY ${fyDisplay} (A + C)`
      }
    };
  }, [fiscalYear]);

  // Filter states
  const [filters, setFilters] = useState({
    category: '',
    projectType: '',
    planActual: 'Plan',
    spv: '',
    section: '',
    showExcluded: true, // Show items excluded from totals
  });

  // Editing state
  const [editingCell, setEditingCell] = useState<{ projectId: number, field: string } | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success?: number;
    failed?: number;
    errors?: string[];
    sheets_found?: string[];
    sheet_count?: number;
  } | null>(null);

  // Fetch projects
  const { data: rawProjects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['commissioning-projects', fiscalYear, filters.planActual],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('fiscalYear', fiscalYear);
      if (filters.planActual && filters.planActual !== 'All') {
        params.append('plan_actual', filters.planActual);
      }
      const response = await fetch(`${API_BASE}/api/commissioning-projects?${params}`);
      if (!response.ok) throw new Error('Failed to fetch projects');
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Filter by User Scope
  const scopeFilteredProjects = useMemo(() => {
    // Admins see everything
    if (!user || user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') return rawProjects;

    const scope = user.scope || 'all';
    if (scope === 'all') return rawProjects;

    // Handle specific categories
    if (scope === 'solar') {
      return rawProjects.filter((p: CommissioningProject) => p.category.toLowerCase().includes('solar'));
    }
    if (scope === 'wind') {
      return rawProjects.filter((p: CommissioningProject) => p.category.toLowerCase().includes('wind'));
    }

    // Handle JSON Format (Composite Keys: Name|SPV|Location)
    if (scope.startsWith('{')) {
      try {
        const { category: cat, projects: keys } = JSON.parse(scope);
        if (keys && keys.length > 0) {
          return rawProjects.filter((p: any) => {
            if (!p.category.toLowerCase().includes(cat) && cat !== 'all') return false;
            const key = `${p.projectName}|${p.spv || ''}|${p.plotLocation || ''}`;
            return keys.includes(key);
          });
        }
        return rawProjects.filter((p: any) => p.category.toLowerCase().includes(cat));
      } catch (e) {
        console.error("Scope parsing failed", e);
        return [];
      }
    }

    // Handle project-specific access (Legacy: "solar:ProjectA,ProjectB")
    if (scope.includes(':')) {
      const [cat, projectsStr] = scope.split(':');
      const allowedProjects = projectsStr.split(',');
      return rawProjects.filter((p: CommissioningProject) =>
        p.category.toLowerCase().includes(cat) &&
        allowedProjects.includes(p.projectName)
      );
    }

    return rawProjects;
  }, [rawProjects, user]);

  // Deduplicate projects to prevent inflated summaries
  const projects = useMemo(() => {
    const seen = new Set();
    return scopeFilteredProjects.filter((p: CommissioningProject) => {
      const id = p.id || `${p.projectName}-${p.spv}-${p.plotLocation}`;
      const key = `${id}-${p.category}-${p.section}-${p.planActual}-${p.capacity}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [rawProjects]);

  // Rest of usage stays same ...


  // Fetch summaries
  const { data: summaries = [], isLoading: summariesLoading } = useQuery({
    queryKey: ['commissioning-summaries', fiscalYear, filters.planActual],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('fiscalYear', fiscalYear);
      if (filters.planActual && filters.planActual !== 'All') {
        params.append('plan_actual', filters.planActual);
      }
      const response = await fetch(`${API_BASE}/api/commissioning-summaries?${params}`);
      if (!response.ok) throw new Error('Failed to fetch summaries');
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch Master Data for dynamic categories
  const { data: masterData } = useQuery({
    queryKey: ['masterData', fiscalYear],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/api/dropdown-options?fiscalYear=${fiscalYear}`);
      if (!response.ok) throw new Error('Failed to fetch master data');
      return response.json();
    }
  });

  const categories = useMemo(() => {
    let validCats = ['Solar', 'Wind'];
    if (masterData?.categories && masterData.categories.length > 0) {
      validCats = masterData.categories;
    }

    // Filter categories based on user scope
    if (user && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      let scopeStr = user.scope || 'all';
      let scopeCat = 'all';

      // Parse JSON scope
      if (scopeStr.startsWith('{')) {
        try {
          scopeCat = JSON.parse(scopeStr).category;
        } catch (e) { }
      } else if (scopeStr !== 'all') {
        // Legacy scope
        if (scopeStr.includes(':')) scopeCat = scopeStr.split(':')[0];
        else scopeCat = scopeStr;
      }

      if (scopeCat === 'solar') return validCats.filter(c => c.toLowerCase().includes('solar'));
      if (scopeCat === 'wind') return validCats.filter(c => c.toLowerCase().includes('wind'));
    }

    return validCats;
  }, [masterData, user]);

  // Save projects mutation
  const saveProjectsMutation = useMutation({
    mutationFn: async (updatedProjects: CommissioningProject[]) => {
      const response = await fetch(`${API_BASE}/api/commissioning-projects?fiscalYear=${fiscalYear}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedProjects),
      });
      if (!response.ok) throw new Error('Failed to save projects');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commissioning-projects', fiscalYear] });
    },
  });

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // Toggle section expansion
  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const toggleAllSections = (expand: boolean) => {
    const allSections: Record<string, boolean> = {};
    if (expand) {
      projects.forEach((p: CommissioningProject) => {
        const mainCat = categories.find((c: string) => p.category.toLowerCase().includes(c.toLowerCase())) || 'Other';
        allSections[`${mainCat}-${p.section}`] = true;
      });
    }
    setExpandedSections(allSections);
  };

  // Expand all sections by default on load or when search changes
  useEffect(() => {
    if (projects.length > 0) {
      toggleAllSections(true);
    }
  }, [projects.length]);

  // Get unique values for filters
  const filterOptions = useMemo(() => {
    const projectTypes = [...new Set(projects.map((p: CommissioningProject) => p.projectType))] as string[];
    const planActuals = [...new Set(projects.map((p: CommissioningProject) => p.planActual))] as string[];
    const spvs = [...new Set(projects.map((p: CommissioningProject) => p.spv))] as string[];

    // Get all unique categories (original full names)
    const allCategories = [...new Set(projects.map((p: CommissioningProject) => p.category))] as string[];

    // Filter categories based on selected category type
    let filteredCategories = allCategories;
    if (filters.category) {
      filteredCategories = allCategories.filter(c => c.toLowerCase().includes(filters.category.toLowerCase()));
    }

    return {
      projectTypes,
      planActuals,
      spvs,
      filteredCategories
    };
  }, [projects, filters.category]);

  // Reset section when category changes
  const handleCategoryTypeChange = (newCategory: string) => {
    setFilters(prev => ({ ...prev, category: newCategory, section: '' }));
  };

  // Filtered projects - now filters by category TYPE (solar/wind) instead of exact match
  const filteredProjects = useMemo(() => {
    return projects.filter((p: CommissioningProject) => {
      // Filter by category
      if (filters.category && !p.category.toLowerCase().includes(filters.category.toLowerCase())) return false;
      if (filters.projectType && p.projectType !== filters.projectType) return false;
      if (filters.planActual && filters.planActual !== 'All') {
        const filterVal = filters.planActual === 'Actual/Fcst' ? 'Actual' : filters.planActual;
        if (p.planActual !== filterVal) return false;
      }
      if (filters.spv && p.spv !== filters.spv) return false;
      // Filter by section (exact category match)
      if (filters.section && p.category !== filters.section) return false;
      return true;
    });
  }, [projects, filters]);

  // Filter projects by tab - RESPECTS CAPACITY TYPE EXCLUSIVITY FROM BACKEND
  const tabProjects = useMemo(() => {
    let filtered = filteredProjects;
    if (activeTab !== 'overview') {
      filtered = filteredProjects.filter((p: CommissioningProject) =>
        p.category.toLowerCase().includes(activeTab.toLowerCase())
      );
    }

    // Backend already filtered by planActual, so capacity type is exclusive
    // Apply showExcluded toggle to respect section inclusion/exclusion
    if (!filters.showExcluded) {
      filtered = filtered.filter((p: CommissioningProject) => p.includedInTotal);
    }

    return filtered;
  }, [filteredProjects, activeTab, filters.showExcluded]);

  const [isGlobalExportOpen, setIsGlobalExportOpen] = useState(false);

  // Prepare records for bank-statement review
  const exportRecords = useMemo(() => {
    const records: any[] = [];
    tabProjects.forEach(p => {
      monthColumns.forEach((m, idx) => {
        const val = (p as any)[m];
        if (val && val !== 0) {
          records.push({
            'Project Name': p.projectName,
            'Year': fiscalYear.replace('FY_', ''),
            'Month': dynamicMonthLabels[idx],
            'Type': p.projectType,
            'Plan/Actual': p.planActual,
            'Capacity (MW)': val,
            'Section': p.section,
            'Verified': 'TRUE'
          });
        }
      });
    });
    return records;
  }, [tabProjects, fiscalYear, dynamicMonthLabels]);

  const handleGlobalDownload = () => {
    const wb = (XLSX.utils as any).book_new();
    const ws = (XLSX.utils as any).json_to_sheet(exportRecords);
    (XLSX.utils as any).book_append_sheet(wb, ws, "Verified_Commissioning");
    XLSX.writeFile(wb, `AGEL_Commissioning_Statement_${fiscalYear}.xlsx`);
    setIsGlobalExportOpen(false);
  };

  // Group projects by category and section
  const groupedProjects = useMemo(() => {
    const groups: Record<string, Record<string, CommissioningProject[]>> = {};

    tabProjects.forEach((p: CommissioningProject) => {
      // Find which main category this project belongs to
      const mainCat = categories.find((c: string) => p.category.toLowerCase().includes(c.toLowerCase())) || 'Other';

      if (!groups[mainCat]) groups[mainCat] = {};
      if (!groups[mainCat][p.section]) groups[mainCat][p.section] = [];
      groups[mainCat][p.section].push(p);
    });

    return groups;
  }, [tabProjects, categories]);

  // Calculate totals for a group of projects - ENFORCES RULES
  const calculateTotals = (projectsToSum: CommissioningProject[]) => {
    const totals: any = {
      capacity: 0,
      apr: 0, may: 0, jun: 0, jul: 0, aug: 0, sep: 0,
      oct: 0, nov: 0, dec: 0, jan: 0, feb: 0, mar: 0,
      totalCapacity: 0, cummTillOct: 0,
      q1: 0, q2: 0, q3: 0, q4: 0
    };

    projectsToSum.forEach((p: CommissioningProject) => {
      // CRITICAL: Only include projects marked as included_in_total
      if (!p.includedInTotal) return;

      totals.capacity += p.capacity || 0;
      monthColumns.forEach(month => {
        totals[month] += (p as any)[month] || 0;
      });
      // Backend already provides deterministic derived values
      totals.totalCapacity += p.totalCapacity || 0;
      totals.cummTillOct += p.cummTillOct || 0;
      totals.q1 += p.q1 || 0;
      totals.q2 += p.q2 || 0;
      totals.q3 += p.q3 || 0;
      totals.q4 += p.q4 || 0;
    });

    return totals;
  };

  // Calculate hierarchical totals - ENFORCES CAPACITY TYPE EXCLUSIVITY
  const calculateHierarchicalTotals = () => {
    // Backend already filters by planActual, so projects here are already capacity-type exclusive
    // Filter to only included projects
    const includedProjects = projects.filter((p: CommissioningProject) => p.includedInTotal);

    const totalsByCat: Record<string, any> = {};
    categories.forEach((cat: string) => {
      const catProjects = includedProjects.filter((p: CommissioningProject) =>
        p.category.toLowerCase().includes(cat.toLowerCase())
      );
      totalsByCat[cat.toLowerCase()] = calculateTotals(catProjects);
    });

    return {
      categories: totalsByCat,
      total: calculateTotals(includedProjects)
    };
  };

  const hierarchicalTotals = useMemo(() => calculateHierarchicalTotals(), [projects]);

  // Handle filter change
  const handleFilterChange = (key: string, value: string | boolean) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({ category: '', projectType: '', planActual: 'Plan', spv: '', section: '', showExcluded: true });
  };

  // Handle inline cell save
  const handleCellSave = (project: CommissioningProject, field: string, value: number | null) => {
    if (!isAdmin) {
      alert('You do not have permission to modify project data. Please login as an Admin.');
      return;
    }
    const updatedProject = { ...project, [field]: value };
    const updatedProjects = projects.map((p: CommissioningProject) =>
      p.id === project.id ? updatedProject : p
    );

    saveProjectsMutation.mutate(updatedProjects);
    setEditingCell(null);
  };

  // Handle delete project
  const handleDeleteProject = (projectId: number) => {
    if (!isAdmin) {
      alert('Only admin users can delete projects.');
      return;
    }

    if (!confirm('Are you sure you want to delete this project?')) return;

    const updatedProjects = projects.filter((p: CommissioningProject) => p.id !== projectId);
    saveProjectsMutation.mutate(updatedProjects);
  };

  // Format number for display
  const formatNumber = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '–';
    // Round to 1 decimal place to avoid floating-point errors, then check if whole
    const rounded = Math.round(value * 10) / 10;
    if (Number.isInteger(rounded)) {
      return rounded.toLocaleString();
    }
    return rounded.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  };

  // Handle Excel upload
  const handleExcelUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fiscalYear', fiscalYear);

      // Use the new upload-excel endpoint that reads all sheets
      const response = await fetch(`${API_BASE}/api/upload-excel`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setUploadResult({
          failed: data.failed || 0,
          errors: data.errors || data.parse_errors || [data.detail || 'Upload failed']
        });
      } else {
        setUploadResult({
          success: data.projects_imported || 0,
          failed: 0,
          errors: data.parse_errors || [],
          sheets_found: data.sheets_found,
          sheet_count: data.sheet_count
        });
        // Refresh ALL commissioning data across all pages
        queryClient.invalidateQueries({ queryKey: ['commissioning-projects'] });
        queryClient.invalidateQueries({ queryKey: ['commissioning-projects-all'] });
        queryClient.invalidateQueries({ queryKey: ['commissioning-summaries'] });
        queryClient.invalidateQueries({ queryKey: ['masterData'] });
      }
    } catch (error: any) {
      setUploadResult({
        failed: 0,
        errors: [error.message || 'Upload failed']
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadTemplate = () => {
    const headers = [
      ['S.No', 'Project Name', 'Category', 'Section', 'SPV', 'Type', 'Location',
        'Capacity (MW)', 'Plan/Actual', 'Included In Total (Yes/No)',
        'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']
    ];
    const sampleRow = [
      1, 'Sample Solar Project', 'Solar', 'A', 'SPV1', 'Plan', 'Khavda',
      100, 'Plan', 'Yes',
      10, 20, 30, 0, 0, 0, 0, 0, 0, 0, 40, 0
    ];
    const ws = (XLSX.utils as any).aoa_to_sheet([...headers, sampleRow]);
    const wb = (XLSX.utils as any).book_new();
    (XLSX.utils as any).book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'Commissioning_Upload_Template.xlsx');
  };

  const handleExportData = () => {
    const dataToExport = filteredProjects.map((p: { sno: any; projectName: any; category: any; section: any; spv: any; projectType: any; plotLocation: any; capacity: any; planActual: any; includedInTotal: any; apr: any; may: any; jun: any; jul: any; aug: any; sep: any; oct: any; nov: any; dec: any; jan: any; feb: any; mar: any; totalCapacity: any; }) => ({
      'S.No': p.sno,
      'Project Name': p.projectName,
      'Category': p.category,
      'Section': p.section,
      'SPV': p.spv,
      'Type': p.projectType,
      'Location': p.plotLocation,
      'Capacity': p.capacity,
      'Plan/Actual': p.planActual,
      'Included': p.includedInTotal ? 'Yes' : 'No',
      'Apr': p.apr, 'May': p.may, 'Jun': p.jun, 'Jul': p.jul, 'Aug': p.aug, 'Sep': p.sep,
      'Oct': p.oct, 'Nov': p.nov, 'Dec': p.dec, 'Jan': p.jan, 'Feb': p.feb, 'Mar': p.mar,
      'Total': p.totalCapacity
    }));

    const ws = (XLSX.utils as any).json_to_sheet(dataToExport);
    const wb = (XLSX.utils as any).book_new();
    (XLSX.utils as any).book_append_sheet(wb, ws, 'Projects');
    XLSX.writeFile(wb, `Commissioning_Status_${fiscalYear}.xlsx`);
  };

  // Loading state
  if (projectsLoading || summariesLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-600 dark:text-gray-300">Loading commissioning data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 min-h-screen bg-[#F5F7FA] dark:bg-gray-900 p-4 sm:p-6 rounded-lg">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-3">
          <Database className="w-5 h-5 text-[#0B74B0]" />
          Commissioning Project Records
        </h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsGlobalExportOpen(true)}
            className="flex items-center gap-2 px-6 py-2.5 text-xs font-black text-white bg-gradient-to-r from-[#0B74B0] to-[#04619b] rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 active:translate-y-0 uppercase tracking-widest"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Download Database Statement
          </button>
        </div>
      </div>

      {/* Tabs - Enhanced with icons and color coding */}
      <div className="border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <nav className="flex gap-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-6 py-3 text-sm font-bold transition-all relative ${activeTab === 'overview'
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
          >
            Overview
            {activeTab === 'overview' && (
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 dark:bg-indigo-400"></div>
            )}
          </button>
          {categories.map((cat: string) => (
            <button
              key={cat}
              onClick={() => setActiveTab(cat.toLowerCase())}
              className={`px-6 py-3 text-sm font-bold transition-all relative ${activeTab === cat.toLowerCase()
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
            >
              {cat}
              {activeTab === cat.toLowerCase() && (
                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 dark:bg-indigo-400"></div>
              )}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportData}
            className="flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors text-sm font-semibold border border-green-200 dark:border-green-800"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export
          </button>
          {/* Upload Excel Button - Admin Only */}
          {isAdmin && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M3 17a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2zm6-7a3 3 0 11-6 0 3 3 0 016 0zm4-5a1 1 0 11-2 0 1 1 0 012 0zm-1.464 3.536a1 1 0 001.414-1.414L9.172 6.05a1 1 0 10-1.414 1.414l2.121 2.122zM2.464 14.536a1 1 0 001.414 1.414l2.121-2.122a1 1 0 10-1.414-1.414l-2.121 2.122zm13.071-7.071a1 1 0 10-1.414-1.414l-2.121 2.121a1 1 0 101.414 1.414l2.121-2.121zM10 4a1 1 0 011-1h4a1 1 0 110 2h-4a1 1 0 01-1-1z" />
              </svg>
              Upload Excel
            </button>
          )}

          {/* Reset Data Button - Super Admin Only */}
          {isSuperAdmin && (
            <button
              onClick={async () => {
                if (confirm('Are you sure you want to RESET all commissioning data? This will clear all monthly values and cannot be undone.')) {
                  try {
                    const res = await fetch(`${API_BASE}/api/reset-commissioning-data`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ fiscalYear })
                    });
                    if (res.ok) {
                      alert('Data reset successfully.');
                      queryClient.invalidateQueries({ queryKey: ['commissioning-projects', fiscalYear] });
                    } else {
                      alert('Failed to reset data.');
                    }
                  } catch (e) {
                    alert('Error resetting data.');
                  }
                }
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              title="Clear all uploaded data"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Reset Data
            </button>
          )}
        </div>
      </div>

      {/* Filters - Responsive Grid */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 overflow-visible">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:flex xl:flex-wrap gap-6 items-end">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2">Category Filter</label>
            <select
              value={filters.category}
              onChange={(e) => handleCategoryTypeChange(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">▣ All Categories</option>
              {categories.map((cat: string) => (
                <option key={cat} value={cat.toLowerCase()}>● {cat}</option>
              ))}
            </select>
          </div>
          <div className="flex-2 min-w-[240px]">
            <label className="block text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2">Project Section</label>
            <select
              value={filters.section}
              onChange={(e) => handleFilterChange('section', e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">▥ All Sections</option>
              {filterOptions.filteredCategories.map((cat: string) => (
                <option key={cat} value={cat}>{getCategoryDisplayName(cat)}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2">Project Type</label>
            <select
              value={filters.projectType}
              onChange={(e) => handleFilterChange('projectType', e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">All Types</option>
              {filterOptions.projectTypes.map((type: string) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Capacity Point</label>
            <select
              value={filters.planActual}
              onChange={(e) => handleFilterChange('planActual', e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-bold text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500/20 outline-none shadow-sm"
            >
              <option value="All">All Points</option>
              <option value="Plan">Plan</option>
              <option value="Actual">Actual / Fcst</option>
            </select>
          </div>
          <div className="flex items-center pb-2">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  checked={filters.showExcluded}
                  onChange={(e) => handleFilterChange('showExcluded', e.target.checked)}
                  className="w-5 h-5 text-indigo-600 border-gray-300 rounded-lg focus:ring-indigo-500 cursor-pointer"
                />
              </div>
              <span className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wide group-hover:text-indigo-600 transition-colors">Show Excluded</span>
            </label>
          </div>
          <button
            onClick={clearFilters}
            className="px-6 py-2.5 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-rose-500 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-rose-200 transition-all active:scale-95"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Summary Cards - Minimalist Adani Style */}
      {activeTab === 'overview' && !filters.section && !filters.category && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-[#007B9E] to-[#005F7A] rounded-xl p-5 shadow-lg text-white relative overflow-hidden group hover:shadow-xl transition-all">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 20 20"><path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" /></svg>
            </div>
            <h3 className="text-[10px] font-bold text-white/80 uppercase tracking-wider mb-2">Total Included Capacity</h3>
            <p className="text-2xl sm:text-3xl font-bold text-white shadow-sm">{formatNumber(hierarchicalTotals.total.totalCapacity)} <span className="text-sm font-medium text-white/80">MW</span></p>
          </div>
          <div className="bg-gradient-to-br from-[#007B9E] to-[#6C2B85] rounded-xl p-5 shadow-lg text-white relative overflow-hidden group hover:shadow-xl transition-all">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h3 className="text-[10px] font-bold text-white/80 uppercase tracking-wider mb-2">Achieved (Overall)</h3>
            <p className="text-2xl sm:text-3xl font-bold text-white shadow-sm">{formatNumber(hierarchicalTotals.total.cummTillOct)} <span className="text-sm font-medium text-white/80">MW</span></p>
          </div>
          {categories.map((cat: string, idx: number) => {
            const catKey = cat.toLowerCase();
            const catTotals = hierarchicalTotals.categories[catKey] || calculateTotals([]);
            const colors = [
              'from-[#6C2B85] to-[#C02741]',
              'from-[#C02741] to-[#9E1F35]',
              'from-[#007B9E] to-[#005F7A]',
              'from-[#007B9E] to-[#6C2B85]'
            ];
            const color = colors[idx % colors.length];

            return (
              <div key={cat} className={`bg-gradient-to-br ${color} rounded-xl p-5 shadow-lg text-white relative overflow-hidden group hover:shadow-xl transition-all`}>
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                  <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" /></svg>
                </div>
                <h3 className="text-[10px] font-bold opacity-80 uppercase tracking-wider mb-2">Overall {cat}</h3>
                <p className="text-2xl sm:text-3xl font-bold text-white shadow-sm">{formatNumber(catTotals.totalCapacity)} <span className="text-sm font-medium opacity-80">MW</span></p>
              </div>
            );
          })}
        </div>
      )}

      {/* PDF-Style Summary Tables - Only show when no specific section/category is selected */}
      {activeTab === 'overview' && !filters.section && !filters.category && (
        <div className="space-y-6">
          {/* AGEL Overall FY Summary (All Categories) - NOW AT TOP */}
          <SummaryTable
            title={`AGEL Overall FY ${fiscalYear.replace('FY_', '').split('-').map((p, i) => i === 0 ? '20' + p : p).join('-')} ${categories.length > 0 ? `(${categories.map((_: string, i: number) => i + 1).join(' + ')})` : ''}`}
            projects={projects.filter((p: CommissioningProject) => p.includedInTotal)}
            monthColumns={monthColumns}
            monthLabels={dynamicMonthLabels}
            cummTillLabel={getCummTillLabel(fiscalYear)}
            formatNumber={formatNumber}
          />

          {categories.map((cat: string, idx: number) => (
            <SummaryTable
              key={cat}
              title={`${idx + 1}. AGEL Overall ${cat} FY ${fiscalYear.replace('FY_', '').split('-').map((p, i) => i === 0 ? '20' + p : p).join('-')}`}
              projects={projects.filter((p: CommissioningProject) =>
                p.category.toLowerCase().includes(cat.toLowerCase()) && p.includedInTotal
              )}
              monthColumns={monthColumns}
              monthLabels={dynamicMonthLabels}
              cummTillLabel={getCummTillLabel(fiscalYear)}
              formatNumber={formatNumber}
            />
          ))}
        </div>
      )}

      {/* Hierarchy Breadcrumb - Clean Style */}
      <div className={`rounded-lg p-3 text-xs font-semibold ${filters.section || filters.category
        ? 'bg-gray-100 dark:bg-gray-800 border-l-4 border-l-amber-500 text-gray-700 dark:text-gray-300'
        : 'bg-gray-100 dark:bg-gray-800 border-l-4 border-l-[#0B74B0] text-gray-700 dark:text-gray-300'
        }`}>
        <span className="opacity-60 uppercase tracking-wider">Commissioning Status</span>
        <span className="mx-2 text-gray-400">/</span>
        <span className="uppercase tracking-wider">AGEL Overall FY 2025–26</span>
        {filters.category && (
          <>
            <span className="mx-2 text-gray-400">/</span>
            <span className="text-[#0B74B0] dark:text-blue-400 uppercase tracking-wider font-bold">{filters.category}</span>
          </>
        )}
        {filters.section && (
          <>
            <span className="mx-2 text-gray-400">/</span>
            <span className="text-[#75479C] dark:text-purple-400 uppercase tracking-wider font-bold">{getCategoryDisplayName(filters.section)}</span>
          </>
        )}
      </div>

      {/* Projects Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {activeTab === 'overview' ? 'All Projects' : activeTab === 'solar' ? 'Solar Projects' : 'Wind Projects'}
          </h2>
          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              <button
                onClick={() => toggleAllSections(true)}
                className="text-xs font-bold text-[#0B74B0] dark:text-[#60a5fa] hover:text-[#095a87] dark:hover:text-blue-300 uppercase tracking-wider flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                Expand All
              </button>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <button
                onClick={() => toggleAllSections(false)}
                className="text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 uppercase tracking-wider flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                Collapse All
              </button>
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Showing {tabProjects.length} project(s)
            </span>
          </div>
        </div>
        <div className="overflow-x-auto overflow-y-auto max-h-[800px] border dark:border-gray-700 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 border-collapse">
            <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0 z-30 shadow-sm">
              <tr>
                <th className="sticky left-0 z-30 bg-gray-100 dark:bg-gray-800 px-2 py-3 text-center text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-r border-gray-200 dark:border-gray-700 w-[50px]">S.No.</th>
                <th className="sticky left-[50px] z-30 bg-gray-100 dark:bg-gray-800 px-3 py-3 text-left text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-r border-gray-200 dark:border-gray-700 min-w-[180px]">Project Name</th>
                <th className="px-3 py-3 text-left text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-r border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">SPV</th>
                <th className="px-2 py-3 text-center text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider border-b border-r border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 w-[40px]">Prio.</th>
                <th className="px-3 py-3 text-left text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-r border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">Type</th>
                <th className="px-3 py-3 text-left text-[10px) font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-r border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">Location</th>
                <th className="px-2 py-3 text-center text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-r border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 w-[60px]">Plot No</th>
                <th className="px-2 py-3 text-center text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-r border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 w-[70px]">Capacity</th>
                <th className="px-3 py-3 text-left text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-r border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 w-[110px]">Plan / Actual</th>
                <th className="px-2 py-3 text-center text-[9px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider border-b border-r border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 min-w-[80px]">Trial Run</th>
                <th className="px-2 py-3 text-center text-[9px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider border-b border-r border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 min-w-[80px]">Charging</th>
                <th className="px-2 py-3 text-center text-[9px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider border-b border-r border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 min-w-[80px]">COD</th>
                {dynamicMonthLabels.map((month, idx) => (
                  <th key={idx} className="px-2 py-3 text-center text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider border-b border-r border-gray-200 dark:border-gray-700 min-w-[75px]">{month}</th>
                ))}
                <th className="px-3 py-3 text-center text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider border-b border-r border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 min-w-[90px]">Total Capacity</th>
                <th className="px-3 py-3 text-center text-[10px] font-bold text-[#0B74B0] dark:text-blue-400 uppercase tracking-wider border-b border-r border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 min-w-[120px]">Cumm till 31-Oct-{fiscalYear.split('-')[0].replace('FY_', '')}</th>
                <th className="px-3 py-3 text-center text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider border-b border-r border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 min-w-[65px]">Q1</th>
                <th className="px-3 py-3 text-center text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider border-b border-r border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 min-w-[65px]">Q2</th>
                <th className="px-3 py-3 text-center text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider border-b border-r border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 min-w-[65px]">Q3</th>
                <th className="px-3 py-3 text-center text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider border-b border-r border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 min-w-[65px]">Q4</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
              {tabProjects.length === 0 ? (
                <tr>
                  <td colSpan={20} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    No projects found matching the current filters.
                  </td>
                </tr>
              ) : (
                Object.entries(groupedProjects).map(([category, sections]) => {
                  // Determine group config based on category name
                  const groupConfig = category.toLowerCase().includes('solar') ? HIERARCHY.SOLAR : HIERARCHY.WIND;

                  // Calculate group totals (e.g., Solar Total, Wind Total)
                  const allGroupProjects = Object.values(sections).flat().filter(p => p.includedInTotal);
                  const groupTotal = calculateTotals(allGroupProjects);

                  return (
                    <React.Fragment key={`group-${category}`}>
                      {/* Major Group Header - Minimal Style */}
                      <tr className="bg-gray-50 dark:bg-gray-800 border-y border-gray-200 dark:border-gray-700">
                        <td colSpan={24} className="px-4 py-2 text-xs font-bold text-gray-800 dark:text-white uppercase tracking-wider">
                          {groupConfig.title}
                        </td>
                      </tr>

                      {/* Iterate Sections present in data */}
                      {Object.keys(sections).sort().map(sectionName => {
                        const sectionProjects = sections[sectionName] || [];
                        if (sectionProjects.length === 0) return null;

                        const sectionTotal = calculateTotals(sectionProjects);
                        const anyIncluded = sectionProjects.some(p => p.includedInTotal);

                        return (
                          <React.Fragment key={`sec-${category}-${sectionName}`}>
                            <tr
                              className={`${groupConfig.bgLight} ${groupConfig.borderColor} border-l-4 cursor-pointer hover:brightness-95 transition-all`}
                              onClick={() => toggleSection(`${category}-${sectionName}`)}
                            >
                              <td colSpan={24} className={`px-4 py-3 text-sm font-bold ${groupConfig.textColor}`}>
                                <div className="flex items-center justify-between w-full">
                                  <span className="flex items-center gap-3">
                                    <span className={`transition-transform duration-200 ${expandedSections[`${category}-${sectionName}`] ? 'rotate-90' : ''}`}>
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                                      </svg>
                                    </span>
                                    <span className={`w-2 h-2 rounded-full ${category.toLowerCase().includes('solar') ? 'bg-orange-500' : 'bg-cyan-500'}`}></span>
                                    {getSectionDisplayName(sectionName)}
                                    {!anyIncluded && (
                                      <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300 rounded-full border border-gray-300 dark:border-gray-500 uppercase tracking-wider">
                                        Excluded (Display Only)
                                      </span>
                                    )}
                                    {anyIncluded && (
                                      <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded-full border border-green-200 dark:border-green-800 uppercase tracking-wider">
                                        ✓ Included in Total
                                      </span>
                                    )}
                                  </span>
                                  <span className="text-xs uppercase opacity-60 font-medium">
                                    {expandedSections[`${category}-${sectionName}`] ? 'Collapse' : 'Expand'} ({sectionProjects.length} Projects)
                                  </span>
                                </div>
                              </td>
                            </tr>

                            {/* Projects - with row merging for identical project groups */}
                            {expandedSections[`${category}-${sectionName}`] && (() => {
                              // Secondary grouping by project identity within the section
                              const projectsByIdentity: Record<string, CommissioningProject[]> = {};
                              sectionProjects.forEach(p => {
                                const idKey = `${p.projectName}-${p.spv}-${p.plotLocation}`;
                                if (!projectsByIdentity[idKey]) projectsByIdentity[idKey] = [];
                                projectsByIdentity[idKey].push(p);
                              });

                              return Object.entries(projectsByIdentity).map(([idKey, rows], groupIdx) => {
                                // 🛑 EXPLANATION: If user selects "All", we force 3 rows to match Excel.
                                // If they select a specific category (like "Plan"), we only show that row.
                                const showAll = filters.planActual === 'All' || !filters.planActual;
                                const statusesToShow = showAll ? ['Plan', 'Actual'] : [filters.planActual];

                                const displayRows = statusesToShow.map(status => {
                                  const existing = rows.find(r => r.planActual === status);
                                  if (existing) return existing;

                                  // Only create empty placeholders if we are in "Show All" mode
                                  if (!showAll) return null;

                                  return {
                                    ...rows[0],
                                    id: undefined,
                                    planActual: status,
                                    apr: 0, may: 0, jun: 0, jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0, jan: 0, feb: 0, mar: 0,
                                    totalCapacity: 0, cummTillOct: 0, q1: 0, q2: 0, q3: 0, q4: 0
                                  } as CommissioningProject;
                                }).filter(Boolean) as CommissioningProject[];

                                return displayRows.map((project, rowIdx) => (
                                  <tr
                                    key={project.id || `${category}-${sectionName}-${groupIdx}-${rowIdx}`}
                                    className={`
                                      ${!project.includedInTotal
                                        ? 'bg-gray-50/50 text-gray-400 dark:bg-gray-800/50 dark:text-gray-500'
                                        : groupIdx % 2 === 0
                                          ? 'bg-white dark:bg-gray-800'
                                          : 'bg-gray-50 dark:bg-gray-900'}
                                      text-gray-900 dark:text-gray-100
                                      border-b border-gray-100 dark:border-gray-700
                                      hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors
                                    `}
                                  >
                                    {/* IDENTITY COLUMNS - RENDERED ONLY FOR THE FIRST ROW OF THE GROUP */}
                                    {rowIdx === 0 && (
                                      <>
                                        <td rowSpan={displayRows.length} className="sticky left-0 z-10 bg-inherit px-2 py-2 text-xs font-bold text-gray-400 dark:text-gray-500 border-r border-gray-200 dark:border-gray-700 shadow-[2px_0_5px_rgba(0,0,0,0.05)] text-center align-middle w-[50px]">
                                          {project.sno}
                                        </td>
                                        <td rowSpan={displayRows.length} className="sticky left-[50px] z-10 bg-inherit px-3 py-2 text-xs whitespace-nowrap shadow-[2px_0_5px_rgba(0,0,0,0.05)] border-r border-gray-100 dark:border-gray-700 font-bold align-middle min-w-[180px]">
                                          {project.projectName}
                                        </td>
                                        <td rowSpan={displayRows.length} className="px-2 py-2 text-xs text-gray-600 dark:text-gray-400 align-middle border-r border-gray-100 dark:border-gray-800 font-bold text-indigo-600 dark:text-indigo-400 text-center">
                                          {project.priority || '-'}
                                        </td>
                                        <td rowSpan={displayRows.length} className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400 align-middle border-r border-gray-100 dark:border-gray-800">
                                          {project.spv}
                                        </td>
                                        <td rowSpan={displayRows.length} className="px-3 py-2 text-xs align-middle text-center border-r border-gray-100 dark:border-gray-800">
                                          <span className="font-medium text-gray-500">{project.projectType}</span>
                                        </td>
                                        <td rowSpan={displayRows.length} className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400 align-middle border-r border-gray-100 dark:border-gray-800 text-center">
                                          {project.plotLocation}
                                        </td>
                                        <td rowSpan={displayRows.length} className="px-2 py-2 text-xs text-gray-600 dark:text-gray-400 align-middle border-r border-gray-100 dark:border-gray-800 text-center font-bold">
                                          {project.plotNo || '-'}
                                        </td>
                                        <td rowSpan={displayRows.length} className="px-2 py-2 text-xs font-bold text-gray-900 dark:text-white align-middle text-center border-r border-gray-200 dark:border-gray-700 w-[70px]">
                                          {formatNumber(project.capacity)}
                                        </td>
                                      </>
                                    )}

                                    {/* DATA COLUMNS - RENDERED FOR EVERY ROW */}
                                    <td className="px-3 py-2 text-xs border-r border-gray-100 dark:border-gray-800">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${project.planActual === 'Plan' ? 'bg-slate-100 text-slate-600' : 'bg-green-100 text-green-700'}`}>
                                        {project.planActual === 'Actual' ? 'Actual/Fcst' : project.planActual}
                                      </span>
                                    </td>
                                    <td className="px-2 py-2 text-[10px] text-center text-purple-600 dark:text-purple-400 font-bold border-r border-gray-100 dark:border-gray-800 bg-purple-50/10 whitespace-nowrap">{project.trialRun || '-'}</td>
                                    <td className="px-2 py-2 text-[10px] text-center text-orange-600 dark:text-orange-400 font-bold border-r border-gray-100 dark:border-gray-800 bg-orange-50/10 whitespace-nowrap">{project.chargingPlan || '-'}</td>
                                    <td className="px-2 py-2 text-[10px] text-center text-sky-600 dark:text-sky-400 font-bold border-r border-gray-100 dark:border-gray-800 bg-sky-50/10 whitespace-nowrap">{project.codPlan || '-'}</td>
                                    {monthColumns.map(m => (
                                      <EditableCell
                                        key={m}
                                        project={project}
                                        field={m}
                                        value={(project as any)[m]}
                                        isEditing={editingCell?.projectId === project.id && editingCell?.field === m}
                                        onEdit={() => isAdmin && project.id && setEditingCell({ projectId: project.id, field: m })}
                                        onSave={(val) => handleCellSave(project, m, val)}
                                        onCancel={() => setEditingCell(null)}
                                        formatNumber={formatNumber}
                                        disabled={!project.includedInTotal || !project.id}
                                      />
                                    ))}
                                    <td className="px-3 py-2 text-xs text-center font-bold bg-gray-50/50 dark:bg-gray-900/50 border-x border-gray-100 dark:border-gray-800">{formatNumber(project.totalCapacity)}</td>
                                    <td className="px-3 py-2 text-xs text-center font-bold text-[#0B74B0] dark:text-blue-400 border-r border-gray-100 dark:border-gray-800">{formatNumber(project.cummTillOct)}</td>
                                    <td className="px-3 py-2 text-xs text-center text-gray-400 border-r border-gray-50 dark:border-gray-800">{formatNumber(project.q1)}</td>
                                    <td className="px-3 py-2 text-xs text-center text-gray-400 border-r border-gray-50 dark:border-gray-800">{formatNumber(project.q2)}</td>
                                    <td className="px-3 py-2 text-xs text-center text-gray-400 border-r border-gray-50 dark:border-gray-800">{formatNumber(project.q3)}</td>
                                    <td className="px-3 py-2 text-xs text-center text-gray-400">{formatNumber(project.q4)}</td>
                                  </tr>
                                ));
                              });
                            })()
                            }



                            {/* SECTION SUB-TOTAL - Minimalist */}
                            {
                              expandedSections[`${category}-${sectionName}`] && anyIncluded && (
                                <tr className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 font-bold text-[11px]">
                                  <td colSpan={9} className="px-3 py-2 text-right text-gray-400">Section Subtotal:</td>
                                  <td className="px-3 py-2">{formatNumber(sectionTotal.capacity)}</td>
                                  <td className="px-3 py-2"></td> {/* Empty for Plan/Actual column */}
                                  {monthColumns.map(m => <td key={m} className="px-2 py-2 text-center">{formatNumber(sectionTotal[m])}</td>)}
                                  <td className="px-3 py-2 text-center">{formatNumber(sectionTotal.totalCapacity)}</td>
                                  <td className="px-3 py-2 text-center text-[#0B74B0] dark:text-blue-400">{formatNumber(sectionTotal.cummTillOct)}</td>
                                  <td className="px-3 py-2 text-center text-gray-500">{formatNumber(sectionTotal.q1)}</td>
                                  <td className="px-3 py-2 text-center text-gray-500">{formatNumber(sectionTotal.q2)}</td>
                                  <td className="px-3 py-2 text-center text-gray-500">{formatNumber(sectionTotal.q3)}</td>
                                  <td className="px-3 py-2 text-center text-gray-500">{formatNumber(sectionTotal.q4)}</td>
                                </tr>
                              )
                            }
                          </React.Fragment>
                        );
                      })}

                      {/* GROUP TOTAL - Minimalist Style */}
                      <tr className="bg-gray-100 dark:bg-gray-900 border-t border-gray-300 dark:border-gray-700 font-bold text-xs">
                        <td colSpan={9} className="px-3 py-2 text-right uppercase text-gray-500">
                          Total {category}:
                        </td>
                        <td className="px-3 py-2 font-bold">{formatNumber(groupTotal.capacity)}</td>
                        <td className="px-3 py-2"></td> {/* Empty for Plan/Actual column */}
                        {monthColumns.map(m => <td key={m} className="px-2 py-2 text-center">{formatNumber(groupTotal[m])}</td>)}
                        <td className="px-3 py-2 text-center font-bold">{formatNumber(groupTotal.totalCapacity)}</td>
                        <td className="px-3 py-2 text-center text-[#0B74B0] dark:text-blue-400 font-bold">{formatNumber(groupTotal.cummTillOct)}</td>
                        <td className="px-3 py-2 text-center">{formatNumber(groupTotal.q1)}</td>
                        <td className="px-3 py-2 text-center">{formatNumber(groupTotal.q2)}</td>
                        <td className="px-3 py-2 text-center">{formatNumber(groupTotal.q3)}</td>
                        <td className="px-3 py-2 text-center">{formatNumber(groupTotal.q4)}</td>
                      </tr>
                    </React.Fragment>
                  );
                })
              )}

              {/* GRAND TOTAL ROW */}
              {(tabProjects.length > 0) && (
                (() => {
                  const grandTotal = calculateTotals(tabProjects.filter((p: { includedInTotal: any; }) => p.includedInTotal));
                  return (
                    <tr className="sticky bottom-0 z-40 bg-gray-900 text-white font-bold text-xs">
                      <td colSpan={9} className="px-3 py-3 text-right uppercase tracking-wider">
                        AGEL Overall Total:
                      </td>
                      <td className="px-3 py-3 font-bold">{formatNumber(grandTotal.capacity)}</td>
                      <td className="px-3 py-3"></td> {/* Empty for Plan/Actual column */}
                      {monthColumns.map(m => <td key={m} className="px-2 py-3 text-center">{formatNumber(grandTotal[m])}</td>)}
                      <td className="px-3 py-3 text-center font-bold">{formatNumber(grandTotal.totalCapacity)}</td>
                      <td className="px-3 py-3 text-center text-blue-400 font-bold">{formatNumber(grandTotal.cummTillOct)}</td>
                      <td className="px-3 py-3 text-center text-gray-400">{formatNumber(grandTotal.q1)}</td>
                      <td className="px-3 py-3 text-center text-gray-400">{formatNumber(grandTotal.q2)}</td>
                      <td colSpan={1} className="px-3 py-3 text-center text-gray-400">{formatNumber(grandTotal.q3)}</td>
                      <td className="px-3 py-3 text-center text-gray-400">{formatNumber(grandTotal.q4)}</td>
                    </tr>
                  );
                })()
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal removed in favor of inline editing */}

      {/* Upload Excel Modal */}
      {
        showUploadModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Upload Commissioning Excel</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Supports consolidated Excel (.xlsx) or Summary CSV files. {" "}
                  <button onClick={handleDownloadTemplate} className="text-[#0B74B0] dark:text-[#60a5fa] hover:underline font-medium inline-flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Download Template
                  </button>
                </p>
              </div>

              <div className="p-6 space-y-4">
                {uploading ? (
                  <div className="py-12 flex flex-col items-center justify-center space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 animate-pulse">
                      Processing your file, please wait...
                    </p>
                  </div>
                ) : !uploadResult ? (
                  <>
                    <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all cursor-pointer group">
                      <input
                        type="file"
                        accept=".xlsx,.csv"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const ext = file.name.split('.').pop()?.toLowerCase();
                            if (ext !== 'xlsx' && ext !== 'csv') {
                              alert('Only .xlsx and .csv files are accepted');
                              return;
                            }
                            handleExcelUpload(file);
                          }
                        }}
                        className="hidden"
                        id="excel-upload"
                      />
                      <label htmlFor="excel-upload" className="cursor-pointer block">
                        <div className="bg-blue-100 dark:bg-blue-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[#0B74B0] dark:text-[#60a5fa]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                          </svg>
                        </div>
                        <p className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                          Click to upload or drag and drop
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Supports .xlsx workbooks and .csv files
                        </p>
                      </label>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg flex items-start space-x-3">
                      <svg className="h-5 w-5 text-blue-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                        <strong>Pro Tip:</strong> You can upload the consolidated Excel file to update all data at once, or just the Summary CSV for project updates.
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    {/* Results Heading */}
                    <div className={uploadResult.success !== undefined && uploadResult.success > 0 ? "bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-100 dark:border-green-800" : "bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border border-orange-100 dark:border-orange-800"}>
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-full ${uploadResult.success !== undefined && uploadResult.success > 0 ? "bg-green-100 dark:bg-green-800" : "bg-orange-100 dark:bg-orange-800"}`}>
                          {uploadResult.success !== undefined && uploadResult.success > 0 ? (
                            <svg className="h-5 w-5 text-green-600 dark:text-green-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="h-5 w-5 text-orange-600 dark:text-orange-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <p className={`text-sm font-bold ${uploadResult.success !== undefined && uploadResult.success > 0 ? "text-green-800 dark:text-green-400" : "text-orange-800 dark:text-orange-400"}`}>
                            {uploadResult.success !== undefined && uploadResult.success > 0
                              ? `Import Successful`
                              : `No data imported`}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {uploadResult.success || 0} projects identified
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    {uploadResult.sheets_found && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700 text-center">
                          <p className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 mb-1">Files/Tabs</p>
                          <p className="text-lg font-bold text-gray-900 dark:text-white">{uploadResult.sheet_count || 0}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700 text-center">
                          <p className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 mb-1">Summaries</p>
                          <p className="text-lg font-bold text-gray-900 dark:text-white">{(uploadResult as any).summaries_imported || 0}</p>
                        </div>
                      </div>
                    )}

                    {/* Errors if any */}
                    {uploadResult.errors && uploadResult.errors.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Issues Encountered:</p>
                        <div className="bg-red-50 dark:bg-red-900/10 p-3 rounded-lg border border-red-100 dark:border-red-900/30">
                          <ul className="text-[11px] text-red-700 dark:text-red-400 space-y-1">
                            {uploadResult.errors.slice(0, 3).map((err, idx) => (
                              <li key={idx} className="flex items-start">
                                <span className="mr-2">•</span>
                                <span>{err}</span>
                              </li>
                            ))}
                            {uploadResult.errors.length > 3 && (
                              <li className="font-medium text-[10px] mt-1 italic">
                                + {uploadResult.errors.length - 3} more technical issues...
                              </li>
                            )}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadResult(null);
                  }}
                  disabled={uploading}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50"
                >
                  {uploadResult ? 'Close' : 'Cancel'}
                </button>
              </div>

            </div>
          </div>
        )
      }
    </div>
  );
}

// Inline Editable Cell Component
interface EditableCellProps {
  key?: string | number;
  project: CommissioningProject;
  field: string;
  value: number | null;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (value: number | null) => void;
  onCancel: () => void;
  formatNumber: (value: number | null) => string;
  disabled: boolean;
}

function EditableCell({ value, isEditing, onEdit, onSave, onCancel, formatNumber, disabled }: EditableCellProps) {
  const [tempValue, setTempValue] = useState(value?.toString() || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      setTempValue(value === null || value === undefined ? '' : value.toString());
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isEditing, value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const num = tempValue === '' ? null : parseFloat(tempValue);
      onSave(num);
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  const handleBlur = () => {
    const num = tempValue === '' ? null : parseFloat(tempValue);
    if (num !== value) {
      onSave(num);
    } else {
      onCancel();
    }
  };

  if (isEditing) {
    return (
      <td className="px-1 py-1 border border-blue-500 shadow-inner bg-white">
        <input
          ref={inputRef}
          type="number"
          step="0.1"
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="w-full h-full text-center text-xs outline-none font-bold"
        />
      </td>
    );
  }

  return (
    <td
      onClick={onEdit}
      className={`px-2 py-2 text-xs text-center border-r border-gray-100 dark:border-gray-800 transition-colors cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 ${disabled ? 'opacity-30' : 'text-gray-700 dark:text-gray-300 font-medium'}`}
    >
      {formatNumber(value)}
    </td>
  );
}