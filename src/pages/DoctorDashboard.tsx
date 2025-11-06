import React, { useState } from 'react';
import { Search, ChevronDown, ChevronUp, Download, FileText, MessageSquare, Copy, Check, Eye, FolderOpen, ClipboardList, Flag, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { DashboardLayout } from '@/components/DashboardLayout';

// Types
interface Patient {
  id: string;
  name: string;
  patientId: string;
  age: number;
  sex: string;
  studyType: string;
  modality: string;
  status: 'Reported' | 'Unreported' | 'Draft';
  referenceDoctor: string;
  uploadedDate: string;
  historyUploadDate: string;
  reportDateTime: string;
  reportedBy: string;
  totalNo: string;
  hospitalName: string;
  accessionNumber: string;
}

interface FilterState {
  patientName: string;
  patientId: string;
  bodyPart: string;
  hospital: string;
  startDate: string;
  endDate: string;
  gender: {
    M: boolean;
    F: boolean;
  };
  modalities: {
    ALL: boolean;
    DT: boolean;
    SC: boolean;
    AN: boolean;
    US: boolean;
    ECHO: boolean;
    CR: boolean;
    XA: boolean;
    MR: boolean;
    CTMR: boolean;
    PX: boolean;
    DX: boolean;
    MR2: boolean;
    NM: boolean;
    RF: boolean;
    CT: boolean;
  };
}

interface ColumnVisibility {
  patientName: boolean;
  patientId: boolean;
  age: boolean;
  sex: boolean;
  studyType: boolean;
  modality: boolean;
  status: boolean;
  referenceDoctor: boolean;
  uploadedDate: boolean;
  historyUploadDate: boolean;
  reportDateTime: boolean;
  reportedBy: boolean;
  totalNo: boolean;
  hospitalName: boolean;
  accessionNumber: boolean;
}

const DoctorDashboard = () => {
  const [activeTab, setActiveTab] = useState<'Unreported' | 'Reported' | 'All Cases' | 'Drafted'>('Unreported');
  const [isFilterCollapsed, setIsFilterCollapsed] = useState(false);
  const [copiedCell, setCopiedCell] = useState<string | null>(null);
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [message, setMessage] = useState('');
  const [messageFlag, setMessageFlag] = useState<'red' | 'blue' | 'green' | null>(null);

  const [filters, setFilters] = useState<FilterState>({
    patientName: '',
    patientId: '',
    bodyPart: '',
    hospital: '',
    startDate: '',
    endDate: '',
    gender: { M: false, F: false },
    modalities: {
      ALL: false, DT: false, SC: false, AN: false,
      US: false, ECHO: false, CR: false, XA: false,
      MR: false, CTMR: false, PX: false, DX: false,
      MR2: false, NM: false, RF: false, CT: false,
    },
  });

  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>({
    patientName: true,
    patientId: true,
    age: true,
    sex: true,
    studyType: true,
    modality: true,
    status: true,
    referenceDoctor: true,
    uploadedDate: true,
    historyUploadDate: true,
    reportDateTime: true,
    reportedBy: true,
    totalNo: true,
    hospitalName: true,
    accessionNumber: true,
  });

  // Mock data
  const patients: Patient[] = Array(20).fill(null).map((_, i) => ({
    id: `${i}`,
    name: 'John Anderson',
    patientId: 'PAT-001456',
    age: 45,
    sex: 'F',
    studyType: i % 3 === 0 ? 'Study Type' : 'CT Chest with contrast',
    modality: i % 5 === 0 ? 'X RAY' : i % 7 === 0 ? 'CT-SCAN' : 'MR',
    status: i % 3 === 0 ? 'Unreported' : i % 5 === 0 ? 'Draft' : 'Reported',
    referenceDoctor: 'Dr. Johnson',
    uploadedDate: '2024-01-15\n09:30',
    historyUploadDate: '2024-01-15\n09:30',
    reportDateTime: '2024-01-15\n09:30',
    reportedBy: 'Dr. Johnson',
    totalNo: '120/120',
    hospitalName: 'Max,Delhi',
    accessionNumber: '1',
  }));

  const handleCopy = (text: string, cellId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCell(cellId);
    setTimeout(() => setCopiedCell(null), 2000);
  };

  const handleMessageClick = (patient: Patient) => {
    setSelectedPatient(patient);
    setMessageDialogOpen(true);
  };

  const handleDocumentClick = (patient: Patient) => {
    setSelectedPatient(patient);
    setDocumentDialogOpen(true);
  };

  const handleSendMessage = () => {
    console.log('Sending message:', message, 'with flag:', messageFlag);
    setMessage('');
    setMessageFlag(null);
    setMessageDialogOpen(false);
  };

  const resetFilters = () => {
    setFilters({
      patientName: '',
      patientId: '',
      bodyPart: '',
      hospital: '',
      startDate: '',
      endDate: '',
      gender: { M: false, F: false },
      modalities: {
        ALL: false, DT: false, SC: false, AN: false,
        US: false, ECHO: false, CR: false, XA: false,
        MR: false, CTMR: false, PX: false, DX: false,
        MR2: false, NM: false, RF: false, CT: false,
      },
    });
  };

  const CellWithCopy = ({ content, cellId }: { content: string; cellId: string }) => (
    <div className="group relative">
      <div className="pr-6">{content}</div>
      <button
        onClick={() => handleCopy(content, cellId)}
        style={{ backgroundColor: 'transparent' }}
        className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-gray-100"
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        {copiedCell === cellId ? (
          <Check className="w-3 h-3 text-green-600" />
        ) : (
          <Copy className="w-3 h-3 text-gray-600" />
        )}
      </button>
    </div>
  );

  return (
    <DashboardLayout>
    <div className="min-h-screen bg-white">
      {/* Header Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-2 p-4">
          {(['Unreported', 'Reported', 'All Cases', 'Drafted'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-black! text-white!'
                  : 'bg-white! text-gray-700! border border-gray-200 hover:bg-gray-50!'
              }`}
            >
              {tab}
            </button>
          ))}
          <button
            onClick={() => setIsFilterCollapsed(!isFilterCollapsed)}
            className="ml-auto p-2 hover:bg-gray-100! rounded bg-white! border border-gray-200"
          >
            {isFilterCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Filters Section */}
      {!isFilterCollapsed && (
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Patient Name</label>
              <Input
                placeholder="Search patient..."
                value={filters.patientName}
                onChange={(e) => setFilters({ ...filters, patientName: e.target.value })}
                className="bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Patient ID</label>
              <Input
                placeholder="Enter id"
                value={filters.patientId}
                onChange={(e) => setFilters({ ...filters, patientId: e.target.value })}
                className="bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Body part</label>
              <Input
                placeholder="Enter body part"
                value={filters.bodyPart}
                onChange={(e) => setFilters({ ...filters, bodyPart: e.target.value })}
                className="bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select gender</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={filters.gender.M}
                    onCheckedChange={(checked) =>
                      setFilters({ ...filters, gender: { ...filters.gender, M: checked as boolean } })
                    }
                    className="bg-white! border-gray-300! data-[state=checked]:bg-black! data-[state=checked]:border-black! data-[state=checked]:text-white!"
                  />
                  <span className="text-sm">M</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={filters.gender.F}
                    onCheckedChange={(checked) =>
                      setFilters({ ...filters, gender: { ...filters.gender, F: checked as boolean } })
                    }
                    className="bg-white! border-gray-300! data-[state=checked]:bg-black! data-[state=checked]:border-black! data-[state=checked]:text-white!"
                  />
                  <span className="text-sm">F</span>
                </label>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hospital</label>
              <Input
                placeholder="Search Hospital..."
                value={filters.hospital}
                onChange={(e) => setFilters({ ...filters, hospital: e.target.value })}
                className="bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select date</label>
              <Input
                type="date"
                placeholder="Enter starting date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Enter date</label>
              <Input
                type="date"
                placeholder="Enter ending date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="bg-white"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={() => console.log('Apply filter')} className="bg-black! text-white! hover:bg-gray-800!">
                Apply filter
              </Button>
              <Button onClick={resetFilters} variant="outline" className="bg-white! text-gray-900! border-gray-300! hover:bg-gray-50!">
                Reset filter
              </Button>
            </div>
          </div>

          {/* Modality Checkboxes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select modality</label>
            <div className="grid grid-cols-8 gap-4">
              {Object.keys(filters.modalities).map((mod) => (
                <label key={mod} className="flex items-center gap-2">
                  <Checkbox
                    checked={filters.modalities[mod as keyof typeof filters.modalities]}
                    onCheckedChange={(checked) =>
                      setFilters({
                        ...filters,
                        modalities: { ...filters.modalities, [mod]: checked as boolean },
                      })
                    }
                    className="bg-white! border-gray-300! data-[state=checked]:bg-black! data-[state=checked]:border-black! data-[state=checked]:text-white!"
                  />
                  <span className="text-sm">{mod}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Time Period Selector */}
          <div className="flex gap-2 mt-4">
            {['1D', '2D', '3D', '1W', '2W'].map((period) => (
              <button
                key={period}
                className={`px-3 py-1 text-sm rounded border ${
                  period === '2W' ? 'bg-black! text-white! border-black!' : 'bg-white! text-gray-700! border-gray-300! hover:bg-gray-50!'
                }`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Table Toolbar */}
      <div className="p-4 border-b border-gray-200 flex items-center gap-2">
        <span className="text-sm font-medium">Toolbar</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="bg-white! text-gray-900! border-gray-300! hover:bg-gray-50!">
              Fields <ChevronDown className="w-4 h-4 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 bg-white!">
            {Object.keys(columnVisibility).map((col) => (
              <DropdownMenuCheckboxItem
                key={col}
                checked={columnVisibility[col as keyof ColumnVisibility]}
                onCheckedChange={(checked) =>
                  setColumnVisibility({ ...columnVisibility, [col]: checked })
                }
                className="cursor-pointer hover:bg-gray-100!"
              >
                {col.replace(/([A-Z])/g, ' $1').trim()}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="p-3 text-left font-medium text-gray-700">Action</th>
              {columnVisibility.patientName && <th className="p-3 text-left font-medium text-gray-700">Patient Name</th>}
              {columnVisibility.patientId && <th className="p-3 text-left font-medium text-gray-700">Patient ID</th>}
              {columnVisibility.age && <th className="p-3 text-left font-medium text-gray-700">Age</th>}
              {columnVisibility.sex && <th className="p-3 text-left font-medium text-gray-700">Sex</th>}
              {columnVisibility.studyType && <th className="p-3 text-left font-medium text-gray-700">Study Type</th>}
              {columnVisibility.modality && <th className="p-3 text-left font-medium text-gray-700">Modality</th>}
              {columnVisibility.status && <th className="p-3 text-left font-medium text-gray-700">Status</th>}
              {columnVisibility.referenceDoctor && <th className="p-3 text-left font-medium text-gray-700">Reference Doctor</th>}
              {columnVisibility.uploadedDate && <th className="p-3 text-left font-medium text-gray-700">Uploaded date & time</th>}
              {columnVisibility.historyUploadDate && <th className="p-3 text-left font-medium text-gray-700">History upload date & time</th>}
              {columnVisibility.reportDateTime && <th className="p-3 text-left font-medium text-gray-700">Report date & time</th>}
              {columnVisibility.reportedBy && <th className="p-3 text-left font-medium text-gray-700">Reported by</th>}
              {columnVisibility.totalNo && <th className="p-3 text-left font-medium text-gray-700">Total no</th>}
              {columnVisibility.hospitalName && <th className="p-3 text-left font-medium text-gray-700">Hospital name</th>}
              {columnVisibility.accessionNumber && <th className="p-3 text-left font-medium text-gray-700">Accession Number</th>}
            </tr>
          </thead>
          <tbody>
            {patients.map((patient, i) => (
              <tr key={patient.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="p-3">
                  <div className="flex gap-1">
                    <button 
                      className="p-1.5 hover:bg-gray-100! rounded bg-white! border border-gray-200 transition-colors" 
                      title="View Report"
                    >
                      <ClipboardList className="w-4 h-4 text-gray-700" />
                    </button>
                    <button 
                      className="p-1.5 hover:bg-gray-100! rounded bg-white! border border-gray-200 transition-colors" 
                      title="View Images"
                      onClick={() => handleDocumentClick(patient)}
                    >
                      <Eye className="w-4 h-4 text-gray-700" />
                    </button>
                    <button 
                      className="p-1.5 hover:bg-gray-100! rounded bg-white! border border-gray-200 transition-colors" 
                      title="Documents"
                      onClick={() => handleDocumentClick(patient)}
                    >
                      <FolderOpen className="w-4 h-4 text-gray-700" />
                    </button>
                    <button 
                      className="p-1.5 hover:bg-gray-100! rounded bg-white! border border-gray-200 transition-colors" 
                      title="Message"
                      onClick={() => handleMessageClick(patient)}
                    >
                      <MessageSquare className="w-4 h-4 text-gray-700" />
                    </button>
                    <button 
                      className="p-1.5 hover:bg-gray-100! rounded bg-white! border border-gray-200 transition-colors" 
                      title="Download"
                      onClick={() => handleDocumentClick(patient)}
                    >
                      <Download className="w-4 h-4 text-gray-700" />
                    </button>
                    <button 
                      className="p-1.5 hover:bg-gray-100! rounded bg-white! border border-gray-200 transition-colors" 
                      title="Patient Page"
                    >
                      <FileText className="w-4 h-4 text-gray-700" />
                    </button>
                  </div>
                </td>
                {columnVisibility.patientName && <td className="p-3"><CellWithCopy content={patient.name} cellId={`${i}-name`} /></td>}
                {columnVisibility.patientId && <td className="p-3"><CellWithCopy content={patient.patientId} cellId={`${i}-id`} /></td>}
                {columnVisibility.age && <td className="p-3"><CellWithCopy content={patient.age.toString()} cellId={`${i}-age`} /></td>}
                {columnVisibility.sex && <td className="p-3"><CellWithCopy content={patient.sex} cellId={`${i}-sex`} /></td>}
                {columnVisibility.studyType && <td className="p-3"><CellWithCopy content={patient.studyType} cellId={`${i}-study`} /></td>}
                {columnVisibility.modality && <td className="p-3"><CellWithCopy content={patient.modality} cellId={`${i}-mod`} /></td>}
                {columnVisibility.status && (
                  <td className="p-3">
                    <span
                      className={`inline-flex items-center gap-1 ${
                        patient.status === 'Reported'
                          ? 'text-green-600'
                          : patient.status === 'Unreported'
                          ? 'text-red-600'
                          : 'text-yellow-600'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${
                        patient.status === 'Reported'
                          ? 'bg-green-600'
                          : patient.status === 'Unreported'
                          ? 'bg-red-600'
                          : 'bg-yellow-600'
                      }`} />
                      {patient.status}
                    </span>
                  </td>
                )}
                {columnVisibility.referenceDoctor && <td className="p-3"><CellWithCopy content={patient.referenceDoctor} cellId={`${i}-doc`} /></td>}
                {columnVisibility.uploadedDate && <td className="p-3 whitespace-pre-line text-xs"><CellWithCopy content={patient.uploadedDate} cellId={`${i}-upload`} /></td>}
                {columnVisibility.historyUploadDate && <td className="p-3 whitespace-pre-line text-xs"><CellWithCopy content={patient.historyUploadDate} cellId={`${i}-history`} /></td>}
                {columnVisibility.reportDateTime && <td className="p-3 whitespace-pre-line text-xs"><CellWithCopy content={patient.reportDateTime} cellId={`${i}-report`} /></td>}
                {columnVisibility.reportedBy && <td className="p-3"><CellWithCopy content={patient.reportedBy} cellId={`${i}-by`} /></td>}
                {columnVisibility.totalNo && <td className="p-3"><CellWithCopy content={patient.totalNo} cellId={`${i}-total`} /></td>}
                {columnVisibility.hospitalName && <td className="p-3"><CellWithCopy content={patient.hospitalName} cellId={`${i}-hospital`} /></td>}
                {columnVisibility.accessionNumber && <td className="p-3"><CellWithCopy content={patient.accessionNumber} cellId={`${i}-acc`} /></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Message Dialog */}
      <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
        <DialogContent className="sm:max-w-[500px] bg-white">
          <button 
            onClick={() => setMessageDialogOpen(false)}
            className="absolute right-4  top-4 p-1 rounded-sm hover:bg-gray-100 z-50"
          >
            <X className="h-4 w-4  text-white" />
          </button>
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Message</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              placeholder="Type your message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[150px] resize-none border-2 border-gray-300! focus:border-black! bg-white!"
            />
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700">Flags</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setMessageFlag('red')}
                  className={`p-1.5 rounded bg-transparent! hover:bg-gray-50 ${
                    messageFlag === 'red' ? 'ring-2 ring-offset-2 ring-red-500' : ''
                  }`}
                  title="Red Flag"
                >
                  <Flag className="w-5 h-5 text-red-500 fill-red-500" />
                </button>
                <button
                  onClick={() => setMessageFlag('blue')}
                  className={`p-1.5 rounded bg-transparent! hover:bg-gray-50 ${
                    messageFlag === 'blue' ? 'ring-2 ring-offset-2 ring-blue-500' : ''
                  }`}
                  title="Blue Flag"
                >
                  <Flag className="w-5 h-5 text-blue-500 fill-blue-500" />
                </button>
                <button
                  onClick={() => setMessageFlag('green')}
                  className={`p-1.5 rounded bg-transparent! hover:bg-gray-50 ${
                    messageFlag === 'green' ? 'ring-2 ring-offset-2 ring-green-500' : ''
                  }`}
                  title="Green Flag"
                >
                  <Flag className="w-5 h-5 text-green-500 fill-green-500" />
                </button>
              </div>
            </div>
            <Button 
              onClick={handleSendMessage} 
              className="w-full bg-black! text-white! hover:bg-gray-800! py-6 text-base"
            >
              Send
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Document Dialog */}
      <Dialog open={documentDialogOpen} onOpenChange={setDocumentDialogOpen}>
        <DialogContent className="sm:max-w-[600px] bg-white">
          <button 
            onClick={() => setDocumentDialogOpen(false)}
            className="absolute right-4 top-4 p-1 rounded-sm hover:bg-gray-100 z-50"
          >
            <X className="h-4 w-4 text-red-500" />
          </button>
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Patient Documents</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              {['Medical Report.pdf', 'Lab Results.pdf', 'X-Ray Images.pdf', 'Prescription.pdf'].map((doc, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50!"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-blue-500" />
                    <span className="font-medium text-sm">{doc}</span>
                  </div>
                  <Button variant="ghost" size="sm" className="bg-white! text-gray-700! hover:bg-gray-100!">
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </DashboardLayout>
  );
};

export default DoctorDashboard;







