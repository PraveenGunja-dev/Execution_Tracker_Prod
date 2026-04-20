
import React, { useState } from 'react';
import { ExportReviewModal } from './ExportReviewModal';
import * as XLSX from 'xlsx';

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
}

interface SummaryTableProps {
    key?: string | number;
    title: string;
    projects: CommissioningProject[];
    monthColumns: string[];
    monthLabels: string[];
    cummTillLabel?: string;
    formatNumber: (value: number | null | undefined) => string;
}

export function SummaryTable({ title, projects, monthColumns, monthLabels, cummTillLabel, formatNumber }: SummaryTableProps) {
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);

    // Group projects by planActual and projectType
    const aggregateByType = (projs: CommissioningProject[], planActual: string) => {
        const filtered = projs.filter(p => p.planActual === planActual);

        const types = ['PPA', 'Merchant', 'Group'];
        const byType: Record<string, any> = {};

        types.forEach(type => {
            const typeProjs = filtered.filter(p => p.projectType === type);
            if (typeProjs.length === 0) return;

            byType[type] = {
                apr: typeProjs.reduce((s, p) => s + (p.apr || 0), 0),
                may: typeProjs.reduce((s, p) => s + (p.may || 0), 0),
                jun: typeProjs.reduce((s, p) => s + (p.jun || 0), 0),
                jul: typeProjs.reduce((s, p) => s + (p.jul || 0), 0),
                aug: typeProjs.reduce((s, p) => s + (p.aug || 0), 0),
                sep: typeProjs.reduce((s, p) => s + (p.sep || 0), 0),
                oct: typeProjs.reduce((s, p) => s + (p.oct || 0), 0),
                nov: typeProjs.reduce((s, p) => s + (p.nov || 0), 0),
                dec: typeProjs.reduce((s, p) => s + (p.dec || 0), 0),
                jan: typeProjs.reduce((s, p) => s + (p.jan || 0), 0),
                feb: typeProjs.reduce((s, p) => s + (p.feb || 0), 0),
                mar: typeProjs.reduce((s, p) => s + (p.mar || 0), 0),
                totalCapacity: typeProjs.reduce((s, p) => s + (p.totalCapacity || 0), 0),
                cummTillOct: typeProjs.reduce((s, p) => s + (p.cummTillOct || 0), 0),
                q1: typeProjs.reduce((s, p) => s + (p.q1 || 0), 0),
                q2: typeProjs.reduce((s, p) => s + (p.q2 || 0), 0),
                q3: typeProjs.reduce((s, p) => s + (p.q3 || 0), 0),
                q4: typeProjs.reduce((s, p) => s + (p.q4 || 0), 0),
            };
        });

        const total = {
            apr: filtered.reduce((s, p) => s + (p.apr || 0), 0),
            may: filtered.reduce((s, p) => s + (p.may || 0), 0),
            jun: filtered.reduce((s, p) => s + (p.jun || 0), 0),
            jul: filtered.reduce((s, p) => s + (p.jul || 0), 0),
            aug: filtered.reduce((s, p) => s + (p.aug || 0), 0),
            sep: filtered.reduce((s, p) => s + (p.sep || 0), 0),
            oct: filtered.reduce((s, p) => s + (p.oct || 0), 0),
            nov: filtered.reduce((s, p) => s + (p.nov || 0), 0),
            dec: filtered.reduce((s, p) => s + (p.dec || 0), 0),
            jan: filtered.reduce((s, p) => s + (p.jan || 0), 0),
            feb: filtered.reduce((s, p) => s + (p.feb || 0), 0),
            mar: filtered.reduce((s, p) => s + (p.mar || 0), 0),
            totalCapacity: filtered.reduce((s, p) => s + (p.totalCapacity || 0), 0),
            cummTillOct: filtered.reduce((s, p) => s + (p.cummTillOct || 0), 0),
            q1: filtered.reduce((s, p) => s + (p.q1 || 0), 0),
            q2: filtered.reduce((s, p) => s + (p.q2 || 0), 0),
            q3: filtered.reduce((s, p) => s + (p.q3 || 0), 0),
            q4: filtered.reduce((s, p) => s + (p.q4 || 0), 0),
        };

        return { byType, total };
    };

    const planData = aggregateByType(projects, 'Plan');
    const actualData = aggregateByType(projects, 'Actual/Fcst');

    if (actualData.total.totalCapacity === 0) {
        const actualInternal = aggregateByType(projects, 'Actual');
        actualData.byType = actualInternal.byType;
        actualData.total = actualInternal.total;
    }

    const renderRow = (label: string, data: any, rowClass: string = '', key?: string) => (
        <tr key={key} className={`transition-colors ${rowClass}`}>
            <td className="px-4 py-3 text-[10px] font-bold text-gray-700 dark:text-gray-300 whitespace-nowrap uppercase tracking-wider">{label}</td>

            {/* Milestones - REMOVED */}

            {monthColumns.map(m => (
                <td key={m} className={`px-2 py-3 text-[10px] text-center ${data[m] ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-400'}`}>
                    {formatNumber(data[m])}
                </td>
            ))}
            <td className="px-2 py-3 text-[10px] text-center font-black text-gray-900 dark:text-white bg-gray-50/30 dark:bg-gray-900/20">{formatNumber(data.totalCapacity)}</td>
            <td className="px-2 py-3 text-[10px] text-center font-black text-[#0B74B0] dark:text-blue-400 bg-blue-50/20 dark:bg-blue-900/10 border-x border-blue-50 dark:border-blue-900/20">{formatNumber(data.cummTillOct)}</td>
            <td className="px-2 py-3 text-[10px] text-center font-bold text-gray-500">{formatNumber(data.q1)}</td>
            <td className="px-2 py-3 text-[10px] text-center font-bold text-gray-500">{formatNumber(data.q2)}</td>
            <td className="px-2 py-3 text-[10px] text-center font-bold text-gray-500">{formatNumber(data.q3)}</td>
            <td className="px-2 py-3 text-[10px] text-center font-bold text-gray-500">{formatNumber(data.q4)}</td>
        </tr>
    );

    // SQL-style raw data for bank statement review
    const exportRecords = (() => {
        const records: any[] = [];
        projects.forEach(p => {
            monthColumns.forEach((m, idx) => {
                const val = (p as any)[m];
                if (val && val !== 0) {
                    records.push({
                        'Project Name': p.projectName,
                        'Year': title.includes('25-26') ? '2025-26' : '2024-25',
                        'Month': monthLabels[idx],
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
    })();

    const handleActualDownload = () => {
        const wb = (XLSX.utils as any).book_new();

        // Sheet 1: Aggregated Summary
        const summaryRows: any[] = [];
        const buildSummaryRow = (label: string, data: any) => {
            const row: any = { 'PLAN / ACTUAL': label };
            monthColumns.forEach((m, idx) => { row[monthLabels[idx]] = data[m] || 0; });
            row['TOTAL CAPACITY'] = data.totalCapacity || 0;
            row[cummTillLabel || 'CUMM TILL DATE'] = data.cummTillOct || 0;
            row['Q1'] = data.q1 || 0; row['Q2'] = data.q2 || 0; row['Q3'] = data.q3 || 0; row['Q4'] = data.q4 || 0;
            return row;
        };

        summaryRows.push(buildSummaryRow('PLAN TOTAL', planData.total));
        Object.entries(planData.byType).forEach(([type, data]) => summaryRows.push(buildSummaryRow(`  ${type}`, data)));
        summaryRows.push(buildSummaryRow('ACTUAL TOTAL', actualData.total));
        Object.entries(actualData.byType).forEach(([type, data]) => summaryRows.push(buildSummaryRow(`  ${type}`, data)));

        const wsSummary = (XLSX.utils as any).json_to_sheet(summaryRows);
        (XLSX.utils as any).book_append_sheet(wb, wsSummary, "Dashboard_View");

        // Sheet 2: Raw Records
        const wsDetailed = (XLSX.utils as any).json_to_sheet(exportRecords);
        (XLSX.utils as any).book_append_sheet(wb, wsDetailed, "Raw_Data_Statement");

        XLSX.writeFile(wb, `${title.replace(/[^a-zA-Z0-9]/g, '_')}_Statement.xlsx`);
        setIsExportModalOpen(false);
    };

    return (
        <div className="bg-white dark:bg-gray-950 rounded-[2rem] border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
            <div className="bg-gradient-to-r from-gray-50/50 to-white dark:from-gray-900/50 dark:to-gray-950 border-b border-gray-100 dark:border-gray-800 px-6 py-4 flex items-center justify-between">
                <h3 className="text-sm font-black text-[#1F2937] dark:text-gray-100 uppercase tracking-[0.1em]">{title}</h3>
                <button
                    onClick={() => setIsExportModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-[#0B74B0] to-[#0d8ed1] rounded-xl hover:from-[#095a8a] hover:to-[#0B74B0] transition-all shadow-sm hover:shadow-md"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Export Statement
                </button>
            </div>
            <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800">
                <table className="min-w-full text-[10px] border-collapse">
                    <thead className="bg-[#F9FAFB] dark:bg-gray-900/50">
                        <tr>
                            <th className="px-4 py-3 text-left text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800">PLAN / ACTUAL</th>
                            {monthLabels.map((m, idx) => (
                                <th key={idx} className="px-2 py-3 text-center text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800">{m}</th>
                            ))}
                            <th className="px-2 py-3 text-center text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800">TOTAL CAPACITY</th>
                            <th className="px-2 py-3 text-center text-[9px] font-black text-[#0B74B0] dark:text-blue-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800">{cummTillLabel || 'CUMM TILL DATE'}</th>
                            <th className="px-2 py-3 text-center text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800">Q1</th>
                            <th className="px-2 py-3 text-center text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800">Q2</th>
                            <th className="px-2 py-3 text-center text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800">Q3</th>
                            <th className="px-2 py-3 text-center text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800">Q4</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-900">
                        {renderRow('Plan', planData.total, 'bg-[#0B74B0]/15 dark:bg-[#0B74B0]/20 font-black text-[#0B74B0] dark:text-[#4DA8D8] border-l-4 border-l-[#0B74B0]')}
                        {Object.entries(planData.byType).map(([type, data]) => renderRow(type, data, 'hover:bg-gray-50/50 dark:hover:bg-gray-900/20 pl-6', `plan-${type}`))}
                        {renderRow('Actual / Fcst', actualData.total, 'bg-[#75479C]/15 dark:bg-[#75479C]/20 font-black text-[#75479C] dark:text-[#D8B4FE] border-l-4 border-l-[#75479C]')}
                        {Object.entries(actualData.byType).map(([type, data]) => renderRow(type, data, 'hover:bg-gray-50/50 dark:hover:bg-gray-900/20 pl-6', `actual-${type}`))}
                    </tbody>
                </table>
            </div>

            <ExportReviewModal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                onConfirm={handleActualDownload}
                title={title}
                data={exportRecords}
                headers={['Project Name', 'Year', 'Month', 'Type', 'Plan/Actual', 'Capacity (MW)', 'Section']}
            />
        </div>
    );
}
