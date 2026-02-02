import { useState, useMemo, useEffect } from "react";
import type { VisibilityState, RowSelectionState } from '@tanstack/react-table';
import { createColumnHelper } from '@tanstack/react-table';
import { Bookmark as BookmarkIcon, ChevronDown, ChevronUp, ClipboardCheck, Download, FolderOpen, ImageIcon, MessageSquare, Settings, X } from "lucide-react";
import { Link } from "react-router-dom";
import { DataTable, CellWithCopy } from "@/components/common/DataTable";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import DownloadModal from "@/components/common/DownloadModal";
import { apiService } from "@/lib/api";
import toast from "react-hot-toast";
import type { Patient } from "@/components/patient/PacDetailsModal";

type BookmarkedCase = Patient;

const COLUMN_VISIBILITY_KEY = 'research_bookmarks_columns';

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
                        patient: caseItem.patient,
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
        },
        columnHelper.display({
            id: 'actions',
            header: 'Actions',
            enableHiding: false,
            enableSorting: false,
            cell: (props: any) => (
                <TooltipProvider>
                    <div className="flex gap-0.5" onClick={(e) => e.stopPropagation()}>
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

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    className="p-0.5 hover:bg-blue-50 rounded cursor-pointer"
                                    onClick={() => {
                                        window.open(`${window.location.origin}/case/${props.row.original._id}/report`, `report_${props.row.original._id}`, 'width=1200,height=800,resizable=yes,scrollbars=yes');
                                    }}
                                >
                                    <ClipboardCheck className="w-3.5 h-3.5 text-blue-500" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>View Report</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button className="p-0.5 hover:bg-yellow-50 rounded cursor-pointer" onClick={() => { /* attached documents */ }}>
                                    <FolderOpen className="w-3.5 h-3.5 text-yellow-500" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>Attached Documents</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button className="p-0.5 hover:bg-blue-50 rounded cursor-pointer" onClick={() => { /* messages */ }}>
                                    <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>Messages</TooltipContent>
                        </Tooltip>

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

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    className="p-0.5 hover:bg-red-50 rounded cursor-pointer"
                                    onClick={() => handleRemoveBookmark(props.row.original._id)}
                                >
                                    <X className="w-3.5 h-3.5 text-red-500" />
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
            header: 'Note',
            enableSorting: false,
            cell: (props: any) => {
                const notes = (props.row.original as any).notes;
                if (!notes || notes.length === 0) {
                    return <span className="text-gray-400 text-xs">-</span>;
                }

                return (
                    <HoverCard>
                        <HoverCardTrigger asChild>
                            <button className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs">
                                <MessageSquare className="w-3 h-3" />
                                {notes.length}
                            </button>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-80">
                            <div className="space-y-2">
                                {notes.map((note: any) => (
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
        columnHelper.accessor('name', {
            id: 'name',
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
        columnHelper.display({
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
        }),
        columnHelper.display({
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
        }),
        columnHelper.display({
            id: 'reporting_date_time',
            header: 'Reporting Date & Time',
            enableSorting: true,
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
                                isColumnModalOpen={isColumnModalOpen}
                                onColumnModalOpenChange={setIsColumnModalOpen}
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
