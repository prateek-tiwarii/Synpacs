import { useState, useMemo, useEffect } from "react";
import type { VisibilityState, RowSelectionState } from '@tanstack/react-table';
import { createColumnHelper } from '@tanstack/react-table';
import { Bookmark as BookmarkIcon, ChevronDown, ChevronUp, Download, MessageSquare, Eye, X } from "lucide-react";
import { Link } from "react-router-dom";
import { DataTable, CellWithCopy } from "@/components/common/DataTable";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import DownloadModal from "@/components/common/DownloadModal";
import { apiService } from "@/lib/api";
import toast from "react-hot-toast";

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
}

interface BookmarkedCase {
    _id: string;
    name: string;
    pac_patient_id: string;
    sex: string;
    age: string;
    description: string;
    modality: string;
    accession_number: string;
    case_date: string;
    case_time: string;
    case_type: string;
    updatedAt: string;
    series_count: number;
    instance_count: number;
    hospital_name: string;
    referring_physician: string;
    notes: Note[];
    attached_report?: {
        created_at: string;
        is_draft: boolean;
    };
}

const COLUMN_VISIBILITY_KEY = 'research_bookmarks_columns';

const DEFAULT_COLUMN_VISIBILITY: VisibilityState = {
    select: true,
    actions: true,
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
    bookmark_notes: true,
    series_count: false,
    instance_count: false,
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
    const [downloadModalOpen, setDownloadModalOpen] = useState(false);
    const [selectedCaseForDownload, setSelectedCaseForDownload] = useState<{ id: string; name: string } | null>(null);

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

    useEffect(() => {
        if (!isCollapsed) {
            fetchBookmarks();
        }
    }, [isCollapsed]);

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

                    return {
                        _id: caseItem._id,
                        name: caseItem.patient?.name || '-',
                        pac_patient_id: caseItem.pac_patinet_id || caseItem.patient?.patient_id || '-',
                        sex: caseItem.patient?.sex || '-',
                        age: calculateAge(caseItem.patient?.birth_date || ''),
                        description: caseItem.description || '-',
                        modality: caseItem.modality || '-',
                        accession_number: caseItem.accession_number || '-',
                        case_date: caseItem.case_date || '',
                        case_time: caseItem.case_time || '',
                        case_type: caseItem.case_type || '-',
                        updatedAt: caseItem.updatedAt || '',
                        series_count: caseItem.series_count || 0,
                        instance_count: caseItem.instance_count || 0,
                        hospital_name: caseItem.hospital_name || '-',
                        referring_physician: caseItem.referring_physician || '-',
                        notes: caseItem.notes || [],
                        attached_report: caseItem.attached_report,
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
        },
        columnHelper.display({
            id: 'actions',
            header: 'Actions',
            enableHiding: false,
            cell: (props: any) => (
                <TooltipProvider>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    className="p-1 hover:bg-blue-50 rounded cursor-pointer"
                                    onClick={() => {
                                        window.open(`${window.location.origin}/case/${props.row.original._id}/viewer`, `viewer_${props.row.original._id}`, 'width=1200,height=800,resizable=yes,scrollbars=yes');
                                    }}
                                >
                                    <Eye className="w-4 h-4 text-blue-500" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>View Case</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    className="p-1 hover:bg-green-50 rounded cursor-pointer"
                                    onClick={() => handleDownloadClick(props.row.original._id, props.row.original.name)}
                                >
                                    <Download className="w-4 h-4 text-green-600" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>Download Images</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    className="p-1 hover:bg-red-50 rounded cursor-pointer"
                                    onClick={() => handleRemoveBookmark(props.row.original._id)}
                                >
                                    <X className="w-4 h-4 text-red-500" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>Remove Bookmark</TooltipContent>
                        </Tooltip>
                    </div>
                </TooltipProvider>
            ),
        }),
        columnHelper.accessor('name', {
            id: 'name',
            header: 'Patient Name',
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
            cell: (props) => {
                const patientId = props.row.original.pac_patient_id || '-';
                return <CellWithCopy content={patientId} cellId={`${props.row.id}-case-id`} />;
            },
        }),
        columnHelper.display({
            id: 'age',
            header: 'Age',
            cell: (props) => {
                const age = props.row.original.age || '-';
                return <CellWithCopy content={String(age)} cellId={`${props.row.id}-age`} />;
            },
        }),
        columnHelper.display({
            id: 'sex',
            header: 'Sex',
            cell: (props) => {
                const sex = props.row.original.sex || '-';
                return <CellWithCopy content={sex} cellId={`${props.row.id}-sex`} />;
            },
        }),
        columnHelper.display({
            id: 'study_date_time',
            header: 'Study Date & Time',
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
        }),
        columnHelper.display({
            id: 'history_date_time',
            header: 'History Date & Time',
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
        }),
        columnHelper.display({
            id: 'reporting_date_time',
            header: 'Reporting Date & Time',
            cell: (props) => {
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
            cell: (info) => <CellWithCopy content={info.getValue() || '-'} cellId={`${info.row.id}-accession`} />,
        }),
        columnHelper.display({
            id: 'center',
            header: 'Center',
            cell: (props) => {
                const centerName = props.row.original.hospital_name;
                if (!centerName || centerName === '-') return <span className="text-gray-400">-</span>;
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
            cell: (info) => <CellWithCopy content={info.getValue() || '-'} cellId={`${info.row.id}-description`} />,
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
            id: 'reported',
            header: 'Reported',
            cell: (props) => {
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
        columnHelper.display({
            id: 'series_count',
            header: 'Series Count',
            cell: (props) => {
                const seriesCount = props.row.original.series_count || 0;
                return <CellWithCopy content={String(seriesCount)} cellId={`${props.row.id}-series-count`} />;
            },
        }),
        columnHelper.display({
            id: 'instance_count',
            header: 'Instance Count',
            cell: (props) => {
                const instanceCount = props.row.original.instance_count || 0;
                return <CellWithCopy content={String(instanceCount)} cellId={`${props.row.id}-instance-count`} />;
            },
        }),
        columnHelper.display({
            id: 'bookmark_notes',
            header: 'Notes',
            cell: (props) => {
                const notes = props.row.original.notes;
                if (!notes || notes.length === 0) {
                    return <span className="text-gray-400 text-xs">No notes</span>;
                }
                
                return (
                    <HoverCard>
                        <HoverCardTrigger asChild>
                            <button className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs">
                                <MessageSquare className="w-3 h-3" />
                                {notes.length} note{notes.length > 1 ? 's' : ''}
                            </button>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-80">
                            <div className="space-y-2">
                                {notes.map((note) => (
                                    <div key={note._id} className="border-b last:border-0 pb-2 last:pb-0">
                                        <p className="text-xs text-gray-700">{note.note}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                                note.flag_type === 'urgent' ? 'bg-red-100 text-red-700' :
                                                note.flag_type === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                                                note.flag_type === 'info' ? 'bg-blue-100 text-blue-700' :
                                                'bg-gray-100 text-gray-700'
                                            }`}>
                                                {note.flag_type}
                                            </span>
                                            {note.created_by && (
                                                <span className="text-[10px] text-gray-500">
                                                    by {note.created_by.full_name}
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
                            <DataTable
                                data={bookmarks}
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
                            />
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
        </>
    );
};
