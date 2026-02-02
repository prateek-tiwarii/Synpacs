import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { apiService } from "@/lib/api";
import {
  type RowSelectionState,
  type VisibilityState,
} from "@tanstack/react-table";

import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { ChevronDown, ChevronUp, RefreshCw, SlidersHorizontal, Eye, X, ImageIcon, Settings } from "lucide-react";
import { Heading } from "@/components/common/Heading";
import PatientDetailsModal from "./PacDetailsModal";
import { DataTable, CellWithCopy } from "@/components/common/DataTable";
import { createColumnHelper } from "@tanstack/react-table";
import { formatDate, formatTime } from "@/lib/helperFunctions";

import FilterPanel, { type FilterState } from "@/components/common/FilterPanel";
import { format } from "date-fns";

interface AssignedDoctor {
  _id: string;
  email: string;
  full_name: string;
}

interface Case {
  case_uid: string;
  body_part: string;
}

interface Patient {
  _id: string;
  pac_patinet_id: string;
  name: string;
  dob: string; // Date of birth in format YYYYMMDD
  hospital_id: string;
  sex: string;
  case_description: string;
  age: string;
  case: Case | string;
  treatment_type: string;
  date_of_capture: string;
  time_of_capture: string;
  referring_doctor: string;
  accession_number: string;
  pac_images: string[]; // Array of image IDs
  status: string;
  assigned_to: string | AssignedDoctor | null;
  pac_images_count: number;
  createdAt?: string;
  updatedAt?: string;
  __v?: number;
}

interface CasePatient {
  _id: string;
  patient_id: string;
  dob: string;
  name: string;
  sex: string;
}

interface PacCase {
  _id: string;
  case_uid: string;
  accession_number: string;
  body_part: string;
  description: string;
  hospital_id: string;
  modality: string;
  patient_id: string;
  case_date: string;
  case_time: string;
  patient: CasePatient;
  attached_report: string | null;
  uploaded_images_count?: number;
  present_images_count?: number;
  history_date_time?: string;
  reporting_date_time?: string;
  hospital_name?: string;
  center_name?: string;
  referring_doctor_name?: string;
  [key: string]: any; // Allow dynamic fields
}

interface PaginationInfo {
  currentPage: number;
  pageSize: number;
  totalCases: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface ApiResponse {
  success: boolean;
  message: string;
  count: number;
  pagination: PaginationInfo;
  data: {
    cases: PacCase[];
  };
}

interface Doctor {
  _id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  doctor_details: {
    speciality: string;
    availability: any[];
  } | null;
}

interface DoctorResponse {
  success: boolean;
  message: string;
  count: number;
  data: Doctor[];
}


// Helper function to calculate age from date of birth (YYYYMMDD format)
const calculateAge = (dob: string): string => {
  if (!dob || dob.length !== 8) return "";
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

const flattenCaseData = (cases: PacCase[]): any[] => {
  return cases.map((caseItem) => {
    const assignedDoctorName =
      caseItem.assigned_to && typeof caseItem.assigned_to === 'object' && 'full_name' in caseItem.assigned_to
        ? (caseItem.assigned_to as AssignedDoctor).full_name
        : caseItem.assigned_to || "";

    const flattened: any = {
      ...caseItem,
      name: caseItem.patient?.name || "",
      sex: caseItem.patient?.sex || "",
      date_of_birth: caseItem.patient?.dob || "",
      age: calculateAge(caseItem.patient?.dob || ""),
      case_description: caseItem.description || "",
      assigned_to: assignedDoctorName,
      attached_report: caseItem.attached_report,
      uploaded_images_count: caseItem.uploaded_images_count || 0,
      present_images_count: caseItem.present_images_count || 0,
      history_date_time: caseItem.history_date_time || null,
      reporting_date_time: caseItem.reporting_date_time || null,
      center_name: caseItem.center_name || caseItem.hospital_name || null,
      hospital_name: caseItem.hospital_name || caseItem.center_name || null,
      referring_doctor_name: caseItem.referring_doctor_name || null,
      study_date_time: caseItem.case_date ? `${caseItem.case_date} ${caseItem.case_time || ''}` : null,
    };
    return flattened;
  });
};

const getAllKeys = (data: any[]): string[] => {
  const keys = new Set<string>();
  data.forEach((item) => {
    Object.keys(item).forEach((key) => {
      if (key === 'attached_report') {
        keys.add(key);
      }
      else if (item[key] !== null && typeof item[key] === 'object' && !Array.isArray(item[key])) {
        Object.keys(item[key]).forEach((nestedKey) => {
          keys.add(`${key}.${nestedKey}`);
        });
      } else if (typeof item[key] !== 'function') {
        keys.add(key);
      }
    });
  });
  return Array.from(keys).sort();
};

// Default column visibility configuration for ShowAllPatients
const DEFAULT_COLUMN_VISIBILITY: VisibilityState = {
  select: true,
  name: true,
  case_uid: true, // Case ID
  accession_number: true, // Accession Number
  'patient.sex': true, // Sex
  'patient.dob': true, // Age (calculated from DOB)
  study_date_time: true, // Study Date & Time (combined)
  history_date_time: true, // History Date & Time
  reporting_date_time: false, // Reporting Date & Time - hidden by default
  center_name: true, // Center
  hospital_name: false, // Hospital Name - same as center, hide by default
  referring_doctor_name: true, // Referring Doctor
  uploaded_images_count: true, // Image Count (Uploaded)
  present_images_count: false, // Image Count (Present) - hidden by default
  modality: true,
  status: true,
  assigned_to: true,
  attached_report: true,
  // Hide removed columns
  priority: false,
  body_part: false,
  // Hide technical/internal fields
  _id: false,
  patient_id: false,
  hospital_id: false,
  __v: false,
  patient: false,
  case_date: false, // Hidden - using study_date_time instead
  case_time: false, // Hidden - using study_date_time instead
  date_of_birth: false, // Hidden - using patient.dob instead
  age_sex: false, // Hidden - using separate age and sex columns
  case_description: false, // Hidden by default
  notes: false, // Hidden by default
};

const STORAGE_KEY_ALL_PATIENTS = 'all_patients_table_columns';

const ShowAllPatients = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [cases, setCases] = useState<PacCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<PacCase | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const [assigning, setAssigning] = useState(false);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [isFilterCollapsed, setIsFilterCollapsed] = useState(true);
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);

  // Initialize column visibility from localStorage or use default
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_ALL_PATIENTS);
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

  // Initialize filters with default values instead of null
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
    reportStatus: { reported: false, drafted: false, unreported: false },
    modalities: {
      ALL: true,
      DT: true,
      SC: true,
      AN: true,
      US: true,
      ECHO: true,
      CR: true,
      XA: true,
      MR: true,
      CTMR: true,
      PX: true,
      DX: true,
      MR2: true,
      NM: true,
      RF: true,
      CT: true,
    },
  });

  // Save column visibility to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ALL_PATIENTS, JSON.stringify(columnVisibility));
    } catch (error) {
      console.error('Failed to save column visibility to localStorage:', error);
    }
  }, [columnVisibility]);

  // Get page and limit from URL, defaulting to 1 and 20
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  // Initialize default dates in URL on mount
  useEffect(() => {
    const defaultDates = getDefaultDateRange();

    // Set default dates in URL if not present
    if (!searchParams.get("start_date") || !searchParams.get("end_date")) {
      setSearchParams((prev) => {
        const newParams = new URLSearchParams(prev);
        if (!prev.get("start_date")) {
          newParams.set("start_date", defaultDates.start);
        }
        if (!prev.get("end_date")) {
          newParams.set("end_date", defaultDates.end);
        }
        return newParams;
      });
    }
  }, []); // Only run on mount

  // Sync filters from URL params
  useEffect(() => {
    const defaultDates = getDefaultDateRange();

    const urlFilters: FilterState = {
      patientName: searchParams.get("patient_name") || "",
      patientId: searchParams.get("patient_id") || "",
      bodyPart: searchParams.get("body_part") || "",
      hospital: searchParams.get("hospital") || "",
      startDate: searchParams.get("start_date") || defaultDates.start,
      endDate: searchParams.get("end_date") || defaultDates.end,
      status: searchParams.get("status") || "all",
      gender: {
        M: searchParams.get("gender") === "M",
        F: searchParams.get("gender") === "F",
      },
      reportStatus: {
        reported: false,
        drafted: false,
        unreported: false,
      },
      modalities: {
        ALL: true,
        DT: true,
        SC: true,
        AN: true,
        US: true,
        ECHO: true,
        CR: true,
        XA: true,
        MR: true,
        CTMR: true,
        PX: true,
        DX: true,
        MR2: true,
        NM: true,
        RF: true,
        CT: true,
      },
    };

    // Parse modality from URL
    const modalityParam = searchParams.get("modality");
    if (modalityParam && urlFilters.modalities.hasOwnProperty(modalityParam)) {
      urlFilters.modalities[modalityParam as keyof typeof urlFilters.modalities] = true;
    }

    setFilters(urlFilters);
  }, [searchParams]);


  useEffect(() => {
    const currentPage = searchParams.get("page");
    const currentLimit = searchParams.get("limit");

    if (!currentPage || !currentLimit) {
      setSearchParams((prev) => {
        const newParams = new URLSearchParams(prev);
        if (!currentPage) {
          newParams.set("page", "1");
        }
        if (!currentLimit) {
          newParams.set("limit", "20");
        }
        return newParams;
      });
    }
  }, []); // Only run on mount

  // Create a filter key from URL params to use as dependency
  const filterKey = useMemo(() => {
    return JSON.stringify({
      page,
      limit,
      start_date: searchParams.get("start_date"),
      end_date: searchParams.get("end_date"),
      patient_name: searchParams.get("patient_name"),
      body_part: searchParams.get("body_part"),
      hospital: searchParams.get("hospital"),
      gender: searchParams.get("gender"),
      modality: searchParams.get("modality"),
      status: searchParams.get("status"),
    });
  }, [page, limit, searchParams]);

  useEffect(() => {
    if (filters) {
      fetchAllPacCases();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  const fetchAllPacCases = async () => {

    try {
      setLoading(true);
      setError(null);

      // Build filters object for API
      const apiFilters: {
        start_date: string;
        end_date: string;
        patient_name?: string;
        patient_id?: string;
        body_part?: string;
        gender?: string;
        hospital?: string;
        modality?: string;
        status?: string;
        report_status?: string;
      } = {
        start_date: filters.startDate,
        end_date: filters.endDate,
      };

      // Add optional filters if they have values
      if (filters.patientName) {
        apiFilters.patient_name = filters.patientName;
      }
      if (filters.patientId) {
        apiFilters.patient_id = filters.patientId;
      }
      if (filters.bodyPart) {
        apiFilters.body_part = filters.bodyPart;
      }
      if (filters.hospital) {
        apiFilters.hospital = filters.hospital;
      }
      if (filters.status && filters.status !== "all") {
        apiFilters.status = filters.status;
      }

      // Handle report status filter
      const reportStatusFilters = [];
      if (filters.reportStatus.reported) reportStatusFilters.push('reported');
      if (filters.reportStatus.drafted) reportStatusFilters.push('drafted');
      if (filters.reportStatus.unreported) reportStatusFilters.push('unreported');
      if (reportStatusFilters.length > 0) {
        apiFilters.report_status = reportStatusFilters.join(',');
      }

      // Handle gender filter
      if (filters.gender.M && !filters.gender.F) {
        apiFilters.gender = "M";
      } else if (filters.gender.F && !filters.gender.M) {
        apiFilters.gender = "F";
      }
      // If both are selected or neither, don't send gender filter

      // Handle modality filter - only send if specific modalities are selected (not all)
      const selectedModalities = Object.entries(filters.modalities)
        .filter(([key, isSelected]) => isSelected && key !== "ALL")
        .map(([key]) => key);
      
      // Check if all modalities are selected (excluding ALL)
      const allModalityKeys = Object.keys(filters.modalities).filter(k => k !== "ALL");
      const allModalitiesSelected = allModalityKeys.every(key => filters.modalities[key as keyof typeof filters.modalities]);
      
      // Only send modality filter if not all are selected
      if (selectedModalities.length > 0 && !allModalitiesSelected) {
        apiFilters.modality = selectedModalities[0]; // API likely only supports single modality
      }

      const response = await apiService.getAllPacCases(page, limit, apiFilters) as ApiResponse;

      if (response.success) {
        const casesData = response.data?.cases || [];
        setCases(casesData);
        setPagination(response.pagination || null);

        // Merge default visibility with any new columns from data
        if (casesData.length > 0) {
          const flattened = flattenCaseData(casesData);
          const allKeys = getAllKeys(flattened);

          setColumnVisibility((prevVisibility) => {
            const updatedVisibility: VisibilityState = { ...prevVisibility };

            // Add any new columns that aren't in the current visibility state
            allKeys.forEach((key) => {
              if (!(key in updatedVisibility)) {
                // Use default visibility if defined, otherwise show non-technical fields
                if (key in DEFAULT_COLUMN_VISIBILITY) {
                  updatedVisibility[key] = DEFAULT_COLUMN_VISIBILITY[key];
                } else if (['_id', 'patient_id', 'hospital_id', '__v', 'patient'].includes(key)) {
                  updatedVisibility[key] = false;
                } else {
                  updatedVisibility[key] = true;
                }
              }
            });

            return updatedVisibility;
          });
        }
      } else {
        setError(response.message || "Failed to fetch cases");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred while fetching cases");
    } finally {
      setLoading(false);
    }
  }

  const handleCaseClick = (caseItem: any) => {
    // Find the original case from cases array
    const originalCase = cases.find(c => c._id === caseItem._id);
    if (originalCase) {
      setSelectedCase(originalCase);
      setIsModalOpen(true);
      fetchDoctors();
      setSelectedDoctorId("");
    }
  };

  const fetchDoctors = async () => {
    try {
      setLoadingDoctors(true);
      const response = await apiService.getAllDoctors() as DoctorResponse;
      if (response.success) {
        setDoctors(response.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch doctors:", err);
    } finally {
      setLoadingDoctors(false);
    }
  };

  const handleAssignDoctor = async () => {
    if (!selectedCase || !selectedDoctorId) return;

    try {
      setAssigning(true);
      await apiService.assignCaseToDoctor(selectedCase._id, selectedDoctorId);

      const selectedDoctor = doctors.find(d => d._id === selectedDoctorId);
      if (selectedDoctor) {
        // Update the case in the state if needed
        // Note: The API response structure may need to be updated to include assigned_to
        setCases(prevCases =>
          prevCases.map(caseItem =>
            caseItem._id === selectedCase._id
              ? { ...caseItem } // Update with assigned doctor if API returns it
              : caseItem
          )
        );
      }

      setSelectedDoctorId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign doctor");
    } finally {
      setAssigning(false);
    }
  };

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);

    // Update URL with filter values
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);

      // Always set dates
      newParams.set("start_date", newFilters.startDate);
      newParams.set("end_date", newFilters.endDate);

      // Set optional filters
      if (newFilters.patientName) {
        newParams.set("patient_name", newFilters.patientName);
      } else {
        newParams.delete("patient_name");
      }

      if (newFilters.bodyPart) {
        newParams.set("body_part", newFilters.bodyPart);
      } else {
        newParams.delete("body_part");
      }

      if (newFilters.hospital) {
        newParams.set("hospital", newFilters.hospital);
      } else {
        newParams.delete("hospital");
      }

      // Handle gender
      if (newFilters.gender.M && !newFilters.gender.F) {
        newParams.set("gender", "M");
      } else if (newFilters.gender.F && !newFilters.gender.M) {
        newParams.set("gender", "F");
      } else {
        newParams.delete("gender");
      }

      // Handle modality
      const selectedModality = Object.entries(newFilters.modalities).find(
        ([_, isSelected]) => isSelected && _ !== "ALL"
      );
      if (selectedModality) {
        newParams.set("modality", selectedModality[0]);
      } else {
        newParams.delete("modality");
      }

      // Reset to page 1 when filters change
      newParams.set("page", "1");

      return newParams;
    });
  };

  const handleFilterReset = () => {
    const defaultDates = getDefaultDateRange();
    const resetFilters: FilterState = {
      patientName: "",
      patientId: "",
      bodyPart: "",
      hospital: "",
      startDate: defaultDates.start,
      endDate: defaultDates.end,
      status: "all",
      gender: { M: false, F: false },
      reportStatus: { reported: false, drafted: false, unreported: false },
      modalities: {
        ALL: true,
        DT: true,
        SC: true,
        AN: true,
        US: true,
        ECHO: true,
        CR: true,
        XA: true,
        MR: true,
        CTMR: true,
        PX: true,
        DX: true,
        MR2: true,
        NM: true,
        RF: true,
        CT: true,
      },
    };

    setFilters(resetFilters);

    // Reset URL params to defaults
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      newParams.set("start_date", defaultDates.start);
      newParams.set("end_date", defaultDates.end);
      newParams.delete("patient_name");
      newParams.delete("body_part");
      newParams.delete("hospital");
      newParams.delete("gender");
      newParams.delete("modality");
      newParams.set("page", "1");
      return newParams;
    });
  };

  const columnHelper = createColumnHelper<any>();

  const columns = useMemo(() => [
    // Select checkbox
    columnHelper.display({
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    }),
    // Name
    columnHelper.accessor('name', {
      header: () => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsColumnModalOpen(true);
            }}
            className="p-0.5 hover:bg-gray-200 rounded"
            title="Column Settings"
          >
            <Settings className="w-3 h-3 text-gray-600" />
          </button>
          <span>Name</span>
        </div>
      ),
      enableSorting: true,
      cell: (info) => (
        <div className="flex items-center justify-between gap-2">
          <CellWithCopy content={info.getValue() || '-'} cellId={`${info.row.id}-name`} />
          <button
            onClick={(e) => {
              e.stopPropagation();
              const patientName = info.getValue() || '';
              handleFilterChange({ ...filters, patientName });
              setIsFilterCollapsed(false); // Expand filter panel to show the change
            }}
            className="w-3.5 h-3.5 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center cursor-pointer shrink-0"
            title="Filter Patient"
          >
            <span className="text-white text-[7px] font-bold">F</span>
          </button>
        </div>
      ),
    }),
    // Case UID
    columnHelper.accessor('case_uid', {
      header: 'Case ID',
      enableSorting: false,
      cell: (info) => <CellWithCopy content={info.getValue() || '-'} cellId={`${info.row.id}-case-uid`} />,
    }),
    // Accession Number
    columnHelper.accessor('accession_number', {
      header: 'Accession Number',
      enableSorting: false,
      cell: (info) => <CellWithCopy content={info.getValue() || '-'} cellId={`${info.row.id}-accession`} />,
    }),
    // Age
    columnHelper.accessor('age', {
      header: 'Age',
      enableSorting: false,
      cell: (info) => <CellWithCopy content={info.getValue() || '-'} cellId={`${info.row.id}-age`} />,
    }),
    // Sex
    columnHelper.accessor('sex', {
      header: 'Sex',
      enableSorting: false,
      cell: (info) => <CellWithCopy content={info.getValue() || '-'} cellId={`${info.row.id}-sex`} />,
    }),
    // Study Date & Time
    columnHelper.display({
      id: 'study_date_time',
      header: 'Study Date & Time',
      enableSorting: true,
      cell: (props) => {
        const value = props.row.original.study_date_time;
        if (!value || value === '-') return <span className="text-gray-400">-</span>;

        // Parse "YYYYMMDD HHMMSS.ms" format
        const parts = value.trim().split(' ');
        const dateStr = parts[0] || '';
        const timeStr = parts[1] || '';

        let formattedDate = '-';
        if (dateStr.length === 8) {
          formattedDate = `${dateStr.slice(6, 8)}-${dateStr.slice(4, 6)}-${dateStr.slice(0, 4)}`;
        }

        let formattedTime = '';
        if (timeStr) {
          const timePart = timeStr.split('.')[0]; // Remove milliseconds
          if (timePart.length >= 4) {
            formattedTime = `${timePart.slice(0, 2)}:${timePart.slice(2, 4)}`;
          }
        }

        return <CellWithCopy content={`${formattedDate} ${formattedTime}`.trim()} cellId={`${props.row.id}-study-dt`} />;
      },
    }),
    // History Date & Time
    columnHelper.display({
      id: 'history_date_time',
      header: 'History Date & Time',
      enableSorting: true,
      cell: (props) => {
        const value = props.row.original.history_date_time;
        if (!value) return <span className="text-gray-400">-</span>;
        const date = new Date(value);
        const formatted = date.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
        return <CellWithCopy content={formatted} cellId={`${props.row.id}-history-dt`} />;
      },
    }),
    // Reporting Date & Time
    columnHelper.display({
      id: 'reporting_date_time',
      header: 'Reporting Date & Time',
      enableSorting: true,
      cell: (props) => {
        const value = props.row.original.reporting_date_time;
        if (!value) return <span className="text-gray-400">-</span>;
        const date = new Date(value);
        const formatted = date.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
        return <CellWithCopy content={formatted} cellId={`${props.row.id}-report-dt`} />;
      },
    }),
    // Center
    columnHelper.accessor('center_name', {
      header: 'Center',
      enableSorting: false,
      cell: (info) => <CellWithCopy content={info.getValue() || '-'} cellId={`${info.row.id}-center`} />,
    }),
    // Hospital Name
    columnHelper.accessor('hospital_name', {
      header: 'Hospital',
      enableSorting: false,
      cell: (info) => <CellWithCopy content={info.getValue() || '-'} cellId={`${info.row.id}-hospital`} />,
    }),
    // Referring Doctor
    columnHelper.accessor('referring_doctor_name', {
      header: 'Referring Doctor',
      enableSorting: false,
      cell: (info) => <CellWithCopy content={info.getValue() || '-'} cellId={`${info.row.id}-ref-doc`} />,
    }),
    // Image Count
    columnHelper.accessor('uploaded_images_count', {
      header: 'Image Count',
      enableSorting: false,
      cell: (info) => <CellWithCopy content={String(info.getValue() || 0)} cellId={`${info.row.id}-img-count`} />,
    }),
    // Modality
    columnHelper.accessor('modality', {
      header: 'Modality',
      enableSorting: false,
      cell: (info) => <CellWithCopy content={info.getValue() || '-'} cellId={`${info.row.id}-modality`} />,
    }),
    // Status
    columnHelper.accessor('status', {
      header: 'Status',
      enableSorting: false,
      cell: (info) => <CellWithCopy content={info.getValue() || '-'} cellId={`${info.row.id}-status`} />,
    }),
    // Assigned To
    columnHelper.accessor('assigned_to', {
      header: 'Assigned To',
      enableSorting: false,
      cell: (info) => <CellWithCopy content={info.getValue() || '-'} cellId={`${info.row.id}-assigned`} />,
    }),
    // Attached Report
    columnHelper.display({
      id: 'attached_report',
      header: 'Report',
      enableSorting: false,
      cell: (props) => {
        const report = props.row.original.attached_report;
        if (!report) return <span className="text-gray-400">-</span>;
        return <span className="text-green-600 font-medium">Yes</span>;
      },
    }),
  ], []);

  // Error state
  if (error) {
    return (
      <Card className="w-full">
        <CardContent className="py-6">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button
            onClick={fetchAllPacCases}
            className="mt-4"
            variant="outline"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const flattenedCases = useMemo(() => {
    return flattenCaseData(cases);
  }, [cases]);

  const selectedCases = useMemo(() => {
    return Object.keys(rowSelection)
      .filter(key => rowSelection[key])
      .map(key => flattenedCases[parseInt(key)])
      .filter(Boolean);
  }, [rowSelection, flattenedCases]);

  const handleBulkViewStudies = () => {
    selectedCases.forEach((caseItem, index) => {
      if (caseItem?._id) {
        // Open each study in a new window (not tab) with a slight delay
        setTimeout(() => {
          window.open(`/case/${caseItem._id}/viewer`, `viewer_${caseItem._id}`, 'width=1200,height=800,resizable=yes,scrollbars=yes');
        }, index * 100);
      }
    });
  };

  const handleBulkViewReports = () => {
    selectedCases.forEach((caseItem, index) => {
      if (caseItem?._id) {
        setTimeout(() => {
          window.open(`/case/${caseItem._id}/report`, `report_${caseItem._id}`, 'width=1200,height=800,resizable=yes,scrollbars=yes');
        }, index * 100);
      }
    });
  };

  const handleClearSelection = () => {
    setRowSelection({});
  };

  console.log('Case', selectedCase)

  return (
    <>
      <div className="w-full space-y-2 border rounded-md p-2 bg-white">
        <div className="flex items-center justify-between">
          <Heading title="Manage all Cases" subtitle="Manage all Case's in the system" />
          <div>
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
          </div>
        </div>

        {!isFilterCollapsed && filters && (
          <div className="border rounded-md p-2">
            <FilterPanel
              onFilterChange={handleFilterChange}
              onFilterReset={handleFilterReset}
              initialFilters={filters}
            />
          </div>
        )}
        {selectedCases.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-blue-900">
                  {selectedCases.length} case{selectedCases.length > 1 ? 's' : ''} selected
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleBulkViewStudies}
                    className="h-8 text-xs bg-blue-600 hover:bg-blue-700"
                  >
                    <Eye className="w-3.5 h-3.5 mr-1.5" />
                    Open All Studies
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleBulkViewReports}
                    className="h-8 text-xs border-blue-300 text-blue-700 hover:bg-blue-100"
                  >
                    <ImageIcon className="w-3.5 h-3.5 mr-1.5" />
                    Open All Reports
                  </Button>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleClearSelection}
                className="h-8 text-xs text-gray-600 hover:text-gray-900"
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Clear
              </Button>
            </div>
          </div>
        )}
        <DataTable
          data={flattenedCases}
          columns={columns}
          isLoading={loading}
          emptyMessage="No cases found"
          loadingMessage="Loading all cases..."
          onRowClick={handleCaseClick}
          containerClassName="flex flex-col gap-0"
          showColumnToggle={true}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={setColumnVisibility}
          enableRowSelection={true}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          showDoctorsOnSelect={true}
          manualPagination={true}
          isColumnModalOpen={isColumnModalOpen}
          onColumnModalOpenChange={setIsColumnModalOpen}
        />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-2 py-3">
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">Rows per page</p>
            <Select
              value={`${limit}`}
              onValueChange={(value) => {
                const newLimit = Number(value);
                setSearchParams((prev) => {
                  const newParams = new URLSearchParams(prev);
                  newParams.set("limit", newLimit.toString());
                  newParams.set("page", "1"); // Reset to page 1 when changing limit
                  return newParams;
                });
              }}
            >
              <SelectTrigger className="h-7 w-15 text-xs">
                <SelectValue placeholder={limit.toString()} />
              </SelectTrigger>
              <SelectContent side="top">
                {[20, 50, 100].map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`} className="text-xs">
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground flex whitespace-nowrap">
                <span>Page {page} {pagination ? `of ${pagination.totalPages}` : ''}</span>
              </p>
            </div>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (pagination?.hasPrevPage || page > 1) {
                        setSearchParams((prev) => {
                          const newParams = new URLSearchParams(prev);
                          newParams.set("page", (page - 1).toString());
                          return newParams;
                        });
                      }
                    }}
                    className={
                      !pagination?.hasPrevPage && page <= 1
                        ? "pointer-events-none opacity-50"
                        : "cursor-pointer"
                    }
                  />
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (pagination?.hasNextPage) {
                        setSearchParams((prev) => {
                          const newParams = new URLSearchParams(prev);
                          newParams.set("page", (page + 1).toString());
                          return newParams;
                        });
                      }
                    }}
                    className={
                      !pagination?.hasNextPage
                        ? "pointer-events-none opacity-50"
                        : "cursor-pointer"
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>
      </div>

      <PatientDetailsModal
        isOpen={isModalOpen}
        onClose={setIsModalOpen}
        patient={selectedCase ? {
          _id: selectedCase.patient_id,
          pac_patinet_id: selectedCase.patient?.patient_id || "",
          name: selectedCase.patient?.name || "",
          dob: selectedCase.patient?.dob || "",
          hospital_id: selectedCase.hospital_id,
          sex: selectedCase.patient?.sex || "",
          case_description: selectedCase.description || "",
          age: calculateAge(selectedCase.patient?.dob || ""),
          case: { case_uid: selectedCase.case_uid, body_part: selectedCase.body_part },
          treatment_type: "",
          date_of_capture: formatDate(selectedCase.case_date || ""),
          time_of_capture: formatTime(selectedCase.case_time || ""),
          referring_doctor: "",
          accession_number: selectedCase.accession_number || "",
          pac_images: [],
          status: "",
          case_date: selectedCase.case_date || "",
          modality: selectedCase.modality || "",
          patient_history: selectedCase.patient_history || [],
          assigned_to: null,
          pac_images_count: 0,
        } as Patient : null}
        doctors={doctors}
        selectedDoctorId={selectedDoctorId}
        onDoctorSelect={setSelectedDoctorId}
        onAssignDoctor={handleAssignDoctor}
        isAssigning={assigning}
        isLoadingDoctors={loadingDoctors}
        case_id={selectedCase?._id || ""}
      />
    </>
  );
};

export default ShowAllPatients;