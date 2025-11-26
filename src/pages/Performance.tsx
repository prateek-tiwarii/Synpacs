import React, { useState } from 'react';
import { Calendar, FileText, CheckCircle, AlertCircle, FileEdit, Eye } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Checkbox } from '@/components/ui/checkbox';
const Performance = () => {
  const [activeTab, setActiveTab] = useState('doctor');
  const [timeFilter, setTimeFilter] = useState('1W');
  const [selectedDoctors, setSelectedDoctors] = useState<number[]>([]);
  const [selectedCenters, setSelectedCenters] = useState<number[]>([]);

  const doctors = [
    { id: 1, name: 'Dr. Sarah Johnson', location: 'Main Hospital, Clinic A' },
    { id: 2, name: 'Dr. Michael Chen', location: 'Main Hospital' },
    { id: 3, name: 'Dr. Emily Rodriguez', location: 'Clinic A, Clinic B' },
    { id: 4, name: 'Dr. James Wilson', location: 'Clinic C' },
  ];

  const centers = [
    { id: 1, name: 'Main Hospital', location: 'New York, NY' },
    { id: 2, name: 'Clinic A', location: 'Brooklyn, NY' },
    { id: 3, name: 'Clinic B', location: 'Queens, NY' },
    { id: 4, name: 'Clinic C', location: 'Manhattan, NY' },
  ];

  const stats = [
    { label: 'Assigned', value: 204, icon: FileText, color: 'text-blue-600' },
    { label: 'Reported', value: 171, icon: CheckCircle, color: 'text-green-600' },
    { label: 'Unreported', value: 33, icon: AlertCircle, color: 'text-yellow-600' },
    { label: 'Drafted', value: 51, icon: FileEdit, color: 'text-gray-600' },
    { label: 'Reviewed', value: 120, icon: Eye, color: 'text-purple-600' },
  ];

  const performanceData = [
    {
      name: 'Dr. Sarah Johnson',
      login: '4h 23m',
      assigned: 45,
      reported: 38,
      unreported: 7,
      drafted: 12,
      reviewed: 26,
      avgTAT: 42,
    },
    {
      name: 'Dr. Michael Chen',
      login: '6h 15m',
      assigned: 52,
      reported: 48,
      unreported: 4,
      drafted: 8,
      reviewed: 35,
      avgTAT: 38,
    },
    {
      name: 'Dr. Emily Rodriguez',
      login: '5h 45m',
      assigned: 48,
      reported: 42,
      unreported: 6,
      drafted: 15,
      reviewed: 30,
      avgTAT: 45,
    },
    {
      name: 'Dr. James Wilson',
      login: '7h 02m',
      assigned: 59,
      reported: 43,
      unreported: 16,
      drafted: 16,
      reviewed: 29,
      avgTAT: 51,
    },
  ];

  const centerPerformanceData = [
    {
      name: 'Main Hospital',
      login: '24h 00m',
      assigned: 150,
      reported: 140,
      unreported: 10,
      drafted: 5,
      reviewed: 135,
      avgTAT: 40,
    },
    {
      name: 'Clinic A',
      login: '12h 30m',
      assigned: 80,
      reported: 75,
      unreported: 5,
      drafted: 2,
      reviewed: 70,
      avgTAT: 35,
    },
     {
      name: 'Clinic B',
      login: '10h 15m',
      assigned: 60,
      reported: 55,
      unreported: 5,
      drafted: 3,
      reviewed: 50,
      avgTAT: 45,
    },
  ];

  const toggleDoctor = (doctorId: number) => {
    setSelectedDoctors((prev: number[]) =>
      prev.includes(doctorId)
        ? prev.filter((id) => id !== doctorId)
        : [...prev, doctorId]
    );
  };

  const toggleCenter = (centerId: number) => {
    setSelectedCenters((prev: number[]) =>
      prev.includes(centerId)
        ? prev.filter((id) => id !== centerId)
        : [...prev, centerId]
    );
  };

  return (
    <DashboardLayout>
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Date Range and Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                defaultValue="2025-11-20"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <input
                type="date"
                defaultValue="2025-11-26"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('doctor')}
                className={`px-6 py-2 rounded-md font-medium transition-colors ${
                  activeTab === 'doctor'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Doctor
              </button>
              <button
                onClick={() => setActiveTab('center')}
                className={`px-6 py-2 rounded-md font-medium transition-colors ${
                  activeTab === 'center'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Center
              </button>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            {['1D', '2D', '1W', '1M'].map((filter) => (
              <button
                key={filter}
                onClick={() => setTimeFilter(filter)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  timeFilter === filter
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {/* Selection Filter */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            {activeTab === 'doctor' ? 'Select Doctor(s)' : 'Select Center(s)'}
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            {activeTab === 'doctor' 
              ? 'Select one or more doctors to filter' 
              : 'Select one or more centers to filter'}
          </p>
          <div className="space-y-3">
            {activeTab === 'doctor' ? (
              doctors.map((doctor) => (
                <label
                  key={doctor.id}
                  className="flex items-start gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded-md transition-colors"
                >
                  <Checkbox
                    checked={selectedDoctors.includes(doctor.id)}
                    onCheckedChange={() => toggleDoctor(doctor.id)}
                    className="mt-1 border-gray-300 data-[state=checked]:bg-white! data-[state=checked]:text-black! data-[state=checked]:border-black!"
                  />
                  <div>
                    <div className="font-medium text-gray-900">{doctor.name}</div>
                    <div className="text-sm text-gray-500">{doctor.location}</div>
                  </div>
                </label>
              ))
            ) : (
              centers.map((center) => (
                <label
                  key={center.id}
                  className="flex items-start gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded-md transition-colors"
                >
                  <Checkbox
                    checked={selectedCenters.includes(center.id)}
                    onCheckedChange={() => toggleCenter(center.id)}
                    className="mt-1 border-gray-300 data-[state=checked]:bg-white! data-[state=checked]:text-black! data-[state=checked]:border-black!"
                  />
                  <div>
                    <div className="font-medium text-gray-900">{center.name}</div>
                    <div className="text-sm text-gray-500">{center.location}</div>
                  </div>
                </label>
              ))
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={index}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">
                    {stat.label}
                  </span>
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div className="text-3xl font-bold text-gray-900">
                  {stat.value}
                </div>
              </div>
            );
          })}
        </div>

        {/* Performance Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Performance</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Login
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Assigned
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Reported
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Unreported
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Drafted
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Reviewed
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Avg TAT (mins)
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(activeTab === 'doctor' ? performanceData : centerPerformanceData).map((item, index) => (
                  <tr
                    key={index}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {item.login}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.assigned}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.reported}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.unreported}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.drafted}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.reviewed}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.avgTAT}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
    </DashboardLayout>
  );
};

export default Performance;