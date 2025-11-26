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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

// Interfaces (duplicated for now to be self-contained, or could be imported)
export interface AssignedDoctor {
    _id: string;
    email: string;
    full_name: string;
}

export interface Patient {
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

export interface Doctor {
    _id: string;
    full_name: string;
    email: string;
    is_active: boolean;
    doctor_details: {
        speciality: string;
        availability: any[];
    } | null;
}

interface PatientDetailsModalProps {
    isOpen: boolean;
    onClose: (open: boolean) => void;
    patient: Patient | null;
    doctors: Doctor[];
    selectedDoctorId: string;
    onDoctorSelect: (id: string) => void;
    onAssignDoctor: () => void;
    isAssigning: boolean;
    isLoadingDoctors: boolean;
}

const PatientDetailsModal = ({
    isOpen,
    onClose,
    patient,
    doctors,
    selectedDoctorId,
    onDoctorSelect,
    onAssignDoctor,
    isAssigning,
    isLoadingDoctors,
}: PatientDetailsModalProps) => {

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

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Patient Details</DialogTitle>
                    <DialogDescription>
                        Complete information for {patient?.name}
                    </DialogDescription>
                </DialogHeader>
                {patient && (
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-muted-foreground">Patient ID</label>
                                <p className="text-sm font-medium">{patient.patient_id}</p>
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-muted-foreground">Name</label>
                                <p className="text-sm font-medium">{patient.name}</p>
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-muted-foreground">Email</label>
                                <p className="text-sm">{patient.email}</p>
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-muted-foreground">Phone</label>
                                <p className="text-sm">{patient.phone}</p>
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-muted-foreground">Age</label>
                                <p className="text-sm">{patient.age} years</p>
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-muted-foreground">Sex</label>
                                <p className="text-sm">{patient.sex}</p>
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-muted-foreground">Patient Type</label>
                                <p className="text-sm">{patient.patient_type}</p>
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-muted-foreground">Center</label>
                                <p className="text-sm">{patient.center}</p>
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-muted-foreground">Study</label>
                                <p className="text-sm font-medium">{patient.study}</p>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground">Images Count</label>
                                <p className="text-sm">{patient.images_count}</p>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground">Status</label>
                                <Badge variant={getStatusVariant(patient.status)} className="mt-1">
                                    {patient.status}
                                </Badge>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground">Priority</label>
                                <Badge variant={getPriorityVariant(patient.priority)} className="mt-1">
                                    {patient.priority}
                                </Badge>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground">Assigned To</label>
                                <p className="text-sm">{getAssignedToName(patient.assigned_to)}</p>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground">Hospital ID</label>
                                <p className="text-xs font-mono">{patient.hospital_id}</p>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground">Created At</label>
                                <p className="text-sm">{formatDate(patient.createdAt)}</p>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground">Updated At</label>
                                <p className="text-sm">{formatDate(patient.updatedAt)}</p>
                            </div>
                        </div>
                        <div className="border-t pt-4">
                            <label className="text-sm font-medium text-muted-foreground">Notes</label>
                            <p className="text-sm mt-1">
                                {patient.notes && patient.notes.length > 0
                                    ? JSON.stringify(patient.notes, null, 2)
                                    : "No notes available"}
                            </p>
                        </div>
                        <div className="border-t pt-4">
                            <label className="text-sm font-medium text-muted-foreground">Documents</label>
                            <p className="text-sm mt-1">
                                {patient.docs && patient.docs.length > 0
                                    ? `${patient.docs.length} document(s)`
                                    : "No documents available"}
                            </p>
                        </div>
                        <div className="border-t pt-4">
                            <label className="text-sm font-medium text-muted-foreground mb-2 block">
                                {isAssigned(patient.assigned_to) ? "Change Doctor Assignment" : "Assign to Doctor"}
                            </label>
                            <div className="flex gap-2">
                                <Select
                                    value={selectedDoctorId}
                                    onValueChange={onDoctorSelect}
                                    disabled={isLoadingDoctors || isAssigning}
                                >
                                    <SelectTrigger className="flex-1">
                                        <SelectValue placeholder={isLoadingDoctors ? "Loading doctors..." : "Select a doctor"} />
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
                                    onClick={onAssignDoctor}
                                    disabled={!selectedDoctorId || isAssigning || isLoadingDoctors}
                                >
                                    {isAssigning ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Assigning...
                                        </>
                                    ) : (
                                        isAssigned(patient.assigned_to) ? "Reassign" : "Assign"
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default PatientDetailsModal;
