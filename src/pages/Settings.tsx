import React, { useState, useRef } from 'react';
import { Eye, Edit2, Trash2, Plus, Upload, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DashboardLayout } from '@/components/DashboardLayout';

// Mock data structure (API-ready)
const mockDoctorsData = {
  data: [
    {
      id: 1,
      fullName: 'Dr. John Doe',
      displayName: 'Dr. Amit Kapoor',
      note: 'MD',
      qualification: 'MD Radiology, FRCR',
      phone: '+91-98765-43210',
      email: 'a.kapoor@synapsec.com',
      specialty: 'Interventional Radiology',
      medicalRegistrationNumber: 'MCI-12345',
      workingTimings: '09:00-17:00',
      centerAccess: ['City Hospital', 'Metro Imaging'],
      viewScope: 'Only cases assigned to me',
      signatureFile: null,
      degreeFiles: [],
      registrationFile: null
    },
    {
      id: 2,
      fullName: 'Dr. Jane Smith',
      displayName: 'Dr. Priya Sharma',
      note: 'Radiologist',
      qualification: 'MBBS, DNB Radiology',
      phone: '+91-98765-43211',
      email: 'p.sharma@synapsec.com',
      specialty: 'Neuroradiology',
      medicalRegistrationNumber: 'MCI-67890',
      workingTimings: '10:00-18:00',
      centerAccess: ['City Hospital'],
      viewScope: 'Only cases assigned to me',
      signatureFile: null,
      degreeFiles: [],
      registrationFile: null
    },
    {
      id: 3,
      fullName: 'Dr. Mohan Rao',
      displayName: 'Dr. Mohan Rao',
      note: '',
      qualification: 'MD Radiology',
      phone: '+91-98765-43212',
      email: 'm.rao@synapsec.com',
      specialty: '',
      medicalRegistrationNumber: 'MCI-11223',
      workingTimings: '09:00-17:00',
      centerAccess: ['Sunrise Center'],
      viewScope: 'Assigned only',
      signatureFile: null,
      degreeFiles: [],
      registrationFile: null
    }
  ],
  total: 3
};

const mockHospitalsData = {
  data: [
    {
      id: 1,
      centerName: 'City Hospital',
      fontFamily: 'Roboto',
      fontSize: '12pt',
      headerFile: 'header_city_hospital.png'
    },
    {
      id: 2,
      centerName: 'Metro Imaging',
      fontFamily: 'Roboto',
      fontSize: '12pt',
      headerFile: 'header_metro.png'
    },
    {
      id: 3,
      centerName: 'Sunrise Center',
      fontFamily: 'Roboto',
      fontSize: '12pt',
      headerFile: 'header_sunrise.png'
    }
  ],
  total: 3
};

// Add/Edit Doctor Dialog Component
const DoctorDialog = ({ open, onOpenChange, doctor, onSave }: any) => {
  const signatureFileRef = useRef<HTMLInputElement>(null);
  const degreeFilesRef = useRef<HTMLInputElement>(null);
  const registrationFileRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState(doctor || {
    fullName: '',
    displayName: '',
    note: '',
    email: '',
    phone: '',
    qualification: '',
    specialty: '',
    medicalRegistrationNumber: '',
    workingStartTime: '09:00',
    workingEndTime: '17:00',
    viewScope: 'Only cases assigned to me',
    signatureFile: null,
    signatureFileName: '',
    degreeFiles: [],
    degreeFileNames: [],
    registrationFile: null,
    registrationFileName: ''
  });

  React.useEffect(() => {
    if (doctor) {
      setFormData(doctor);
    } else {
      setFormData({
        fullName: '',
        displayName: '',
        note: '',
        email: '',
        phone: '',
        qualification: '',
        specialty: '',
        medicalRegistrationNumber: '',
        workingStartTime: '09:00',
        workingEndTime: '17:00',
        viewScope: 'Only cases assigned to me',
        signatureFile: null,
        signatureFileName: '',
        degreeFiles: [],
        degreeFileNames: [],
        registrationFile: null,
        registrationFileName: ''
      });
    }
  }, [doctor, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto [&>button]:bg-white! [&>button]:text-red-600! [&>button]:hover:bg-white! [&>button]:hover:text-red-700!">
        <DialogHeader>
          <DialogTitle>{doctor ? 'Edit Doctor Account' : 'Create Doctor Account'}</DialogTitle>
          <DialogDescription>
            {doctor ? 'Update doctor information' : 'Required: Signature, Qualifications'}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="fullName">Full Name *</Label>
            <Input
              id="fullName"
              placeholder="Dr. John Doe"
              value={formData.fullName}
              onChange={(e) => setFormData({...formData, fullName: e.target.value})}
              required
            />
          </div>

          <div>
            <Label htmlFor="displayName">Display Name on Report *</Label>
            <Input
              id="displayName"
              placeholder="Dr. John Doe, MD"
              value={formData.displayName}
              onChange={(e) => setFormData({...formData, displayName: e.target.value})}
              required
            />
            <p className="text-xs text-gray-500 mt-1">Consultant Radiologist</p>
          </div>

          <div>
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="doctor@example.com"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              required
            />
          </div>

          <div>
            <Label htmlFor="phone">Phone *</Label>
            <Input
              id="phone"
              placeholder="+91-98765-43210"
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              required
            />
          </div>

          <div>
            <Label htmlFor="qualification">Qualifications *</Label>
            <Input
              id="qualification"
              placeholder="MD Radiology, FRCR"
              value={formData.qualification}
              onChange={(e) => setFormData({...formData, qualification: e.target.value})}
              required
            />
          </div>

          <div>
            <Label htmlFor="signature">Signature Upload *</Label>
            <input
              ref={signatureFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setFormData({...formData, signatureFile: file, signatureFileName: file.name});
                }
              }}
            />
            <div className="flex items-center gap-2">
              <Button 
                type="button" 
                variant="outline" 
                className="w-full bg-white! text-black! border-gray-300 hover:bg-gray-50!"
                onClick={() => signatureFileRef.current?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                {formData.signatureFileName ? 'Change Signature' : 'Choose Signature File'}
              </Button>
            </div>
            {formData.signatureFileName && (
              <p className="text-xs text-gray-600 mt-1">{formData.signatureFileName}</p>
            )}
          </div>

          <div>
            <Label htmlFor="degrees">Degrees Upload (optional, multiple)</Label>
            <input
              ref={degreeFilesRef}
              type="file"
              accept=".pdf,image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                if (files.length > 0) {
                  setFormData({
                    ...formData, 
                    degreeFiles: files,
                    degreeFileNames: files.map(f => f.name)
                  });
                }
              }}
            />
            <div className="flex items-center gap-2">
              <Button 
                type="button" 
                variant="outline" 
                className="w-full bg-white! text-black! border-gray-300 hover:bg-gray-50!"
                onClick={() => degreeFilesRef.current?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                {formData.degreeFileNames?.length > 0 ? `${formData.degreeFileNames.length} files selected` : 'Choose Files'}
              </Button>
            </div>
            {formData.degreeFileNames?.length > 0 && (
              <p className="text-xs text-gray-600 mt-1">{formData.degreeFileNames.join(', ')}</p>
            )}
          </div>

          <div>
            <Label htmlFor="medicalReg">Medical Registration Number</Label>
            <Input
              id="medicalReg"
              placeholder="MCI-12345"
              value={formData.medicalRegistrationNumber}
              onChange={(e) => setFormData({...formData, medicalRegistrationNumber: e.target.value})}
            />
          </div>

          <div>
            <Label htmlFor="regFile">Registration File Upload</Label>
            <input
              ref={registrationFileRef}
              type="file"
              accept=".pdf,image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setFormData({...formData, registrationFile: file, registrationFileName: file.name});
                }
              }}
            />
            <div className="flex items-center gap-2">
              <Button 
                type="button" 
                variant="outline" 
                className="w-full bg-white! text-black! border-gray-300 hover:bg-gray-50!"
                onClick={() => registrationFileRef.current?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                {formData.registrationFileName ? 'Change File' : 'Choose File'}
              </Button>
            </div>
            {formData.registrationFileName && (
              <p className="text-xs text-gray-600 mt-1">{formData.registrationFileName}</p>
            )}
          </div>

          <div>
            <Label htmlFor="specialty">Specialty</Label>
            <Input
              id="specialty"
              placeholder="Interventional Radiology"
              value={formData.specialty}
              onChange={(e) => setFormData({...formData, specialty: e.target.value})}
            />
          </div>

          <div>
            <Label>Working Timings</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Label htmlFor="workingStartTime" className="text-xs text-gray-500">Start Time</Label>
                <Input
                  id="workingStartTime"
                  type="time"
                  value={formData.workingStartTime}
                  onChange={(e) => setFormData({...formData, workingStartTime: e.target.value})}
                  className="mt-1"
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="workingEndTime" className="text-xs text-gray-500">End Time</Label>
                <Input
                  id="workingEndTime"
                  type="time"
                  value={formData.workingEndTime}
                  onChange={(e) => setFormData({...formData, workingEndTime: e.target.value})}
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="note">Short Personal Note (private)</Label>
            <Textarea
              id="note"
              placeholder="Private note shown beside doctor name in queue"
              value={formData.note}
              onChange={(e) => setFormData({...formData, note: e.target.value})}
              rows={2}
            />
            <p className="text-xs text-gray-500 mt-1">Private — shown beside doctor name in queue</p>
          </div>

          <div>
            <Label htmlFor="viewScope">View Scope</Label>
            <Select 
              value={formData.viewScope} 
              onValueChange={(value) => setFormData({...formData, viewScope: value})}
            >
              <SelectTrigger className="bg-white! text-gray-900!">
                <SelectValue placeholder="Select view scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Only cases assigned to me">Only cases assigned to me</SelectItem>
                <SelectItem value="All studies of selected centers">All studies of selected centers</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="bg-white! text-black! border-gray-300">
              Reset
            </Button>
            <Button type="submit" className="bg-black! text-white! hover:bg-gray-800!">
              {doctor ? 'Update Account' : 'Create Account'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Add/Edit Hospital Dialog Component
const HospitalDialog = ({ open, onOpenChange, hospital, onSave }: any) => {
  const headerFileRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState(hospital || {
    centerName: '',
    fontFamily: 'Roboto',
    fontSize: '12pt',
    headerFile: null,
    headerFileName: ''
  });

  React.useEffect(() => {
    if (hospital) {
      setFormData(hospital);
    } else {
      setFormData({
        centerName: '',
        fontFamily: 'Roboto',
        fontSize: '12pt',
        headerFile: null,
        headerFileName: ''
      });
    }
  }, [hospital, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl [&>button]:bg-white! [&>button]:text-red-600! [&>button]:hover:bg-white! [&>button]:hover:text-red-700!">
        <DialogHeader>
          <DialogTitle>{hospital ? 'Edit Hospital/Center' : 'Add Hospital/Center'}</DialogTitle>
          <DialogDescription>
            Center report formatting & header upload. All fields optional.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="centerName">Center Name</Label>
            <Input
              id="centerName"
              placeholder="City Hospital"
              value={formData.centerName}
              onChange={(e) => setFormData({...formData, centerName: e.target.value})}
            />
            <p className="text-xs text-gray-500 mt-1">Per-center header and text settings. All fields optional.</p>
          </div>

          <div>
            <Label htmlFor="fontFamily">Font Family</Label>
            <Select 
              value={formData.fontFamily} 
              onValueChange={(value) => setFormData({...formData, fontFamily: value})}
            >
              <SelectTrigger className="bg-white! text-gray-900!">
                <SelectValue placeholder="Select font family" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Roboto">Roboto</SelectItem>
                <SelectItem value="Arial">Arial</SelectItem>
                <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                <SelectItem value="Helvetica">Helvetica</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="fontSize">Font Size</Label>
            <Select 
              value={formData.fontSize} 
              onValueChange={(value) => setFormData({...formData, fontSize: value})}
            >
              <SelectTrigger className="bg-white! text-gray-900!">
                <SelectValue placeholder="Select font size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10pt">10pt</SelectItem>
                <SelectItem value="11pt">11pt</SelectItem>
                <SelectItem value="12pt">12pt</SelectItem>
                <SelectItem value="13pt">13pt</SelectItem>
                <SelectItem value="14pt">14pt</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="headerUpload">Header Upload</Label>
            <input
              ref={headerFileRef}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setFormData({...formData, headerFile: file, headerFileName: file.name});
                }
              }}
            />
            <div className="flex items-center gap-2">
              <Button 
                type="button" 
                variant="outline" 
                className="w-full bg-white! text-black! border-gray-300 hover:bg-gray-50!"
                onClick={() => headerFileRef.current?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                {formData.headerFileName ? 'Change Header' : 'Choose File'}
              </Button>
            </div>
            {formData.headerFileName && (
              <p className="text-xs text-gray-600 mt-1">{formData.headerFileName}</p>
            )}
            {!formData.headerFileName && (
              <p className="text-xs text-gray-500 mt-1">No file chosen</p>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="bg-white! text-black! border-gray-300">
              Clear
            </Button>
            <Button type="submit" className="bg-black! text-white! hover:bg-gray-800!">
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Doctors Table Component
const DoctorsTable = ({ doctors, onEdit, onView, onDelete }: any) => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Display Name & Note</TableHead>
          <TableHead>Qualifications</TableHead>
          <TableHead>Phone</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Specialty</TableHead>
          <TableHead>Centers Access</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {doctors.map((doctor) => (
          <TableRow key={doctor.id}>
            <TableCell className="font-medium">{doctor.fullName}</TableCell>
            <TableCell>
              <div>{doctor.displayName}</div>
              {doctor.note && <div className="text-xs text-gray-500">{doctor.note}</div>}
            </TableCell>
            <TableCell>{doctor.qualification}</TableCell>
            <TableCell>{doctor.phone}</TableCell>
            <TableCell className="text-blue-600">{doctor.email}</TableCell>
            <TableCell>{doctor.specialty || '—'}</TableCell>
            <TableCell>{doctor.centerAccess.join(', ')}</TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => onView(doctor)}
                  className="h-8 w-8 p-0 bg-white! text-gray-700! border-gray-300 hover:bg-gray-100!"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => onEdit(doctor)}
                  className="h-8 w-8 p-0 bg-white! text-gray-700! border-gray-300 hover:bg-gray-100!"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => onDelete(doctor.id)}
                  className="h-8 w-8 p-0 bg-white! text-red-600! border-gray-300 hover:bg-red-50!"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

// Hospitals Table Component
const HospitalsTable = ({ hospitals, onEdit, onView, onDelete }: any) => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Center Name</TableHead>
          <TableHead>Font Family</TableHead>
          <TableHead>Font Size</TableHead>
          <TableHead>Header Upload</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {hospitals.map((hospital) => (
          <TableRow key={hospital.id}>
            <TableCell className="font-medium">{hospital.centerName}</TableCell>
            <TableCell>{hospital.fontFamily}</TableCell>
            <TableCell>{hospital.fontSize}</TableCell>
            <TableCell className="text-blue-600">{hospital.headerFile || 'No file'}</TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => onView(hospital)}
                  className="h-8 w-8 p-0 bg-white! text-gray-700! border-gray-300 hover:bg-gray-100!"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => onEdit(hospital)}
                  className="h-8 w-8 p-0 bg-white! text-gray-700! border-gray-300 hover:bg-gray-100!"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => onDelete(hospital.id)}
                  className="h-8 w-8 p-0 bg-white! text-red-600! border-gray-300 hover:bg-red-50!"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

// Main Settings Page Component
const Settings = () => {
  const [doctors, setDoctors] = useState(mockDoctorsData.data);
  const [hospitals, setHospitals] = useState(mockHospitalsData.data);
  const [doctorDialogOpen, setDoctorDialogOpen] = useState(false);
  const [hospitalDialogOpen, setHospitalDialogOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleAddDoctor = () => {
    setSelectedDoctor(null);
    setDoctorDialogOpen(true);
  };

  const handleEditDoctor = (doctor: any) => {
    setSelectedDoctor(doctor);
    setDoctorDialogOpen(true);
  };

  const handleViewDoctor = (doctor: any) => {
    setSelectedDoctor(doctor);
    setDoctorDialogOpen(true);
  };

  const handleDeleteDoctor = (id: any) => {
    if (confirm('Are you sure you want to delete this doctor?')) {
      setDoctors(doctors.filter((d: any) => d.id !== id));
    }
  };

  const handleSaveDoctor = (doctorData: any) => {
    if (selectedDoctor) {
      // Update existing doctor
      setDoctors(doctors.map((d: any) => d.id === selectedDoctor.id ? {...doctorData, id: selectedDoctor.id} : d));
    } else {
      // Add new doctor
      setDoctors([...doctors, {...doctorData, id: Date.now()}]);
    }
  };

  const handleAddHospital = () => {
    setSelectedHospital(null);
    setHospitalDialogOpen(true);
  };

  const handleEditHospital = (hospital: any) => {
    setSelectedHospital(hospital);
    setHospitalDialogOpen(true);
  };

  const handleViewHospital = (hospital: any) => {
    setSelectedHospital(hospital);
    setHospitalDialogOpen(true);
  };

  const handleDeleteHospital = (id: any) => {
    if (confirm('Are you sure you want to delete this hospital?')) {
      setHospitals(hospitals.filter((h: any) => h.id !== id));
    }
  };

  const handleSaveHospital = (hospitalData: any) => {
    if (selectedHospital) {
      // Update existing hospital
      setHospitals(hospitals.map((h: any) => h.id === selectedHospital.id ? {...hospitalData, id: selectedHospital.id} : h));
    } else {
      // Add new hospital
      setHospitals([...hospitals, {...hospitalData, id: Date.now()}]);
    }
  };

  const filteredDoctors = doctors.filter(doctor => 
    doctor.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doctor.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doctor.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doctor.specialty.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Doctor management, center report formatting & account quota</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Accounts used:</span>
          <span className="text-lg font-semibold text-gray-900">3 / 10</span>
        </div>
      </div>

      {/* Main Content - Both Cards Vertically */}
      <div className="space-y-6">
        {/* Doctors Managed by You Card */}
        <Card className="border-none shadow-md">
          <CardHeader className="border-b bg-white">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-medium">Doctors Managed by You ({filteredDoctors.length})</CardTitle>
                <CardDescription>View and manage your assigned doctors</CardDescription>
              </div>
              <div className="flex items-center gap-3">
                {/* Search Bar */}
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Search doctors..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-3 pr-4 py-2 w-64 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
                  />
                </div>
                <Button onClick={handleAddDoctor} className="gap-2 bg-black! text-white! hover:bg-gray-800!">
                  <Plus className="w-4 h-4" />
                  Add Doctor
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <DoctorsTable 
                doctors={filteredDoctors} 
                onEdit={handleEditDoctor}
                onView={handleViewDoctor}
                onDelete={handleDeleteDoctor}
              />
            </div>
          </CardContent>
        </Card>

        {/* Hospitals Managed by You Card */}
        <Card className="border-none shadow-md">
          <CardHeader className="border-b bg-white">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-medium">Hospitals Managed by You ({hospitals.length})</CardTitle>
                <CardDescription>View and manage your assigned hospitals</CardDescription>
              </div>
              <Button onClick={handleAddHospital} className="gap-2 bg-black! text-white! hover:bg-gray-800!">
                <Plus className="w-4 h-4" />
                Add Hospital
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <HospitalsTable 
                hospitals={hospitals}
                onEdit={handleEditHospital}
                onView={handleViewHospital}
                onDelete={handleDeleteHospital}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <DoctorDialog 
        open={doctorDialogOpen} 
        onOpenChange={setDoctorDialogOpen}
        doctor={selectedDoctor}
        onSave={handleSaveDoctor}
      />
      
      <HospitalDialog 
        open={hospitalDialogOpen} 
        onOpenChange={setHospitalDialogOpen}
        hospital={selectedHospital}
        onSave={handleSaveHospital}
      />
    </div>
    </DashboardLayout>
  );
};



export default Settings;