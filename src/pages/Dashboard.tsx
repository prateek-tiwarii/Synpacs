import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
  UserPlus,
  ChevronDown,
  Activity,
  Search,
  RefreshCw
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';

const NumberTicker = ({ value , duration = 1000 }: { value: string; duration?: number }) => {
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
  const [selectedPatients, setSelectedPatients] = useState<number[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
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

  const patients = [
    { id: 1, priority: 'Critical', time: '08:30', patient: 'John Smith', sex: 'M', age: 45, center: 'Main Hospital', study: 'CT Brain', modality: 'CT', images: 120, refDr: 'Dr. Wilson', accNo: 'ACC001', status: 'Unreported', assigned: 'Dr. Anderson' },
    { id: 2, priority: 'Urgent', time: '09:15', patient: 'Sarah Johnson', sex: 'F', age: 32, center: 'East Clinic', study: 'MRI Spine', modality: 'MRI', images: 85, refDr: 'Dr. Martinez', accNo: 'ACC002', status: 'Reported', assigned: 'Dr. Chen' },
    { id: 3, priority: 'Routine', time: '10:00', patient: 'Michael Brown', sex: 'M', age: 58, center: 'Main Hospital', study: 'X-Ray Chest', modality: 'XR', images: 2, refDr: 'Dr. Taylor', accNo: 'ACC003', status: 'Unreported', assigned: '-' },
    { id: 4, priority: 'Critical', time: '10:45', patient: 'Emily Davis', sex: 'F', age: 67, center: 'West Center', study: 'CT Abdomen', modality: 'CT', images: 200, refDr: 'Dr. Lee', accNo: 'ACC004', status: 'Unreported', assigned: '-' },
    { id: 5, priority: 'Routine', time: '11:20', patient: 'David Wilson', sex: 'M', age: 41, center: 'East Clinic', study: 'US Abdomen', modality: 'US', images: 45, refDr: 'Dr. Brown', accNo: 'ACC005', status: 'Reported', assigned: 'Dr. Anderson' },
    { id: 6, priority: 'Urgent', time: '12:00', patient: 'Lisa Anderson', sex: 'F', age: 29, center: 'Main Hospital', study: 'MRI Brain', modality: 'MRI', images: 150, refDr: 'Dr. Garcia', accNo: 'ACC006', status: 'Unreported', assigned: 'Dr. Rodriguez' }
  ];

  const doctors = [
    { name: 'Dr. Anderson', specialty: 'Neuroradiology', status: 'Available', assigned: 12, reported: 45 },
    { name: 'Dr. Chen', specialty: 'Musculoskeletal', status: 'Busy', assigned: 18, reported: 62 },
    { name: 'Dr. Rodriguez', specialty: 'Cardiac Imaging', status: 'Available', assigned: 8, reported: 38 },
    { name: 'Dr. Patel', specialty: 'Abdominal Imaging', status: 'Available', assigned: 10, reported: 51 }
  ];

  const handlePatientSelect = (patientId: number) => {
    setSelectedPatients(prev => 
      prev.includes(patientId) 
        ? prev.filter(id => id !== patientId)
        : [...prev, patientId]
    );
  };

  const handleAssignDoctor = (doctorName: string) => {
    console.log(`Assigning ${doctorName} to patients:`, selectedPatients);
    setSelectedPatients([]);
    setShowAssignModal(false);
  };

  const getPriorityColor = (priority: string) => {
    switch(priority) {
      case 'Critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'Urgent': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'Routine': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

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
                    <DropdownMenuItem onClick={() => setFilters({...filters, [key]: `All ${key.charAt(0).toUpperCase() + key.slice(1)}`})}>
                      All {key.charAt(0).toUpperCase() + key.slice(1)}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFilters({...filters, [key]: 'Option 1'})}>
                      Option 1
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFilters({...filters, [key]: 'Option 2'})}>
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
          {/* Patient Table - Takes 2/3 width */}
          <Card className="flex-1 border-none shadow-md">
            <CardHeader className="border-b bg-white">
              <div className="flex justify-between items-center gap-4">
                <CardTitle className="text-lg font-medium">Patient Studies</CardTitle>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input 
                      type="text" 
                      placeholder="Search patients..."
                      className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
                    />
                  </div>
                  {selectedPatients.length > 0 && (
                    <Button onClick={() => setShowAssignModal(!showAssignModal)} size="sm" className="gap-2 bg-black! text-white!">
                      <UserPlus className="h-4 w-4" />
                      Assign ({selectedPatients.length})
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {showAssignModal && selectedPatients.length > 0 && (
                <div className="p-4 bg-blue-50 border-b border-blue-200">
                  <p className="text-xs font-medium text-blue-900 mb-2">Select a doctor to assign:</p>
                  <div className="flex flex-wrap gap-2">
                    {doctors.map((doctor, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        onClick={() => handleAssignDoctor(doctor.name)}
                        className="bg-white! text-black! border border-gray-300 hover:bg-gray-100 text-xs"
                      >
                        {doctor.name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Select</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sex</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Age</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Center</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Study</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Mod</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Images</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ref Dr</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Acc#</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Assigned</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {patients.map((patient) => (
                      <tr key={patient.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-3">
                          <Checkbox
                            checked={selectedPatients.includes(patient.id)}
                            onCheckedChange={() => handlePatientSelect(patient.id)}
                            className="bg-white! border-gray-300! data-[state=checked]:bg-black! data-[state=checked]:text-white!"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getPriorityColor(patient.priority)}`}>
                            {patient.priority}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-900">{patient.time}</td>
                        <td className="px-3 py-3 text-xs font-medium text-gray-900">{patient.patient}</td>
                        <td className="px-3 py-3 text-xs text-gray-900">{patient.sex}</td>
                        <td className="px-3 py-3 text-xs text-gray-900">{patient.age}</td>
                        <td className="px-3 py-3 text-xs text-gray-700">{patient.center}</td>
                        <td className="px-3 py-3 text-xs text-gray-700">{patient.study}</td>
                        <td className="px-3 py-3 text-xs text-gray-900">{patient.modality}</td>
                        <td className="px-3 py-3 text-xs text-gray-900">{patient.images}</td>
                        <td className="px-3 py-3 text-xs text-gray-700">{patient.refDr}</td>
                        <td className="px-3 py-3 text-xs text-gray-900">{patient.accNo}</td>
                        <td className="px-3 py-3">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            patient.status === 'Reported' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {patient.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-700">{patient.assigned}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Doctor Cards - Takes 1/3 width */}
          <div className="w-full space-y-4">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-medium text-gray-900">Available Radiologists</h2>
                <span className="text-xs text-gray-500">{doctors.length} doctors</span>
              </div>
              <div className="grid grid-cols-1 gap-4 max-h-[600px] overflow-y-auto pr-3">
                {doctors.map((doctor, index) => {
                  const workloadPercent = Math.round((doctor.assigned / (doctor.assigned + doctor.reported)) * 100);
                  return (
                    <div key={index} className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900 text-base">{doctor.name}</h3>
                          <p className="text-xs text-gray-600 mt-1">{doctor.specialty}</p>
                        </div>
                        <span className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
                          doctor.status === 'Available' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-orange-100 text-orange-800'
                        }`}>
                          {doctor.status}
                        </span>
                      </div>
                      
                      {/* Workload Progress Bar */}
                      <div className="mb-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs text-gray-600">Workload</span>
                          <span className="text-xs font-medium text-gray-900">{workloadPercent}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div 
                            className={`h-1.5 rounded-full transition-all ${
                              workloadPercent > 70 ? 'bg-orange-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${workloadPercent}%` }}
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-50 rounded-md p-3 border border-gray-200">
                          <p className="text-xs text-gray-600 mb-1">Assigned</p>
                          <p className="text-2xl font-medium text-gray-900">{doctor.assigned}</p>
                          <p className="text-xs text-gray-500 mt-0.5">studies</p>
                        </div>
                        <div className="bg-gray-50 rounded-md p-3 border border-gray-200">
                          <p className="text-xs text-gray-600 mb-1">Reported</p>
                          <p className="text-2xl font-medium text-gray-900">{doctor.reported}</p>
                          <p className="text-xs text-gray-500 mt-0.5">total</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;