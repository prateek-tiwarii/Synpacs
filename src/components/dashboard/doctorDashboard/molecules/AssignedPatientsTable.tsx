import { Bookmark, ClipboardCheck, Download, FolderOpen, ImageIcon, MessageSquare } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import type { VisibilityState } from '@tanstack/react-table';
import { createColumnHelper } from '@tanstack/react-table';
import type { Patient, Note } from "@/components/patient/PacDetailsModal";
import { apiService } from "@/lib/api";
import { DataTable, CellWithCopy } from "@/components/common/DataTable";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

import type { FilterState } from "@/components/common/FilterPanel";
import toast from "react-hot-toast";

// Default column visibility configuration for AssignedPatientsTable
const DEFAULT_COLUMN_VISIBILITY: VisibilityState = {
    actions: true, // Always visible, cannot be hidden
    name: true,
    age_sex: true,
    body_part: true,
    description: true,
    modality: true,
    accession_number: true,
    study_date_time: true,
    case_type: true,
    priority: true,
    series_count: true,
    instance_count: true,
    // Hide all other columns
    pac_patinet_id: false,
    age: false,
    sex: false,
    study_description: false,
    treatment_type: false,
    status: false,
    referring_doctor: false,
    date_of_capture: false,
    pac_images_count: false,
    hospital_id: false,
    study_date: false,
    study_time: false,
};

const STORAGE_KEY_ASSIGNED_PATIENTS = 'assigned_patients_table_columns';

interface AssignedPatientsTableProps {
    setSelectedPatient: (patient: Patient | null) => void;
    setMessageDialogOpen: (open: boolean) => void;
    setDocumentDialogOpen: (open: boolean) => void;
    filters?: FilterState;
}

// interface Case {
//     _id: string;
//     study_uid: string;
//     accession_number: string;
//     body_part: string;
//     description: string;
//     hospital_id: string;
//     modality: string;
//     patient_id: string;
//     study_date: string;
//     study_time: string;
//     assigned_to: string;
//     case_type: string;
//     priority: string;
//     status: string;
//     updatedAt: string;
//     patient: {
//         _id: string;
//         patient_id: string;
//         date_of_birth: string;
//         name: string;
//         sex: string;
//     };
// }

// interface AssignedCasesResponse {
//     success: boolean;
//     message: string;
//     count: number;
//     data: {
//         cases: Case[];
//     };
// }

const AssignedPatientsTable = ({
    setSelectedPatient,
    setMessageDialogOpen,
    setDocumentDialogOpen,
    filters,
}: AssignedPatientsTableProps) => {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Initialize column visibility from localStorage or use default
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY_ASSIGNED_PATIENTS);
            if (stored) {
                const parsed = JSON.parse(stored);
                // Always ensure actions column is visible
                return { ...parsed, actions: true };
            }
        } catch (error) {
            console.error('Failed to load column visibility from localStorage:', error);
        }
        return DEFAULT_COLUMN_VISIBILITY;
    });

    // Save column visibility to localStorage whenever it changes
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY_ASSIGNED_PATIENTS, JSON.stringify(columnVisibility));
        } catch (error) {
            console.error('Failed to save column visibility to localStorage:', error);
        }
    }, [columnVisibility]);

    useEffect(() => {
        const fetchAssignedPatients = async () => {
            try {
                setIsLoading(true);
                setError(null);

                // Build API filters from FilterState
                const apiFilters: any = {};

                if (filters) {
                    if (filters.startDate) apiFilters.start_date = filters.startDate;
                    if (filters.endDate) apiFilters.end_date = filters.endDate;
                    if (filters.patientName) apiFilters.patient_name = filters.patientName;
                    if (filters.bodyPart) apiFilters.body_part = filters.bodyPart;
                    if (filters.status && filters.status !== 'all') apiFilters.status = filters.status;

                    // Handle gender
                    if (filters.gender.M && !filters.gender.F) {
                        apiFilters.gender = 'M';
                    } else if (filters.gender.F && !filters.gender.M) {
                        apiFilters.gender = 'F';
                    }

                    // Handle modality
                    const selectedModality = Object.entries(filters.modalities).find(
                        ([_, isSelected]) => isSelected && _ !== 'ALL'
                    );
                    if (selectedModality) {
                        apiFilters.modality = selectedModality[0];
                    }
                }

                const response = await apiService.getAssignedCases(apiFilters) as any;
                if (response.success && response.data) {
                    // Map API response to match Patient interface
                    const mappedPatients: Patient[] = response.data.map((caseItem: any) => {
                        // Format study_date to readable format (YYYYMMDD -> YYYY-MM-DD)
                        const formatStudyDate = (dateStr: string): string => {
                            if (!dateStr || dateStr.length !== 8) return dateStr;
                            return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
                        };

                        // Use pre-calculated age from API if available, otherwise calculate from dob
                        const getAge = (): string => {
                            if (caseItem.patient?.age !== undefined && caseItem.patient?.age !== null) {
                                return caseItem.patient.age.toString();
                            }
                            // Fallback: calculate from dob if age not provided
                            const dob = caseItem.patient?.dob || caseItem.patient?.date_of_birth;
                            if (!dob || dob.length !== 8) return '';
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

                        return {
                            _id: caseItem._id,
                            name: caseItem.patient?.name || '',
                            sex: caseItem.patient?.sex || '',
                            pac_patinet_id: caseItem.patient?.patient_id || '',
                            date_of_birth: caseItem.patient?.dob || caseItem.patient?.date_of_birth || '',
                            age: getAge(),
                            hospital_id: caseItem.hospital_id || '',
                            hospital_name: caseItem.hospital_name || '',
                            status: caseItem.status || '',
                            study_description: caseItem.description || '',
                            description: caseItem.description || '',
                            body_part: caseItem.body_part || '',
                            accession_number: caseItem.accession_number || '',
                            study_uid: caseItem.study_uid || '',
                            modality: caseItem.modality || '',
                            study_date: caseItem.study_date || '',
                            study_time: caseItem.study_time || '',
                            date_of_capture: formatStudyDate(caseItem.study_date),
                            priority: caseItem.priority || '',
                            case_type: caseItem.case_type || '',
                            assigned_to: caseItem.assigned_to || '',
                            referring_physician: caseItem.referring_physician || '',
                            patient: caseItem.patient,
                            series_count: caseItem.series_count || 0,
                            instance_count: caseItem.instance_count || 0,
                            pac_images_count: 0, // Not provided in API response
                            updatedAt: caseItem.updatedAt || '',
                            isBookmarked: caseItem.isBookmarked || false,
                            notes: caseItem.notes || [],
                        } as Patient;
                    });
                    setPatients(mappedPatients);
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch assigned patients');
                console.error('Error fetching assigned patients:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAssignedPatients();
    }, [filters]);

    const handleZipDownload = (case_id: string) => {
        console.log('Downloading Case:', case_id);
    };

    // Save a patient case to bookmarks
    const handleSaveBookmark = async (patient: Patient) => {
        try {
            await apiService.bookmarkCase(patient._id);
            // Update local state to reflect the change immediately
            setPatients(prevPatients =>
                prevPatients.map(p =>
                    p._id === patient._id ? { ...p, isBookmarked: true } : p
                )
            );
            toast.success('Case bookmarked successfully');
        } catch (error) {
            console.error('Failed to bookmark case:', error);
            toast.error('Failed to bookmark case');
        }
    };

    // Remove a patient case from bookmarks
    const handleDeleteBookmark = async (patient: Patient) => {
        try {
            await apiService.deleteBookmark(patient._id);
            // Update local state to reflect the change immediately
            setPatients(prevPatients =>
                prevPatients.map(p =>
                    p._id === patient._id ? { ...p, isBookmarked: false } : p
                )
            );
            toast.success('Bookmark removed successfully');
        } catch (error) {
            console.error('Failed to remove bookmark:', error);
            toast.error('Failed to remove bookmark');
        }
    };

    const columnHelper = createColumnHelper<Patient>();

    const columns = useMemo(() => [
        columnHelper.display({
            id: 'actions',
            header: 'Action',
            enableHiding: false, // Always visible, cannot be hidden
            cell: (props) => (
                <TooltipProvider>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button className="p-1 hover:bg-blue-50 rounded cursor-pointer">
                                    <ClipboardCheck className="w-4 h-4 text-blue-500" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>???</p>
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button className="p-1 hover:bg-yellow-50 rounded cursor-pointer" onClick={() => handleDocumentClick(props.row.original)}>
                                    <FolderOpen className="w-4 h-4 text-yellow-500" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Attached Documents</p>
                            </TooltipContent>
                        </Tooltip>

                        {/* Message icon with notes indicator and hover popup */}
                        <HoverCard openDelay={200} closeDelay={100}>
                            <HoverCardTrigger asChild>
                                <button
                                    className="p-1 hover:bg-blue-50 rounded cursor-pointer relative"
                                    onClick={() => handleMessageClick(props.row.original)}
                                >
                                    <MessageSquare className="w-4 h-4 text-blue-500" />
                                    {props.row.original.notes && props.row.original.notes.length >= 1 && (
                                        <span className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border border-white" />
                                    )}
                                </button>
                            </HoverCardTrigger>
                            {props.row.original.notes && props.row.original.notes.length >= 1 && (
                                <HoverCardContent className="w-80 max-h-60 overflow-y-auto" align="start">
                                    <div className="space-y-3">
                                        <h4 className="text-sm font-semibold text-gray-900">Notes ({props.row.original.notes.length})</h4>
                                        <div className="space-y-2">
                                            {props.row.original.notes.map((note: Note) => (
                                                <div key={note._id} className="p-2 bg-gray-50 rounded-md border border-gray-100">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={`w-2 h-2 rounded-full ${note.flag_type === 'info' ? 'bg-blue-500' :
                                                            note.flag_type === 'warning' ? 'bg-yellow-500' :
                                                                note.flag_type === 'error' ? 'bg-red-500' : 'bg-gray-500'
                                                            }`} />
                                                        <span className="text-xs text-gray-500">
                                                            {new Date(note.created_at).toLocaleDateString('en-US', {
                                                                month: 'short',
                                                                day: 'numeric',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-gray-700">{note.note}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </HoverCardContent>
                            )}
                        </HoverCard>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => handleZipDownload(props.row.original._id)}
                                    className="p-1 hover:bg-yellow-50 rounded cursor-pointer"
                                >
                                    <Download className="w-4 h-4 text-yellow-500" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Download</p>
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Link to={`/studies/${props.row.original._id}/viewer`} target="_blank" className="p-1 hover:bg-blue-50 rounded cursor-pointer">
                                    <ImageIcon className="w-4 h-4 text-blue-500" />
                                </Link>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>View Images</p>
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    className="p-1 hover:bg-yellow-50 rounded cursor-pointer"
                                    onClick={() => props.row.original.isBookmarked
                                        ? handleDeleteBookmark(props.row.original)
                                        : handleSaveBookmark(props.row.original)
                                    }
                                >
                                    {props.row.original.isBookmarked ? (
                                        <Bookmark className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                    ) : (
                                        <Bookmark className="w-4 h-4 text-yellow-500" />
                                    )}
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{props.row.original.isBookmarked ? 'Remove Bookmark' : 'Save to Bookmarks'}</p>
                            </TooltipContent>
                        </Tooltip>
                    </div>
                </TooltipProvider>
            ),
        }),
        columnHelper.accessor('name', {
            header: 'Patient Name',
            cell: (info) => <CellWithCopy content={info.getValue()} cellId={`${info.row.id}-name`} />,
        }),
        columnHelper.display({
            id: 'age_sex',
            header: 'Age/Sex',
            cell: (props) => {
                const age = props.row.original.age || '-';
                const sex = props.row.original.sex || '-';
                return <CellWithCopy content={`${age} / ${sex}`} cellId={`${props.row.id}-age-sex`} />;
            },
        }),
        columnHelper.accessor('body_part', {
            header: 'Body Part',
            cell: (info) => <CellWithCopy content={info.getValue() || '-'} cellId={`${info.row.id}-body`} />,
        }),
        columnHelper.accessor('description', {
            header: 'Description',
            cell: (info) => <CellWithCopy content={info.getValue() || '-'} cellId={`${info.row.id}-desc`} />,
        }),
        columnHelper.accessor('modality', {
            header: 'Modality',
            cell: (info) => <CellWithCopy content={info.getValue() || '-'} cellId={`${info.row.id}-modality`} />,
        }),
        columnHelper.accessor('accession_number', {
            header: 'Accession Number',
            cell: (info) => <CellWithCopy content={info.getValue() || '-'} cellId={`${info.row.id}-acc`} />,
        }),
        columnHelper.display({
            id: 'study_date_time',
            header: 'Study Date/Time',
            cell: (props) => {
                // Format date from YYYYMMDD to readable format
                const dateStr = props.row.original.study_date || '';
                let formattedDate = '-';
                if (dateStr && dateStr.length === 8) {
                    const year = dateStr.substring(0, 4);
                    const month = dateStr.substring(4, 6);
                    const day = dateStr.substring(6, 8);
                    formattedDate = `${year}-${month}-${day}`;
                }

                // Format time from HHMMSS.milliseconds to HH:MM:SS
                const timeStr = props.row.original.study_time || '';
                let formattedTime = '';
                if (timeStr) {
                    const timePart = timeStr.split('.')[0];
                    if (timePart.length >= 6) {
                        formattedTime = `${timePart.substring(0, 2)}:${timePart.substring(2, 4)}:${timePart.substring(4, 6)}`;
                    }
                }

                return (
                    <div className="whitespace-pre-line text-xs">
                        <CellWithCopy
                            content={`${formattedDate}\n${formattedTime}`}
                            cellId={`${props.row.id}-datetime`}
                        />
                    </div>
                );
            },
        }),
        columnHelper.accessor('case_type', {
            header: 'Case Type',
            cell: (info) => <CellWithCopy content={info.getValue() || '-'} cellId={`${info.row.id}-case-type`} />,
        }),
        columnHelper.accessor('priority', {
            header: 'Priority',
            cell: (info) => <CellWithCopy content={info.getValue() || '-'} cellId={`${info.row.id}-priority`} />,
        }),
        columnHelper.accessor('series_count', {
            header: 'Series Count',
            cell: (info) => <CellWithCopy content={info.getValue()?.toString() || '0'} cellId={`${info.row.id}-series`} />,
        }),
        columnHelper.accessor('instance_count', {
            header: 'Instance Count',
            cell: (info) => <CellWithCopy content={info.getValue()?.toString() || '0'} cellId={`${info.row.id}-instance`} />,
        }),
    ], []);

    const handleMessageClick = (patient: Patient) => {
        setSelectedPatient(patient);
        setMessageDialogOpen(true);
    };

    const handleDocumentClick = (patient: Patient) => {
        setSelectedPatient(patient);
        setDocumentDialogOpen(true);
    };

    return (
        <DataTable
            data={patients}
            columns={columns}
            isLoading={isLoading}
            error={error}
            emptyMessage="No patients assigned to you yet."
            loadingMessage="Loading assigned patients..."
            columnVisibility={columnVisibility}
            onColumnVisibilityChange={setColumnVisibility}
            showColumnToggle={true}
            tableTitle="Cases"
        />
    );
};

export default AssignedPatientsTable;
