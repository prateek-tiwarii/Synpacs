import { Bookmark, ClipboardCheck, Download, FolderOpen, ImageIcon, MessageSquare, Eye, X } from "lucide-react";
import { useState, useMemo, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import type { VisibilityState, RowSelectionState } from '@tanstack/react-table';
import { createColumnHelper } from '@tanstack/react-table';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Patient, Note } from "@/components/patient/PacDetailsModal";
import { apiService } from "@/lib/api";
import { DataTable, CellWithCopy } from "@/components/common/DataTable";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import BookmarkDialog from "./BookmarkDialog";
import DownloadModal from "@/components/common/DownloadModal";

import type { FilterState } from "@/components/common/FilterPanel";
import toast from "react-hot-toast";

// Default column visibility configuration for AssignedPatientsTable
const DEFAULT_COLUMN_VISIBILITY: VisibilityState = {
    actions: true, // Always visible, cannot be hidden
    name: true,
    case_id: true,
    age: true,
    sex: true,
    study_date_time: true,
    history_date_time: true,
    reporting_date_time: true,
    accession_number: true,
    center: true,
    referring_doctor: true,
    image_count: true,
    description: true,
    modality: true,
    case_type: true,
    reported: true,
    // Hide other columns
    series_count: false,
    instance_count: false,
};

const STORAGE_KEY_ASSIGNED_PATIENTS = 'assigned_patients_table_columns';

type TabType = 'Unreported' | 'Signed Off' | 'All Cases' | 'Drafted';

// Map tab names to backend reporitng_status values
const TAB_TO_REPORTING_STATUS_MAP: Record<TabType, string> = {
    'Unreported': 'unreported',
    'Signed Off': 'signed_off',
    'All Cases': 'all',
    'Drafted': 'drafted',
};

interface AssignedPatientsTableProps {
    setSelectedPatient: (patient: Patient | null) => void;
    setMessageDialogOpen: (open: boolean) => void;
    setDocumentDialogOpen: (open: boolean) => void;
    filters?: FilterState;
    activeTab?: TabType;
}

const AssignedPatientsTable = ({
    setSelectedPatient,
    setMessageDialogOpen,
    setDocumentDialogOpen,
    filters,
    activeTab = 'All Cases',
}: AssignedPatientsTableProps) => {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [bookmarkDialogOpen, setBookmarkDialogOpen] = useState(false);
    const [selectedPatientForBookmark, setSelectedPatientForBookmark] = useState<Patient | null>(null);
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const [downloadModalOpen, setDownloadModalOpen] = useState(false);
    const [selectedCaseForDownload, setSelectedCaseForDownload] = useState<{ id: string; name: string } | null>(null);

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

    const fetchAssignedPatients = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            // Build API filters from FilterState - always include all properties
            // Map activeTab to status
            const reporting_status = TAB_TO_REPORTING_STATUS_MAP[activeTab] || 'all';

            const apiFilters: any = {
                start_date: filters?.startDate || '',
                end_date: filters?.endDate || '',
                patient_name: filters?.patientName || '',
                patient_id: filters?.patientId || '',
                body_part: filters?.bodyPart || '',
                reporting_status: reporting_status,
                gender: '',
                modality: '',
            };

            if (filters) {
                // Handle gender
                if (filters.gender?.M && !filters.gender?.F) {
                    apiFilters.gender = 'M';
                } else if (filters.gender?.F && !filters.gender?.M) {
                    apiFilters.gender = 'F';
                } else if (filters.gender?.M && filters.gender?.F) {
                    apiFilters.gender = 'MF';
                }

                // Handle modality
                if (filters.modalities) {
                    const selectedModality = Object.entries(filters.modalities).find(
                        ([key, isSelected]) => isSelected && key !== 'ALL'
                    );
                    if (selectedModality) {
                        apiFilters.modality = selectedModality[0];
                    }
                }
            }

            const response = await apiService.getAssignedCases(apiFilters) as any;
            if (response.success && response.data) {
                // Map API response to match Patient interface
                const mappedPatients: Patient[] = response.data.map((caseItem: any) => {
                    // Format case_date to readable format (YYYYMMDD -> YYYY-MM-DD)
                    const formatCaseDate = (dateStr: string): string => {
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
                        hospital_id: caseItem.center_id || caseItem.hospital_id || '',
                        hospital_name: caseItem.center_name || caseItem.hospital_name || '',
                        status: caseItem.status || '',
                        case_description: caseItem.description || '',
                        description: caseItem.description || '',
                        body_part: caseItem.body_part || '',
                        accession_number: caseItem.accession_number || '',
                        case_uid: caseItem.case_uid || '',
                        modality: caseItem.modality || '',
                        case_date: caseItem.case_date || '',
                        case_time: caseItem.case_time || '',
                        date_of_capture: formatCaseDate(caseItem.case_date),
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
                        attached_report: caseItem.attached_report || null,
                        reporting_status: caseItem.reporting_status || '',
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
    }, [filters, activeTab]);

    useEffect(() => {
        fetchAssignedPatients();
    }, [fetchAssignedPatients]);

    const handleZipDownload = (case_id: string, patient_name?: string) => {
        setSelectedCaseForDownload({
            id: case_id,
            name: patient_name || 'Study Files'
        });
        setDownloadModalOpen(true);
    };

    // Save a patient case to bookmarks
    const handleSaveBookmark = async (patient: Patient) => {
        setSelectedPatientForBookmark(patient);
        setBookmarkDialogOpen(true);
    };

    const handleBookmarkSuccess = () => {
        if (selectedPatientForBookmark) {
            // Update local state to reflect the change immediately
            setPatients(prevPatients =>
                prevPatients.map(p =>
                    p._id === selectedPatientForBookmark._id ? { ...p, isBookmarked: true } : p
                )
            );
            toast.success('Case bookmarked successfully');
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
            id: 'select',
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
                    onClick={(e) => e.stopPropagation()}
                />
            ),
            enableHiding: false,
        }),
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
                                                <div key={note._id} className="p-2.5 bg-white rounded-md border border-gray-200 shadow-sm">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${note.flag_type === 'urgent' ? 'bg-red-100 text-red-700' :
                                                                note.flag_type === 'routine' ? 'bg-gray-100 text-gray-700' :
                                                                    note.flag_type === 'info' ? 'bg-blue-100 text-blue-700' :
                                                                        note.flag_type === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                                                                            note.flag_type === 'error' ? 'bg-red-100 text-red-700' :
                                                                                'bg-gray-100 text-gray-700'
                                                                }`}>
                                                                {note.flag_type === 'urgent' ? 'URGENT' :
                                                                    note.flag_type === 'routine' ? 'ROUTINE' :
                                                                        String(note.flag_type || 'ROUTINE').toUpperCase()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <p className="text-sm text-gray-700 mb-2 leading-relaxed">{note.note}</p>
                                                    <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
                                                        <span className="font-medium">
                                                            {note.created_by?.full_name || 'Unknown User'}
                                                        </span>
                                                        <span>
                                                            {new Date(note.createdAt || note.created_at).toLocaleDateString('en-US', {
                                                                month: 'short',
                                                                day: 'numeric',
                                                                year: 'numeric'
                                                            })} at {new Date(note.createdAt || note.created_at).toLocaleTimeString('en-US', {
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </span>
                                                    </div>
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
                                    onClick={() => handleZipDownload(props.row.original._id, props.row.original.patient?.name)}
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
                                <button
                                    onClick={() => {
                                        const id = props.row.original._id;
                                        // Open viewer only in a new window (not tab)
                                        window.open(`/case/${id}/viewer`, `viewer_${id}`, 'width=1200,height=800,resizable=yes,scrollbars=yes');
                                    }}
                                    className="p-1 hover:bg-blue-50 rounded cursor-pointer"
                                >
                                    <ImageIcon className="w-4 h-4 text-blue-500" />
                                </button>
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
            cell: (info) => {
                const name = info.getValue();
                const caseId = info.row.original._id;
                return (
                    <button
                        onClick={() => {
                            // Open only viewer in new window
                            window.open(`${window.location.origin}/case/${caseId}/viewer`, `viewer_${caseId}`, 'width=1200,height=800,resizable=yes,scrollbars=yes');
                        }}
                        className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-medium text-left"
                    >
                        {name}
                    </button>
                );
            },
        }),
        columnHelper.display({
            id: 'case_id',
            header: 'Case ID',
            cell: (props) => {
                const patientId = props.row.original.pac_patinet_id || props.row.original.patient?.patient_id || '-';
                return <CellWithCopy content={patientId} cellId={`${props.row.id}-case-id`} />;
            },
        }),
        columnHelper.display({
            id: 'age',
            header: 'Age',
            cell: (props) => {
                const age = props.row.original.age || props.row.original.patient?.age || '-';
                return <CellWithCopy content={String(age)} cellId={`${props.row.id}-age`} />;
            },
        }),
        columnHelper.display({
            id: 'sex',
            header: 'Sex',
            cell: (props) => {
                const sex = props.row.original.sex || props.row.original.patient?.sex || '-';
                return <CellWithCopy content={sex} cellId={`${props.row.id}-sex`} />;
            },
        }),
        columnHelper.display({
            id: 'study_date_time',
            header: 'Study Date & Time',
            cell: (props) => {
                // Format date from YYYYMMDD to readable format
                const dateStr = props.row.original.case_date || '';
                let formattedDate = '-';
                if (dateStr && dateStr.length === 8) {
                    const year = dateStr.substring(0, 4);
                    const month = dateStr.substring(4, 6);
                    const day = dateStr.substring(6, 8);
                    formattedDate = `${day}-${month}-${year}`;
                }

                // Format time from HHMMSS.milliseconds to HH:MM
                const timeStr = props.row.original.case_time || '';
                let formattedTime = '';
                if (timeStr) {
                    const timePart = timeStr.split('.')[0];
                    if (timePart.length >= 4) {
                        formattedTime = `${timePart.substring(0, 2)}:${timePart.substring(2, 4)}`;
                    }
                }

                return <CellWithCopy content={`${formattedDate} ${formattedTime}`} cellId={`${props.row.id}-study-dt`} />;
            },
        }),
        columnHelper.display({
            id: 'history_date_time',
            header: 'History Date & Time',
            cell: (props) => {
                // Use updatedAt as history date/time
                const updatedAt = props.row.original.updatedAt;
                if (!updatedAt) return <span className="text-gray-400">-</span>;

                const date = new Date(updatedAt);
                const formatted = date.toLocaleString('en-GB', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                });
                return <CellWithCopy content={formatted} cellId={`${props.row.id}-history-dt`} />;
            },
        }),

        columnHelper.accessor('accession_number', {
            header: 'Accession Number',
            cell: (info) => <CellWithCopy content={info.getValue() || '-'} cellId={`${info.row.id}-accession`} />,
        }),
        columnHelper.display({
            id: 'center',
            header: 'Center',
            cell: (props) => {
                const centerName = props.row.original.hospital_name;
                if (!centerName) return <span className="text-gray-400">-</span>;
                return (
                    <Badge variant="info" className="font-normal text-[10px] px-2 py-0.5 whitespace-nowrap">
                        {centerName}
                    </Badge>
                );
            },
        }),
        columnHelper.display({
            id: 'referring_doctor',
            header: 'Referring Doctor',
            cell: (props) => {
                const referringPhysician = props.row.original.referring_physician || '-';
                return <CellWithCopy content={referringPhysician} cellId={`${props.row.id}-ref-doc`} />;
            },
        }),
        columnHelper.display({
            id: 'image_count',
            header: 'Image Count',
            cell: (props) => {
                const instanceCount = props.row.original.instance_count || 0;
                return <CellWithCopy content={String(instanceCount)} cellId={`${props.row.id}-img-count`} />;
            },
        }),
        columnHelper.accessor('description', {
            header: 'Description',
            cell: (info) => <CellWithCopy content={info.getValue() || '-'} cellId={`${info.row.id}-desc`} />,
        }),
        columnHelper.accessor('modality', {
            header: 'Modality',
            cell: (info) => <CellWithCopy content={info.getValue() || '-'} cellId={`${info.row.id}-modality`} />,
        }),
        columnHelper.accessor('case_type', {
            header: 'Case Type',
            cell: (info) => <CellWithCopy content={info.getValue() || '-'} cellId={`${info.row.id}-case-type`} />,
        }),
        columnHelper.display({
            id: 'reporting_date_time',
            header: 'Reporting Date & Time',
            cell: (props) => {
                const attachedReport = (props.row.original as any).attached_report;
                if (!attachedReport?.created_at) return <span className="text-gray-400">-</span>;

                const date = new Date(attachedReport.created_at);
                const formatted = date.toLocaleString('en-GB', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                });
                return <CellWithCopy content={formatted} cellId={`${props.row.id}-report-dt`} />;
            },
        }),
        columnHelper.display({
            id: 'reported',
            header: 'Reported',
            cell: (props) => {
                const reportingStatus = (props.row.original as any).reporting_status;

                // Check for attached report first
                if (reportingStatus === 'drafted') {
                    return (
                        <Link
                            to={`/case/${props.row.original._id}/report`}
                            onClick={(e) => e.stopPropagation()}
                            className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full transition-colors bg-yellow-100 border-2 border-yellow-500 text-yellow-800 hover:bg-yellow-200`}
                        >
                            Drafted
                        </Link>
                    );
                }

                // Check for reporting_status field
                if (reportingStatus === 'signed_off') {
                    return (
                        <Link
                            to={`/case/${props.row.original._id}/report`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 border-2 border-green-500 text-green-800 hover:bg-green-200 transition-colors"
                        >
                            Signed Off
                        </Link>
                    );
                }

                if (reportingStatus === 'unreported') {
                    return (
                        <Link
                            to={`/case/${props.row.original._id}/report`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex justify-center"
                        >
                            -
                        </Link>
                    );
                }

                // Default: unreported
                return <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">Unreported</span>;
            },
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

    // Get selected patients from row selection
    const selectedPatients = useMemo(() => {
        return Object.keys(rowSelection)
            .filter(key => rowSelection[key])
            .map(key => patients[parseInt(key)])
            .filter(Boolean);
    }, [rowSelection, patients]);

    // Handle bulk viewer action
    const handleBulkViewStudies = () => {
        selectedPatients.forEach((patient, index) => {
            if (patient?._id) {
                // Open each study in a new window (not tab) with a slight delay
                setTimeout(() => {
                    window.open(`/case/${patient._id}/viewer`, `viewer_${patient._id}`, 'width=1200,height=800,resizable=yes,scrollbars=yes');
                }, index * 100);
            }
        });
    };

    // Handle bulk report action
    const handleBulkViewReports = () => {
        selectedPatients.forEach((patient, index) => {
            if (patient?._id) {
                setTimeout(() => {
                    window.open(`/case/${patient._id}/report`, `report_${patient._id}`, 'width=1200,height=800,resizable=yes,scrollbars=yes');
                }, index * 100);
            }
        });
    };

    // Clear selection
    const handleClearSelection = () => {
        setRowSelection({});
    };

    return (
        <>
            {selectedPatients.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-blue-900">
                                {selectedPatients.length} case{selectedPatients.length > 1 ? 's' : ''} selected
                            </span>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    onClick={handleBulkViewStudies}
                                    className="h-8 text-xs bg-blue-600 hover:bg-blue-700"
                                >
                                    <Eye className="w-3.5 h-3.5 mr-1.5" />
                                    Open All Studies
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleBulkViewReports}
                                    className="h-8 text-xs border-blue-300 text-blue-700 hover:bg-blue-100"
                                >
                                    <ClipboardCheck className="w-3.5 h-3.5 mr-1.5" />
                                    Open All Reports
                                </Button>
                            </div>
                        </div>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleClearSelection}
                            className="h-8 text-xs text-gray-600 hover:text-gray-900"
                        >
                            <X className="w-3.5 h-3.5 mr-1" />
                            Clear
                        </Button>
                    </div>
                </div>
            )}
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
                enableRowSelection={true}
                rowSelection={rowSelection}
                onRowSelectionChange={setRowSelection}
            />
            <BookmarkDialog
                open={bookmarkDialogOpen}
                onOpenChange={setBookmarkDialogOpen}
                patient={selectedPatientForBookmark}
                onSuccess={handleBookmarkSuccess}
            />
            <DownloadModal
                open={downloadModalOpen}
                onClose={() => {
                    setDownloadModalOpen(false);
                    setSelectedCaseForDownload(null);
                }}
                caseId={selectedCaseForDownload?.id || ''}
                caseName={selectedCaseForDownload?.name}
            />
        </>
    );
};

export default AssignedPatientsTable;
