import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const getCurrentFiscalYear = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth(); // 0 is jan, 3 is apr

  // FY starts April 1st (month index 3)
  const startYear = month >= 3 ? year : year - 1;
  const startYearShort = startYear.toString().slice(-2);
  const endYearShort = (startYear + 1).toString().slice(-2);

  return `FY_${startYearShort}-${endYearShort}`;
};

export const getCummTillLabel = (fy: string) => {
  const now = new Date();
  // Get yesterday's date
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  let startYearShort = 25;
  if (fy.includes('_')) {
    startYearShort = parseInt(fy.split('_')[1].split('-')[0]);
  } else if (fy.includes('-')) {
    startYearShort = parseInt(fy.split('-')[0].slice(-2));
  }
  const fyStartYear = startYearShort + 2000;
  const fyEndYear = fyStartYear + 1;

  const fyStartDate = new Date(fyStartYear, 3, 1); // April 1st
  const fyEndDate = new Date(fyEndYear, 2, 31); // March 31st

  // If yesterday is before fiscal year start, show end of previous FY
  if (yesterday < fyStartDate) {
    return `CUMM TILL 31-MAR-${(fyStartYear - 1).toString().slice(-2)}`;
  }
  // If yesterday is after fiscal year end, show end of current FY
  if (yesterday > fyEndDate) {
    return `CUMM TILL 31-MAR-${fyEndYear.toString().slice(-2)}`;
  }

  // Format yesterday's date
  const day = yesterday.getDate();
  const monthName = yesterday.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const yearShort = yesterday.getFullYear().toString().slice(-2);

  return `CUMM TILL ${day}-${monthName}-${yearShort}`;
};

// Helper to parse scope string
export const parseScopeString = (scope: string | null): { category: string; projects: string[] } => {
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
  if (scope.includes(':')) {
    const [category, projectsStr] = scope.split(':');
    return { category, projects: projectsStr ? projectsStr.split(',') : [] };
  }

  return { category: scope, projects: [] };
};

// Helper to format scope to display
export const formatScopeDisplay = (scope: string | null): string => {
  if (!scope || scope === 'all') return 'Global (All)';
  if (scope === 'solar') return 'Solar (All Projects)';
  if (scope === 'wind') return 'Wind (All Projects)';

  const { category, projects } = parseScopeString(scope);
  const catDisplay = category.charAt(0).toUpperCase() + category.slice(1);

  if (projects.length === 0) return `${catDisplay} (All Projects)`;
  return `${catDisplay}: ${projects.length} specific projects`;
};

