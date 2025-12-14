import { ClipboardCheck, Download, FolderOpen, ImageIcon, MessageSquare, Save } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { VisibilityState } from '@tanstack/react-table';
import { createColumnHelper } from '@tanstack/react-table';
import type { Patient } from "@/components/patient/PacDetailsModal";
import { apiService } from "@/lib/api";
import { DataTable, CellWithCopy, StatusCell, formatDate } from "@/components/common/DataTable";

interface AssignedPatientsTableProps {
    setSelectedPatient: (patient: Patient | null) => void;
    setMessageDialogOpen: (open: boolean) => void;
    setDocumentDialogOpen: (open: boolean) => void;
    columnVisibility: VisibilityState;
    onColumnVisibilityChange: (visibility: VisibilityState) => void;
}

interface Case {
    _id: string;
    study_uid: string;
    accession_number: string;
    body_part: string;
    description: string;
    hospital_id: string;
    modality: string;
    patient_id: string;
    study_date: string;
    study_time: string;
    assigned_to: string;
    case_type: string;
    priority: string;
    status: string;
    updatedAt: string;
    patient: {
        _id: string;
        patient_id: string;
        date_of_birth: string;
        name: string;
        sex: string;
    };
}

interface AssignedCasesResponse {
    success: boolean;
    message: string;
    count: number;
    data: {
        cases: Case[];
    };
}

const AssignedPatientsTable = ({
    setSelectedPatient,
    setMessageDialogOpen,
    setDocumentDialogOpen,
    columnVisibility,
    onColumnVisibilityChange,
}: AssignedPatientsTableProps) => {
    const navigate = useNavigate();
    const [patients, setPatients] = useState<Patient[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchAssignedPatients = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const response = await apiService.getAssignedCases() as any;
                if (response.success && response.data?.cases) {
                    // Map API response to match Patient interface
                    const mappedPatients: Patient[] = response.data.cases.map((caseItem: any) => {
                        // Calculate age from date_of_birth (format: YYYYMMDD)
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

                        // Format study_date to readable format (YYYYMMDD -> YYYY-MM-DD)
                        const formatStudyDate = (dateStr: string): string => {
                            if (!dateStr || dateStr.length !== 8) return dateStr;
                            return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
                        };

                        return {
                            _id: caseItem._id,
                            name: caseItem.patient.name,
                            sex: caseItem.patient.sex,
                            pac_patinet_id: caseItem.patient.patient_id,
                            date_of_birth: caseItem.patient.date_of_birth,
                            age: calculateAge(caseItem.patient.date_of_birth),
                            hospital_id: caseItem.hospital_id,
                            status: caseItem.status,
                            study_description: caseItem.description,
                            description: caseItem.description,
                            body_part: caseItem.body_part,
                            accession_number: caseItem.accession_number,
                            study_uid: caseItem.study_uid,
                            modality: caseItem.modality,
                            study_date: caseItem.study_date,
                            study_time: caseItem.study_time,
                            date_of_capture: formatStudyDate(caseItem.study_date),
                            priority: caseItem.priority,
                            case_type: caseItem.case_type,
                            assigned_to: caseItem.assigned_to,
                            patient: caseItem.patient,
                            pac_images_count: 0, // Not provided in API response
                            updatedAt: caseItem.updatedAt,
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
        };

        fetchAssignedPatients();
    }, []);



    const columnHelper = createColumnHelper<Patient>();

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
            cell: (info) => <CellWithCopy content={info.getValue() || ''} cellId={`${info.row.id}-id`} />,
        }),
        columnHelper.accessor('age', {
            header: 'Age',
            cell: (info) => <CellWithCopy content={info.getValue() || ''} cellId={`${info.row.id}-age`} />,
        }),
        columnHelper.accessor('sex', {
            header: 'Sex',
            cell: (info) => <CellWithCopy content={info.getValue()} cellId={`${info.row.id}-sex`} />,
        }),
        columnHelper.accessor('study_description', {
            header: 'Study Description',
            cell: (info) => <CellWithCopy content={info.getValue() || ''} cellId={`${info.row.id}-study`} />,
        }),
        columnHelper.accessor('treatment_type', {
            header: 'Treatment Type',
            cell: (info) => <CellWithCopy content={info.getValue() || ''} cellId={`${info.row.id}-treatment`} />,
        }),
        columnHelper.accessor('status', {
            header: 'Status',
            cell: (info) => <StatusCell status={info.getValue()} />,
        }),
        columnHelper.accessor('referring_doctor', {
            header: 'Referring Doctor',
            cell: (info) => <CellWithCopy content={info.getValue() || ''} cellId={`${info.row.id}-doc`} />,
        }),
        columnHelper.accessor('date_of_capture', {
            header: 'Date of Capture',
            cell: (info) => <div className="whitespace-pre-line text-xs"><CellWithCopy content={formatDate(info.getValue() || '')} cellId={`${info.row.id}-capture`} /></div>,
        }),
        columnHelper.accessor('pac_images_count', {
            header: 'Images Count',
            cell: (info) => <CellWithCopy content={(info.getValue() ?? 0).toString()} cellId={`${info.row.id}-images`} />,
        }),
        columnHelper.accessor('hospital_id', {
            header: 'Hospital ID',
            cell: (info) => <CellWithCopy content={info.getValue()} cellId={`${info.row.id}-hospital`} />,
        }),
        columnHelper.accessor('accession_number', {
            header: 'Accession Number',
            cell: (info) => <CellWithCopy content={info.getValue() || ''} cellId={`${info.row.id}-acc`} />,
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

    const handleRowClick = (patient: Patient) => {
        navigate(`/patient/${patient._id}`);
    };

    return (
        <DataTable
            data={patients}
            columns={columns}
            isLoading={isLoading}
            error={error}
            emptyMessage="No patients assigned to you yet."
            loadingMessage="Loading assigned patients..."
            columnVisibility={columnVisibility}
            onColumnVisibilityChange={onColumnVisibilityChange}
            onRowClick={handleRowClick}
            tableTitle="Patients"
        />
    );
};

export default AssignedPatientsTable;
