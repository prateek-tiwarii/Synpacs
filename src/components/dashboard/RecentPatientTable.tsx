import { useEffect, useState, useMemo } from "react";
import { apiService } from "@/lib/api";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
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
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowRight, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

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

interface ApiResponse {
  success: boolean;
  message: string;
  count: number;
  data: Patient[];
}

const RecentPatientTable = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getRecentPatients() as ApiResponse;

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
    {
      accessorKey: "pac_patinet_id",
      header: "Patient ID",
      cell: ({ row }) => (
        <span className="font-medium whitespace-nowrap">
          {row.original.pac_patinet_id}
        </span>
      ),
    },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <span className="font-medium whitespace-nowrap">
          {row.original.name || 'N/A'}
        </span>
      ),
    },
    {
      accessorKey: "dob",
      header: "DOB",
      cell: ({ row }) => (
        <span className="text-sm whitespace-nowrap">
          {formatDOB(row.original.dob)}
        </span>
      ),
    },
    {
      id: "age_sex",
      header: "Age/Sex",
      cell: ({ row }) => (
        <span className="text-sm whitespace-nowrap">
          {row.original.age} / {row.original.sex}
        </span>
      ),
    },
    {
      accessorKey: "study_description",
      header: "Study Description",
      cell: ({ row }) => (
        <span className="text-sm font-medium whitespace-nowrap">
          {row.original.study_description || 'N/A'}
        </span>
      ),
    },
    {
      accessorKey: "study.body_part",
      header: "Body Part",
      cell: ({ row }) => (
        <span className="text-sm whitespace-nowrap">
          {row.original.study?.body_part || 'N/A'}
        </span>
      ),
    },
    {
      accessorKey: "treatment_type",
      header: "Treatment Type",
      cell: ({ row }) => (
        <span className="text-sm whitespace-nowrap">
          {row.original.treatment_type || 'N/A'}
        </span>
      ),
    },
    {
      accessorKey: "date_of_capture",
      header: "Date of Capture",
      cell: ({ row }) => (
        <span className="text-sm whitespace-nowrap">
          {formatDate(row.original.date_of_capture)}
        </span>
      ),
    },
    {
      accessorKey: "referring_doctor",
      header: "Referring Doctor",
      cell: ({ row }) => (
        <span className="text-sm whitespace-nowrap">
          {row.original.referring_doctor || 'N/A'}
        </span>
      ),
    },
    {
      accessorKey: "accession_number",
      header: "Accession Number",
      cell: ({ row }) => (
        <span className="text-sm font-mono whitespace-nowrap">
          {row.original.accession_number || 'N/A'}
        </span>
      ),
    },
    {
      id: "pac_images",
      header: "PAC Images",
      cell: ({ row }) => (
        <Badge variant="outline" className="font-semibold whitespace-nowrap">
          {row.original.pac_images_count ?? row.original.pac_images?.length ?? 0}
        </Badge>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={getStatusVariant(row.original.status)} className="whitespace-nowrap">
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "priority",
      header: "Priority",
      cell: ({ row }) => (
        row.original.priority ? (
          <Badge variant={getPriorityVariant(row.original.priority)} className="whitespace-nowrap">
            {row.original.priority}
          </Badge>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        )
      ),
    },
    {
      id: "assigned_to",
      header: "Assigned To",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {getAssignedToName(row.original.assigned_to)}
        </span>
      ),
    },
  ], []);

  const table = useReactTable({
    data: patients,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onRowSelectionChange: setRowSelection,
    state: {
      rowSelection,
    },
    enableRowSelection: true,
  });

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading patients...</p>
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
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex justify-between items-center p-4">
        <CardHeader className="p-0 flex flex-col gap-1">
          <CardTitle className="">
            <p className="text-xl font-bold">Recently Added Patients</p>
            <p className="text-sm text-muted-foreground">The Recent Patients added to the system</p>
          </CardTitle>
        </CardHeader>

        <Link to="/manage-patients" className="flex items-center gap-2 text-sm text-muted-foreground">
          <p className="text-sm text-muted-foreground">View All Patients</p>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      {/* <div className="px-4">
        <Filters filters={{
          center: 'All Centers',
          modality: 'All Modalities',
          doctor: 'All Doctors',
          priority: 'All Priority',
          status: 'All Status'
        }} setFilters={() => { }} />
      </div> */}
      <CardContent className="p-4">
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="bg-muted/50">
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="font-semibold whitespace-nowrap">
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
                    className="hover:bg-muted/30"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="whitespace-nowrap">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    <p className="text-muted-foreground">No patients found</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default RecentPatientTable;
