import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertCircle,
  Clock,
  FileText, 
  CheckCircle2,
  Calendar,
  Filter, 
  ChevronDown,
  Activity, 
  RefreshCw
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import DoctorAvailablity from '@/components/dashboard/DoctorAvailablity';
import PatientTable from '@/components/dashboard/RecentPatientTable';

const NumberTicker = ({ value, duration = 1000 }: { value: string; duration?: number }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const targetValue = parseInt(value);
    const steps = 30;
    const increment = targetValue / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= targetValue) {
        setDisplayValue(targetValue);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [value, duration]);

  return <span>{displayValue}</span>;
};

const Dashboard = () => {

  const [filters, setFilters] = useState({
    center: 'All Centers',
    modality: 'All Modalities',
    doctor: 'All Doctors',
    priority: 'All Priority',
    status: 'All Status'
  });

  const stats = [
    { title: 'Assigned', value: '124', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
    { title: 'Unassigned', value: '18', icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' },
    { title: 'Critical', value: '7', icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
    { title: 'Unreported', value: '32', icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
    { title: 'Routine', value: '89', icon: Activity, color: 'text-purple-600', bg: 'bg-purple-50' },
    { title: 'Assigned Today', value: '15', icon: Calendar, color: 'text-teal-600', bg: 'bg-teal-50' }
  ];


  return (
    <DashboardLayout>
      <div className="min-h-[calc(100vh-4rem)] bg-gray-50 p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-medium text-gray-900">Overview</h1>
            <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Medical Imaging Management System
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-gray-500">Today</p>
              <p className="text-sm font-medium text-gray-900">
                {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <Button variant="outline" size="sm" className="bg-white! text-black! border border-gray-300 gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>



        {/* Stats Cards - Smaller Horizontal */}
        <div className="flex gap-4 overflow-x-auto pb-2">
          {stats.map((stat, index) => (
            <Card key={index} className="shrink-0 border-none shadow-md hover:shadow-lg transition-all">
              <CardContent className="p-7 min-w-52">
                <div className="flex items-center gap-4">
                  <div className={`${stat.bg} p-3 rounded-lg`}>
                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600 whitespace-nowrap">{stat.title}</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">
                      <NumberTicker value={stat.value} />
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>


        {/* <DashboardComponent/> */}

        {/* Filters */}
        <Card className="border-none shadow-md">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-gray-700 font-medium">
                <Filter className="h-4 w-4" />
                <span className="text-sm">Filters:</span>
              </div>

              {Object.entries(filters).map(([key, value]) => (
                <DropdownMenu key={key}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-2 bg-white! text-black! border border-gray-300">
                      {value}
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setFilters({ ...filters, [key]: `All ${key.charAt(0).toUpperCase() + key.slice(1)}` })}>
                      All {key.charAt(0).toUpperCase() + key.slice(1)}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFilters({ ...filters, [key]: 'Option 1' })}>
                      Option 1
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFilters({ ...filters, [key]: 'Option 2' })}>
                      Option 2
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ))}
            </div>
          </CardContent>
        </Card>



        {/* Main Content - Patients and Doctors in Flex Row */}
        <div className="flex gap-6">
          <PatientTable />
          <DoctorAvailablity />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;