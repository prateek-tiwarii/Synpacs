import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { flexRender } from "@tanstack/react-table";
import { useReactTable, getCoreRowModel, getFilteredRowModel, getSortedRowModel } from "@tanstack/react-table";
import { Check, ClipboardCheck, Copy, Download, FolderOpen, ImageIcon, MessageSquare, Save, Loader2 } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { VisibilityState } from '@tanstack/react-table';
import { createColumnHelper } from '@tanstack/react-table';
import type { Patient } from "@/components/patient/PatientDetailsModal";
import { apiService } from "@/lib/api";

interface AssignedPatientsTableProps {
    setSelectedPatient: (patient: Patient | null) => void;
    setMessageDialogOpen: (open: boolean) => void;
    setDocumentDialogOpen: (open: boolean) => void;
    columnVisibility: VisibilityState;
    onColumnVisibilityChange: (visibility: VisibilityState) => void;
}

interface AssignedPatientsResponse {
    success: boolean;
    message: string;
    count: number;
    data: Patient[];
}

const AssignedPatientsTable = ({
    setSelectedPatient,
    setMessageDialogOpen,
    setDocumentDialogOpen,
    columnVisibility,
    onColumnVisibilityChange,
}: AssignedPatientsTableProps) => {
    const navigate = useNavigate();
    const [copiedCell, setCopiedCell] = useState<string | null>(null);
    const [patients, setPatients] = useState<Patient[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchAssignedPatients = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const response = await apiService.getAssignedPatients() as AssignedPatientsResponse;
                if (response.success && response.data) {
                    // Map API response to match Patient interface
                    const mappedPatients = response.data.map((patient) => ({
                        ...patient,
                        study_description: typeof patient.study === 'object' && patient.study !== null 
                            ? patient.study.body_part || '' 
                            : '',
                        pac_images_count: patient.pac_images?.length || 0,
                    }));
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
    }, []);






    const CellWithCopy = ({ content, cellId }: { content: string; cellId: string }) => (
        <div className="group relative">
            <div className="pr-6">{content}</div>
            <button
                onClick={() => handleCopy(content, cellId)}
                className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 rounded"
            >
                {copiedCell === cellId ? (
                    <Check className="w-3 h-3 text-green-600" />
                ) : (
                    <Copy className="w-3 h-3 text-gray-600" />
                )}
            </button>
        </div>
    );

    const columnHelper = createColumnHelper<Patient>();


    const formatDate = (dateString: string) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return `${date.toLocaleDateString()}\n${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    };

    const columns = useMemo(() => [
        columnHelper.display({
            id: 'actions',
            header: 'Action',
            cell: (props) => (
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <button className="p-1 hover:bg-blue-50 rounded" title="Verify">
                        <ClipboardCheck className="w-4 h-4 text-blue-500" />
                    </button>
                    <button className="p-1 hover:bg-yellow-50 rounded" title="Open Folder">
                        <FolderOpen className="w-4 h-4 text-yellow-500" />
                    </button>
                    <button
                        className="p-1 hover:bg-blue-50 rounded"
                        title="Message"
                        onClick={() => handleMessageClick(props.row.original)}
                    >
                        <MessageSquare className="w-4 h-4 text-blue-500" />
                    </button>
                    <button
                        className="p-1 hover:bg-yellow-50 rounded"
                        title="Download"
                        onClick={() => handleDocumentClick(props.row.original)}
                    >
                        <Download className="w-4 h-4 text-yellow-500" />
                    </button>
                    <button className="p-1 hover:bg-blue-50 rounded" title="View Images">
                        <ImageIcon className="w-4 h-4 text-blue-500" />
                    </button>
                    <button className="p-1 hover:bg-yellow-50 rounded" title="Save">
                        <Save className="w-4 h-4 text-yellow-500" />
                    </button>
                </div>
            ),
        }),
        columnHelper.accessor('name', {
            header: 'Patient Name',
            cell: (info) => <CellWithCopy content={info.getValue()} cellId={`${info.row.id}-name`} />,
        }),
        columnHelper.accessor('pac_patinet_id', {
            header: 'Patient ID',
            cell: (info) => <CellWithCopy content={info.getValue()} cellId={`${info.row.id}-id`} />,
        }),
        columnHelper.accessor('age', {
            header: 'Age',
            cell: (info) => <CellWithCopy content={info.getValue()} cellId={`${info.row.id}-age`} />,
        }),
        columnHelper.accessor('sex', {
            header: 'Sex',
            cell: (info) => <CellWithCopy content={info.getValue()} cellId={`${info.row.id}-sex`} />,
        }),
        columnHelper.accessor('study_description', {
            header: 'Study Description',
            cell: (info) => <CellWithCopy content={info.getValue()} cellId={`${info.row.id}-study`} />,
        }),
        columnHelper.accessor('treatment_type', {
            header: 'Treatment Type',
            cell: (info) => <CellWithCopy content={info.getValue()} cellId={`${info.row.id}-treatment`} />,
        }),
        columnHelper.accessor('status', {
            header: 'Status',
            cell: (info) => {
                const status = info.getValue();
                return (
                    <span
                        className={`inline-flex items-center gap-1 ${status === 'Reported'
                            ? 'text-green-600'
                            : status === 'Unreported'
                                ? 'text-red-600'
                                : 'text-yellow-600'
                            }`}
                    >
                        <span className={`w-2 h-2 rounded-full ${status === 'Reported'
                            ? 'bg-green-600'
                            : status === 'Unreported'
                                ? 'bg-red-600'
                                : 'bg-yellow-600'
                            }`} />
                        {status}
                    </span>
                );
            },
        }),
        columnHelper.accessor('referring_doctor', {
            header: 'Referring Doctor',
            cell: (info) => <CellWithCopy content={info.getValue()} cellId={`${info.row.id}-doc`} />,
        }),
        columnHelper.accessor('date_of_capture', {
            header: 'Date of Capture',
            cell: (info) => <div className="whitespace-pre-line text-xs"><CellWithCopy content={formatDate(info.getValue())} cellId={`${info.row.id}-capture`} /></div>,
        }),
        columnHelper.accessor('pac_images_count', {
            header: 'Images Count',
            cell: (info) => <CellWithCopy content={info.getValue().toString()} cellId={`${info.row.id}-images`} />,
        }),
        columnHelper.accessor('hospital_id', {
            header: 'Hospital ID',
            cell: (info) => <CellWithCopy content={info.getValue()} cellId={`${info.row.id}-hospital`} />,
        }),
        columnHelper.accessor('accession_number', {
            header: 'Accession Number',
            cell: (info) => <CellWithCopy content={info.getValue()} cellId={`${info.row.id}-acc`} />,
        }),
    ], [copiedCell]);

    const handleCopy = (text: string, cellId: string) => {
        navigator.clipboard.writeText(text);
        setCopiedCell(cellId);
        setTimeout(() => setCopiedCell(null), 2000);
    };

    const handleMessageClick = (patient: Patient) => {
        setSelectedPatient(patient);
        setMessageDialogOpen(true);
    };

    const handleDocumentClick = (patient: Patient) => {
        setSelectedPatient(patient);
        setDocumentDialogOpen(true);
    };

    const handleRowClick = (patient: Patient) => {
        navigate(`/patient/${patient._id}`);
    };


    const table = useReactTable({
        data: patients,
        columns,
        state: {
            columnVisibility,
        },
        onColumnVisibilityChange: (updater) => {
            const newVisibility = typeof updater === 'function' 
                ? updater(columnVisibility) 
                : updater;
            onColumnVisibilityChange(newVisibility);
        },
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });


    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <span className="ml-2 text-gray-600">Loading assigned patients...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-12">
                <p className="text-red-500 mb-2">Error: {error}</p>
                <button 
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                    Retry
                </button>
            </div>
        );
    }

    if (patients.length === 0) {
        return (
            <div className="flex items-center justify-center py-12">
                <p className="text-gray-500">No patients assigned to you yet.</p>
            </div>
        );
    }

    return (
        <div className='flex flex-col gap-2 bg-white'>
            <div className="overflow-x-auto">
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id} className="bg-muted/50">
                                    {headerGroup.headers.map((header) => (
                                        <TableHead key={header.id} className="font-semibold whitespace-nowrap">
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {table.getRowModel().rows.map((row) => (
                                <TableRow 
                                    key={row.id} 
                                    className="hover:bg-muted/30 cursor-pointer"
                                    onClick={() => handleRowClick(row.original)}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id} className="whitespace-nowrap">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
};

export default AssignedPatientsTable;
