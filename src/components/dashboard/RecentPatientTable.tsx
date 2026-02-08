import { useEffect, useState, useMemo } from "react";
import { apiService } from "@/lib/api";
import {
  type ColumnDef,
  type RowSelectionState,
  type VisibilityState,
} from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowRight, ChevronDown, ChevronUp, SlidersHorizontal } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { DataTable } from "@/components/common/DataTable/DataTable";
import FilterPanel, { type FilterState } from "@/components/common/FilterPanel";

interface AssignedDoctor {
  _id: string;
  email: string;
  full_name: string;
}

interface CaseInfo {
  case_uid: string;
  body_part: string;
 }

interface AttachedReport {
  _id: string;
  title: string;
  is_draft: boolean;
  is_reviewed: boolean;
  is_signed_off: boolean;
  created_by?: {
    _id: string;
    email: string;
    full_name: string;
  };
  created_at: string;
}

interface Patient {
  _id: string;
  name: string;
  pac_patinet_id: string;
  dob?: string;
  hospital_id?: string;
  priority?: string;
  sex: string;
  age: string;
  case_description?: string;
  case: CaseInfo;
  treatment_type?: string;
  date_of_capture?: string;
  referring_doctor?: string;
  accession_number?: string;
  pac_images?: string[];
  pac_images_count?: number;
  status: string;
  assigned_to: string | AssignedDoctor | null;
  attached_report?: AttachedReport | null;
}

interface Case {
  _id: string;
  case_uid: string;
  accession_number: string;
  description: string;
  hospital_id: string;
  hospital_name: string;
  patient_id: string;
  referring_physician: string | null;
  case_date: string;
  case_time: string;
  body_part: string;
  assigned_to: AssignedDoctor | null;
  case_type: string;
  priority: string;
  status: string;
  attached_report: AttachedReport | null;
  patient: {
    _id: string;
    patient_id: string;
    dob: string;
    name: string;
    sex: string;
  };
}

interface ApiResponse {
  success: boolean;
  message: string;
  count: number;
  pagination: {
    currentPage: number;
    pageSize: number;
    totalCases: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  data: {
    cases: Case[];
  };
}

// Default column visibility configuration
const DEFAULT_COLUMN_VISIBILITY: VisibilityState = {
  select: true,
  name: true,
  dob: true,
  age_sex: true,
  case_description: true,
  "case.body_part": true,
  treatment_type: false, // Hidden by default
  date_of_capture: false, // Hidden by default
  referring_doctor: false, // Hidden by default
  accession_number: true,
  pac_images: true,
  status: true,
  priority: true,
  assigned_to: true,
  attached_report: true,
};

const STORAGE_KEY = 'recent_pacs_table_columns';

interface RecentPatientTableProps {
  onDateRangeChange?: (dateRange: { from: string; to: string }) => void;
}

const RecentPatientTable = ({ onDateRangeChange }: RecentPatientTableProps = {}) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [isFilterCollapsed, setIsFilterCollapsed] = useState(true);
  const [availableCenters, setAvailableCenters] = useState<{ id: string; name: string }[]>([]);


  // Fetch available centers
  useEffect(() => {
    const fetchCenters = async () => {
      try {
        const response = await apiService.getAllManagedHospitals() as any;
        if (response.success && response.data) {
          const centers = response.data.map((hospital: any) => ({
            id: hospital._id,
            name: hospital.hospital_name || hospital.name
          }));
          setAvailableCenters(centers);
        }
      } catch (error) {
        console.error('Failed to fetch centers:', error);
      }
    };
    fetchCenters();
  }, []);

  // Initialize column visibility from localStorage or use default
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load column visibility from localStorage:', error);
    }
    return DEFAULT_COLUMN_VISIBILITY;
  });

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
  const [filters, setFilters] = useState<FilterState>({
    patientName: "",
    patientId: "",
    bodyPart: "",
    hospital: "",
    startDate: defaultDates.start,
    endDate: defaultDates.end,
    status: "all",
    gender: { M: false, F: false },
    centers: [],
    studyStatus: { reported: false, drafted: false, unreported: false, reviewed: false },
    reportStatus: { reported: false, drafted: false, unreported: false },
    modalities: {
      ALL: false,
      DT: false,
      SC: false,
      AN: false,
      US: false,
      ECHO: false,
      CR: false,
      XA: false,
      MR: false,
      CTMR: false,
      PX: false,
      DX: false,
      MR2: false,
      NM: false,
      RF: false,
      CT: false,
    },
  });

  // Save column visibility to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(columnVisibility));
    } catch (error) {
      console.error('Failed to save column visibility to localStorage:', error);
    }
  }, [columnVisibility]);

  // Notify parent component about date range changes
  useEffect(() => {
    if (onDateRangeChange && filters.startDate && filters.endDate) {
      onDateRangeChange({
        from: filters.startDate,
        to: filters.endDate
      });
    }
  }, [filters.startDate, filters.endDate, onDateRangeChange]);

  useEffect(() => {
    fetchPatients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const fetchPatients = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build filters object for API
      const apiFilters: any = {
        start_date: filters.startDate,
        end_date: filters.endDate,
      };

      // Add optional filters if they have values
      if (filters.patientName) apiFilters.patient_name = filters.patientName;
      if (filters.patientId) apiFilters.patient_id = filters.patientId;
      if (filters.bodyPart) apiFilters.body_part = filters.bodyPart;
      if (filters.hospital) apiFilters.hospital = filters.hospital;
      if (filters.status && filters.status !== "all") apiFilters.status = filters.status;

      // Handle report status filter
      const reportStatusFilters = [];
      if (filters.reportStatus?.reported) reportStatusFilters.push('reported');
      if (filters.reportStatus?.drafted) reportStatusFilters.push('drafted');
      if (filters.reportStatus?.unreported) reportStatusFilters.push('unreported');
      if (reportStatusFilters.length > 0) {
        apiFilters.report_status = reportStatusFilters.join(',');
      }

      // Handle gender filter
      if (filters.gender.M && !filters.gender.F) {
        apiFilters.gender = "M";
      } else if (filters.gender.F && !filters.gender.M) {
        apiFilters.gender = "F";
      }

      // Handle modality filter
      const selectedModality = Object.entries(filters.modalities).find(
        ([_, isSelected]) => isSelected && _ !== "ALL"
      );
      if (selectedModality) {
        apiFilters.modality = selectedModality[0];
      }

      const response = await apiService.getAllCasesWithFilters(1, 10, apiFilters) as ApiResponse;

      if (response.success && response.data?.cases) {
        // Map cases to Patient format
        const mappedPatients: Patient[] = response.data.cases.map((caseItem) => {
          const calculateAge = (dob: string): string => {
            if (!dob || dob.length !== 8) return '';
            const year = parseInt(dob.substring(0, 4));
            const month = parseInt(dob.substring(4, 6)) - 1;
            const day = parseInt(dob.substring(6, 8));
            const birthDate = new Date(year, month, day);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
              age--;
            }
            return age.toString();
          };

          // Format case date from YYYYMMDD to readable format
          const formatCaseDate = (caseDate: string): string => {
            if (!caseDate || caseDate.length !== 8) return caseDate || '';
            const year = caseDate.substring(0, 4);
            const month = caseDate.substring(4, 6);
            const day = caseDate.substring(6, 8);
            return `${year}-${month}-${day}`;
          };

          return {
            _id: caseItem._id,
            name: caseItem.patient?.name || 'N/A',
            pac_patinet_id: caseItem.patient?.patient_id || '',
            dob: caseItem.patient?.dob || '',
            hospital_id: caseItem.hospital_id,
            priority: caseItem.priority || 'Normal',
            sex: caseItem.patient?.sex || '',
            age: calculateAge(caseItem.patient?.dob || ''),
            case_description: caseItem.description || '',
            case: {
              case_uid: caseItem.case_uid,
              body_part: caseItem.body_part || '',
            },
            treatment_type: caseItem.case_type || '',
            date_of_capture: formatCaseDate(caseItem.case_date),
            referring_doctor: caseItem.referring_physician || '',
            accession_number: caseItem.accession_number || '',
            status: caseItem.status || 'Unassigned',
            assigned_to: caseItem.assigned_to,
            attached_report: caseItem.attached_report,
          };
        });
        setPatients(mappedPatients);
      } else {
        setError(response.message || "Failed to fetch patients");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred while fetching patients");
    } finally {
      setLoading(false);
    }
  };

  const getStatusVariant = (status: string) => {
    if (!status || typeof status !== 'string') return "secondary";
    switch (status.toLowerCase()) {
      case "reported":
        return "success";
      case "unreported":
        return "destructive";
      case "in_progress":
        return "info";
      default:
        return "secondary";
    }
  };

  const getPriorityVariant = (priority: string) => {
    if (!priority || typeof priority !== 'string') return "outline";
    switch (priority.toLowerCase()) {
      case "high":
        return "destructive";
      case "medium":
        return "warning";
      case "low":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getAssignedToName = (assignedTo: string | AssignedDoctor | null): string => {
    if (!assignedTo) return "Unassigned";
    if (typeof assignedTo === 'string') return assignedTo;
    return assignedTo.full_name || "Unassigned";
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const formatDOB = (dob?: string): string => {
    if (!dob) return "N/A";
    // Format YYYYMMDD to readable format
    if (dob.length === 8) {
      const year = dob.substring(0, 4);
      const month = dob.substring(4, 6);
      const day = dob.substring(6, 8);
      return `${year}-${month}-${day}`;
    }
    return dob;
  };

  // Handle filter changes from FilterPanel
  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
  };

  // Handle filter reset
  const handleFilterReset = () => {
    const defaultFilters: FilterState = {
      patientName: "",
      patientId: "",
      bodyPart: "",
      hospital: "",
      startDate: defaultDates.start,
      endDate: defaultDates.end,
      status: "all",
      gender: { M: false, F: false },
      centers: [],
      studyStatus: { reported: false, drafted: false, unreported: false, reviewed: false },
      reportStatus: { reported: false, drafted: false, unreported: false },
      modalities: {
        ALL: false,
        DT: false,
        SC: false,
        AN: false,
        US: false,
        ECHO: false,
        CR: false,
        XA: false,
        MR: false,
        CTMR: false,
        PX: false,
        DX: false,
        MR2: false,
        NM: false,
        RF: false,
        CT: false,
      },
    };
    setFilters(defaultFilters);
  };


  const columns = useMemo<ColumnDef<Patient>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    // {
    //   accessorKey: "pac_patinet_id",
    //   header: "Patient ID",
    //   cell: ({ row }) => (
    //     <span className="font-medium text-xs">
    //       {row.original.pac_patinet_id}
    //     </span>
    //   ),
    // },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <span className="font-medium text-xs">
          {row.original.name || 'N/A'}
        </span>
      ),
    },
    {
      accessorKey: "dob",
      header: "DOB",
      cell: ({ row }) => (
        <span className="text-xs">
          {formatDOB(row.original.dob)}
        </span>
      ),
    },
    {
      id: "age_sex",
      header: "Age/Sex",
      cell: ({ row }) => (
        <span className="text-xs">
          {row.original.age} / {row.original.sex}
        </span>
      ),
    },
    {
      accessorKey: "case_description",
      header: "Case Description",
      cell: ({ row }) => (
        <span className="text-xs font-medium">
          {row.original.case_description || 'N/A'}
        </span>
      ),
    },
    {
      accessorKey: "case.body_part",
      header: "Study Description",
      cell: ({ row }) => (
        <span className="text-xs">
          {row.original.case?.body_part || 'N/A'}
        </span>
      ),
    },
    {
      accessorKey: "treatment_type",
      header: "Treatment Type",
      cell: ({ row }) => (
        <span className="text-xs">
          {row.original.treatment_type || 'N/A'}
        </span>
      ),
    },
    {
      accessorKey: "date_of_capture",
      header: "Date of Capture",
      cell: ({ row }) => (
        <span className="text-xs">
          {formatDate(row.original.date_of_capture)}
        </span>
      ),
    },
    {
      accessorKey: "referring_doctor",
      header: "Referring Doctor",
      cell: ({ row }) => (
        <span className="text-xs">
          {row.original.referring_doctor || 'N/A'}
        </span>
      ),
    },
    {
      accessorKey: "accession_number",
      header: "Accession Number",
      cell: ({ row }) => (
        <span className="text-xs font-mono">
          {row.original.accession_number || 'N/A'}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={getStatusVariant(row.original.status)} className="text-xs px-2 py-0">
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "priority",
      header: "Priority",
      cell: ({ row }) => (
        row.original.priority ? (
          <Badge variant={getPriorityVariant(row.original.priority)} className="text-xs px-2 py-0">
            {row.original.priority}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )
      ),
    },
    {
      id: "assigned_to",
      header: "Assigned To",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {getAssignedToName(row.original.assigned_to)}
        </span>
      ),
    },
    {
      accessorKey: "attached_report",
      header: "Report",
      cell: ({ row }) => {
        const report = row.original.attached_report;
        if (!report) {
          return <span className="text-xs text-muted-foreground">N/A</span>;
        }

        const isDraft = report.is_draft && !report.is_reviewed && !report.is_signed_off;

        return (
          <Badge
            variant={isDraft ? "warning" : "success"}
            className="text-xs px-2 py-0 cursor-pointer hover:opacity-80"
            onClick={(e) => {
              e.stopPropagation();
              window.open(`/case/${row.original._id}/report`, '_blank');
            }}
          >
            {isDraft ? "Draft" : "Available"}
          </Badge>
        );
      },
    },
  ], []);
  
  return (
    <Card className="overflow-hidden">
      <div className="flex justify-between items-center p-4">
        <CardHeader className="p-0 flex flex-col gap-1">
          <CardTitle className="">
            <p className="text-xl font-bold">Recently Added Cases</p>
            <p className="text-sm text-muted-foreground">The Recent Cases added to the system</p>
          </CardTitle>
        </CardHeader>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsFilterCollapsed(!isFilterCollapsed)}
            className={`
              flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200
              ${!isFilterCollapsed
                ? 'bg-slate-700 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }
            `}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filters</span>
            {isFilterCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
          <Link to="/manage-cases" className="flex items-center gap-2 text-sm text-muted-foreground">
            <p className="text-sm text-muted-foreground">View All Cases</p>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Filter Panel */}
      {!isFilterCollapsed && (
        <FilterPanel
          onFilterChange={handleFilterChange}
          onFilterReset={handleFilterReset}
          initialFilters={filters}
          availableCenters={availableCenters}
          showCenters={true}
          showStudyStatus={true}
        />
      )}

      <CardContent className="px-3">
        <DataTable
          data={patients}
          columns={columns}
          isLoading={loading}
          error={error}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          enableRowSelection={true}
          emptyMessage="No Cases found"
          loadingMessage="Loading Cases..."
          showBorder={true}
          containerClassName=""
          showColumnToggle={true}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={setColumnVisibility}
          showDoctorsOnSelect={true}
        />
      </CardContent>
    </Card>
  );
};

export default RecentPatientTable;
