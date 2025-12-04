import  { useState, useMemo } from 'react';
import { 
  ChevronDown, ChevronUp, Download, FileText, MessageSquare, Copy, Check,
  ClipboardCheck, FolderOpen, Image as ImageIcon, Save
} from 'lucide-react';
import { 
  useReactTable, 
  getCoreRowModel, 
  flexRender, 
  createColumnHelper,
  getFilteredRowModel,
  getSortedRowModel,
} from '@tanstack/react-table';
import type { VisibilityState } from '@tanstack/react-table';
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

const DoctorDashboard = () => {
  const [activeTab, setActiveTab] = useState<'Unreported' | 'Reported' | 'All Cases' | 'Drafted'>('Unreported');
  const [isFilterCollapsed, setIsFilterCollapsed] = useState(false);
  const [copiedCell, setCopiedCell] = useState<string | null>(null);
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [, setSelectedPatient] = useState<Patient | null>(null);
  const [message, setMessage] = useState('');
  const [messageFlag, setMessageFlag] = useState<'red' | 'blue' | 'green' | null>(null);
  const [activePeriod, setActivePeriod] = useState<string | null>(null);

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

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
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
  const patients: Patient[] = useMemo(() => Array(4).fill(null).map((_, i) => ({
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
  })), []);

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
        className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 rounded"
      >
        {copiedCell === cellId ? (
          <Check className="w-3 h-3 text-green-600" />
        ) : (
          <Copy className="w-3 h-3 text-gray-600" />
        )}
      </button>
    </div>
  );

  const columnHelper = createColumnHelper<Patient>();

  const columns = useMemo(() => [
    columnHelper.display({
      id: 'actions',
      header: 'Action',
      cell: (props) => (
        <div className="flex gap-1">
          <button className="p-1 hover:bg-blue-50 rounded" title="Verify">
            <ClipboardCheck className="w-4 h-4 text-blue-500" />
          </button>
          <button className="p-1 hover:bg-yellow-50 rounded" title="Open Folder">
            <FolderOpen className="w-4 h-4 text-yellow-500" />
          </button>
          <button 
            className="p-1 hover:bg-blue-50 rounded" 
            title="Message"
            onClick={() => handleMessageClick(props.row.original)}
          >
            <MessageSquare className="w-4 h-4 text-blue-500" />
          </button>
          <button 
            className="p-1 hover:bg-yellow-50 rounded" 
            title="Download"
            onClick={() => handleDocumentClick(props.row.original)}
          >
            <Download className="w-4 h-4 text-yellow-500" />
          </button>
          <button className="p-1 hover:bg-blue-50 rounded" title="View Images">
            <ImageIcon className="w-4 h-4 text-blue-500" />
          </button>
          <button className="p-1 hover:bg-yellow-50 rounded" title="Save">
            <Save className="w-4 h-4 text-yellow-500" />
          </button>
        </div>
      ),
    }),
    columnHelper.accessor('name', {
      header: 'Patient Name',
      cell: (info) => <CellWithCopy content={info.getValue()} cellId={`${info.row.id}-name`} />,
    }),
    columnHelper.accessor('patientId', {
      header: 'Patient ID',
      cell: (info) => <CellWithCopy content={info.getValue()} cellId={`${info.row.id}-id`} />,
    }),
    columnHelper.accessor('age', {
      header: 'Age',
      cell: (info) => <CellWithCopy content={info.getValue().toString()} cellId={`${info.row.id}-age`} />,
    }),
    columnHelper.accessor('sex', {
      header: 'Sex',
      cell: (info) => <CellWithCopy content={info.getValue()} cellId={`${info.row.id}-sex`} />,
    }),
    columnHelper.accessor('studyType', {
      header: 'Study Type',
      cell: (info) => <CellWithCopy content={info.getValue()} cellId={`${info.row.id}-study`} />,
    }),
    columnHelper.accessor('modality', {
      header: 'Modality',
      cell: (info) => <CellWithCopy content={info.getValue()} cellId={`${info.row.id}-mod`} />,
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => {
        const status = info.getValue();
        return (
          <span
            className={`inline-flex items-center gap-1 ${
              status === 'Reported'
                ? 'text-green-600'
                : status === 'Unreported'
                ? 'text-red-600'
                : 'text-yellow-600'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${
              status === 'Reported'
                ? 'bg-green-600'
                : status === 'Unreported'
                ? 'bg-red-600'
                : 'bg-yellow-600'
            }`} />
            {status}
          </span>
        );
      },
    }),
    columnHelper.accessor('referenceDoctor', {
      header: 'Reference Doctor',
      cell: (info) => <CellWithCopy content={info.getValue()} cellId={`${info.row.id}-doc`} />,
    }),
    columnHelper.accessor('uploadedDate', {
      header: 'Uploaded date & time',
      cell: (info) => <div className="whitespace-pre-line text-xs"><CellWithCopy content={info.getValue()} cellId={`${info.row.id}-upload`} /></div>,
    }),
    columnHelper.accessor('historyUploadDate', {
      header: 'History upload date & time',
      cell: (info) => <div className="whitespace-pre-line text-xs"><CellWithCopy content={info.getValue()} cellId={`${info.row.id}-history`} /></div>,
    }),
    columnHelper.accessor('reportDateTime', {
      header: 'Report date & time',
      cell: (info) => <div className="whitespace-pre-line text-xs"><CellWithCopy content={info.getValue()} cellId={`${info.row.id}-report`} /></div>,
    }),
    columnHelper.accessor('reportedBy', {
      header: 'Reported by',
      cell: (info) => <CellWithCopy content={info.getValue()} cellId={`${info.row.id}-by`} />,
    }),
    columnHelper.accessor('totalNo', {
      header: 'Total no',
      cell: (info) => <CellWithCopy content={info.getValue()} cellId={`${info.row.id}-total`} />,
    }),
    columnHelper.accessor('hospitalName', {
      header: 'Hospital name',
      cell: (info) => <CellWithCopy content={info.getValue()} cellId={`${info.row.id}-hospital`} />,
    }),
    columnHelper.accessor('accessionNumber', {
      header: 'Accession Number',
      cell: (info) => <CellWithCopy content={info.getValue()} cellId={`${info.row.id}-acc`} />,
    }),
  ], [copiedCell]);

  const table = useReactTable({
    data: patients,
    columns,
    state: {
      columnVisibility,
    },
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
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
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tab}
            </button>
          ))}
          <button
            onClick={() => setIsFilterCollapsed(!isFilterCollapsed)}
            className="ml-auto p-2 hover:bg-gray-100 rounded"
          >
            {isFilterCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Filters Section */}
      {!isFilterCollapsed && (
        <div className="p-6 bg-[#F8F9FC] border-b border-gray-200 text-xs flex gap-8">
          {/* Left Section - Inputs */}
          <div className="flex-1 grid grid-cols-4 gap-x-6 gap-y-6">
            {/* Row 1 */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Patient Name</label>
              <Input
                placeholder="Search patient..."
                value={filters.patientName}
                onChange={(e) => setFilters({ ...filters, patientName: e.target.value })}
                className="bg-[#F8F9FC] border-gray-200 h-9 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Patient ID</label>
              <Input
                placeholder="Enter id"
                value={filters.patientId}
                onChange={(e) => setFilters({ ...filters, patientId: e.target.value })}
                className="bg-[#F8F9FC] border-gray-200 h-9 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Body part</label>
              <Input
                placeholder="Enter body part"
                value={filters.bodyPart}
                onChange={(e) => setFilters({ ...filters, bodyPart: e.target.value })}
                className="bg-[#F8F9FC] border-gray-200 h-9 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Select gender</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setFilters({ ...filters, gender: { ...filters.gender, M: !filters.gender.M } })}
                  className={`w-9 h-9 rounded border flex items-center justify-center transition-colors ${
                    filters.gender.M ? 'bg-gray-200 border-gray-300' : 'bg-[#F8F9FC] border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  M
                </button>
                <button
                  onClick={() => setFilters({ ...filters, gender: { ...filters.gender, F: !filters.gender.F } })}
                  className={`w-9 h-9 rounded border flex items-center justify-center transition-colors ${
                    filters.gender.F ? 'bg-gray-200 border-gray-300' : 'bg-[#F8F9FC] border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  F
                </button>
              </div>
            </div>

            {/* Row 2 */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Hospital</label>
              <Input
                placeholder="Search Hospital..."
                value={filters.hospital}
                onChange={(e) => setFilters({ ...filters, hospital: e.target.value })}
                className="bg-[#F8F9FC] border-gray-200 h-9 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Select date</label>
              <Input
                type="date"
                placeholder="Enter starting date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="bg-[#F8F9FC] border-gray-200 h-9 text-xs"
              />
              <div className="flex gap-3 mt-2">
                {['1D', '2D', '3D', '1W', '2W'].map((period) => (
                  <button
                    key={period}
                    onClick={() => setActivePeriod(period)}
                    className={`text-[10px] font-bold transition-colors ${
                      activePeriod === period ? 'text-blue-600' : 'text-gray-900 hover:text-blue-600'
                    }`}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Enter date</label>
              <Input
                type="date"
                placeholder="Enter ending date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="bg-[#F8F9FC] border-gray-200 h-9 text-xs"
              />
            </div>
            <div className="flex items-start gap-2 pt-6">
              <Button onClick={() => console.log('Apply filter')} className="bg-[#4B8BF4] hover:bg-blue-600 h-9 text-xs px-6">
                Apply filter
              </Button>
              <Button onClick={resetFilters} className="bg-[#4B8BF4] hover:bg-blue-600 h-9 text-xs px-6">
                Reset filter
              </Button>
            </div>
          </div>

          {/* Right Section - Modality */}
          <div className="w-[400px] border-l border-gray-200 pl-8">
            <label className="block text-xs font-medium text-gray-500 mb-4">Select modality</label>
            <div className="grid grid-cols-4 gap-y-4 gap-x-2">
              {Object.keys(filters.modalities).map((mod) => (
                <label key={mod} className="flex items-center gap-2 cursor-pointer">
                  <div className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                    filters.modalities[mod as keyof typeof filters.modalities]
                      ? 'bg-[#9CA3AF] border-[#9CA3AF]'
                      : 'bg-white border-gray-300'
                  }`}>
                    <Checkbox
                      checked={filters.modalities[mod as keyof typeof filters.modalities]}
                      onCheckedChange={(checked) =>
                        setFilters({
                          ...filters,
                          modalities: { ...filters.modalities, [mod]: checked as boolean },
                        })
                      }
                      className="border-0 w-4 h-4 data-[state=checked]:bg-transparent data-[state=checked]:text-white"
                    />
                  </div>
                  <span className="text-xs font-bold text-gray-700">{mod}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Table Toolbar */}
      <div className="p-4 border-b border-gray-200 flex items-center gap-2">
        <span className="text-sm font-medium">Toolbar</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              Columns <ChevronDown className="w-4 h-4 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="bottom" className="w-56">
            {table.getAllLeafColumns().map((column) => {
              return (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  className="capitalize"
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(!!value)}
                >
                  {column.id.replace(/([A-Z])/g, ' $1').trim()}
                </DropdownMenuCheckboxItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="p-3 text-left font-medium text-gray-700">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="p-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Message Dialog */}
      <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
        <DialogContent className="sm:max-w-[500px] bg-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Message</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              placeholder="Type your message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[150px] resize-none border-2 border-blue-400 focus:border-blue-500"
            />
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700">Flags</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setMessageFlag('red')}
                  className={`w-8 h-8 rounded ${
                    messageFlag === 'red' ? 'ring-2 ring-offset-2 ring-red-500' : ''
                  }`}
                >
                  <div className="w-full h-full bg-red-500 rounded" />
                </button>
                <button
                  onClick={() => setMessageFlag('blue')}
                  className={`w-8 h-8 rounded ${
                    messageFlag === 'blue' ? 'ring-2 ring-offset-2 ring-blue-500' : ''
                  }`}
                >
                  <div className="w-full h-full bg-blue-500 rounded" />
                </button>
                <button
                  onClick={() => setMessageFlag('green')}
                  className={`w-8 h-8 rounded ${
                    messageFlag === 'green' ? 'ring-2 ring-offset-2 ring-green-500' : ''
                  }`}
                >
                  <div className="w-full h-full bg-green-500 rounded" />
                </button>
              </div>
            </div>
            <Button 
              onClick={handleSendMessage} 
              className="w-full bg-blue-500 hover:bg-blue-600 text-white py-6 text-base"
            >
              Send
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Document Dialog */}
      <Dialog open={documentDialogOpen} onOpenChange={setDocumentDialogOpen}>
        <DialogContent className="sm:max-w-[600px] bg-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Patient Documents</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              {['Medical Report.pdf', 'Lab Results.pdf', 'X-Ray Images.pdf', 'Prescription.pdf'].map((doc, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-blue-500" />
                    <span className="font-medium text-sm">{doc}</span>
                  </div>
                  <Button variant="ghost" size="sm">
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DoctorDashboard;