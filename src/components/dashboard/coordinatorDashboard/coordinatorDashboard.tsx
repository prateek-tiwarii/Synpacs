import { Activity, AlertCircle, CheckCircle2, Clock, FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import PatientTable from '@/components/dashboard/RecentPatientTable';
import DoctorAvailablity from '@/components/dashboard/DoctorAvailablity';
import { useState, useEffect } from 'react';
import { apiService } from '@/lib/api';
import { format } from 'date-fns';

interface HospitalStats {
  total_assigned_cases: number;
  total_unassigned_cases: number;
  total_critical_cases: number;
  total_reported_cases: number;
  total_unreported_cases: number;
}

const CoordinatorDashboard = () => {
  const [statsData, setStatsData] = useState<HospitalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Helper function to get default date range (last 1 month)
  const getDefaultDateRange = () => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
    return {
      start: format(startDate, "yyyy-MM-dd"),
      end: format(endDate, "yyyy-MM-dd"),
    };
  };

  const defaultDates = getDefaultDateRange();
  const [dateRange, setDateRange] = useState({
    from: defaultDates.start,
    to: defaultDates.end
  });

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getHospitalStats();
      if (response.success && response.data) {
        // @ts-ignore
        setStatsData(response.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch stats');
      console.error('Error fetching hospital stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const stats = [
    {
      title: 'Assigned',
      value: loading ? '...' : (statsData?.total_assigned_cases?.toString() || '0'),
      icon: CheckCircle2,
      color: 'text-green-600',
      bg: 'bg-green-50'
    },
    {
      title: 'Unassigned',
      value: loading ? '...' : (statsData?.total_unassigned_cases?.toString() || '0'),
      icon: Clock,
      color: 'text-orange-600',
      bg: 'bg-orange-50'
    },
    {
      title: 'Critical',
      value: loading ? '...' : (statsData?.total_critical_cases?.toString() || '0'),
      icon: AlertCircle,
      color: 'text-red-600',
      bg: 'bg-red-50'
    },
    {
      title: 'Reported',
      value: loading ? '...' : (statsData?.total_reported_cases?.toString() || '0'),
      icon: FileText,
      color: 'text-blue-600',
      bg: 'bg-blue-50'
    },
    {
      title: 'Unreported',
      value: loading ? '...' : (statsData?.total_unreported_cases?.toString() || '0'),
      icon: Activity,
      color: 'text-purple-600',
      bg: 'bg-purple-50'
    },
  ];

  return (
    <div className='flex flex-col gap-2'>
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-medium text-gray-900">Worklist</h1>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Medical Imaging Management System
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-gray-500">Date Range</p>
            <p className="text-sm font-medium text-gray-900">
              {format(new Date(dateRange.from), 'MMM dd, yyyy')} - {format(new Date(dateRange.to), 'MMM dd, yyyy')}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-3 overflow-x-auto pb-2 w-full justify-between">
        {stats.map((stat: any, index: number) => (
          <Card key={index} className="flex-1 border border-gray-200 shadow-sm hover:shadow-md transition-all">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`${stat.bg} p-2 rounded-lg`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 whitespace-nowrap">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stat.value}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-2 flex-col">

        {/* Main Content - Patients and Doctors in Flex Row */}
        <div className="flex gap-2 w-full justify-around">
          <PatientTable onDateRangeChange={setDateRange} />
          <DoctorAvailablity />
        </div>
      </div>


    </div>
  )
}

export default CoordinatorDashboard