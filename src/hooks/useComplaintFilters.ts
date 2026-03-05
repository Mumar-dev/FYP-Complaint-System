import { useState, useMemo } from 'react';

interface FilterState {
  status: string;
  priority: string;
  search: string;
}

/**
 * Custom hook that manages complaint filtering state.
 * Used in complaint list pages across admin, department head, and staff views.
 */
export const useComplaintFilters = (complaints: any[]) => {
  const [filters, setFilters] = useState<FilterState>({
    status: 'all',
    priority: 'all',
    search: '',
  });

  const filteredComplaints = useMemo(() => {
    return complaints.filter((complaint) => {
      const matchesStatus =
        filters.status === 'all' || complaint.status === filters.status;
      const matchesPriority =
        filters.priority === 'all' || complaint.priority === filters.priority;
      const matchesSearch =
        !filters.search ||
        complaint.title?.toLowerCase().includes(filters.search.toLowerCase()) ||
        complaint.description?.toLowerCase().includes(filters.search.toLowerCase());

      return matchesStatus && matchesPriority && matchesSearch;
    });
  }, [complaints, filters]);

  const updateFilter = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({ status: 'all', priority: 'all', search: '' });
  };

  return { filters, filteredComplaints, updateFilter, resetFilters };
};
