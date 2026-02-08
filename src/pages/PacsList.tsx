import { Download, ImageIcon, ChevronDown, ChevronUp, SlidersHorizontal, ClipboardCheck, FolderOpen, MessageSquare, Bookmark, Settings, Eye } from "lucide-react";
import { useState, useMemo, useEffect, useCallback } from "react";
import type { VisibilityState, ColumnSizingState } from '@tanstack/react-table';
import { createColumnHelper } from '@tanstack/react-table';
import type { Patient } from "@/components/patient/PacDetailsModal";
import { apiService } from "@/lib/api";
import { DataTable, CellWithCopy } from "@/components/common/DataTable";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Link } from "react-router-dom";
import FilterPanel, { type FilterState } from "@/components/common/FilterPanel";
import MessageDialog from "@/components/dashboard/doctorDashboard/molecules/MessageDialog";
import DocumentDialog from "@/components/dashboard/doctorDashboard/molecules/DocumentDialog";
import BookmarkDialog from "@/components/dashboard/doctorDashboard/molecules/BookmarkDialog";
import DownloadModal from "@/components/common/DownloadModal";
import PatientHistoryModal from "@/components/dashboard/doctorDashboard/molecules/PatientHistoryModal";
import toast from "react-hot-toast";
import type { Note } from "@/components/patient/PacDetailsModal";

// Default column visibility configuration
const DEFAULT_COLUMN_VISIBILITY: VisibilityState = {
    actions: true,
    name: true,
    case_id: true,
    age: true,
    sex: true,
    study_date_time: true,
    history_date_time: false,
    reporting_date_time: false,
    accession_number: true,
    center: true,
    referring_doctor: true,
    image_count: true,
    description: true,
    modality: true,
    case_type: true,
    reported: true,
};

const STORAGE_KEY_PACS_LIST = 'pacs_list_table_columns';
const STORAGE_KEY_PACS_LIST_SIZING = 'pacs_list_table_column_sizing';

const PacsList = () => {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFilterCollapsed, setIsFilterCollapsed] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCases, setTotalCases] = useState(0);
    const pageSize = 20;
    const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
    const [activePeriod, setActivePeriod] = useState('1M');
    const [availableCenters, setAvailableCenters] = useState<{ id: string; name: string }[]>([]);

    // Dialog states
    const [messageDialogOpen, setMessageDialogOpen] = useState(false);
    const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
    const [bookmarkDialogOpen, setBookmarkDialogOpen] = useState(false);
    const [downloadModalOpen, setDownloadModalOpen] = useState(false);
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
    const [selectedCaseForDownload, setSelectedCaseForDownload] = useState<{ id: string; name: string } | null>(null);

    // Initialize filters with default values
    const [filters, setFilters] = useState<FilterState>({
        patientName: '',
        patientId: '',
        bodyPart: '',
        startDate: '',
        endDate: '',
        status: 'all',
        gender: { M: false, F: false },
        hospital: '',
        centers: [],
        studyStatus: { reported: false, drafted: false, unreported: false, reviewed: false },
        reportStatus: { reported: false, drafted: false, unreported: false },
        modalities: {
            ALL: true, DT: true, SC: true, AN: true,
            US: true, ECHO: true, CR: true, XA: true,
            MR: true, CTMR: true, PX: true, DX: true,
            MR2: true, NM: true, RF: true, CT: true,
        },
    });

    // Initialize column visibility from localStorage or use default
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY_PACS_LIST);
            if (stored) {
                const parsed = JSON.parse(stored);
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
            localStorage.setItem(STORAGE_KEY_PACS_LIST, JSON.stringify(columnVisibility));
        } catch (error) {
            console.error('Failed to save column visibility to localStorage:', error);
        }
    }, [columnVisibility]);

    // Initialize column sizing from localStorage or use empty (default sizes)
    const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY_PACS_LIST_SIZING);
            if (stored) return JSON.parse(stored);
        } catch (error) {
            console.error('Failed to load column sizing from localStorage:', error);
        }
        return {};
    });

    // Save column sizing to localStorage whenever it changes
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY_PACS_LIST_SIZING, JSON.stringify(columnSizing));
        } catch (error) {
            console.error('Failed to save column sizing to localStorage:', error);
        }
    }, [columnSizing]);

    // Fetch available centers
    useEffect(() => {
        const fetchCenters = async () => {
            try {
                const response = await apiService.getAllManagedHospitals() as any;
                if (response.success && response.data) {
                    const centers = response.data.map((hospital: any) => ({
                        id: hospital._id,
                        name: hospital.hospital_name || hospital.name
                    }));
                    setAvailableCenters(centers);
                }
            } catch (error) {
                console.error('Failed to fetch centers:', error);
            }
        };
        fetchCenters();
    }, []);

    const fetchAllCases = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            // Check if user is authenticated
            const token = apiService.getToken();
            if (!token) {
                setError('Please log in to view PACS List');
                setIsLoading(false);
                return;
            }

            // Get the active hospital/center ID from localStorage
            const activeHospital = localStorage.getItem('active_hospital');
            
            if (!activeHospital) {
                setError('No active center selected');
                setIsLoading(false);
                return;
            }

            const response = await apiService.getAllCasesWithFilters(currentPage, pageSize, {}) as any;

            if (response.success && response.data?.cases) {
                // Update pagination info
                if (response.pagination) {
                    setCurrentPage(response.pagination.currentPage);
                    setTotalPages(response.pagination.totalPages);
                    setTotalCases(response.pagination.totalCases || response.data.cases.length);
                }

                // Apply client-side filtering
                let filteredData = [...response.data.cases];

                // Filter by report status
                if (filters.reportStatus.reported || filters.reportStatus.drafted || filters.reportStatus.unreported) {
                    filteredData = filteredData.filter((caseItem: any) => {
                        const hasReport = caseItem.attached_report;
                        const isDraft = hasReport?.is_draft;
                        
                        if (filters.reportStatus.reported && hasReport && !isDraft) return true;
                        if (filters.reportStatus.drafted && hasReport && isDraft) return true;
                        if (filters.reportStatus.unreported && !hasReport) return true;
                        
                        return false;
                    });
                }

                // Filter by modality
                const selectedModalities = Object.entries(filters.modalities)
                    .filter(([_, isSelected]) => isSelected)
                    .map(([modality]) => modality);
                
                // Check if all modalities are selected (excluding ALL)
                const allModalityKeys = Object.keys(filters.modalities).filter(k => k !== "ALL");
                const allModalitiesSelected = allModalityKeys.every(key => filters.modalities[key as keyof typeof filters.modalities]);
                
                // Only filter if not all modalities are selected
                if (selectedModalities.length > 0 && !allModalitiesSelected && !selectedModalities.includes('ALL')) {
                    filteredData = filteredData.filter((caseItem: any) => 
                        selectedModalities.includes(caseItem.modality)
                    );
                }

                const mappedPatients: Patient[] = filteredData.map((caseItem: any) => {
                    // Calculate age from DOB if needed
                    const calculateAge = (dob: string): string => {
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
                        name: caseItem.patient?.name || 'N/A',
                        pac_patinet_id: caseItem.patient?.patient_id || '',
                        dob: caseItem.patient?.dob || '',
                        hospital_id: caseItem.hospital_id || '',
                        age: calculateAge(caseItem.patient?.dob || ''),
                        sex: caseItem.patient?.sex || '',
                        case_description: caseItem.description || '',
                        case: { case_uid: caseItem.case_uid || '', body_part: caseItem.body_part || '' },
                        treatment_type: caseItem.case_type || '',
                        case_date: caseItem.case_date || '',
                        case_time: caseItem.case_time || '',
                        referring_doctor: caseItem.referring_physician || '',
                        accession_number: caseItem.accession_number || '',
                        status: caseItem.status || '',
                        priority: caseItem.priority || '',
                        assigned_to: caseItem.assigned_to || null,
                        hospital_name: caseItem.hospital_name || '',
                        modality: caseItem.modality || '',
                        series_count: caseItem.series_count || 0,
                        instance_count: caseItem.instance_count || 0,
                        pac_images_count: caseItem.instance_count || 0,
                        updatedAt: caseItem.updatedAt || '',
                        attached_report: caseItem.attached_report || null,
                        patient: caseItem.patient,
                        notes: caseItem.notes || [],
                        isBookmarked: caseItem.isBookmarked || false,
                        patient_history: caseItem.patient_history || [],
                    } as Patient;
                });
                setPatients(mappedPatients);
            } else {
                setError(response.message || 'Failed to fetch patients');
            }
        } catch (err) {
            console.error('Error fetching all cases:', err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to fetch cases';
            
            // Check if it's an authentication error
            if (errorMessage.includes('Unauthorized') || errorMessage.includes('Authorization') || errorMessage.includes('token')) {
                setError('Your session has expired. Please log in again.');
                // Optionally redirect to login
                // window.location.href = '/login';
            } else {
                setError(errorMessage);
            }
        } finally {
            setIsLoading(false);
        }
    }, [filters, currentPage, pageSize]);

    useEffect(() => {
        fetchAllCases();
    }, [fetchAllCases, currentPage]);

    const handleFilterChange = (newFilters: FilterState) => {
        setFilters(newFilters);
    };

    const handleFilterReset = () => {
        setFilters({
            patientName: '',
            patientId: '',
            bodyPart: '',
            startDate: '',
            endDate: '',
            status: 'all',
            gender: { M: false, F: false },
            hospital: '',
            centers: [],
            studyStatus: { reported: false, drafted: false, unreported: false, reviewed: false },
            reportStatus: { reported: false, drafted: false, unreported: false },
            modalities: {
                ALL: true, DT: true, SC: true, AN: true,
                US: true, ECHO: true, CR: true, XA: true,
                MR: true, CTMR: true, PX: true, DX: true,
                MR2: true, NM: true, RF: true, CT: true,
            },
        });
    };

    // Action handlers
    const handleMessageClick = (patient: Patient) => {
        setSelectedPatient(patient);
        setMessageDialogOpen(true);
    };

    const handleDocumentClick = (patient: Patient) => {
        setSelectedPatient(patient);
        setDocumentDialogOpen(true);
    };

    const handleHistoryClick = (patient: Patient) => {
        setSelectedPatient(patient);
        setHistoryModalOpen(true);
    };

    const handleZipDownload = (caseId: string, patientName?: string) => {
        setSelectedCaseForDownload({
            id: caseId,
            name: patientName || 'Study Files'
        });
        setDownloadModalOpen(true);
    };

    const handleSaveBookmark = (patient: Patient) => {
        setSelectedPatient(patient);
        setBookmarkDialogOpen(true);
    };

    const handleBookmarkSuccess = () => {
        if (selectedPatient) {
            setPatients(prevPatients =>
                prevPatients.map(p =>
                    p._id === selectedPatient._id ? { ...p, isBookmarked: true } : p
                )
            );
            toast.success('Case bookmarked successfully');
        }
    };

    const handleDeleteBookmark = async (patient: Patient) => {
        try {
            await apiService.deleteBookmark(patient._id);
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

    const handleNoteSuccess = () => {
        toast.success('Note added successfully');
    };

    const columnHelper = createColumnHelper<Patient>();

    const columns = useMemo(() => [
        columnHelper.display({
            id: 'actions',
            header: () => (
                <div className="flex items-center gap-1">
                    <span>Action</span>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsColumnModalOpen(true);
                        }}
                        className="p-0.5 hover:bg-gray-200 rounded"
                        title="Column Settings"
                    >
                        <Settings className="w-3 h-3 text-gray-600" />
                    </button>
                </div>
            ),
            enableHiding: false,
            size: 125,
            minSize: 80,
            cell: (props: any) => (
                <TooltipProvider>
                    <div className="flex gap-0.5" onClick={(e) => e.stopPropagation()}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    className="p-0.5 hover:bg-blue-50 rounded cursor-pointer"
                                    onClick={() => handleHistoryClick(props.row.original)}
                                >
                                    <ClipboardCheck className="w-3.5 h-3.5 text-blue-500" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Patient History</p>
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    className="p-0.5 hover:bg-yellow-50 rounded cursor-pointer"
                                    onClick={() => handleDocumentClick(props.row.original)}
                                >
                                    <FolderOpen className="w-3.5 h-3.5 text-yellow-500" />
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
                                    className="p-0.5 hover:bg-blue-50 rounded cursor-pointer relative"
                                    onClick={() => handleMessageClick(props.row.original)}
                                >
                                    <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
                                    {props.row.original.notes && props.row.original.notes.length >= 1 && (
                                        <span className="absolute bottom-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-white" />
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
                                                            {note.created_by?.full_name ||
                                                                (typeof note.user_id === 'object' ? note.user_id.full_name : 'Unknown User')}
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
                                    className="p-0.5 hover:bg-yellow-50 rounded cursor-pointer"
                                >
                                    <Download className="w-3.5 h-3.5 text-yellow-500" />
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
                                        window.open(`/case/${props.row.original._id}/viewer`, `viewer_${props.row.original._id}`, 'width=1200,height=800,resizable=yes,scrollbars=yes');
                                    }}
                                    className="p-0.5 hover:bg-blue-50 rounded cursor-pointer"
                                >
                                    <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>View Images</p>
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    className="p-0.5 hover:bg-yellow-50 rounded cursor-pointer"
                                    onClick={() => props.row.original.isBookmarked
                                        ? handleDeleteBookmark(props.row.original)
                                        : handleSaveBookmark(props.row.original)
                                    }
                                >
                                    {props.row.original.isBookmarked ? (
                                        <Bookmark className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                                    ) : (
                                        <Bookmark className="w-3.5 h-3.5 text-yellow-500" />
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
            enableSorting: true,
            size: 150,
            minSize: 30,
            cell: (info: any) => {
                const name = info.getValue();
                const caseId = info.row.original._id;
                return (
                    <div className="flex items-center gap-2">
                        <CellWithCopy content={name || '-'} cellId={`${info.row.id}-name`} />
                        <button
                            onClick={() => {
                                window.open(`${window.location.origin}/case/${caseId}/viewer`, `viewer_${caseId}`, 'width=1200,height=800,resizable=yes,scrollbars=yes');
                            }}
                            className="text-red-500 hover:text-red-700 shrink-0"
                            title="Open Viewer"
                        >
                            <Eye className="w-4 h-4" />
                        </button>
                    </div>
                );
            },
        }),
        columnHelper.display({
            id: 'case_id',
            header: 'Case ID',
            enableSorting: false,
            size: 85,
            minSize: 30,
            cell: (props: any) => {
                const patientId = props.row.original.pac_patinet_id || props.row.original.patient?.patient_id || '-';
                return <CellWithCopy content={patientId} cellId={`${props.row.id}-case-id`} />;
            },
        }),
        columnHelper.display({
            id: 'age',
            header: 'Age',
            enableSorting: false,
            size: 40,
            minSize: 20,
            cell: (props: any) => {
                const age = props.row.original.age || props.row.original.patient?.age || '-';
                return <CellWithCopy content={String(age)} cellId={`${props.row.id}-age`} />;
            },
        }),
        columnHelper.display({
            id: 'sex',
            header: 'Sex',
            enableSorting: false,
            size: 40,
            minSize: 20,
            cell: (props: any) => {
                const sex = props.row.original.sex || props.row.original.patient?.sex || '-';
                return <CellWithCopy content={sex} cellId={`${props.row.id}-sex`} />;
            },
        }),
        columnHelper.display({
            id: 'study_date_time',
            header: 'Study Date & Time',
            enableSorting: true,
            size: 120,
            minSize: 30,
            cell: (props: any) => {
                const dateStr = props.row.original.case_date || '';
                let formattedDate = '-';
                if (dateStr && dateStr.length === 8) {
                    const year = dateStr.substring(0, 4);
                    const month = dateStr.substring(4, 6);
                    const day = dateStr.substring(6, 8);
                    formattedDate = `${day}-${month}-${year}`;
                }

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
            enableSorting: true,
            size: 120,
            minSize: 30,
            cell: (props: any) => {
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
        columnHelper.display({
            id: 'reporting_date_time',
            header: 'Reporting Date & Time',
            enableSorting: true,
            size: 120,
            minSize: 30,
            cell: (props: any) => {
                const attachedReport = props.row.original.attached_report;
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
        columnHelper.accessor('accession_number', {
            header: 'Accession Number',
            enableSorting: false,
            size: 105,
            minSize: 30,
            cell: (info: any) => <CellWithCopy content={info.getValue() || '-'} cellId={`${info.row.id}-accession`} />,
        }),
        columnHelper.display({
            id: 'center',
            header: 'Center',
            enableSorting: false,
            size: 90,
            minSize: 30,
            cell: (props: any) => {
                const centerName = props.row.original.hospital_name || '-';
                return <CellWithCopy content={centerName} cellId={`${props.row.id}-center`} />;
            },
        }),
        columnHelper.display({
            id: 'referring_doctor',
            header: 'Referring Doctor',
            enableSorting: false,
            size: 105,
            minSize: 30,
            cell: (props: any) => {
                const referringDoctor = props.row.original.referring_doctor || '-';
                return <CellWithCopy content={referringDoctor} cellId={`${props.row.id}-ref-doc`} />;
            },
        }),
        columnHelper.display({
            id: 'image_count',
            header: 'Image Count',
            enableSorting: false,
            size: 60,
            minSize: 20,
            cell: (props: any) => {
                const instanceCount = props.row.original.instance_count || 0;
                return <CellWithCopy content={String(instanceCount)} cellId={`${props.row.id}-img-count`} />;
            },
        }),
        columnHelper.accessor('case_description', {
            header: 'Study Description',
            enableSorting: false,
            size: 130,
            minSize: 30,
            cell: (info: any) => <CellWithCopy content={info.getValue() || '-'} cellId={`${info.row.id}-desc`} />,
        }),
        columnHelper.accessor('modality', {
            header: 'Modality',
            enableSorting: false,
            size: 55,
            minSize: 20,
            cell: (info: any) => <CellWithCopy content={info.getValue() || '-'} cellId={`${info.row.id}-modality`} />,
        }),
        columnHelper.display({
            id: 'case_type',
            header: 'Case Type',
            enableSorting: false,
            size: 70,
            minSize: 20,
            cell: (props: any) => {
                const caseType = props.row.original.treatment_type || '-';
                return <CellWithCopy content={caseType} cellId={`${props.row.id}-case-type`} />;
            },
        }),
        columnHelper.display({
            id: 'reported',
            header: 'Reported',
            enableSorting: false,
            size: 75,
            minSize: 30,
            cell: (props: any) => {
                const attachedReport = props.row.original.attached_report;
                if (attachedReport) {
                    return (
                        <Link
                            to={`/case/${props.row.original._id}/report`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 hover:bg-green-200 transition-colors"
                        >
                            {attachedReport.is_draft ? 'Draft' : 'Available'}
                        </Link>
                    );
                }
                return <span className="text-gray-400">-</span>;
            },
        }),
    ], [handleDeleteBookmark, handleSaveBookmark, handleZipDownload, handleMessageClick, handleDocumentClick, handleHistoryClick]);

    return (
        <div className="p-6 space-y-4">
            {/* Header with Filter Toggle */}
            <div className="border border-slate-200 bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-end px-4 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                    <button
                        onClick={() => setIsFilterCollapsed(!isFilterCollapsed)}
                        className={`
                            flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200
                            ${!isFilterCollapsed
                                ? 'bg-slate-700 text-white shadow-sm'
                                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                            }
                        `}
                    >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <span>Filters</span>
                        {isFilterCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                    </button>
                </div>

                {/* Filter Panel */}
                {!isFilterCollapsed && (
                    <FilterPanel
                        onFilterChange={handleFilterChange}
                        onFilterReset={handleFilterReset}
                        initialFilters={filters}
                        activePeriod={activePeriod}
                        setActivePeriod={setActivePeriod}
                        availableCenters={availableCenters}
                        showCenters={true}
                        showStudyStatus={true}
                    />
                )}
            </div>

            {/* Data Table */}
            <DataTable
                data={patients}
                columns={columns}
                isLoading={isLoading}
                error={error}
                emptyMessage="No cases found"
                loadingMessage="Loading cases..."
                showBorder={true}
                showColumnToggle={true}
                columnVisibility={columnVisibility}
                onColumnVisibilityChange={setColumnVisibility}
                isColumnModalOpen={isColumnModalOpen}
                onColumnModalOpenChange={setIsColumnModalOpen}
                enableColumnResizing={true}
                columnSizing={columnSizing}
                onColumnSizingChange={setColumnSizing}
            />

            {/* Footer with Total Cases and Pagination */}
            {!isLoading && !error && (
                <div className="flex items-center justify-end gap-4">
                    <span className="text-xs text-slate-600">
                        Total: <span className="font-semibold">{totalCases}</span> cases
                    </span>
                    {totalPages > 1 && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-md border border-slate-200">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1 || isLoading}
                                className="px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Previous
                            </button>
                            <span className="text-xs text-slate-600 font-medium">
                                Page {currentPage} of {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages || isLoading}
                                className="px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Dialogs */}
            <MessageDialog
                open={messageDialogOpen}
                onOpenChange={setMessageDialogOpen}
                patient={selectedPatient}
                onSuccess={handleNoteSuccess}
            />

            <DocumentDialog
                open={documentDialogOpen}
                onOpenChange={setDocumentDialogOpen}
                patient={selectedPatient}
            />

            <BookmarkDialog
                open={bookmarkDialogOpen}
                onOpenChange={setBookmarkDialogOpen}
                patient={selectedPatient}
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

            <PatientHistoryModal
                open={historyModalOpen}
                onOpenChange={setHistoryModalOpen}
                images={selectedPatient?.patient_history || []}
                patientName={selectedPatient?.name}
            />
        </div>
    );
};

export default PacsList;
