import React from 'react';

interface DataTableProps {
  fiscalYear?: string;
  data?: any[];
  columns?: any[];
}

const DataTable: React.FC<DataTableProps> = ({ 
  fiscalYear = 'FY_25', 
  data = [], 
  columns = [] 
}) => {
  // Sample data for testing
  const sampleData = [
    { id: 1, project: 'Solar Project A', capacity: '100 MW', status: 'Active', location: 'Gujarat' },
    { id: 2, project: 'Wind Project B', capacity: '50 MW', status: 'Planning', location: 'Tamil Nadu' },
    { id: 3, project: 'Solar Project C', capacity: '200 MW', status: 'Under Construction', location: 'Rajasthan' },
    { id: 4, project: 'Hybrid Project D', capacity: '150 MW', status: 'Operational', location: 'Karnataka' },
  ];

  const displayedData = data.length > 0 ? data : sampleData;

  // Sample columns for testing
  const sampleColumns = [
    { key: 'id', label: 'ID', className: 'px-4 py-2 text-left' },
    { key: 'project', label: 'Project Name', className: 'px-4 py-2 text-left' },
    { key: 'capacity', label: 'Capacity', className: 'px-4 py-2 text-left' },
    { key: 'status', label: 'Status', className: 'px-4 py-2 text-left' },
    { key: 'location', label: 'Location', className: 'px-4 py-2 text-left' },
  ];

  const displayedColumns = columns.length > 0 ? columns : sampleColumns;

  return (
    <div className="overflow-x-auto border rounded-lg">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-100 dark:bg-gray-700">
          <tr>
            {displayedColumns.map((column, index) => (
              <th 
                key={index} 
                className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {displayedData.map((row, rowIndex) => (
            <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-850'}>
              {displayedColumns.map((column, colIndex) => (
                <td 
                  key={colIndex} 
                  className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap"
                >
                  {row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DataTable;