import { useState, useCallback, useEffect } from 'react';
import { useSocket } from '../SocketContext';
import { message } from 'antd';
import { Socket } from 'socket.io-client';

export interface DealDashboardData {
  // Summary metrics
  totalDeals: number;
  totalDealsInPeriod: number;
  wonDeals: number;
  lostDeals: number;
  openDeals: number;
  dealValues: {
    totalValue: number;
    avgValue: number;
    wonValue: number;
    lostValue: number;
    openValue: number;
  };
  conversionRate: number;
  avgDealCycle: number;
  
  // Breakdown data
  dealsByStage: Array<{
    _id: string;
    count: number;
    value: number;
  }>;
  dealsByOwner: Array<{
    _id: string;
    count: number;
    value: number;
    wonCount: number;
    lostCount: number;
    openCount: number;
  }>;
  probabilityRanges: Array<{
    _id: number | string;
    count: number;
    value: number;
  }>;
  
  // Time-based data
  monthlyData: {
    won: number[];
    lost: number[];
    open: number[];
    wonValue: number[];
    lostValue: number[];
    openValue: number[];
  };
  recentDeals: Array<{
    _id: string;
    name: string;
    stage: string;
    status: string;
    dealValue: number;
    owner: {
      name: string;
      avatar?: string;
    };
    createdAt: string;
    expectedClosedDate?: string;
  }>;
  topDeals: Array<{
    _id: string;
    name: string;
    dealValue: number;
    owner: {
      name: string;
      avatar?: string;
    };
    status: string;
  }>;
  
  // Filter info
  filter: string;
  dateRange: {
    start: string | null;
    end: string | null;
  };
}

export interface DealDashboardFilters {
  filter?: 'week' | 'month' | 'year';
  dateRange?: {
    start: string;
    end: string;
  };
}

export const useDealDashboard = () => {
  const socket = useSocket() as Socket | null;
  const [dashboardData, setDashboardData] = useState<DealDashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback((filters: DealDashboardFilters = {}) => {
    if (!socket) {
      console.warn('[useDealDashboard] Socket not available');
      return;
    }
    setLoading(true);
    setError(null);
    console.log('[useDealDashboard] Fetching dashboard data with filters:', filters);
    socket.emit('deal:dashboard:getData', filters);
  }, [socket]);

  useEffect(() => {
    if (!socket) return;

    const handleDashboardResponse = (response: any) => {
      console.log('[useDealDashboard] Received dashboard response:', response);
      setLoading(false);
      if (response.done) {
        setDashboardData(response.data);
        setError(null);
      } else {
        setDashboardData(null);
        setError(response.error || 'Failed to load dashboard data');
        message.error(response.error || 'Failed to load dashboard data');
      }
    };

    socket.on('deal:dashboard:getData-response', handleDashboardResponse);

    return () => {
      socket.off('deal:dashboard:getData-response', handleDashboardResponse);
    };
  }, [socket]);

  // Auto-fetch on mount with default filters
  useEffect(() => {
    if (socket) {
      fetchDashboardData({ filter: 'month' });
    }
  }, [socket, fetchDashboardData]);

  return {
    dashboardData,
    loading,
    error,
    fetchDashboardData,
  };
};