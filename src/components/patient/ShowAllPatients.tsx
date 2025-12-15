import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { apiService } from "@/lib/api";
import {
  type RowSelectionState,
  type VisibilityState,
} from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
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
import { ChevronDown, ChevronUp, RefreshCw, SlidersHorizontal } from "lucide-react";
import { Heading } from "@/components/common/Heading";
import PatientDetailsModal from "./PacDetailsModal";
import { DataTable, CellWithCopy } from "@/components/common/DataTable";
import { createColumnHelper } from "@tanstack/react-table";
import { formatDate, formatTime } from "@/lib/helperFunctions";
import { Check, Copy } from "lucide-react";
import FilterPanel, { type FilterState } from "@/components/common/FilterPanel";
import { format } from "date-fns";

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
  pac_patinet_id: string;
  name: string;
  dob: string; // Date of birth in format YYYYMMDD
  hospital_id: string;
  sex: string;
  study_description: string;
  age: string;
  study: Study | string;
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
  date_of_birth: string;
  name: string;
  sex: string;
}

interface PacCase {
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
  patient: CasePatient;
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

// Component for status cell with copy functionality
const StatusCellWithCopy = ({ value, cellId }: { value: any; cellId: string }) => {
  const [copiedCell, setCopiedCell] = useState<string | null>(null);
  const displayValue = value || "-";

  const handleCopy = (text: string, cellId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCell(cellId);
    setTimeout(() => setCopiedCell(null), 2000);
  };

  const getStatusVariant = (status: string) => {
    if (!status || typeof status !== 'string') return "secondary";
    switch (status.toLowerCase()) {
      case "assigned":
        return "success";
      case "unassigned":
        return "warning";
      case "in_progress":
      case "in progress":
        return "info";
      default:
        return "secondary";
    }
  };

  return (
    <div className="group relative">
      <div className="pr-6">
        <Badge variant={getStatusVariant(String(value || ""))}>
          {String(displayValue)}
        </Badge>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleCopy(String(displayValue), cellId);
        }}
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
};

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

// Helper function to flatten case data and merge patient info
const flattenCaseData = (cases: PacCase[]): any[] => {
  return cases.map((caseItem) => {
    // Extract assigned_to doctor name
    const assignedDoctorName =
      caseItem.assigned_to && typeof caseItem.assigned_to === 'object' && 'full_name' in caseItem.assigned_to
        ? (caseItem.assigned_to as AssignedDoctor).full_name
        : caseItem.assigned_to || "";

    const flattened: any = {
      ...caseItem,
      // Flatten patient data to top level
      name: caseItem.patient?.name || "",
      sex: caseItem.patient?.sex || "",
      date_of_birth: caseItem.patient?.date_of_birth || "",
      age: calculateAge(caseItem.patient?.date_of_birth || ""),
      // Map description to study_description for compatibility
      study_description: caseItem.description || "",
      // Extract assigned_to doctor name
      assigned_to: assignedDoctorName,
    };
    return flattened;
  });
};

// Helper function to get all unique keys from data
const getAllKeys = (data: any[]): string[] => {
  const keys = new Set<string>();
  data.forEach((item) => {
    Object.keys(item).forEach((key) => {
      // Skip nested objects and functions
      if (item[key] !== null && typeof item[key] === 'object' && !Array.isArray(item[key])) {
        // Flatten nested objects
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
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [isFilterCollapsed, setIsFilterCollapsed] = useState(true);
  
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

      // Handle gender filter
      if (filters.gender.M && !filters.gender.F) {
        apiFilters.gender = "M";
      } else if (filters.gender.F && !filters.gender.M) {
        apiFilters.gender = "F";
      }
      // If both are selected or neither, don't send gender filter

      // Handle modality filter - get the first selected modality
      const selectedModality = Object.entries(filters.modalities).find(
        ([_, isSelected]) => isSelected && _ !== "ALL"
      );
      if (selectedModality) {
        apiFilters.modality = selectedModality[0];
      }

      const response = await apiService.getAllPacCases(page, limit, apiFilters) as ApiResponse;

      if (response.success) {
        const casesData = response.data?.cases || [];
        setCases(casesData);
        setPagination(response.pagination || null);

        // Initialize column visibility for all columns
        if (casesData.length > 0) {
          const flattened = flattenCaseData(casesData);
          const allKeys = getAllKeys(flattened);
          const initialVisibility: VisibilityState = {};
          allKeys.forEach((key) => {
            // Hide some technical/internal fields by default
            if (!['_id', 'patient_id', 'hospital_id', '__v', 'patient'].includes(key)) {
              initialVisibility[key] = true;
            } else {
              initialVisibility[key] = false;
            }
          });
          // Always show select column
          initialVisibility['select'] = true;
          setColumnVisibility(initialVisibility);
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

  // Generate dynamic columns based on the data
  const columns = useMemo(() => {
    if (cases.length === 0) return [];

    const flattened = flattenCaseData(cases);
    const allKeys = getAllKeys(flattened);

    // Filter out technical/internal fields and nested objects
    const displayKeys = allKeys.filter(key =>
      !['_id', 'patient_id', 'hospital_id', '__v', 'patient'].includes(key) &&
      !key.includes('.') // Exclude nested object paths
    );

    const columnHelper = createColumnHelper<any>();

    const dynamicColumns = [
      columnHelper.display({
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
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
    ];

    // Check if both age and sex exist to combine them
    const hasAge = displayKeys.includes('age');
    const hasSex = displayKeys.includes('sex');
    const shouldCombineAgeSex = hasAge && hasSex;
    const processedKeys = new Set<string>();

    // Generate columns for each key
    displayKeys.forEach((key) => {
      // Skip if already processed (for age/sex combination)
      if (processedKeys.has(key)) return;

      const headerLabel = key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());

      // Special handling for age/sex combination
      if (shouldCombineAgeSex && (key === 'age' || key === 'sex')) {
        dynamicColumns.push(
          columnHelper.display({
            id: "age_sex",
            header: "Age/Sex",
            cell: ({ row }) => {
              const ageValue = row.original.age || "";
              const sexValue = row.original.sex || "";
              const combinedValue = `${ageValue || "-"} / ${sexValue || "-"}`;
              return (
                <CellWithCopy
                  content={combinedValue}
                  cellId={`${row.id}-age_sex`}
                />
              );
            },
          })
        );
        processedKeys.add('age');
        processedKeys.add('sex');
        return;
      }

      // Special handling for status field
      if (key === 'status') {
        dynamicColumns.push(
          columnHelper.display({
            id: key,
            header: headerLabel,
            cell: ({ row }) => {
              const value = (row.original as any)[key];
              return (
                <StatusCellWithCopy
                  value={value}
                  cellId={`${row.id}-${key}`}
                />
              );
            },
          })
        );
      } else {
        dynamicColumns.push(
          columnHelper.display({
            id: key,
            header: headerLabel,
            cell: ({ row }) => {
              const value = (row.original as any)[key];
              let displayValue: string = "-";

              // Format based on value type
              if (value === null || value === undefined || value === "") {
                displayValue = "-";
              } else if (typeof value === 'boolean') {
                displayValue = value ? 'Yes' : 'No';
              } else if (Array.isArray(value)) {
                displayValue = value.length.toString();
              } else if (typeof value === 'object') {
                // Handle objects - try to extract meaningful data
                if ('full_name' in value) {
                  displayValue = (value as any).full_name || "-";
                } else {
                  displayValue = "-";
                }
              } else {
                // Format time fields
                if (key === 'study_time' || key === 'time_of_capture' || key.toLowerCase().includes('time')) {
                  displayValue = formatTime(String(value));
                }
                // Format date fields
                else if (key === 'study_date' || key === 'date_of_birth' || key === 'date_of_capture' || key.toLowerCase().includes('date')) {
                  displayValue = formatDate(String(value));
                } else {
                  displayValue = String(value);
                }
              }

              return (
                <div className="whitespace-nowrap text-xs">
                  <CellWithCopy
                    content={displayValue}
                    cellId={`${row.id}-${key}`}
                  />
                </div>
              );
            },
          })
        );
      }
    });

    return dynamicColumns;
  }, [cases]);

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

  // Flatten cases data for display
  const flattenedCases = useMemo(() => {
    return flattenCaseData(cases);
  }, [cases]);

  return (
    <>
      <div className="w-full space-y-2 border rounded-md p-2 bg-white">
        <div className="flex items-center justify-between">
          <Heading title="Manage PACs" subtitle="Manage all PACs in the system" />
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
              <SelectTrigger className="h-7 w-[60px] text-xs">
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
          dob: selectedCase.patient?.date_of_birth || "",
          hospital_id: selectedCase.hospital_id,
          sex: selectedCase.patient?.sex || "",
          study_description: selectedCase.description || "",
          age: calculateAge(selectedCase.patient?.date_of_birth || ""),
          study: { study_uid: selectedCase.study_uid, body_part: selectedCase.body_part },
          treatment_type: "",
          date_of_capture: formatDate(selectedCase.study_date || ""),
          time_of_capture: formatTime(selectedCase.study_time || ""),
          referring_doctor: "",
          accession_number: selectedCase.accession_number || "",
          pac_images: [],
          status: "",
          study_date: selectedCase.study_date || "",
          modality: selectedCase.modality || "",
          assigned_to: null,
          pac_images_count: 0,
        } as Patient : null}
        doctors={doctors}
        selectedDoctorId={selectedDoctorId}
        onDoctorSelect={setSelectedDoctorId}
        onAssignDoctor={handleAssignDoctor}
        isAssigning={assigning}
        isLoadingDoctors={loadingDoctors}
      />
    </>
  );
};

export default ShowAllPatients;