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
import { RefreshCw } from "lucide-react";
import { Heading } from "@/components/common/Heading";
import PatientDetailsModal from "./PacDetailsModal";
import { DataTable } from "@/components/common/DataTable";
import { createColumnHelper } from "@tanstack/react-table";
import { formatDate, formatTime } from "@/lib/helperFunctions";

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

// Helper function to calculate age from date of birth (YYYYMMDD format)
const calculateAge = (dob: string): string => {
  if (!dob || dob.length !== 8) return "N/A";
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
    const flattened: any = {
      ...caseItem,
      // Flatten patient data to top level
      name: caseItem.patient?.name || "N/A",
      sex: caseItem.patient?.sex || "N/A",
      date_of_birth: caseItem.patient?.date_of_birth || "",
      age: calculateAge(caseItem.patient?.date_of_birth || ""),
      // Map description to study_description for compatibility
      study_description: caseItem.description || "N/A",
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

  // Get page and limit from URL, defaulting to 1 and 10
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);


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

  useEffect(() => {
    fetchAllPacCases();
  }, [page, limit]);

  const fetchAllPacCases = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getAllPacCases(page, limit) as ApiResponse;

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

  const getStatusVariant = (status: string) => {
    if (!status || typeof status !== 'string') return "secondary";
    switch (status.toLowerCase()) {
      case "reported":
        return "success";
      case "unreported":
        return "warning";
      case "in_progress":
      case "in progress":
        return "info";
      default:
        return "secondary";
    }
  };

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
            cell: ({ row }) => (
              <div className="whitespace-nowrap text-xs">
                {row.original.age || "N/A"} / {row.original.sex || "N/A"}
              </div>
            ),
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
                <Badge variant={getStatusVariant(String(value || ""))}>
                  {String(value || "N/A")}
                </Badge>
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
              // Format based on value type
              if (value === null || value === undefined) {
                return <div className="whitespace-nowrap text-xs text-muted-foreground">N/A</div>;
              }
              if (typeof value === 'boolean') {
                return <div className="whitespace-nowrap text-xs">{value ? 'Yes' : 'No'}</div>;
              }
              if (Array.isArray(value)) {
                return <div className="whitespace-nowrap text-xs">{value.length}</div>;
              }

              // Format time fields
              if (key === 'study_time' || key === 'time_of_capture' || key.toLowerCase().includes('time')) {
                return (
                  <div className="whitespace-nowrap text-xs">
                    {formatTime(String(value))}
                  </div>
                );
              }

              // Format date fields
              if (key === 'study_date' || key === 'date_of_birth' || key === 'date_of_capture' || key.toLowerCase().includes('date')) {
                return (
                  <div className="whitespace-nowrap text-xs">
                    {formatDate(String(value))}
                  </div>
                );
              }

              return (
                <div className="whitespace-nowrap text-xs">
                  {String(value)}
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
      <div className="w-full space-y-2 border rounded-md p-4 bg-white">
        <Heading title="Manage PACs" subtitle="Manage all PACs in the system" />
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
        <div className="flex items-center justify-between px-2 py-4">
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">Rows per page</p>
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
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue placeholder={limit.toString()} />
              </SelectTrigger>
              <SelectContent side="top">
                {[20, 50, 100].map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground flex whitespace-nowrap">
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