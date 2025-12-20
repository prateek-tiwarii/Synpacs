import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiService } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    ArrowLeft,
    Loader2,
    User,
    Stethoscope,
    FileText,
    Image,
    Clock,
    Phone,
    Flag,
    AlertCircle,
    Upload,
    ExternalLink,
    Send,
    X,
    File,
} from "lucide-react";
import toast from "react-hot-toast";

interface Study {
    study_uid: string;
    body_part: string;
}

interface AssignedDoctor {
    _id: string;
    full_name: string;
    email: string;
    role: string;
    phone: string;
}

interface Note {
    _id: string;
    note: string;
    flag_type: string;
    created_by: {
        _id: string;
        full_name: string;
        email: string;
    };
    createdAt: string;
    updatedAt: string;
}

interface Doc {
    _id: string;
    title: string;
    description: string;
    file_url: string;
    file_type?: string;
    file_size?: string;
    patient_id: string;
    createdAt: string;
    updatedAt: string;
    signed_url?: string;
}

interface PatientData {
    _id: string;
    pac_patinet_id: string;
    name: string;
    dob: string;
    hospital_id: string;
    patient_type: string;
    priority: string;
    time: string;
    sex: string;
    age: string;
    center: string;
    study: Study;
    treatment_type: string;
    date_of_capture: string;
    referring_doctor: string;
    accession_number: string;
    pac_images: Array<{ _id: string; image_url: string }>;
    pac_images_count: number;
    status: string;
    assigned_to: AssignedDoctor | null;
    notes: Note[];
    docs: Doc[];
    createdAt: string;
    updatedAt: string;
}

interface PatientResponse {
    success: boolean;
    message: string;
    data: PatientData;
}

interface NoteResponse {
    success: boolean;
    message: string;
    data: Note;
}

interface DocResponse {
    success: boolean;
    message: string;
    data: Doc;
}

const SinglePatient = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [patient, setPatient] = useState<PatientData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Notes state
    const [notes, setNotes] = useState<Note[]>([]);
    const [newNote, setNewNote] = useState("");
    const [noteFlagType, setNoteFlagType] = useState("info");
    const [isAddingNote, setIsAddingNote] = useState(false);

    // Documents state
    const [documents, setDocuments] = useState<Doc[]>([]);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadTitle, setUploadTitle] = useState("");
    const [uploadDescription, setUploadDescription] = useState("");
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const fetchPatient = async () => {
            if (!id) return;

            try {
                setIsLoading(true);
                setError(null);
                const response = (await apiService.getPatientById(id)) as PatientResponse;
                if (response.success && response.data) {
                    setPatient(response.data);
                    // Set notes from API
                    if (response.data.notes) {
                        setNotes(response.data.notes);
                    }
                    // Set docs from API
                    if (response.data.docs) {
                        setDocuments(response.data.docs);
                    }
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to fetch patient");
                console.error("Error fetching patient:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchPatient();
    }, [id]);

    const formatDate = (dateString: string) => {
        if (!dateString) return "N/A";
        return new Date(dateString).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    };

    const formatDateTime = (dateString: string) => {
        if (!dateString) return "N/A";
        return new Date(dateString).toLocaleString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const formatDOB = (dob: string) => {
        if (!dob) return "N/A";
        if (dob.length === 8) {
            const formatted = `${dob.substring(0, 4)}-${dob.substring(4, 6)}-${dob.substring(6, 8)}`;
            return formatDate(formatted);
        }
        return formatDate(dob);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "Reported":
                return "bg-emerald-50 text-emerald-700 border-emerald-200";
            case "Unreported":
                return "bg-red-50 text-red-700 border-red-200";
            default:
                return "bg-amber-50 text-amber-700 border-amber-200";
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority?.toLowerCase()) {
            case "high":
                return "bg-red-50 text-red-700 border-red-200";
            case "medium":
                return "bg-amber-50 text-amber-700 border-amber-200";
            case "low":
                return "bg-blue-50 text-blue-700 border-blue-200";
            default:
                return "bg-gray-50 text-gray-700 border-gray-200";
        }
    };

    const getFlagColor = (flagType: string) => {
        switch (flagType?.toLowerCase()) {
            case "warning":
                return "bg-amber-500";
            case "error":
                return "bg-red-500";
            default:
                return "bg-blue-500";
        }
    };

    const getFlagBgColor = (flagType: string) => {
        switch (flagType?.toLowerCase()) {
            case "warning":
                return "bg-amber-50 border-amber-200";
            case "error":
                return "bg-red-50 border-red-200";
            default:
                return "bg-blue-50 border-blue-200";
        }
    };

    const handleAddNote = async () => {
        if (!newNote.trim() || !id) return;

        try {
            setIsAddingNote(true);
            const response = await apiService.createCaseNote(id, {
                note: newNote,
                flag_type: noteFlagType,
            }) as NoteResponse;

            if (response.success && response.data) {
                setNotes([response.data, ...notes]);
                toast.success("Note added successfully");
            }
            setNewNote("");
            setNoteFlagType("info");
        } catch (err) {
            console.error("Error adding note:", err);
            toast.error("Failed to add note");
        } finally {
            setIsAddingNote(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setUploadFile(file);
            setUploadTitle(file.name.replace(/\.[^/.]+$/, ""));
        }
    };

    const handleUploadDocument = async () => {
        if (!uploadFile || !uploadTitle || !id) return;

        try {
            setIsUploading(true);
            const response = await apiService.uploadPatientDocument(
                id,
                uploadFile,
                uploadTitle,
                uploadDescription
            ) as DocResponse;

            if (response.success && response.data) {
                setDocuments([response.data, ...documents]);
                toast.success("Document uploaded successfully");
            }
            setIsUploadModalOpen(false);
            setUploadFile(null);
            setUploadTitle("");
            setUploadDescription("");
        } catch (err) {
            console.error("Error uploading document:", err);
            toast.error("Failed to upload document");
        } finally {
            setIsUploading(false);
        }
    };

    const getRelativeTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return "Today";
        if (diffDays === 1) return "Yesterday";
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
        return `${Math.floor(diffDays / 365)} years ago`;
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                <span className="ml-2 text-sm text-gray-600">Loading patient details...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4">
                <AlertCircle className="w-10 h-10 text-red-400" />
                <p className="text-sm text-red-500">{error}</p>
                <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Go Back
                </Button>
            </div>
        );
    }

    if (!patient) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4">
                <p className="text-sm text-gray-500">Patient not found</p>
                <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Go Back
                </Button>
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-64px)] flex flex-col overflow-hidden bg-gray-50">
            {/* Header - Fixed */}
            <div className="flex-shrink-0 bg-white border-b px-4 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(-1)}
                            className="text-gray-600 hover:text-gray-900 h-8 px-2"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                        <Separator orientation="vertical" className="h-5" />
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-sm font-semibold text-gray-900">{patient.name}</h1>
                                <span className="text-xs text-gray-400">•</span>
                                <span className="text-xs text-gray-500">{patient.pac_patinet_id}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span>{patient.age}</span>
                                <span>•</span>
                                <span>{patient.sex === "M" ? "Male" : patient.sex === "F" ? "Female" : patient.sex}</span>
                                <span>•</span>
                                <span>{patient.treatment_type}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-xs ${getStatusColor(patient.status)}`}>
                            {patient.status}
                        </Badge>
                        {patient.priority && (
                            <Badge variant="outline" className={`text-xs ${getPriorityColor(patient.priority)}`}>
                                {patient.priority}
                            </Badge>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content - Scrollable within components */}
            <div className="flex-1 grid grid-cols-12 gap-4 p-4 min-h-0">
                {/* Left Panel - Patient Info & Images */}
                <div className="col-span-3 flex flex-col gap-4 min-h-0">
                    {/* Patient Info */}
                    <div className="bg-white rounded-lg border p-4 flex-shrink-0">
                        <div className="flex items-center gap-2 mb-3">
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="text-xs font-medium text-gray-700">Patient Info</span>
                        </div>
                        <div className="space-y-2 text-xs">
                            <div className="flex justify-between">
                                <span className="text-gray-500">DOB</span>
                                <span className="text-gray-900">{formatDOB(patient.dob)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Center</span>
                                <span className="text-gray-900">{patient.center || "N/A"}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Body Part</span>
                                <span className="text-gray-900">{patient.study?.body_part || "N/A"}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Referring</span>
                                <span className="text-gray-900 truncate ml-2">{patient.referring_doctor || "N/A"}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Accession</span>
                                <span className="text-gray-900 font-mono">{patient.accession_number || "N/A"}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Captured</span>
                                <span className="text-gray-900">{formatDate(patient.date_of_capture)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Assigned Doctor */}
                    {patient.assigned_to && (
                        <div className="bg-white rounded-lg border p-4 flex-shrink-0">
                            <div className="flex items-center gap-2 mb-3">
                                <Stethoscope className="w-4 h-4 text-gray-400" />
                                <span className="text-xs font-medium text-gray-700">Assigned Doctor</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                    <User className="w-4 h-4 text-blue-600" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-medium text-gray-900 truncate">
                                        {patient.assigned_to.full_name}
                                    </p>
                                    <p className="text-xs text-gray-500 truncate">{patient.assigned_to.email}</p>
                                </div>
                            </div>
                            {patient.assigned_to.phone && (
                                <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
                                    <Phone className="w-3 h-3" />
                                    <span>{patient.assigned_to.phone}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Images */}
                    <div className="bg-white rounded-lg border p-4 flex-1 min-h-0 flex flex-col">
                        <div className="flex items-center justify-between mb-3 flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <Image className="w-4 h-4 text-gray-400" />
                                <span className="text-xs font-medium text-gray-700">Images</span>
                                <Badge variant="secondary" className="text-[10px] h-5">
                                    {patient.pac_images_count || patient.pac_images?.length || 0}
                                </Badge>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {patient.pac_images && patient.pac_images.length > 0 ? (
                                <div className="grid grid-cols-2 gap-2">
                                    {patient.pac_images.map((img, index) => (
                                        <div
                                            key={img._id || index}
                                            className="aspect-square bg-gray-100 rounded flex items-center justify-center border hover:border-blue-300 cursor-pointer transition-colors"
                                        >
                                            {img.image_url ? (
                                                <img
                                                    src={img.image_url}
                                                    alt={`Scan ${index + 1}`}
                                                    className="w-full h-full object-cover rounded"
                                                />
                                            ) : (
                                                <Image className="w-5 h-5 text-gray-400" />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="h-full flex items-center justify-center">
                                    <p className="text-xs text-gray-400">No images</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Middle Panel - Notes Timeline */}
                <div className="col-span-5 bg-white rounded-lg border flex flex-col min-h-0">
                    <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <Flag className="w-4 h-4 text-gray-400" />
                            <span className="text-xs font-medium text-gray-700">Notes & Timeline</span>
                            <Badge variant="secondary" className="text-[10px] h-5">
                                {notes.length}
                            </Badge>
                        </div>
                    </div>

                    {/* Add Note Form */}
                    <div className="px-4 py-3 border-b flex-shrink-0 bg-gray-50">
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <Textarea
                                    placeholder="Add a note..."
                                    value={newNote}
                                    onChange={(e) => setNewNote(e.target.value)}
                                    className="text-xs min-h-[60px] resize-none"
                                />
                            </div>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                            <Select value={noteFlagType} onValueChange={setNoteFlagType}>
                                <SelectTrigger className="w-28 h-7 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="info" className="text-xs">Info</SelectItem>
                                    <SelectItem value="warning" className="text-xs">Warning</SelectItem>
                                    <SelectItem value="error" className="text-xs">Error</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button
                                size="sm"
                                className="h-7 text-xs"
                                onClick={handleAddNote}
                                disabled={!newNote.trim() || isAddingNote}
                            >
                                {isAddingNote ? (
                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                ) : (
                                    <Send className="w-3 h-3 mr-1" />
                                )}
                                {isAddingNote ? "Adding..." : "Add Note"}
                            </Button>
                        </div>
                    </div>

                    {/* Notes Timeline */}
                    <div className="flex-1 overflow-y-auto px-4 py-3">
                        <div className="relative">
                            {/* Timeline line */}
                            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-200" />

                            {/* Notes */}
                            <div className="space-y-4">
                                {notes
                                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                                    .map((note) => (
                                        <div key={note._id} className="relative pl-6">
                                            {/* Timeline dot */}
                                            <div className={`absolute left-0 top-1.5 w-[15px] h-[15px] rounded-full border-2 border-white ${getFlagColor(note.flag_type)}`} />

                                            <div className={`p-3 rounded-lg border ${getFlagBgColor(note.flag_type)}`}>
                                                <div className="flex items-start justify-between mb-1.5">
                                                    <span className="text-xs font-medium text-gray-800">
                                                        {note.created_by?.full_name || "Unknown"}
                                                    </span>
                                                    <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                                                        <Clock className="w-3 h-3" />
                                                        <span>{getRelativeTime(note.createdAt)}</span>
                                                    </div>
                                                </div>
                                                <p className="text-xs text-gray-600 leading-relaxed">{note.note}</p>
                                                <div className="mt-2 text-[10px] text-gray-400">
                                                    {formatDateTime(note.createdAt)}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Panel - Documents */}
                <div className="col-span-4 bg-white rounded-lg border flex flex-col min-h-0">
                    <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-gray-400" />
                            <span className="text-xs font-medium text-gray-700">Documents</span>
                            <Badge variant="secondary" className="text-[10px] h-5">
                                {documents.length}
                            </Badge>
                        </div>
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => setIsUploadModalOpen(true)}
                        >
                            <Upload className="w-3 h-3 mr-1" />
                            Upload
                        </Button>
                    </div>

                    {/* Upload Modal */}
                    {isUploadModalOpen && (
                        <div className="px-4 py-3 border-b bg-gray-50 flex-shrink-0">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-medium text-gray-700">Upload Document</span>
                                <button
                                    onClick={() => {
                                        setIsUploadModalOpen(false);
                                        setUploadFile(null);
                                        setUploadTitle("");
                                        setUploadDescription("");
                                    }}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                onChange={handleFileSelect}
                            />

                            {!uploadFile ? (
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full border-2 border-dashed border-gray-300 rounded-lg py-4 px-4 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
                                >
                                    <Upload className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                                    <p className="text-xs text-gray-500">Click to select file</p>
                                </button>
                            ) : (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 p-2 bg-white rounded border">
                                        <File className="w-4 h-4 text-blue-500" />
                                        <span className="text-xs text-gray-700 truncate flex-1">{uploadFile.name}</span>
                                        <span className="text-[10px] text-gray-400">{(uploadFile.size / 1024).toFixed(1)} KB</span>
                                    </div>
                                    <Input
                                        placeholder="Document title"
                                        value={uploadTitle}
                                        onChange={(e) => setUploadTitle(e.target.value)}
                                        className="text-xs h-8"
                                    />
                                    <Input
                                        placeholder="Description (optional)"
                                        value={uploadDescription}
                                        onChange={(e) => setUploadDescription(e.target.value)}
                                        className="text-xs h-8"
                                    />
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="flex-1 h-7 text-xs"
                                            onClick={() => {
                                                setUploadFile(null);
                                                setUploadTitle("");
                                                setUploadDescription("");
                                            }}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            size="sm"
                                            className="flex-1 h-7 text-xs"
                                            onClick={handleUploadDocument}
                                            disabled={!uploadTitle || isUploading}
                                        >
                                            {isUploading ? (
                                                <>
                                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                                    Uploading...
                                                </>
                                            ) : (
                                                "Upload"
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Documents List */}
                    <div className="flex-1 overflow-y-auto p-4">
                        <div className="space-y-2">
                            {documents
                                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                                .map((doc) => (
                                    <div
                                        key={doc._id}
                                        className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors group cursor-pointer"
                                        onClick={() => window.open(doc.signed_url || doc.file_url, '_blank')}
                                    >
                                        <div className="w-9 h-9 bg-blue-100 rounded flex items-center justify-center flex-shrink-0">
                                            <FileText className="w-4 h-4 text-blue-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium text-gray-900 truncate">{doc.title}</p>
                                            {doc.description && (
                                                <p className="text-[10px] text-gray-500 truncate mt-0.5">{doc.description}</p>
                                            )}
                                            <div className="flex items-center gap-2 mt-1.5 text-[10px] text-gray-400">
                                                {doc.file_type && <span>{doc.file_type}</span>}
                                                {doc.file_type && doc.file_size && <span>•</span>}
                                                {doc.file_size && <span>{doc.file_size}</span>}
                                                {(doc.file_type || doc.file_size) && <span>•</span>}
                                                <span>{getRelativeTime(doc.createdAt)}</span>
                                            </div>
                                        </div>
                                        <div
                                            className="p-1.5 text-gray-400 group-hover:text-blue-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Open in new tab"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SinglePatient;
