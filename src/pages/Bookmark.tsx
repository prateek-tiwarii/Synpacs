import { useState, useMemo, useEffect } from "react";

import type { VisibilityState, RowSelectionState } from '@tanstack/react-table';
import { createColumnHelper } from '@tanstack/react-table';
import { Bookmark as BookmarkIcon, ClipboardCheck, Download, FileText, FolderOpen, ImageIcon, MessageSquare, Settings, X } from "lucide-react";
import { DataTable, CellWithCopy } from "@/components/common/DataTable";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import DownloadModal from "@/components/common/DownloadModal";
import PatientHistoryModal from "@/components/dashboard/doctorDashboard/molecules/PatientHistoryModal";
import MessageDialog from "@/components/dashboard/doctorDashboard/molecules/MessageDialog";
import DocumentDialog from "@/components/dashboard/doctorDashboard/molecules/DocumentDialog";
import { apiService } from "@/lib/api";
import toast from "react-hot-toast";
import type { Patient, Note } from "@/components/patient/PacDetailsModal";

type BookmarkedCase = Patient & { notes?: Note[]; patient_history?: any[] };

const COLUMN_VISIBILITY_KEY = 'bookmarks_table_columns';

// Default column visibility for bookmarks table
const DEFAULT_COLUMN_VISIBILITY: VisibilityState = {
    select: true,
    actions: true,
    bookmark_notes: true,
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

const Bookmark = () => {
    const [bookmarks, setBookmarks] = useState<BookmarkedCase[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
    const [downloadModalOpen, setDownloadModalOpen] = useState(false);
    const [selectedCaseForDownload, setSelectedCaseForDownload] = useState<{ id: string; name: string } | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    // Dialog states for actions aligned with PACS List
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [messageDialogOpen, setMessageDialogOpen] = useState(false);
    const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState<BookmarkedCase | null>(null);

    // Initialize column visibility from localStorage
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
        try {
            const stored = localStorage.getItem(COLUMN_VISIBILITY_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                return { ...parsed, actions: true };
            }
        } catch (error) {
            console.error('Failed to load column visibility:', error);
        }
        return DEFAULT_COLUMN_VISIBILITY;
    });

    // Save column visibility to localStorage
    useEffect(() => {
        try {
            localStorage.setItem(COLUMN_VISIBILITY_KEY, JSON.stringify(columnVisibility));
        } catch (error) {
            console.error('Failed to save column visibility:', error);
        }
    }, [columnVisibility]);

    // Fetch bookmarks from API
    const fetchBookmarks = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const response = await apiService.getBookmarkedCases() as any;

            if (response.success && response.data?.cases) {
                // Map API response to match our interface
                const mappedBookmarks: BookmarkedCase[] = response.data.cases.map((caseItem: any) => {
                    // Calculate age from birth_date (format: YYYYMMDD)
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

                    const dob = caseItem.patient?.dob || caseItem.patient?.birth_date || caseItem.patient?.date_of_birth || '';

                    return {
                        _id: caseItem._id,
                        name: caseItem.patient?.name || '-',
                        pac_patinet_id: caseItem.pac_patinet_id || caseItem.patient?.patient_id || '',
                        dob,
                        hospital_id: caseItem.hospital_id || '',
                        hospital_name: caseItem.hospital_name || '',
                        sex: caseItem.patient?.sex || '-',
                        age: calculateAge(dob),
                        case_description: caseItem.description || '-',
                        case: { case_uid: caseItem.case_uid || '', body_part: caseItem.body_part || '' },
                        treatment_type: caseItem.case_type || '-',
                        case_date: caseItem.case_date || '',
                        case_time: caseItem.case_time || '',
                        referring_doctor: caseItem.referring_physician || '-',
                        accession_number: caseItem.accession_number || '-',
                        status: caseItem.status || '',
                        priority: caseItem.priority || '',
                        assigned_to: caseItem.assigned_to || null,
                        modality: caseItem.modality || '-',
                        series_count: caseItem.series_count || 0,
                        instance_count: caseItem.instance_count || 0,
                        pac_images_count: caseItem.instance_count || 0,
                        updatedAt: caseItem.updatedAt || '',
                        attached_report: caseItem.attached_report || null,
                        notes: caseItem.notes || [],
                        patient: caseItem.patient,
                        patient_history: caseItem.patient_history || [],
                    } as Patient;
                });
                setBookmarks(mappedBookmarks);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch bookmarks');
            console.error('Error fetching bookmarks:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchBookmarks();
    }, []);

    // Paginated bookmarks
    const paginatedBookmarks = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        return bookmarks.slice(startIndex, endIndex);
    }, [bookmarks, currentPage, pageSize]);

    const totalPages = Math.ceil(bookmarks.length / pageSize);

    // Remove a bookmark
    const removeBookmark = async (caseId: string) => {
        try {
            await apiService.deleteBookmark(caseId);
            // Update local state immediately
            setBookmarks(prev => prev.filter(b => b._id !== caseId));
            toast.success('Bookmark removed successfully');
        } catch (error) {
            console.error('Failed to remove bookmark:', error);
            toast.error('Failed to remove bookmark');
        }
    };

    // Get selected bookmarks from row selection
    const selectedBookmarks = useMemo(() => {
        return Object.keys(rowSelection)
            .filter(key => rowSelection[key])
            .map(key => bookmarks[parseInt(key)])
            .filter(Boolean);
    }, [rowSelection, bookmarks]);

    // Handle bulk viewer action
    const handleBulkViewStudies = () => {
        selectedBookmarks.forEach((bookmark, index) => {
            if (bookmark?._id) {
                setTimeout(() => {
                    window.open(`/case/${bookmark._id}/viewer`, `viewer_${bookmark._id}`, 'width=1200,height=800,resizable=yes,scrollbars=yes');
                }, index * 100);
            }
        });
    };

    // Handle bulk report action
    const handleBulkViewReports = () => {
        selectedBookmarks.forEach((bookmark, index) => {
            if (bookmark?._id) {
                setTimeout(() => {
                    window.open(`/case/${bookmark._id}/report`, `report_${bookmark._id}`, 'width=1200,height=800,resizable=yes,scrollbars=yes');
                }, index * 100);
            }
        });
    };

    // Clear selection
    const handleClearSelection = () => {
        setRowSelection({});
    };

    const columnHelper = createColumnHelper<BookmarkedCase>();

    const columns = useMemo(() => [
        columnHelper.display({
            id: 'select',
            header: ({ table }: any) => (
                <Checkbox
                    checked={table.getIsAllPageRowsSelected()}
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Select all"
                />
            ),
            cell: ({ row }: any) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Select row"
                    onClick={(e) => e.stopPropagation()}
                />
            ),
            enableHiding: false,
            enableSorting: false,
        }),
        columnHelper.display({
            id: 'actions',
            header: 'Action',
            enableHiding: false,
            enableSorting: false,
            cell: (props: any) => (
                <TooltipProvider>
                    <div className="flex gap-0.5" onClick={(e) => e.stopPropagation()}>
                        {/* Patient History - aligned with PACS List */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    className="p-0.5 hover:bg-blue-50 rounded cursor-pointer"
                                    onClick={() => {
                                        setSelectedPatient(props.row.original);
                                        setHistoryModalOpen(true);
                                    }}
                                >
                                    <ClipboardCheck className="w-3.5 h-3.5 text-blue-500" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Patient History</p>
                            </TooltipContent>
                        </Tooltip>

                        {/* Attached Documents */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    className="p-0.5 hover:bg-yellow-50 rounded cursor-pointer"
                                    onClick={() => {
                                        setSelectedPatient(props.row.original);
                                        setDocumentDialogOpen(true);
                                    }}
                                >
                                    <FolderOpen className="w-3.5 h-3.5 text-yellow-500" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Attached Documents</p>
                            </TooltipContent>
                        </Tooltip>

                        {/* Messages with notes indicator */}
                        <HoverCard openDelay={200} closeDelay={100}>
                            <HoverCardTrigger asChild>
                                <button
                                    className="p-0.5 hover:bg-blue-50 rounded cursor-pointer relative"
                                    onClick={() => {
                                        setSelectedPatient(props.row.original);
                                        setMessageDialogOpen(true);
                                    }}
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
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                                            note.flag_type === 'urgent' ? 'bg-red-100 text-red-700' :
                                                            note.flag_type === 'routine' ? 'bg-gray-100 text-gray-700' :
                                                            note.flag_type === 'info' ? 'bg-blue-100 text-blue-700' :
                                                            note.flag_type === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                                                            note.flag_type === 'error' ? 'bg-red-100 text-red-700' :
                                                            'bg-gray-100 text-gray-700'
                                                        }`}>
                                                            {(note.flag_type || 'routine').toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-gray-700 mb-2 leading-relaxed">{note.note}</p>
                                                    <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
                                                        <span className="font-medium">
                                                            {note.created_by?.full_name || 'Unknown User'}
                                                        </span>
                                                        <span>
                                                            {new Date(note.createdAt || note.created_at || Date.now()).toLocaleDateString('en-US', {
                                                                month: 'short',
                                                                day: 'numeric',
                                                                year: 'numeric'
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

                        {/* Download */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    className="p-0.5 hover:bg-yellow-50 rounded cursor-pointer"
                                    onClick={() => {
                                        setSelectedCaseForDownload({
                                            id: props.row.original._id,
                                            name: props.row.original.name || 'Bookmarked Study'
                                        });
                                        setDownloadModalOpen(true);
                                    }}
                                >
                                    <Download className="w-3.5 h-3.5 text-yellow-500" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Download</p>
                            </TooltipContent>
                        </Tooltip>

                        {/* View Images */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    className="p-0.5 hover:bg-blue-50 rounded cursor-pointer"
                                    onClick={() => {
                                        window.open(`${window.location.origin}/case/${props.row.original._id}/viewer`, `viewer_${props.row.original._id}`, 'width=1200,height=800,resizable=yes,scrollbars=yes');
                                    }}
                                >
                                    <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>View Images</p>
                            </TooltipContent>
                        </Tooltip>

                        {/* View Report */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    className="p-0.5 hover:bg-blue-50 rounded cursor-pointer"
                                    onClick={() => {
                                        window.open(`${window.location.origin}/case/${props.row.original._id}/report`, `report_${props.row.original._id}`, 'width=1200,height=800,resizable=yes,scrollbars=yes');
                                    }}
                                >
                                    <FileText className="w-3.5 h-3.5 text-blue-500" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>View Report</p>
                            </TooltipContent>
                        </Tooltip>

                        {/* Remove Bookmark */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    className="p-0.5 hover:bg-red-50 rounded cursor-pointer"
                                    onClick={() => removeBookmark(props.row.original._id)}
                                >
                                    <BookmarkIcon className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Remove Bookmark</p>
                            </TooltipContent>
                        </Tooltip>
                    </div>
                </TooltipProvider>
            ),
        }),
        columnHelper.display({
            id: 'bookmark_notes',
            header: 'Note',
            enableSorting: false,
            cell: (props: any) => {
                const notes = props.row.original.notes;
                if (!notes || notes.length === 0) {
                    return <span className="text-gray-400 text-xs">-</span>;
                }

                return (
                    <HoverCard openDelay={200} closeDelay={100}>
                        <HoverCardTrigger asChild>
                            <button className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs">
                                <MessageSquare className="w-3 h-3" />
                                {notes.length}
                            </button>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-80 max-h-60 overflow-y-auto" align="start">
                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold text-gray-900">Notes ({notes.length})</h4>
                                <div className="space-y-2">
                                    {notes.map((note: Note) => (
                                        <div key={note._id} className="p-2.5 bg-white rounded-md border border-gray-200 shadow-sm">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                                        note.flag_type === 'urgent' ? 'bg-red-100 text-red-700' :
                                                        note.flag_type === 'routine' ? 'bg-gray-100 text-gray-700' :
                                                        note.flag_type === 'info' ? 'bg-blue-100 text-blue-700' :
                                                        note.flag_type === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                                                        note.flag_type === 'error' ? 'bg-red-100 text-red-700' :
                                                        'bg-gray-100 text-gray-700'
                                                    }`}>
                                                        {(note.flag_type || 'routine').toUpperCase()}
                                                    </span>
                                                </div>
                                            </div>
                                            <p className="text-sm text-gray-700 mb-2 leading-relaxed">{note.note || '-'}</p>
                                            <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
                                                <span className="font-medium">
                                                    {note.created_by?.full_name || 
                                                     (typeof note.user_id === 'object' && note.user_id?.full_name) || 
                                                     'Unknown User'}
                                                </span>
                                                <span>
                                                    {(note.createdAt || note.created_at) ? 
                                                        new Date(note.createdAt || note.created_at).toLocaleDateString('en-US', {
                                                            month: 'short',
                                                            day: 'numeric',
                                                            year: 'numeric'
                                                        }) : 'No Date'
                                                    }
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </HoverCardContent>
                    </HoverCard>
                );
            },
        }),
        columnHelper.accessor('name', {
            header: () => (
                <div className="flex items-center gap-1">
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
                    <span>Patient Name</span>
                </div>
            ),
            enableSorting: true,
            cell: (info: any) => {
                const name = info.getValue() || '-';
                const caseId = info.row.original._id;
                return (
                    <div className="flex items-center gap-2">
                        <CellWithCopy content={name} cellId={`${info.row.id}-name`} />
                        <button
                            onClick={() => {
                                window.open(`${window.location.origin}/case/${caseId}/viewer`, `viewer_${caseId}`, 'width=1200,height=800,resizable=yes,scrollbars=yes');
                            }}
                            className="text-blue-600 hover:text-blue-800 text-[10px] font-medium shrink-0"
                            title="Open Viewer"
                        >
                            [View]
                        </button>
                    </div>
                );
            },
        }),
        columnHelper.display({
            id: 'case_id',
            header: 'Case ID',
            enableSorting: false,
            cell: (props: any) => {
                const patientId = props.row.original.pac_patinet_id || props.row.original.patient?.patient_id || '-';
                return <CellWithCopy content={patientId} cellId={`${props.row.id}-case-id`} />;
            },
        }),
        columnHelper.display({
            id: 'age',
            header: 'Age',
            enableSorting: false,
            cell: (props: any) => {
                const age = props.row.original.age || props.row.original.patient?.age || '-';
                return <CellWithCopy content={String(age)} cellId={`${props.row.id}-age`} />;
            },
        }),
        columnHelper.display({
            id: 'sex',
            header: 'Sex',
            enableSorting: false,
            cell: (props: any) => {
                const sex = props.row.original.sex || props.row.original.patient?.sex || '-';
                return <CellWithCopy content={sex} cellId={`${props.row.id}-sex`} />;
            },
        }),
        columnHelper.accessor(
            (row: any) => {
                const dateStr = row.case_date || '';
                const timeStr = row.case_time || '';
                return dateStr + (timeStr.split('.')[0] || '000000').padEnd(6, '0');
            },
            {
                id: 'study_date_time',
                header: 'Study Date & Time',
                enableSorting: true,
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
        }
        ),
        columnHelper.accessor(
            (row: any) => {
                const updatedAt = row.updatedAt;
                return updatedAt ? new Date(updatedAt).getTime() : Number.MAX_SAFE_INTEGER;
            },
            {
                id: 'history_date_time',
                header: 'History Date & Time',
                enableSorting: true,
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
        }
        ),
        columnHelper.accessor(
            (row: any) => {
                const createdAt = row.attached_report?.created_at;
                return createdAt ? new Date(createdAt).getTime() : Number.MAX_SAFE_INTEGER;
            },
            {
                id: 'reporting_date_time',
                header: 'Reporting Date & Time',
                enableSorting: true,
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
        }
        ),
        columnHelper.accessor('accession_number', {
            header: 'Accession Number',
            enableSorting: false,
            cell: (info: any) => <CellWithCopy content={info.getValue() || '-'} cellId={`${info.row.id}-accession`} />,
        }),
        columnHelper.display({
            id: 'center',
            header: 'Center',
            enableSorting: false,
            cell: (props: any) => {
                const centerName = props.row.original.hospital_name || '-';
                return <CellWithCopy content={centerName} cellId={`${props.row.id}-center`} />;
            },
        }),
        columnHelper.display({
            id: 'referring_doctor',
            header: 'Referring Doctor',
            enableSorting: false,
            cell: (props: any) => {
                const referringDoctor = props.row.original.referring_doctor || '-';
                return <CellWithCopy content={referringDoctor} cellId={`${props.row.id}-ref-doc`} />;
            },
        }),
        columnHelper.display({
            id: 'image_count',
            header: 'Image Count',
            enableSorting: false,
            cell: (props: any) => {
                const instanceCount = props.row.original.instance_count || 0;
                return <CellWithCopy content={String(instanceCount)} cellId={`${props.row.id}-img-count`} />;
            },
        }),
        columnHelper.accessor('case_description', {
            header: 'Study Description',
            enableSorting: false,
            cell: (info: any) => <CellWithCopy content={info.getValue() || '-'} cellId={`${info.row.id}-desc`} />,
        }),
        columnHelper.accessor('modality', {
            header: 'Modality',
            enableSorting: false,
            cell: (info: any) => <CellWithCopy content={info.getValue() || '-'} cellId={`${info.row.id}-modality`} />,
        }),
        columnHelper.display({
            id: 'case_type',
            header: 'Case Type',
            enableSorting: false,
            cell: (props: any) => {
                const caseType = props.row.original.treatment_type || '-';
                return <CellWithCopy content={caseType} cellId={`${props.row.id}-case-type`} />;
            },
        }),
        columnHelper.display({
            id: 'reported',
            header: 'Reported',
            enableSorting: false,
            cell: (props: any) => {
                const attachedReport = props.row.original.attached_report;
                if (attachedReport) {
                    return (
                        <a
                            href={`/case/${props.row.original._id}/report`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 hover:bg-green-200 transition-colors"
                            target="_blank"
                            rel="noreferrer"
                        >
                            {attachedReport.is_draft ? 'Draft' : 'Available'}
                        </a>
                    );
                }
                return <span className="text-gray-400">-</span>;
            },
        }),
    ], []);

    return (
        <div className="p-2">
            <div className="bg-white p-2 rounded-md space-y-2">
                {selectedBookmarks.length > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-medium text-blue-900">
                                    {selectedBookmarks.length} bookmark{selectedBookmarks.length > 1 ? 's' : ''} selected
                                </span>
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        onClick={handleBulkViewStudies}
                                        className="h-8 text-xs bg-blue-600 hover:bg-blue-700"
                                    >
                                        <ImageIcon className="w-3.5 h-3.5 mr-1.5" />
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
                    data={paginatedBookmarks}
                    columns={columns}
                    isLoading={isLoading}
                    error={error}
                    emptyMessage="No bookmarks saved yet. Save cases from the patient list to see them here."
                    loadingMessage="Loading bookmarks..."
                    columnVisibility={columnVisibility}
                    onColumnVisibilityChange={setColumnVisibility}
                    showColumnToggle={true}
                    tableTitle="Bookmarks"
                    showEmptyTable={true}
                    enableRowSelection={true}
                    rowSelection={rowSelection}
                    onRowSelectionChange={setRowSelection}
                    isColumnModalOpen={isColumnModalOpen}
                    onColumnModalOpenChange={setIsColumnModalOpen}
                />
                {/* Pagination Footer */}
                {!isLoading && !error && bookmarks.length > 0 && (
                    <div className="flex items-center justify-between px-4 py-3 bg-linear-to-r from-slate-50 to-white border-t border-slate-100 mt-2">
                        <div className="flex items-center gap-4">
                            <span className="text-xs text-slate-600">
                                Showing <span className="font-semibold">{Math.min((currentPage - 1) * pageSize + 1, bookmarks.length)}</span> to{' '}
                                <span className="font-semibold">{Math.min(currentPage * pageSize, bookmarks.length)}</span> of{' '}
                                <span className="font-semibold">{bookmarks.length}</span> bookmarks
                            </span>
                            <select
                                value={pageSize}
                                onChange={(e) => {
                                    setPageSize(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                                className="text-xs border border-slate-200 rounded px-2 py-1"
                            >
                                <option value={10}>10 per page</option>
                                <option value={20}>20 per page</option>
                                <option value={50}>50 per page</option>
                                <option value={100}>100 per page</option>
                            </select>
                        </div>
                        {totalPages > 1 && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Previous
                                </button>
                                <span className="text-xs text-slate-600 font-medium">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                    className="px-3 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </div>
                )}
                <DownloadModal
                    open={downloadModalOpen}
                    onClose={() => {
                        setDownloadModalOpen(false);
                        setSelectedCaseForDownload(null);
                    }}
                    caseId={selectedCaseForDownload?.id || ''}
                    caseName={selectedCaseForDownload?.name}
                />

                {/* Patient History Modal - aligned with PACS List */}
                <PatientHistoryModal
                    open={historyModalOpen}
                    onOpenChange={setHistoryModalOpen}
                    images={selectedPatient?.patient_history || []}
                    patientName={selectedPatient?.name}
                />

                {/* Message Dialog - aligned with PACS List */}
                <MessageDialog
                    open={messageDialogOpen}
                    onOpenChange={setMessageDialogOpen}
                    patient={selectedPatient as Patient | null}
                    onSuccess={() => {
                        toast.success('Note added successfully');
                        fetchBookmarks();
                    }}
                />

                {/* Document Dialog - aligned with PACS List */}
                <DocumentDialog
                    open={documentDialogOpen}
                    onOpenChange={setDocumentDialogOpen}
                    patient={selectedPatient as Patient | null}
                />
            </div>
        </div>
    );
};

export default Bookmark;