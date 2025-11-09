import { useEffect, useState } from "react";
import { apiService } from "@/lib/api";
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
import { Loader2 } from "lucide-react";

interface AssignedDoctor {
  _id: string;
  email: string;
  full_name: string;
}

interface Patient {
  _id: string;
  name: string;
  patient_id: string;
  priority: string;
  sex: string;
  age: number;
  study: string;
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

  const getAssignedToName = (assignedTo: string | AssignedDoctor | null): string => {
    if (!assignedTo) return "Unassigned";
    if (typeof assignedTo === 'string') return assignedTo;
    return assignedTo.full_name || "Unassigned";
  };


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
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Recently Added Patients</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Patient ID</TableHead>
                <TableHead className="font-semibold">Name</TableHead>
                <TableHead className="font-semibold">Age/Sex</TableHead>
                <TableHead className="font-semibold">Study</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Priority</TableHead>
                <TableHead className="font-semibold">Assigned To</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {patients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10">
                    <p className="text-muted-foreground">No patients found</p>
                  </TableCell>
                </TableRow>
              ) : (
                patients.map((patient) => (
                  <TableRow key={patient._id} className="hover:bg-muted/30">
                    <TableCell className="font-medium">
                      {patient.patient_id}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{patient.name}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {patient.age}Y / {patient.sex}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">{patient.study}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(patient.status)}>
                        {patient.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getPriorityVariant(patient.priority)}>
                        {patient.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {getAssignedToName(patient.assigned_to)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default RecentPatientTable;