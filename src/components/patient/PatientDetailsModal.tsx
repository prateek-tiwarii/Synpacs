import { useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

// Interfaces (duplicated for now to be self-contained, or could be imported)
export interface AssignedDoctor {
    _id: string;
    email: string;
    full_name: string;
}

export interface Study {
    study_uid: string;
    body_part: string;
}

export interface PatientDocument {
    title: string;
    description: string;
    file_url: string;
    patient_id: string;
    _id: string;
    createdAt: string;
    updatedAt: string;
    signed_url?: string;
}

export interface Patient {
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
    referring_doctor: string;
    accession_number: string;
    pac_images: string[]; // Array of image IDs
    status: string;
    assigned_to: string | AssignedDoctor | null;
    pac_images_count: number;
    docs?: PatientDocument[]; // Array of patient documents
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

    // Form state
    const [formData, setFormData] = useState({
        name: "",
        dob: "",
        age: "",
        sex: "",
        study_description: "",
        treatment_type: "",
        referring_doctor: "",
        accession_number: "",
        study_body_part: "",
        status: "",
    });

    // Initialize form data when patient changes
    useEffect(() => {
        if (patient) {
            setFormData({
                name: patient.name || "",
                dob: formatDOB(patient.dob) || "",
                age: patient.age || "",
                sex: patient.sex || "",
                study_description: patient.study_description || "",
                treatment_type: patient.treatment_type || "",
                referring_doctor: patient.referring_doctor || "",
                accession_number: patient.accession_number || "",
                study_body_part: getStudyBodyPart(patient.study),
                status: patient.status || "",
            });
        }
    }, [patient]);

    const formatDate = (dateString: string | undefined) => {
        if (!dateString) return "N/A";
        return new Date(dateString).toLocaleString();
    };

    const formatDOB = (dob: string | undefined): string => {
        if (!dob) return "";
        // Convert YYYYMMDD to YYYY-MM-DD for input field
        if (dob.length === 8) {
            return `${dob.substring(0, 4)}-${dob.substring(4, 6)}-${dob.substring(6, 8)}`;
        }
        return dob;
    };

    const getStudyBodyPart = (study: Study | string | undefined): string => {
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



    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Patient Details</DialogTitle>
                    <DialogDescription>
                        Complete information for {patient?.name}
                    </DialogDescription>
                </DialogHeader>
                {patient && (
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            {/* Patient ID - Read only */}
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="patient_id">PAC Patient ID</Label>
                                <Input
                                    id="patient_id"
                                    value={patient.pac_patinet_id}
                                    disabled
                                    className="bg-muted"
                                />
                            </div>

                            {/* Accession Number */}
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="accession_number">Accession Number</Label>
                                <Input
                                    id="accession_number"
                                    value={formData.accession_number}
                                    onChange={(e) => handleInputChange("accession_number", e.target.value)}
                                />
                            </div>

                            {/* Name */}
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="name">Name</Label>
                                <Input
                                    id="name"
                                    value={formData.name}
                                    onChange={(e) => handleInputChange("name", e.target.value)}
                                />
                            </div>

                            {/* Date of Birth */}
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="dob">Date of Birth</Label>
                                <Input
                                    id="dob"
                                    type="date"
                                    value={formData.dob}
                                    onChange={(e) => handleInputChange("dob", e.target.value)}
                                />
                            </div>

                            {/* Age */}
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="age">Age</Label>
                                <Input
                                    id="age"
                                    value={formData.age}
                                    onChange={(e) => handleInputChange("age", e.target.value)}
                                />
                            </div>

                            {/* Sex - Dropdown */}
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="sex">Sex</Label>
                                <Select
                                    value={formData.sex}
                                    onValueChange={(value) => handleInputChange("sex", value)}
                                >
                                    <SelectTrigger id="sex">
                                        <SelectValue placeholder="Select sex" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="M">Male</SelectItem>
                                        <SelectItem value="F">Female</SelectItem>
                                        <SelectItem value="O">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Study Description */}
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="study_description">Study Description</Label>
                                <Input
                                    id="study_description"
                                    value={formData.study_description}
                                    onChange={(e) => handleInputChange("study_description", e.target.value)}
                                />
                            </div>

                            {/* Treatment Type */}
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="treatment_type">Treatment Type</Label>
                                <Input
                                    id="treatment_type"
                                    value={formData.treatment_type}
                                    onChange={(e) => handleInputChange("treatment_type", e.target.value)}
                                />
                            </div>

                            {/* Study Body Part */}
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="study_body_part">Study Body Part</Label>
                                <Input
                                    id="study_body_part"
                                    value={formData.study_body_part}
                                    onChange={(e) => handleInputChange("study_body_part", e.target.value)}
                                />
                            </div>

                            {/* Study UID - Read only */}
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="study_uid">Study UID</Label>
                                <Input
                                    id="study_uid"
                                    value={typeof patient.study === 'object' && patient.study !== null ? patient.study.study_uid : 'N/A'}
                                    disabled
                                    className="bg-muted font-mono text-xs"
                                />
                            </div>

                            {/* Referring Doctor */}
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="referring_doctor">Referring Doctor</Label>
                                <Input
                                    id="referring_doctor"
                                    value={formData.referring_doctor}
                                    onChange={(e) => handleInputChange("referring_doctor", e.target.value)}
                                />
                            </div>

                            {/* Images Count - Read only */}
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="images_count">Images Count</Label>
                                <Input
                                    id="images_count"
                                    value={patient.pac_images_count || 0}
                                    disabled
                                    className="bg-muted"
                                />
                            </div>

                            {/* Status - Dropdown */}
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="status">Status</Label>
                                <Select
                                    value={formData.status}
                                    onValueChange={(value) => handleInputChange("status", value)}
                                >
                                    <SelectTrigger id="status">
                                        <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Reported">Reported</SelectItem>
                                        <SelectItem value="Unreported">Unreported</SelectItem>
                                        <SelectItem value="In Progress">In Progress</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Date of Capture - Read only */}
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="date_of_capture">Date of Capture</Label>
                                <Input
                                    id="date_of_capture"
                                    value={formatDate(patient.date_of_capture)}
                                    disabled
                                    className="bg-muted"
                                />
                            </div>

                            {/* Assigned To - Read only display */}
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="assigned_to">Currently Assigned To</Label>
                                <Input
                                    id="assigned_to"
                                    value={getAssignedToName(patient.assigned_to)}
                                    disabled
                                    className="bg-muted"
                                />
                            </div>

                            {/* Hospital ID - Read only */}
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="hospital_id">Hospital ID</Label>
                                <Input
                                    id="hospital_id"
                                    value={patient.hospital_id}
                                    disabled
                                    className="bg-muted font-mono text-xs"
                                />
                            </div>
                        </div>

                        {/* PAC Images section */}
                        <div className="border-t pt-4">
                            <Label>PAC Images</Label>
                            <p className="text-sm mt-1 text-muted-foreground">
                                {patient.pac_images && patient.pac_images.length > 0
                                    ? `${patient.pac_images.length} image(s): ${patient.pac_images.slice(0, 3).join(', ')}${patient.pac_images.length > 3 ? '...' : ''}`
                                    : "No images available"}
                            </p>
                        </div>

                        {/* Doctor Assignment section */}
                        <div className="border-t pt-4">
                            <Label className="mb-2 block">
                                {isAssigned(patient.assigned_to) ? "Change Doctor Assignment" : "Assign to Doctor"}
                            </Label>
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

                        {/* Action buttons */}
                        <div className="border-t pt-4 flex justify-end gap-2">
                            <Button variant="outline" onClick={() => onClose(false)}>
                                Cancel
                            </Button>
                            <Button onClick={() => {
                                // Here you would typically save the form data
                                console.log("Saving patient data:", formData);
                                // TODO: Add API call to save updated patient data
                                onClose(false);
                            }}>
                                Save Changes
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default PatientDetailsModal;
