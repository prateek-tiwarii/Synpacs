import { Download, ImageIcon, ChevronDown, ChevronUp, SlidersHorizontal } from "lucide-react";
import { useState, useMemo, useEffect, useCallback } from "react";
import type { VisibilityState } from '@tanstack/react-table';
import { createColumnHelper } from '@tanstack/react-table';
import { Badge } from "@/components/ui/badge";
import type { Patient } from "@/components/patient/PacDetailsModal";
import { apiService } from "@/lib/api";
import { DataTable, CellWithCopy } from "@/components/common/DataTable";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "react-router-dom";
import FilterPanel, { type FilterState } from "@/components/common/FilterPanel";

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

const PacsList = () => {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFilterCollapsed, setIsFilterCollapsed] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalPatients, setTotalPatients] = useState(0);
    const pageSize = 20;

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
        reportStatus: { reported: false, drafted: false, unreported: false },
        modalities: {
            ALL: false, DT: false, SC: false, AN: false,
            US: false, ECHO: false, CR: false, XA: false,
            MR: false, CTMR: false, PX: false, DX: false,
            MR2: false, NM: false, RF: false, CT: false,
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
                    setTotalPatients(response.pagination.totalCases || response.pagination.totalPatients);
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
                
                if (selectedModalities.length > 0 && !selectedModalities.includes('ALL')) {
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
            reportStatus: { reported: false, drafted: false, unreported: false },
            modalities: {
                ALL: false, DT: false, SC: false, AN: false,
                US: false, ECHO: false, CR: false, XA: false,
                MR: false, CTMR: false, PX: false, DX: false,
                MR2: false, NM: false, RF: false, CT: false,
            },
        });
    };

    const columnHelper = createColumnHelper<Patient>();

    const columns = useMemo(() => [
        columnHelper.display({
            id: 'actions',
            header: 'Action',
            enableHiding: false,
            cell: (props: any) => (
                <TooltipProvider>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    className="p-1 hover:bg-green-50 rounded cursor-pointer"
                                    onClick={() => {
                                        window.open(`${window.location.origin}/case/${props.row.original._id}/viewer`, `viewer_${props.row.original._id}`, 'width=1200,height=800,resizable=yes,scrollbars=yes');
                                    }}
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
                                    className="p-1 hover:bg-blue-50 rounded cursor-pointer"
                                    onClick={() => {
                                        // Download functionality can be added later
                                    }}
                                >
                                    <Download className="w-4 h-4 text-green-500" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Download</p>
                            </TooltipContent>
                        </Tooltip>
                    </div>
                </TooltipProvider>
            ),
        }),
        columnHelper.accessor('name', {
            header: 'Patient Name',
            cell: (info: any) => {
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
            cell: (props: any) => {
                const patientId = props.row.original.pac_patinet_id || props.row.original.patient?.patient_id || '-';
                return <CellWithCopy content={patientId} cellId={`${props.row.id}-case-id`} />;
            },
        }),
        columnHelper.display({
            id: 'age',
            header: 'Age',
            cell: (props: any) => {
                const age = props.row.original.age || props.row.original.patient?.age || '-';
                return <CellWithCopy content={String(age)} cellId={`${props.row.id}-age`} />;
            },
        }),
        columnHelper.display({
            id: 'sex',
            header: 'Sex',
            cell: (props: any) => {
                const sex = props.row.original.sex || props.row.original.patient?.sex || '-';
                return <CellWithCopy content={sex} cellId={`${props.row.id}-sex`} />;
            },
        }),
        columnHelper.display({
            id: 'study_date_time',
            header: 'Study Date & Time',
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
            cell: (info: any) => <CellWithCopy content={info.getValue() || '-'} cellId={`${info.row.id}-accession`} />,
        }),
        columnHelper.display({
            id: 'center',
            header: 'Center',
            cell: (props: any) => {
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
            cell: (props: any) => {
                const referringDoctor = props.row.original.referring_doctor || '-';
                return <CellWithCopy content={referringDoctor} cellId={`${props.row.id}-ref-doc`} />;
            },
        }),
        columnHelper.display({
            id: 'image_count',
            header: 'Image Count',
            cell: (props: any) => {
                const instanceCount = props.row.original.instance_count || 0;
                return <CellWithCopy content={String(instanceCount)} cellId={`${props.row.id}-img-count`} />;
            },
        }),
        columnHelper.accessor('case_description', {
            header: 'Study Description',
            cell: (info: any) => <CellWithCopy content={info.getValue() || '-'} cellId={`${info.row.id}-desc`} />,
        }),
        columnHelper.accessor('modality', {
            header: 'Modality',
            cell: (info: any) => <CellWithCopy content={info.getValue() || '-'} cellId={`${info.row.id}-modality`} />,
        }),
        columnHelper.display({
            id: 'case_type',
            header: 'Case Type',
            cell: (props: any) => {
                const caseType = props.row.original.treatment_type || '-';
                return <CellWithCopy content={caseType} cellId={`${props.row.id}-case-type`} />;
            },
        }),
        columnHelper.display({
            id: 'reported',
            header: 'Reported',
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
    ], []);

    return (
        <div className="p-6 space-y-4">
            {/* Header with Filter Toggle */}
            <div className="border border-slate-200 bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                    <div>
                        <p className="text-sm text-slate-600">
                            {totalPatients > 0 ? `${totalPatients} total cases` : 'All cases from your center'}
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-md border border-slate-200">
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
                </div>

                {/* Filter Panel */}
                {!isFilterCollapsed && (
                    <FilterPanel
                        onFilterChange={handleFilterChange}
                        onFilterReset={handleFilterReset}
                        initialFilters={filters}
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
            />
        </div>
    );
};

export default PacsList;
