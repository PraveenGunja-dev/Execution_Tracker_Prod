
import { useState, useEffect } from 'react';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';

export function GlobalLoader() {
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();

  const isLoading = isFetching > 0 || isMutating > 0;

  if (!isLoading) return null;

  return (
    <div className="fixed top-4 right-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 flex items-center space-x-3">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Loading...
        </span>
      </div>
    </div>
  );
}