import { useEffect, useState, useMemo, type ReactElement } from "react";
import { useSearchParams } from "react-router-dom";
import { apiService } from "@/lib/api";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type RowSelectionState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Loader2, RefreshCw } from "lucide-react";

interface AssignedDoctor {
  _id: string;
  email: string;
  full_name: string;
}

interface Patient {
  _id: string;
  name: string;
  email: string;
  phone: string;
  hospital_id: string;
  patient_id: string;
  patient_type: string;
  priority: string;
  sex: string;
  age: number;
  center: string;
  study: string;
  images_count: number;
  status: string;
  assigned_to: string | AssignedDoctor | null;
  notes: any[];
  docs: any[];
  createdAt: string;
  updatedAt: string;
  __v: number;
}

interface ApiResponse {
  success: boolean;
  message: string;
  count: number;
  data: Patient[];
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

const ShowAllPatients = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const [assigning, setAssigning] = useState(false);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // Get page and limit from URL, defaulting to 1 and 10
  const page = parseInt(searchParams.get("page") || "1", 1);
  const limit = parseInt(searchParams.get("limit") || "20", 20);

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
    fetchAllPatients();
  }, [page, limit]);

  const fetchAllPatients = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getAllPatients(page, limit) as ApiResponse;

      if (response.success) {
        setPatients(response.data || []);
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
    switch (status.toLowerCase()) {
      case "reported":
        return "success";
      case "unreported":
        return "warning";
      case "in_progress":
        return "info";
      default:
        return "secondary";
    }
  };

  const getPriorityVariant = (priority: string) => {
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

  const handlePatientClick = (patient: Patient) => {
    setSelectedPatient(patient);
    setIsModalOpen(true);
    fetchDoctors();

    // Pre-select the assigned doctor if one exists
    if (isAssigned(patient.assigned_to) && patient.assigned_to !== null) {
      if (typeof patient.assigned_to === 'object' && patient.assigned_to._id) {
        setSelectedDoctorId(patient.assigned_to._id);
      } else if (typeof patient.assigned_to === 'string') {
        setSelectedDoctorId(patient.assigned_to);
      } else {
        setSelectedDoctorId("");
      }
    } else {
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
    if (!selectedPatient || !selectedDoctorId) return;

    try {
      setAssigning(true);
      await apiService.assignPatientToDoctor(selectedPatient._id, selectedDoctorId);

      const selectedDoctor = doctors.find(d => d._id === selectedDoctorId);
      if (selectedDoctor) {
        const doctorObject: AssignedDoctor = {
          _id: selectedDoctor._id,
          email: selectedDoctor.email,
          full_name: selectedDoctor.full_name
        };

        setPatients(prevPatients =>
          prevPatients.map(patient =>
            patient._id === selectedPatient._id
              ? { ...patient, assigned_to: doctorObject }
              : patient
          )
        );

        setSelectedPatient({
          ...selectedPatient,
          assigned_to: doctorObject
        });
      }

      setSelectedDoctorId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign doctor");
    } finally {
      setAssigning(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getAssignedToName = (assignedTo: string | AssignedDoctor | null): string => {
    if (!assignedTo) return "Unassigned";
    if (typeof assignedTo === 'string') return assignedTo;
    return assignedTo.full_name || "Unassigned";
  };

  const isAssigned = (assignedTo: string | AssignedDoctor | null): boolean => {
    return assignedTo !== null && assignedTo !== undefined;
  };

  type PatientFieldConfig = {
    key: string;
    label: string;
    value: string | number;
    valueClassName?: string;
    containerClassName?: string;
    render?: (value: string) => ReactElement;
  };

  const getPatientFieldConfig = (patient: Patient): PatientFieldConfig[] => [
    { key: "patient_id", label: "Patient ID", value: patient.patient_id, valueClassName: "font-medium" },
    { key: "name", label: "Name", value: patient.name, valueClassName: "font-medium" },
    { key: "email", label: "Email", value: patient.email },
    { key: "phone", label: "Phone", value: patient.phone },
    { key: "age", label: "Age", value: `${patient.age} years` },
    { key: "sex", label: "Sex", value: patient.sex },
    { key: "patient_type", label: "Patient Type", value: patient.patient_type },
    { key: "center", label: "Center", value: patient.center },
    { key: "study", label: "Study", value: patient.study, valueClassName: "font-medium" },
    { key: "images_count", label: "Images Count", value: patient.images_count, containerClassName: "" },
    {
      key: "status",
      label: "Status",
      value: patient.status,
      containerClassName: "",
      render: (value: string) => (
        <Badge variant={getStatusVariant(value)} className="mt-1">
          {value}
        </Badge>
      )
    },
    {
      key: "priority",
      label: "Priority",
      value: patient.priority,
      containerClassName: "",
      render: (value: string) => (
        <Badge variant={getPriorityVariant(value)} className="mt-1">
          {value}
        </Badge>
      )
    },
    { key: "assigned_to", label: "Assigned To", value: getAssignedToName(patient.assigned_to), containerClassName: "" },
    { key: "hospital_id", label: "Hospital ID", value: patient.hospital_id, valueClassName: "text-xs font-mono", containerClassName: "" },
    { key: "createdAt", label: "Created At", value: formatDate(patient.createdAt), containerClassName: "" },
    { key: "updatedAt", label: "Updated At", value: formatDate(patient.updatedAt), containerClassName: "" },
  ];

  const columns = useMemo<ColumnDef<Patient>[]>(
    () => [
      {
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
      },
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <div className="whitespace-nowrap font-medium">
            {row.getValue("name")}
          </div>
        ),
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.getValue("email")}
          </span>
        ),
      },
      {
        accessorKey: "phone",
        header: "Phone",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.getValue("phone")}
          </span>
        ),
      },
      {
        id: "age_sex",
        header: "Age/Sex",
        cell: ({ row }) => (
          <div className="whitespace-nowrap text-sm">
            {row.original.age}Y / {row.original.sex}
          </div>
        ),
      },
      {
        accessorKey: "patient_type",
        header: "Patient Type",
        cell: ({ row }) => (
          <div className="whitespace-nowrap text-sm">
            {row.getValue("patient_type")}
          </div>
        ),
      },
      {
        accessorKey: "center",
        header: "Center",
        cell: ({ row }) => (
          <div className="whitespace-nowrap text-sm">
            {row.getValue("center")}
          </div>
        ),
      },
      {
        accessorKey: "study",
        header: "Study",
        cell: ({ row }) => (
          <div className="whitespace-nowrap text-sm">
            {row.getValue("study")}
          </div>
        ),
      },
      {
        accessorKey: "images_count",
        header: "Images",
        cell: ({ row }) => (
          <div className="whitespace-nowrap text-sm">
            {row.getValue("images_count")}
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={getStatusVariant(row.getValue("status"))}>
            {row.getValue("status")}
          </Badge>
        ),
      },
      {
        accessorKey: "priority",
        header: "Priority",
        cell: ({ row }) => (
          <Badge variant={getPriorityVariant(row.getValue("priority"))}>
            {row.getValue("priority")}
          </Badge>
        ),
      },
      {
        id: "assigned_to",
        header: "Assigned To",
        cell: ({ row }) => (
          <div className="whitespace-nowrap text-sm">
            {getAssignedToName(row.original.assigned_to)}
          </div>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data: patients,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    onRowSelectionChange: setRowSelection,
    state: {
      rowSelection,
    },
  });

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading all patients...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardContent className="py-6">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button
            onClick={fetchAllPatients}
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

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 px-4">
        <div>
          <CardTitle className="text-xl font-bold">All Patients</CardTitle>
        </div>
        <Button
          onClick={fetchAllPatients}
          variant="outline"
          size="sm"
          disabled={loading}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="px-4">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="bg-muted/50">
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="font-semibold">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className="hover:bg-muted/30 cursor-pointer"
                    onClick={() => handlePatientClick(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    <p className="text-muted-foreground">No patients found</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
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
                <span>Page {page}</span>
              </p>
            </div>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (page > 1) {
                        setSearchParams((prev) => {
                          const newParams = new URLSearchParams(prev);
                          newParams.set("page", (page - 1).toString());
                          return newParams;
                        });
                      }
                    }}
                    className={
                      page <= 1
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
                      setSearchParams((prev) => {
                        const newParams = new URLSearchParams(prev);
                        newParams.set("page", (page + 1).toString());
                        return newParams;
                      });
                    }}
                    className="cursor-pointer"
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>
      </CardContent>
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Patient Details</DialogTitle>
            <DialogDescription>
              Complete information for {selectedPatient?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedPatient && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                {getPatientFieldConfig(selectedPatient).map((field) => (
                  <div
                    key={field.key}
                    className={field.containerClassName || "flex flex-col gap-2"}
                  >
                    <label className="text-sm font-medium text-muted-foreground">
                      {field.label}
                    </label>
                    {field.render ? (
                      field.render(field.value as string)
                    ) : (
                      <p className={`text-sm ${field.valueClassName || ""}`}>
                        {field.value}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              <div className="border-t pt-4">
                <label className="text-sm font-medium text-muted-foreground">Notes</label>
                <p className="text-sm mt-1">
                  {selectedPatient.notes && selectedPatient.notes.length > 0
                    ? JSON.stringify(selectedPatient.notes, null, 2)
                    : "No notes available"}
                </p>
              </div>
              <div className="border-t pt-4">
                <label className="text-sm font-medium text-muted-foreground">Documents</label>
                <p className="text-sm mt-1">
                  {selectedPatient.docs && selectedPatient.docs.length > 0
                    ? `${selectedPatient.docs.length} document(s)`
                    : "No documents available"}
                </p>
              </div>
              <div className="border-t pt-4">
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  {isAssigned(selectedPatient.assigned_to) ? "Change Doctor Assignment" : "Assign to Doctor"}
                </label>
                <div className="flex gap-2">
                  <Select
                    value={selectedDoctorId}
                    onValueChange={setSelectedDoctorId}
                    disabled={loadingDoctors || assigning}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder={loadingDoctors ? "Loading doctors..." : "Select a doctor"} />
                    </SelectTrigger>
                    <SelectContent>
                      {doctors.map((doctor) => (
                        <SelectItem key={doctor._id} value={doctor._id}>
                          {doctor.full_name}
                          {doctor.doctor_details?.speciality && ` - ${doctor.doctor_details.speciality}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleAssignDoctor}
                    disabled={!selectedDoctorId || assigning || loadingDoctors}
                  >
                    {assigning ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Assigning...
                      </>
                    ) : (
                      isAssigned(selectedPatient.assigned_to) ? "Reassign" : "Assign"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default ShowAllPatients;