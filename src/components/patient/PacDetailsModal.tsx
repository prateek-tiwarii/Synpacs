import { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, User, FileText, Stethoscope } from "lucide-react";
import { Separator } from "@/components/ui/separator";

// Interfaces
export interface AssignedDoctor {
    _id: string;
    email: string;
    full_name: string;
}

export interface PacPatient {
    _id: string;
    patient_id: string;
    date_of_birth: string; // Format: YYYYMMDD
    name: string;
    sex: string;
}

export interface PacData {
    _id: string;
    study_uid: string;
    accession_number: string;
    body_part: string;
    description: string;
    hospital_id: string;
    modality: string;
    patient_id: string;
    study_date: string; // Format: YYYYMMDD
    study_time: string; // Format: HHMMSS.ffffff
    patient: PacPatient;
    priority: string;
    status: string;
    case_type: string;
    assigned_to: string | AssignedDoctor | null;
}

export interface Patient {
    _id: string;
    pac_patinet_id?: string;
    name: string;
    dob?: string;
    date_of_birth?: string;
    hospital_id: string;
    sex: string;
    study_description?: string;
    description?: string;
    age?: string;
    study?: { study_uid: string; body_part: string } | string;
    treatment_type?: string;
    date_of_capture?: string;
    referring_doctor?: string;
    accession_number?: string;
    study_body_part?: string;
    body_part?: string;
    pac_images?: string[];
    status: string;
    assigned_to: string | AssignedDoctor | null;
    pac_images_count?: number;
    study_uid?: string;
    modality?: string;
    study_date?: string;
    study_time?: string;
    priority?: string;
    case_type?: string;
    patient?: PacPatient;
    docs?: any[];
    createdAt?: string;
    updatedAt?: string;
    __v?: number;
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

interface PacDetailsModalProps {
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

const PacDetailsModal = ({
    isOpen,
    onClose,
    patient,
    doctors,
    selectedDoctorId,
    onDoctorSelect,
    onAssignDoctor,
    isAssigning,
    isLoadingDoctors,
}: PacDetailsModalProps) => {

    // Form state
    const [formData, setFormData] = useState({
        name: "",
        dob: "",
        sex: "",
        study_description: "",
        accession_number: "",
        study_body_part: "",
        status: "",
        modality: "",
        priority: "",
    });

    // Initialize form data when patient changes
    useEffect(() => {
        if (patient) {
            const patientData = patient.patient || patient;
            const dob = patient.patient?.date_of_birth || patient.dob || patient.date_of_birth || "";
            
            setFormData({
                name: patientData.name || patient.name || "",
                dob: formatDOB(dob) || "",
                sex: patientData.sex || patient.sex || "",
                study_description: patient.description || patient.study_description || "",
                accession_number: patient.accession_number || "",
                study_body_part: patient.body_part || getStudyBodyPart(patient.study) || "",
                status: patient.status || "",
                modality: patient.modality || "",
                priority: patient.priority || "",
            });
        }
    }, [patient]);

    const formatDate = (dateString: string | undefined) => {
        if (!dateString) return "N/A";
        // Handle YYYYMMDD format
        if (dateString.length === 8 && /^\d+$/.test(dateString)) {
            const year = dateString.substring(0, 4);
            const month = dateString.substring(4, 6);
            const day = dateString.substring(6, 8);
            return `${year}-${month}-${day}`;
        }
        return new Date(dateString).toLocaleDateString();
    };

    const formatDOB = (dob: string | undefined): string => {
        if (!dob) return "";
        // Convert YYYYMMDD to YYYY-MM-DD for input field
        if (dob.length === 8 && /^\d+$/.test(dob)) {
            return `${dob.substring(0, 4)}-${dob.substring(4, 6)}-${dob.substring(6, 8)}`;
        }
        return dob;
    };

    const getStudyBodyPart = (study: { study_uid: string; body_part: string } | string | undefined): string => {
        if (!study) return "";
        if (typeof study === 'string') return study;
        if (typeof study === 'object' && study !== null) {
            return study.body_part || "";
        }
        return "";
    };

    const getAssignedToName = (assignedTo: string | AssignedDoctor | null): string => {
        if (!assignedTo) return "Unassigned";
        if (typeof assignedTo === 'string') return assignedTo;
        return assignedTo.full_name || "Unassigned";
    };

    const isAssigned = (assignedTo: string | AssignedDoctor | null): boolean => {
        return assignedTo !== null && assignedTo !== undefined;
    };

    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };



    if (!patient) return null;

    console.log(patient);

    const studyDate = patient.study_date || "";
    const isCurrentlyAssigned = isAssigned(patient.assigned_to);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto">
                <DialogHeader className="pb-2">
                    <DialogTitle className="text-xl font-semibold">PAC Study Details</DialogTitle>
                </DialogHeader>
                
                {patient && (
                    <div className="space-y-3 py-2">
                        {/* Doctor Assignment Section - At the Top */}
                        <div className="bg-muted/50 rounded-lg p-3 border border-primary/20">
                            <div className="flex items-center gap-2 mb-2">
                                <Stethoscope className="h-4 w-4 text-primary" />
                                <Label className="text-sm font-semibold">
                                    {isCurrentlyAssigned ? "Change Doctor Assignment" : "Assign to Doctor"}
                                </Label>
                            </div>
                            {isCurrentlyAssigned && (
                                <div className="mb-2 p-1.5 bg-background rounded border text-xs">
                                    <p className="text-xs text-muted-foreground">
                                        Currently assigned to: <span className="font-semibold text-foreground">{getAssignedToName(patient.assigned_to)}</span>
                                    </p>
                                </div>
                            )}
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
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{doctor.full_name}</span>
                                                    {doctor.doctor_details?.speciality && (
                                                        <span className="text-xs text-muted-foreground">
                                                            {doctor.doctor_details.speciality}
                                                        </span>
                                                    )}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button
                                    onClick={onAssignDoctor}
                                    disabled={!selectedDoctorId || isAssigning || isLoadingDoctors}
                                    className="min-w-[100px]"
                                    size="sm"
                                >
                                    {isAssigning ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Assigning...
                                        </>
                                    ) : (
                                        isCurrentlyAssigned ? "Reassign" : "Assign"
                                    )}
                                </Button>
                            </div>
                        </div>

                        <Separator />

                        {/* Study Information Section */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-primary" />
                                <h3 className="text-sm font-semibold">Study Information</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                {/* Accession Number */}
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="accession_number" className="text-xs font-medium">Accession Number</Label>
                                    <Input
                                        id="accession_number"
                                        value={formData.accession_number}
                                        onChange={(e) => handleInputChange("accession_number", e.target.value)}
                                        className="h-8 text-sm"
                                    />
                                </div>

                                {/* Modality */}
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="modality" className="text-xs font-medium">Modality</Label>
                                    <Input
                                        id="modality"
                                        value={formData.modality}
                                        disabled
                                        className="bg-muted h-8 text-sm"
                                    />
                                </div>

                                {/* Body Part */}
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="body_part" className="text-xs font-medium">Body Part</Label>
                                    <Input
                                        id="body_part"
                                        value={formData.study_body_part}
                                        onChange={(e) => handleInputChange("study_body_part", e.target.value)}
                                        className="h-8 text-sm"
                                    />
                                </div>

                                {/* Study Date */}
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="study_date" className="text-xs font-medium">Study Date</Label>
                                    <Input
                                        id="study_date"
                                        value={formatDate(studyDate)}
                                        disabled
                                        className="bg-muted h-8 text-sm"
                                    />
                                </div>

                                {/* Study Description */}
                                <div className="flex flex-col gap-1.5 col-span-2">
                                    <Label htmlFor="description" className="text-xs font-medium">Study Description</Label>
                                    <Input
                                        id="description"
                                        value={formData.study_description}
                                        onChange={(e) => handleInputChange("study_description", e.target.value)}
                                        className="h-8 text-sm"
                                    />
                                </div>

                                {/* Priority */}
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="priority" className="text-xs font-medium">Priority</Label>
                                    <Select
                                        value={formData.priority}
                                        onValueChange={(value) => handleInputChange("priority", value)}
                                    >
                                        <SelectTrigger id="priority" className="h-8 text-sm">
                                            <SelectValue placeholder="Select priority" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Urgent">Urgent</SelectItem>
                                            <SelectItem value="Stat">Stat</SelectItem>
                                            <SelectItem value="High">High</SelectItem>
                                            <SelectItem value="Normal">Normal</SelectItem>
                                            <SelectItem value="Routine">Routine</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Status */}
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="status" className="text-xs font-medium">Status</Label>
                                    <Select
                                        value={formData.status}
                                        onValueChange={(value) => handleInputChange("status", value)}
                                    >
                                        <SelectTrigger id="status" className="h-8 text-sm">
                                            <SelectValue placeholder="Select status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Assigned">Assigned</SelectItem>
                                            <SelectItem value="Unassigned">Unassigned</SelectItem>
                                            <SelectItem value="Reported">Reported</SelectItem>
                                            <SelectItem value="In Progress">In Progress</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* Patient Information Section */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-primary" />
                                <h3 className="text-sm font-semibold">Patient Information</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                {/* Name */}
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="name" className="text-xs font-medium">Patient Name</Label>
                                    <Input
                                        id="name"
                                        value={formData.name}
                                        onChange={(e) => handleInputChange("name", e.target.value)}
                                        className="h-8 text-sm"
                                    />
                                </div>

                                {/* Date of Birth */}
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="dob" className="text-xs font-medium">Date of Birth</Label>
                                    <Input
                                        id="dob"
                                        type="date"
                                        value={formData.dob}
                                        onChange={(e) => handleInputChange("dob", e.target.value)}
                                        className="h-8 text-sm"
                                    />
                                </div>

                                {/* Sex */}
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="sex" className="text-xs font-medium">Sex</Label>
                                    <Select
                                        value={formData.sex}
                                        onValueChange={(value) => handleInputChange("sex", value)}
                                    >
                                        <SelectTrigger id="sex" className="h-8 text-sm">
                                            <SelectValue placeholder="Select sex" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="M">Male</SelectItem>
                                            <SelectItem value="F">Female</SelectItem>
                                            <SelectItem value="O">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex justify-end gap-2 pt-2 border-t">
                            <Button variant="outline" onClick={() => onClose(false)} size="sm" className="min-w-[80px]">
                                Close
                            </Button>
                            <Button 
                                onClick={() => {
                                    console.log("Saving patient data:", formData);
                                    // TODO: Add API call to save updated patient data
                                    onClose(false);
                                }}
                                size="sm"
                                className="min-w-[100px]"
                            >
                                Save Changes
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default PacDetailsModal;
