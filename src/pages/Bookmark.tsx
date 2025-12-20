import { useState, useMemo, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { VisibilityState } from '@tanstack/react-table';
import { createColumnHelper } from '@tanstack/react-table';
import { Bookmark as BookmarkIcon, ClipboardCheck, Download, FolderOpen, ImageIcon, MessageSquare } from "lucide-react";
import { DataTable, CellWithCopy } from "@/components/common/DataTable";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { apiService } from "@/lib/api";
import toast from "react-hot-toast";

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
    study_date: string;
    study_time: string;
    case_type: string;
    priority: string;
    status: string;
    series_count: number;
    instance_count: number;
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
    study_date_time: true,
    case_type: true,
    priority: true,
    status: true,
};

const Bookmark = () => {
    const navigate = useNavigate();
    const [bookmarks, setBookmarks] = useState<BookmarkedCase[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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
                        study_date: caseItem.study_date || '',
                        study_time: caseItem.study_time || '',
                        case_type: caseItem.case_type || '-',
                        priority: caseItem.priority || '-',
                        status: caseItem.status || '-',
                        series_count: caseItem.series_count || 0,
                        instance_count: caseItem.instance_count || 0,
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

    const columnHelper = createColumnHelper<BookmarkedCase>();

    const columns = useMemo(() => [
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

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button className="p-1 hover:bg-blue-50 rounded cursor-pointer">
                                    <MessageSquare className="w-4 h-4 text-blue-500" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Message</p>
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button className="p-1 hover:bg-yellow-50 rounded cursor-pointer">
                                    <Download className="w-4 h-4 text-yellow-500" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Download</p>
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Link to={`/viewer/${props.row.original._id}`} className="p-1 hover:bg-blue-50 rounded cursor-pointer">
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
            cell: (info) => <CellWithCopy content={info.getValue() || '-'} cellId={`${info.row.id}-name`} />,
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
                const dateStr = props.row.original.study_date || '';
                let formattedDate = '-';
                if (dateStr && dateStr.length === 8) {
                    const year = dateStr.substring(0, 4);
                    const month = dateStr.substring(4, 6);
                    const day = dateStr.substring(6, 8);
                    formattedDate = `${year}-${month}-${day}`;
                }

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

    return (
        <div className="p-2">
            <div className="bg-white p-2 rounded-md">
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
                />
            </div>
        </div>
    );
};

export default Bookmark;