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
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { DataTable } from "@/components/common/DataTable/DataTable";
import { type FilterState } from "@/components/common/FilterPanel";

interface AssignedDoctor {
  _id: string;
  email: string;
  full_name: string;
}

interface Study {
  study_uid: string;
  body_part: string;
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
  study_description?: string;
  study: Study;
  treatment_type?: string;
  date_of_capture?: string;
  referring_doctor?: string;
  accession_number?: string;
  pac_images?: string[];
  pac_images_count?: number;
  status: string;
  assigned_to: string | AssignedDoctor | null;
}

interface Case {
  _id: string;
  study_uid: string;
  accession_number: string;
  body_part: string;
  description: string;
  hospital_id: string;
  modality: string;
  patient_id: string;
  study_date: string;
  study_time: string;
  assigned_to: AssignedDoctor | null;
  case_type: string;
  priority: string;
  status: string;
  patient: {
    _id: string;
    patient_id: string;
    date_of_birth: string;
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
  study_description: true,
  "study.body_part": true,
  treatment_type: false, // Hidden by default
  date_of_capture: false, // Hidden by default
  referring_doctor: false, // Hidden by default
  accession_number: true,
  pac_images: true,
  status: true,
  priority: true,
  assigned_to: true,
};

const STORAGE_KEY = 'recent_pacs_table_columns';

const RecentPatientTable = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [isFilterCollapsed, setIsFilterCollapsed] = useState(true);

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

  useEffect(() => {
    fetchPatients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
  };

  const handleFilterReset = () => {
    const defaultDates = getDefaultDateRange();
    setFilters({
      patientName: "",
      patientId: "",
      bodyPart: "",
      hospital: "",
      startDate: defaultDates.start,
      endDate: defaultDates.end,
      status: "all",
      gender: { M: false, F: false },
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
  };

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

          return {
            _id: caseItem._id,
            name: caseItem.patient?.name || 'N/A',
            pac_patinet_id: caseItem.patient?.patient_id || '',
            dob: caseItem.patient?.date_of_birth || '',
            hospital_id: caseItem.hospital_id,
            priority: caseItem.priority || 'Normal',
            sex: caseItem.patient?.sex || '',
            age: calculateAge(caseItem.patient?.date_of_birth || ''),
            study_description: caseItem.description || '',
            study: {
              study_uid: caseItem.study_uid,
              body_part: caseItem.body_part,
            },
            accession_number: caseItem.accession_number || '',
            status: caseItem.status || 'Unassigned',
            assigned_to: caseItem.assigned_to,
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
      accessorKey: "study_description",
      header: "Study Description",
      cell: ({ row }) => (
        <span className="text-xs font-medium">
          {row.original.study_description || 'N/A'}
        </span>
      ),
    },
    {
      accessorKey: "study.body_part",
      header: "Body Part",
      cell: ({ row }) => (
        <span className="text-xs">
          {row.original.study?.body_part || 'N/A'}
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
      id: "pac_images",
      header: "PAC Images",
      cell: ({ row }) => (
        <Badge variant="outline" className="font-semibold text-xs px-2 py-0">
          {row.original.pac_images_count ?? row.original.pac_images?.length ?? 0}
        </Badge>
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
  ], []);





  return (
    <Card className="overflow-hidden">
      <div className="flex justify-between items-center p-4">
        <CardHeader className="p-0 flex flex-col gap-1">
          <CardTitle className="">
            <p className="text-xl font-bold">Recently Added Patients</p>
            <p className="text-sm text-muted-foreground">The Recent Patients added to the system</p>
          </CardTitle>
        </CardHeader>

        <Link to="/manage-pacs" className="flex items-center gap-2 text-sm text-muted-foreground">
          <p className="text-sm text-muted-foreground">View All Patients</p>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <CardContent className="px-3">
        <DataTable
          data={patients}
          columns={columns}
          isLoading={loading}
          error={error}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          enableRowSelection={true}
          emptyMessage="No patients found"
          loadingMessage="Loading patients..."
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
