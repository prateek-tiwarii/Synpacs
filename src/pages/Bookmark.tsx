import { useState, useMemo, useEffect } from "react";

import type { VisibilityState, RowSelectionState } from '@tanstack/react-table';
import { createColumnHelper } from '@tanstack/react-table';
import { Bookmark as BookmarkIcon, ClipboardCheck, Download, FolderOpen, ImageIcon, MessageSquare, Eye, X } from "lucide-react";
import { DataTable, CellWithCopy } from "@/components/common/DataTable";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import DownloadModal from "@/components/common/DownloadModal";
import { apiService } from "@/lib/api";
import toast from "react-hot-toast";

// Note interface
interface Note {
    _id: string;
    note: string;
    flag_type: 'urgent' | 'routine' | 'info' | 'warning' | 'error';
    created_by?: {
        _id: string;
        full_name: string;
        email: string;
    };
    createdAt: string;
    updatedAt: string;
    created_at?: string;
    updated_at?: string;
}

// Bookmark interface matching the API response structure
interface BookmarkedCase {
    _id: string;
    name: string;
    sex: string;
    age: string;
    body_part: string;
    description: string;
    modality: string;
    accession_number: string;
    case_date: string;
    case_time: string;
    case_type: string;
    priority: string;
    status: string;
    series_count: number;
    instance_count: number;
    notes: Note[];
}

const COLUMN_VISIBILITY_KEY = 'bookmarks_table_columns';

// Default column visibility for bookmarks table
const DEFAULT_COLUMN_VISIBILITY: VisibilityState = {
    actions: true,
    name: true,
    age_sex: true,
    body_part: true,
    description: true,
    modality: true,
    accession_number: true,
    case_date_time: true,
    case_type: true,
    priority: true,
    status: true,
};

const Bookmark = () => {
    const [bookmarks, setBookmarks] = useState<BookmarkedCase[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const [downloadModalOpen, setDownloadModalOpen] = useState(false);
    const [selectedCaseForDownload, setSelectedCaseForDownload] = useState<{ id: string; name: string } | null>(null);

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

                    return {
                        _id: caseItem._id,
                        name: caseItem.patient?.name || '-',
                        sex: caseItem.patient?.sex || '-',
                        age: calculateAge(caseItem.patient?.birth_date || ''),
                        body_part: caseItem.body_part || '-',
                        description: caseItem.description || '-',
                        modality: caseItem.modality || '-',
                        accession_number: caseItem.accession_number || '-',
                        case_date: caseItem.case_date || '',
                        case_time: caseItem.case_time || '',
                        case_type: caseItem.case_type || '-',
                        priority: caseItem.priority || '-',
                        status: caseItem.status || '-',
                        series_count: caseItem.series_count || 0,
                        instance_count: caseItem.instance_count || 0,
                        notes: caseItem.notes || [],
                    };
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
            enableHiding: false,
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
                                <button className="p-1 hover:bg-yellow-50 rounded cursor-pointer">
                                    <FolderOpen className="w-4 h-4 text-yellow-500" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Attached Documents</p>
                            </TooltipContent>
                        </Tooltip>

                        <HoverCard openDelay={200} closeDelay={100}>
                            <HoverCardTrigger asChild>
                                <button className="p-1 hover:bg-blue-50 rounded cursor-pointer relative">
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
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                                                note.flag_type === 'urgent' ? 'bg-red-100 text-red-700' :
                                                                note.flag_type === 'routine' ? 'bg-gray-100 text-gray-700' :
                                                                note.flag_type === 'info' ? 'bg-blue-100 text-blue-700' :
                                                                note.flag_type === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                                                                note.flag_type === 'error' ? 'bg-red-100 text-red-700' :
                                                                'bg-gray-100 text-gray-700'
                                                            }`}>
                                                                {note.flag_type === 'urgent' ? 'URGENT' :
                                                                note.flag_type === 'routine' ? 'ROUTINE' :
                                                                (note.flag_type || 'ROUTINE').toUpperCase()}
                                                            </span>
                                                        </div>
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
                                                            })} at {new Date(note.createdAt || note.created_at || Date.now()).toLocaleTimeString('en-US', {
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
                                    className="p-1 hover:bg-yellow-50 rounded cursor-pointer"
                                    onClick={() => {
                                        setSelectedCaseForDownload({
                                            id: props.row.original._id,
                                            name: props.row.original.name || 'Bookmarked Study'
                                        });
                                        setDownloadModalOpen(true);
                                    }}
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
                                    className="p-1 hover:bg-red-50 rounded cursor-pointer"
                                    onClick={() => removeBookmark(props.row.original._id)}
                                >
                                    <BookmarkIcon className="w-4 h-4 text-yellow-500 fill-yellow-500" />
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
        columnHelper.accessor('name', {
            header: 'Patient Name',
            cell: (info) => {
                const name = info.getValue() || '-';
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
            id: 'age_sex',
            header: 'Age/Sex',
            cell: (props) => {
                const age = props.row.original.age || '-';
                const sex = props.row.original.sex || '-';
                return <CellWithCopy content={`${age} / ${sex}`} cellId={`${props.row.id}-age-sex`} />;
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
        columnHelper.accessor('accession_number', {
            header: 'Accession Number',
            cell: (info) => <CellWithCopy content={info.getValue() || '-'} cellId={`${info.row.id}-acc`} />,
        }),
        columnHelper.display({
            id: 'case_date_time',
            header: 'case Date/Time',
            cell: (props) => {
                const dateStr = props.row.original.case_date || '';
                let formattedDate = '-';
                if (dateStr && dateStr.length === 8) {
                    const year = dateStr.substring(0, 4);
                    const month = dateStr.substring(4, 6);
                    const day = dateStr.substring(6, 8);
                    formattedDate = `${year}-${month}-${day}`;
                }

                const timeStr = props.row.original.case_time || '';
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
        columnHelper.accessor('series_count', {
            header: 'Series Count',
            cell: (info) => <CellWithCopy content={info.getValue()?.toString() || '0'} cellId={`${info.row.id}-series`} />,
        }),
        columnHelper.accessor('instance_count', {
            header: 'Instance Count',
            cell: (info) => <CellWithCopy content={info.getValue()?.toString() || '0'} cellId={`${info.row.id}-instance`} />,
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
                                        <Eye className="w-3.5 h-3.5 mr-1.5" />
                                        Open All Studies
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={handleBulkViewReports}
                                        className="h-8 text-xs border-blue-300 text-blue-700 hover:bg-blue-100"
                                    >
                                        <ImageIcon className="w-3.5 h-3.5 mr-1.5" />
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
                    data={bookmarks}
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
            </div>
        </div>
    );
};

export default Bookmark;