import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../config';

// API functions
const api = {
  getTableData: async (fiscalYear: string) => {
    const response = await fetch(`${API_BASE}/api/table-data?fiscalYear=${fiscalYear}`);
    if (!response.ok) {
      throw new Error('Failed to fetch table data');
    }
    return response.json();
  },

  saveTableData: async (fiscalYear: string, data: any) => {
    const response = await fetch(`${API_BASE}/api/table-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fiscalYear, data }),
    });
    if (!response.ok) {
      throw new Error('Failed to save table data');
    }
    return response.json();
  },

  getDropdownOptions: async (fiscalYear: string) => {
    const response = await fetch(`${API_BASE}/api/dropdown-options?fiscalYear=${fiscalYear}`);
    if (!response.ok) {
      throw new Error('Failed to fetch dropdown options');
    }
    return response.json();
  },

  saveDropdownOptions: async (fiscalYear: string, options: any) => {
    const response = await fetch(`${API_BASE}/api/dropdown-options?fiscalYear=${fiscalYear}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
    });
    if (!response.ok) {
      throw new Error('Failed to save dropdown options');
    }
    return response.json();
  },

  getLocationRelationships: async (fiscalYear: string) => {
    const response = await fetch(`${API_BASE}/api/location-relationships?fiscalYear=${fiscalYear}`);
    if (!response.ok) {
      throw new Error('Failed to fetch location relationships');
    }
    return response.json();
  },

  saveLocationRelationships: async (fiscalYear: string, relationships: any) => {
    const response = await fetch(`${API_BASE}/api/location-relationships?fiscalYear=${fiscalYear}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(relationships),
    });
    if (!response.ok) {
      throw new Error('Failed to save location relationships');
    }
    return response.json();
  },

  saveSingleDropdownOption: async (fiscalYear: string, optionType: string, optionValue: string) => {
    const response = await fetch(`${API_BASE}/api/dropdown-option`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fiscalYear, optionType, optionValue }),
    });
    if (!response.ok) {
      throw new Error('Failed to save dropdown option');
    }
    return response.json();
  },
};

// Custom hook for table data
export function useTableData(fiscalYear: string) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['tableData', fiscalYear],
    queryFn: () => api.getTableData(fiscalYear),
    enabled: !!fiscalYear, // Only fetch when fiscalYear is provided
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    data: data?.data || [],
    isLoading,
    error,
    refetch,
  };
}

// Custom hook for dropdown options
export function useDropdownOptions(fiscalYear: string) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dropdownOptions', fiscalYear],
    queryFn: () => api.getDropdownOptions(fiscalYear),
    enabled: !!fiscalYear, // Only fetch when fiscalYear is provided
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    data: data || {},
    isLoading,
    error,
    refetch,
  };
}

// Custom hook for location relationships
export function useLocationRelationships(fiscalYear: string) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['locationRelationships', fiscalYear],
    queryFn: () => api.getLocationRelationships(fiscalYear),
    enabled: !!fiscalYear, // Only fetch when fiscalYear is provided
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    data: data || [],
    isLoading,
    error,
    refetch,
  };
}

// Custom hook for saving table data with mutation
export function useSaveTableData() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ fiscalYear, data }: { fiscalYear: string; data: any }) =>
      api.saveTableData(fiscalYear, data),
    onSuccess: (data, variables) => {
      // Invalidate and refetch the specific table data
      queryClient.invalidateQueries({ queryKey: ['tableData', variables.fiscalYear] });
    },
  });

  return mutation;
}

// Custom hook for saving dropdown options with mutation
export function useSaveDropdownOptions() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ fiscalYear, options }: { fiscalYear: string; options: any }) =>
      api.saveDropdownOptions(fiscalYear, options),
    onSuccess: (data, variables) => {
      // Invalidate and refetch the specific dropdown options
      queryClient.invalidateQueries({ queryKey: ['dropdownOptions', variables.fiscalYear] });
    },
  });

  return mutation;
}

// Custom hook for saving location relationships with mutation
export function useSaveLocationRelationships() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ fiscalYear, relationships }: { fiscalYear: string; relationships: any }) =>
      api.saveLocationRelationships(fiscalYear, relationships),
    onSuccess: (data, variables) => {
      // Invalidate and refetch the specific location relationships
      queryClient.invalidateQueries({ queryKey: ['locationRelationships', variables.fiscalYear] });
    },
  });

  return mutation;
}

// Custom hook for saving a single dropdown option with mutation
export function useSaveSingleDropdownOption() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ fiscalYear, optionType, optionValue }: { fiscalYear: string; optionType: string; optionValue: string }) =>
      api.saveSingleDropdownOption(fiscalYear, optionType, optionValue),
    onSuccess: (data, variables) => {
      // Invalidate and refetch the specific dropdown options
      queryClient.invalidateQueries({ queryKey: ['dropdownOptions', variables.fiscalYear] });
    },
  });

  return mutation;
}

// Custom hook for debounced search
export function useDebounce(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}