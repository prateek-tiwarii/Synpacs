import { useState, useMemo, useEffect } from "react";
import type { VisibilityState, RowSelectionState, ColumnSizingState } from '@tanstack/react-table';
import { createColumnHelper } from '@tanstack/react-table';
import { Bookmark as BookmarkIcon, ChevronDown, ChevronUp, ClipboardCheck, Download, FileText, FolderOpen, ImageIcon, MessageSquare, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { DataTable, CellWithCopy } from "@/components/common/DataTable";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import DownloadModal from "@/components/common/DownloadModal";
import PatientHistoryModal from "@/components/dashboard/doctorDashboard/molecules/PatientHistoryModal";
import MessageDialog from "@/components/dashboard/doctorDashboard/molecules/MessageDialog";
import DocumentDialog from "@/components/dashboard/doctorDashboard/molecules/DocumentDialog";
import { apiService } from "@/lib/api";
import toast from "react-hot-toast";
import type { Patient, Note } from "@/components/patient/PacDetailsModal";

type BookmarkedCase = Patient & {
    notes?: Note[];
    bookmark_notes?: Note[];
    patient_history?: any[];
};

const COLUMN_VISIBILITY_KEY = 'research_bookmarks_columns';
const COLUMN_SIZING_KEY = 'research_bookmarks_column_sizing';

const DEFAULT_COLUMN_VISIBILITY: VisibilityState = {
    select: true,
    actions: true,
    bookmark_notes: true,
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
};

const parseDicomDateTime = (dateStr?: string, timeStr?: string): number | null => {
    if (!dateStr || dateStr.length !== 8) return null;

    const year = Number(dateStr.substring(0, 4));
    const month = Number(dateStr.substring(4, 6));
    const day = Number(dateStr.substring(6, 8));
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;

    const safeTime = (timeStr || '').split('.')[0].padEnd(6, '0');
    const hour = Number(safeTime.substring(0, 2) || '0');
    const minute = Number(safeTime.substring(2, 4) || '0');
    const second = Number(safeTime.substring(4, 6) || '0');

    const timestamp = new Date(year, month - 1, day, hour, minute, second).getTime();
    return Number.isNaN(timestamp) ? null : timestamp;
};

const parseDateTimeValue = (value?: string | null): number | null => {
    if (!value) return null;
    const timestamp = new Date(value).getTime();
    return Number.isNaN(timestamp) ? null : timestamp;
};

const sortNullableTimestampValues = (a: number | null, b: number | null): number => {
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return a - b;
};

interface BookmarksSectionProps {
    onExportBookmarks: (selectedCases: BookmarkedCase[]) => void;
}

export const BookmarksSection: React.FC<BookmarksSectionProps> = ({ onExportBookmarks }) => {
    const [bookmarks, setBookmarks] = useState<BookmarkedCase[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isCollapsed, setIsCollapsed] = useState(true);
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

    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
        try {
            const stored = localStorage.getItem(COLUMN_VISIBILITY_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                return { ...parsed, actions: true, select: true };
            }
        } catch (error) {
            console.error('Failed to load column visibility:', error);
        }
        return DEFAULT_COLUMN_VISIBILITY;
    });

    useEffect(() => {
        try {
            localStorage.setItem(COLUMN_VISIBILITY_KEY, JSON.stringify(columnVisibility));
        } catch (error) {
            console.error('Failed to save column visibility:', error);
        }
    }, [columnVisibility]);

    const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() => {
        try {
            const stored = localStorage.getItem(COLUMN_SIZING_KEY);
            if (stored) return JSON.parse(stored);
        } catch (error) {
            console.error('Failed to load column sizing:', error);
        }
        return {};
    });

    useEffect(() => {
        try {
            localStorage.setItem(COLUMN_SIZING_KEY, JSON.stringify(columnSizing));
        } catch (error) {
            console.error('Failed to save column sizing:', error);
        }
    }, [columnSizing]);

    useEffect(() => {
        if (!isCollapsed) {
            fetchBookmarks();
        }
    }, [isCollapsed]);

    // Paginated bookmarks
    const paginatedBookmarks = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        return bookmarks.slice(startIndex, endIndex);
    }, [bookmarks, currentPage, pageSize]);

    const totalPages = Math.ceil(bookmarks.length / pageSize);

    const fetchBookmarks = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const response = await apiService.getBookmarkedCases() as any;

            if (response.success && response.data?.cases) {
                const mappedBookmarks: BookmarkedCase[] = response.data.cases.map((caseItem: any) => {
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
                        age: calculateAge(dob),
                        sex: caseItem.patient?.sex || '-',
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
                        bookmark_notes: caseItem.bookmark_notes || [],
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

    const handleRemoveBookmark = async (caseId: string) => {
        try {
            await apiService.deleteBookmark(caseId);
            toast.success('Bookmark removed');
            fetchBookmarks();
        } catch (err) {
            toast.error('Failed to remove bookmark');
            console.error('Error removing bookmark:', err);
        }
    };

    const handleDownloadClick = (caseId: string, name: string) => {
        setSelectedCaseForDownload({ id: caseId, name });
        setDownloadModalOpen(true);
    };

    const handleExportSelected = () => {
        const selectedRows = Object.keys(rowSelection).filter(key => rowSelection[key]);
        const selectedCases = selectedRows.map(index => bookmarks[parseInt(index)]).filter(Boolean);
        
        if (selectedCases.length === 0) {
            toast.error('Please select at least one case to export');
            return;
        }
        
        onExportBookmarks(selectedCases);
    };

    const columnHelper = createColumnHelper<BookmarkedCase>();

    const columns = useMemo(() => [
        {
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
            size: 40,
            minSize: 32,
        },
        columnHelper.display({
            id: 'actions',
            header: () => (
                <div className="flex items-center gap-1">
                    <span>Actions</span>
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
            enableSorting: false,
            size: 140,
            minSize: 90,
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
                            <TooltipContent>Patient History</TooltipContent>
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
                            <TooltipContent>Attached Documents</TooltipContent>
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
                            )}
                        </HoverCard>

                        {/* Download */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    className="p-0.5 hover:bg-yellow-50 rounded cursor-pointer"
                                    onClick={() => handleDownloadClick(props.row.original._id, props.row.original.name)}
                                >
                                    <Download className="w-3.5 h-3.5 text-yellow-500" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>Download</TooltipContent>
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
                            <TooltipContent>View Images</TooltipContent>
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
                            <TooltipContent>View Report</TooltipContent>
                        </Tooltip>

                        {/* Remove Bookmark */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    className="p-0.5 hover:bg-red-50 rounded cursor-pointer"
                                    onClick={() => handleRemoveBookmark(props.row.original._id)}
                                >
                                    <BookmarkIcon className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>Remove Bookmark</TooltipContent>
                        </Tooltip>
                    </div>
                </TooltipProvider>
            ),
        }),
        columnHelper.display({
            id: 'bookmark_notes',
            header: 'Bookmark Note',
            enableSorting: false,
            cell: (props: any) => {
                const bookmarkNotes = (props.row.original as any).bookmark_notes;
                if (!bookmarkNotes || bookmarkNotes.length === 0) {
                    return <span className="text-gray-400 text-xs">-</span>;
                }

                return (
                    <HoverCard>
                        <HoverCardTrigger asChild>
                            <button className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs">
                                <MessageSquare className="w-3 h-3" />
                                {bookmarkNotes.length}
                            </button>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-80">
                            <div className="space-y-2">
                                {bookmarkNotes.map((note: any) => (
                                    <div key={note._id} className="border-b last:border-0 pb-2 last:pb-0">
                                        <p className="text-xs text-gray-700">{note.note || '-'}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                                note.flag_type === 'bookmark_note' ? 'bg-indigo-100 text-indigo-700' :
                                                note.flag_type === 'urgent' ? 'bg-red-100 text-red-700' :
                                                note.flag_type === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                                                note.flag_type === 'info' ? 'bg-blue-100 text-blue-700' :
                                                'bg-gray-100 text-gray-700'
                                            }`}>
                                                {note.flag_type || 'routine'}
                                            </span>
                                            {(note.created_by?.full_name || (typeof note.user_id === 'object' && note.user_id?.full_name)) && (
                                                <span className="text-[10px] text-gray-500">
                                                    by {note.created_by?.full_name || note.user_id?.full_name}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </HoverCardContent>
                    </HoverCard>
                );
            },
        }),
        columnHelper.accessor('name', {
            id: 'name',
            header: 'Patient Name',
            enableSorting: true,
            size: 180,
            minSize: 100,
            cell: (info) => {
                const name = info.getValue();
                const caseId = info.row.original._id;
                return (
                    <button
                        onClick={() => {
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
            enableSorting: false,
            cell: (props) => {
                const patientId = (props.row.original as any).pac_patinet_id || (props.row.original as any).patient?.patient_id || '-';
                return <CellWithCopy content={patientId} cellId={`${props.row.id}-case-id`} />;
            },
        }),
        columnHelper.display({
            id: 'age',
            header: 'Age',
            enableSorting: false,
            cell: (props) => {
                const age = props.row.original.age || '-';
                return <CellWithCopy content={String(age)} cellId={`${props.row.id}-age`} />;
            },
        }),
        columnHelper.display({
            id: 'sex',
            header: 'Sex',
            enableSorting: false,
            cell: (props) => {
                const sex = props.row.original.sex || '-';
                return <CellWithCopy content={sex} cellId={`${props.row.id}-sex`} />;
            },
        }),
        columnHelper.accessor(
            (row: any) => {
                const dateStr = row.case_date || '';
                const timeStr = row.case_time || '';
                // Return sortable value: combine date and time
                return dateStr + (timeStr.split('.')[0] || '000000').padEnd(6, '0');
            },
            {
                id: 'study_date_time',
                header: 'Study Date & Time',
                enableSorting: true,
                cell: (props) => {
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
                cell: (props) => {
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
                const createdAt = (row as any).attached_report?.created_at;
                return createdAt ? new Date(createdAt).getTime() : Number.MAX_SAFE_INTEGER;
            },
            {
                id: 'reporting_date_time',
                header: 'Reporting Date & Time',
                enableSorting: true,
                cell: (props) => {
                const attachedReport = (props.row.original as any).attached_report;
                const reportingDateTime = attachedReport?.created_at || (props.row.original as any).reporting_date_time;
                if (!reportingDateTime) return <span className="text-gray-400">-</span>;

                const date = new Date(reportingDateTime);
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
            cell: (info) => <CellWithCopy content={info.getValue() || '-'} cellId={`${info.row.id}-accession`} />,
        }),
        columnHelper.display({
            id: 'center',
            header: 'Center',
            enableSorting: false,
            cell: (props) => {
                const centerName = (props.row.original as any).hospital_name || '-';
                return <CellWithCopy content={centerName} cellId={`${props.row.id}-center`} />;
            },
        }),
        columnHelper.display({
            id: 'referring_doctor',
            header: 'Referring Doctor',
            enableSorting: false,
            cell: (props) => {
                const referringDoctor = (props.row.original as any).referring_doctor || '-';
                return <CellWithCopy content={referringDoctor} cellId={`${props.row.id}-ref-doc`} />;
            },
        }),
        columnHelper.display({
            id: 'image_count',
            header: 'Image Count',
            enableSorting: false,
            cell: (props) => {
                const instanceCount = props.row.original.instance_count || 0;
                return <CellWithCopy content={String(instanceCount)} cellId={`${props.row.id}-img-count`} />;
            },
        }),
        columnHelper.accessor('case_description', {
            header: 'Study Description',
            enableSorting: false,
            cell: (info) => <CellWithCopy content={info.getValue() || '-'} cellId={`${info.row.id}-desc`} />,
        }),
        columnHelper.accessor('modality', {
            header: 'Modality',
            enableSorting: false,
            cell: (info) => <CellWithCopy content={info.getValue() || '-'} cellId={`${info.row.id}-modality`} />,
        }),
        columnHelper.display({
            id: 'case_type',
            header: 'Case Type',
            enableSorting: false,
            cell: (props: any) => {
                const caseType = (props.row.original as any).treatment_type || '-';
                return <CellWithCopy content={caseType} cellId={`${props.row.id}-case-type`} />;
            },
        }),
        columnHelper.display({
            id: 'reported',
            header: 'Reported',
            enableSorting: false,
            cell: (props) => {
                const attachedReport = (props.row.original as any).attached_report;
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
    ], []);

    return (
        <>
            <Card className="border-slate-200 shadow-sm">
                <CardHeader className="border-b border-slate-200 bg-slate-50 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <BookmarkIcon className="w-4 h-4 text-slate-600" />
                            <h3 className="text-sm font-semibold text-slate-800">Bookmarked Cases</h3>
                            {!isCollapsed && (
                                <span className="text-xs text-slate-500">({bookmarks.length})</span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {!isCollapsed && bookmarks.length > 0 && (
                                <Button
                                    onClick={handleExportSelected}
                                    size="sm"
                                    variant="outline"
                                    className="gap-1.5 h-7 text-xs"
                                    disabled={Object.keys(rowSelection).filter(k => rowSelection[k]).length === 0}
                                >
                                    <Download size={12} />
                                    Export
                                </Button>
                            )}
                            <button
                                onClick={() => setIsCollapsed(!isCollapsed)}
                                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                            >
                                {isCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                                {isCollapsed ? 'Show' : 'Hide'}
                            </button>
                        </div>
                    </div>
                </CardHeader>

                {!isCollapsed && (
                    <CardContent className="pt-4">
                        {isLoading ? (
                            <div className="py-8 text-center text-muted-foreground">
                                Loading bookmarks...
                            </div>
                        ) : error ? (
                            <div className="py-8 text-center text-red-500">
                                Error: {error}
                            </div>
                        ) : bookmarks.length === 0 ? (
                            <div className="py-8 text-center text-muted-foreground">
                                No bookmarked cases found
                            </div>
                        ) : (
                            <>
                                <DataTable
                                    data={paginatedBookmarks}
                                    columns={columns}
                                    isLoading={isLoading}
                                    error={error}
                                    rowSelection={rowSelection}
                                    onRowSelectionChange={setRowSelection}
                                    enableRowSelection={true}
                                    emptyMessage="No bookmarked cases found"
                                    loadingMessage="Loading bookmarks..."
                                    showBorder={true}
                                    showColumnToggle={true}
                                    columnVisibility={columnVisibility}
                                    onColumnVisibilityChange={setColumnVisibility}
                                    isColumnModalOpen={isColumnModalOpen}
                                    onColumnModalOpenChange={setIsColumnModalOpen}
                                />
                                {/* Pagination Footer */}
                                {bookmarks.length > 0 && (
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
                            </>
                        )}
                    </CardContent>
                )}
            </Card>

            {downloadModalOpen && selectedCaseForDownload && (
                <DownloadModal
                    caseId={selectedCaseForDownload.id}
                    caseName={selectedCaseForDownload.name}
                    open={downloadModalOpen}
                    onClose={() => {
                        setDownloadModalOpen(false);
                        setSelectedCaseForDownload(null);
                    }}
                />
            )}

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
        </>
    );
};
