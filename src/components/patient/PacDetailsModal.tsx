import { useEffect, useState, useRef } from "react";
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
import { Loader2, User, FileText, Stethoscope, ImagePlus, X } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { apiService } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

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
    age?: number;
}

export interface Note {
    _id: string;
    case_id: string;
    note: string;
    flag_type: 'urgent' | 'routine' | 'info' | 'warning' | 'error' | 'bookmark_note';
    user_id?: string | {
        _id: string;
        full_name: string;
        email: string;
        role?: string;
    };
    created_at?: string;
    updated_at?: string;
    createdAt: string;
    updatedAt: string;
    created_by?: {
        _id: string;
        full_name: string;
        email: string;
    };
}

export interface PacData {
    _id: string;
    case_uid: string;
    accession_number: string;
    body_part: string;
    description: string;
    hospital_id: string;
    modality: string;
    patient_id: string;
    case_date: string; // Format: YYYYMMDD
    case_time: string; // Format: HHMMSS.ffffff
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
    hospital_name?: string;
    sex: string;
    case_description?: string;
    description?: string;
    age?: string;
    case?: { case_uid: string; body_part: string } | string;
    treatment_type?: string;
    date_of_capture?: string;
    referring_doctor?: string;
    referring_physician?: string;
    accession_number?: string;
    case_body_part?: string;
    body_part?: string;
    pac_images?: string[];
    status: string;
    assigned_to: string | AssignedDoctor | null;
    pac_images_count?: number;
    case_uid?: string;
    modality?: string;
    case_date?: string;
    case_time?: string;
    priority?: string;
    case_type?: string;
    patient?: PacPatient;
    series_count?: number;
    instance_count?: number;
    docs?: any[];
    createdAt?: string;
    updatedAt?: string;
    __v?: number;
    notes?: Note[];
    bookmark_notes?: Note[];
    isBookmarked?: boolean;
    patient_history?: string[];
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
    case_id: string;
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
    case_id,
    isLoadingDoctors,
}: PacDetailsModalProps) => {
    const { toast } = useToast();

    // Form state
    const [formData, setFormData] = useState({
        name: "",
        dob: "",
        sex: "",
        case_description: "",
        accession_number: "",
        case_body_part: "",
        status: "",
        modality: "",
        priority: "",
    });

    // Patient history images state
    const [historyImages, setHistoryImages] = useState<{ file: File; preview: string }[]>([]);
    const [existingHistoryImages, setExistingHistoryImages] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Saving state
    const [isSaving, setIsSaving] = useState(false);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        const newImages = Array.from(files).map(file => ({
            file,
            preview: URL.createObjectURL(file),
        }));

        setHistoryImages(prev => [...prev, ...newImages]);

        // Reset input so same file can be selected again
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleRemoveImage = (index: number) => {
        setHistoryImages(prev => {
            // Revoke the URL to prevent memory leaks
            URL.revokeObjectURL(prev[index].preview);
            return prev.filter((_, i) => i !== index);
        });
    };

    // Initialize form data when patient changes
    useEffect(() => {
        if (patient) {
            const patientData = patient.patient || patient;
            const dob = patient.patient?.date_of_birth || patient.dob || patient.date_of_birth || "";

            setFormData({
                name: patientData.name || patient.name || "",
                dob: formatDOB(dob) || "",
                sex: patientData.sex || patient.sex || "",
                case_description: patient.description || patient.case_description || "",
                accession_number: patient.accession_number || "",
                case_body_part: patient.body_part || getCaseBodyPart(patient.case) || "",
                status: patient.status || "",
                modality: patient.modality || "",
                priority: patient.priority || "",
            });
            setExistingHistoryImages(patient.patient_history || []);
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

    const getCaseBodyPart = (caseData: { case_uid: string; body_part: string } | string | undefined): string => {
        if (!caseData) return "";
        if (typeof caseData === 'string') return caseData;
        if (typeof caseData === 'object' && caseData !== null) {
            return caseData.body_part || "";
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

    const handleSaveChanges = async () => {
        if (!patient) return;

        setIsSaving(true);
        try {
            // Prepare case data for update
            const caseData = {
                accession_number: formData.accession_number || undefined,
                body_part: formData.case_body_part || undefined,
                description: formData.case_description || undefined,
                priority: formData.priority || undefined,
            };

            // Get the files from historyImages
            const files = historyImages.map(img => img.file);

            // Call the API with case ID
            await apiService.updateCase(case_id, caseData, files.length > 0 ? files : undefined);

            toast({
                title: "Success",
                description: "Case updated successfully",
            });

            // Clear the history images after successful upload
            historyImages.forEach(img => URL.revokeObjectURL(img.preview));
            setHistoryImages([]);

            onClose(false);
        } catch (error: any) {
            console.error('Failed to update case:', error);
            toast({
                title: "Error",
                description: error.message || "Failed to update case",
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
        }
    };

    if (!patient) return null;

    const caseDate = patient.case_date || "";
    const isCurrentlyAssigned = isAssigned(patient.assigned_to);

    console.log('historyImages', historyImages)

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto">
                <DialogHeader className="pb-2">
                    <DialogTitle className="text-xl font-semibold">Case Details</DialogTitle>
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
                                    className="min-w-25"
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

                        {/* case Information Section */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-primary" />
                                <h3 className="text-sm font-semibold">case Information</h3>
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
                                        value={formData.case_body_part}
                                        onChange={(e) => handleInputChange("case_body_part", e.target.value)}
                                        className="h-8 text-sm"
                                    />
                                </div>

                                {/* case Date */}
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="case_date" className="text-xs font-medium">case Date</Label>
                                    <Input
                                        id="case_date"
                                        value={formatDate(caseDate)}
                                        disabled
                                        className="bg-muted h-8 text-sm"
                                    />
                                </div>

                                {/* case Description */}
                                <div className="flex flex-col gap-1.5 col-span-2">
                                    <Label htmlFor="description" className="text-xs font-medium">case Description</Label>
                                    <Input
                                        id="description"
                                        value={formData.case_description}
                                        onChange={(e) => handleInputChange("case_description", e.target.value)}
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

                        <Separator />

                        {/* Patient History Images Section */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <ImagePlus className="h-4 w-4 text-primary" />
                                <h3 className="text-sm font-semibold">Patient History</h3>
                            </div>

                            {/* Hidden file input */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handleImageUpload}
                                className="hidden"
                            />

                            {historyImages.length === 0 && existingHistoryImages.length === 0 ? (
                                /* Empty state - Upload area with dotted border */
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer"
                                >
                                    <ImagePlus className="h-8 w-8 text-gray-400" />
                                    <span className="text-sm text-gray-500">Click to upload patient history images</span>
                                    <span className="text-xs text-gray-400">Supports JPG, PNG, GIF</span>
                                </button>
                            ) : (
                                /* Images grid when images exist */
                                <div className="space-y-3">
                                    <div className="grid grid-cols-4 gap-3">
                                        {/* Existing Images */}
                                        {existingHistoryImages.map((imageUrl, index) => (
                                            <div key={`existing-${index}`} className="relative group aspect-square">
                                                <img
                                                    src={imageUrl}
                                                    alt={`History ${index + 1}`}
                                                    className="w-full h-full object-cover rounded-lg border border-gray-200"
                                                />
                                                {/* No delete button for existing images for now */}
                                            </div>
                                        ))}

                                        {/* New Images */}
                                        {historyImages.map((image, index) => (
                                            <div key={`new-${index}`} className="relative group aspect-square">
                                                <img
                                                    src={image.preview}
                                                    alt={`New History ${index + 1}`}
                                                    className="w-full h-full object-cover rounded-lg border border-gray-200"
                                                />
                                                {/* Delete button */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveImage(index)}
                                                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <X className="w-3.5 h-3.5 text-white" />
                                                </button>
                                            </div>
                                        ))}
                                        {/* Add more button */}
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-1 hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer"
                                        >
                                            <ImagePlus className="h-5 w-5 text-gray-400" />
                                            <span className="text-xs text-gray-400">Add</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex justify-end gap-2 pt-2 border-t">
                            <Button variant="outline" onClick={() => onClose(false)} size="sm" className="min-w-20" disabled={isSaving}>
                                Close
                            </Button>
                            <Button
                                onClick={handleSaveChanges}
                                size="sm"
                                className="min-w-25"
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    "Save Changes"
                                )}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default PacDetailsModal;
