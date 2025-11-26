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
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const [assigning, setAssigning] = useState(false);
  const [loadingDoctors, setLoadingDoctors] = useState(false);

  useEffect(() => {
    fetchAllPatients();
  }, []);

  const fetchAllPatients = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getAllPatients() as ApiResponse;

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
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-2xl font-bold">All Patients</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Total: {patients.length} patient{patients.length !== 1 ? 's' : ''}
          </p>
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
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold ">Patient ID</TableHead>
                <TableHead className="font-semibold">Name</TableHead>
                <TableHead className="font-semibold">Email</TableHead>
                <TableHead className="font-semibold">Phone</TableHead>
                <TableHead className="font-semibold">Age/Sex</TableHead>
                <TableHead className="font-semibold">Patient Type</TableHead>
                <TableHead className="font-semibold">Center</TableHead>
                <TableHead className="font-semibold">Study</TableHead>
                <TableHead className="font-semibold">Images</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Priority</TableHead>
                <TableHead className="font-semibold">Assigned To</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {patients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-10">
                    <p className="text-muted-foreground">No patients found</p>
                  </TableCell>
                </TableRow>
              ) : (
                patients.map((patient) => (
                  <TableRow
                    key={patient._id}
                    className="hover:bg-muted/30 cursor-pointer"
                    onClick={() => handlePatientClick(patient)}
                  >
                    <TableCell className="font-medium">
                      {patient.patient_id}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <p className="font-medium">{patient.name}</p>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {patient.email}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {patient.phone}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {patient.age}Y / {patient.sex}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {patient.patient_type}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {patient.center}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {patient.study}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {patient.images_count}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(patient.status)}>
                        {patient.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      <Badge variant={getPriorityVariant(patient.priority)}>
                        {patient.priority}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {getAssignedToName(patient.assigned_to)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
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
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-muted-foreground">Patient ID</label>
                  <p className="text-sm font-medium">{selectedPatient.patient_id}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-muted-foreground">Name</label>
                  <p className="text-sm font-medium">{selectedPatient.name}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p className="text-sm">{selectedPatient.email}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-muted-foreground">Phone</label>
                  <p className="text-sm">{selectedPatient.phone}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-muted-foreground">Age</label>
                  <p className="text-sm">{selectedPatient.age} years</p>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-muted-foreground">Sex</label>
                  <p className="text-sm">{selectedPatient.sex}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-muted-foreground">Patient Type</label>
                  <p className="text-sm">{selectedPatient.patient_type}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-muted-foreground">Center</label>
                  <p className="text-sm">{selectedPatient.center}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-muted-foreground">Study</label>
                  <p className="text-sm font-medium">{selectedPatient.study}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Images Count</label>
                  <p className="text-sm">{selectedPatient.images_count}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <Badge variant={getStatusVariant(selectedPatient.status)} className="mt-1">
                    {selectedPatient.status}
                  </Badge>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Priority</label>
                  <Badge variant={getPriorityVariant(selectedPatient.priority)} className="mt-1">
                    {selectedPatient.priority}
                  </Badge>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Assigned To</label>
                  <p className="text-sm">{getAssignedToName(selectedPatient.assigned_to)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Hospital ID</label>
                  <p className="text-xs font-mono">{selectedPatient.hospital_id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Created At</label>
                  <p className="text-sm">{formatDate(selectedPatient.createdAt)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Updated At</label>
                  <p className="text-sm">{formatDate(selectedPatient.updatedAt)}</p>
                </div>
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