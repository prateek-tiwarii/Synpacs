import React, { useState, useEffect, useMemo } from 'react';
import { Download, FileOutput, History } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ReportVersionHistory } from './ReportVersionHistory';
import { apiService } from '@/lib/api';
import { DataTable, CellWithCopy } from '@/components/common/DataTable';
import type { VisibilityState, RowSelectionState } from '@tanstack/react-table';
import { createColumnHelper } from '@tanstack/react-table';
import { Link } from 'react-router-dom';

interface PatientResult {
  _id: string;
  pac_patinet_id: string;
  name: string;
  age: string;
  sex: string;
  modality: string;
  description: string;
  bodyPart: string;
  case_date: string;
  case_time: string;
  accession_number: string;
  hospital_name: string;
  referring_physician: string | null;
  instance_count: number;
  updatedAt: string;
  attached_report: {
    _id: string;
    is_draft: boolean;
    created_at: string;
  } | null;
  patient: {
    patient_id: string;
    name: string;
    age: string;
    sex: string;
  };
}

interface SearchFilters {
  keywords: string;
  minAge: string;
  maxAge: string;
  center: string;
  startDate: string;
  endDate: string;
  modality: string;
  sex: { male: boolean; female: boolean };
}

interface SearchResultsProps {
  filters: SearchFilters;
  onExport: () => void;
}

const STORAGE_KEY_RESEARCH = 'research_table_columns';

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
  reported: true,
};

export const SearchResults: React.FC<SearchResultsProps> = ({ filters, onExport }) => {
  const [patients, setPatients] = useState<PatientResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // Initialize column visibility from localStorage or use default
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_RESEARCH);
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
      localStorage.setItem(STORAGE_KEY_RESEARCH, JSON.stringify(columnVisibility));
    } catch (error) {
      console.error('Failed to save column visibility to localStorage:', error);
    }
  }, [columnVisibility]);

  // Fetch patients on mount and when filters change
  useEffect(() => {
    fetchPatients();
  }, [filters]);

  const fetchPatients = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build API filters from SearchFilters
      const apiFilters: any = {};

      // Date range
      if (filters.startDate) apiFilters.start_date = filters.startDate;
      if (filters.endDate) apiFilters.end_date = filters.endDate;

      // Keywords (search in description)
      if (filters.keywords) apiFilters.keywords = filters.keywords;

      // Age range
      if (filters.minAge) apiFilters.min_age = filters.minAge;
      if (filters.maxAge) apiFilters.max_age = filters.maxAge;

      // Gender
      if (filters.sex.male && !filters.sex.female) {
        apiFilters.gender = 'M';
      } else if (filters.sex.female && !filters.sex.male) {
        apiFilters.gender = 'F';
      }

      // Modality
      if (filters.modality && filters.modality !== 'all') {
        apiFilters.modality = filters.modality.toUpperCase();
      }

      // Center/Hospital
      if (filters.center && filters.center !== 'all') {
        apiFilters.hospital = filters.center;
      }

      const response = await apiService.getAllCasesWithFilters(1, 50, apiFilters) as any;

      if (response.success && response.data?.cases) {
        const mappedPatients: PatientResult[] = response.data.cases.map((caseItem: any) => {
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
            pac_patinet_id: caseItem.patient?.patient_id || 'N/A',
            name: caseItem.patient?.name || 'N/A',
            age: calculateAge(caseItem.patient?.dob || ''),
            sex: caseItem.patient?.sex || '',
            modality: caseItem.modality || '',
            description: caseItem.description || '',
            bodyPart: caseItem.body_part || '',
            case_date: caseItem.case_date || '',
            case_time: caseItem.case_time || '',
            accession_number: caseItem.accession_number || '',
            hospital_name: caseItem.hospital_name || '',
            referring_physician: caseItem.referring_physician,
            instance_count: caseItem.instance_count || 0,
            updatedAt: caseItem.updatedAt || '',
            attached_report: caseItem.attached_report,
            patient: {
              patient_id: caseItem.patient?.patient_id || '',
              name: caseItem.patient?.name || '',
              age: calculateAge(caseItem.patient?.dob || ''),
              sex: caseItem.patient?.sex || '',
            },
          };
        });
        setPatients(mappedPatients);
      } else {
        setError(response.message || 'Failed to fetch patients');
      }
    } catch (err: any) {
      console.error('Error fetching patients:', err);
      setError(err.message || 'Failed to fetch patients');
    } finally {
      setLoading(false);
    }
  };

  const handleViewHistory = (reportId: string) => {
    setSelectedReportId(reportId);
    setVersionHistoryOpen(true);
  };

  const handleCloseVersionHistory = () => {
    setVersionHistoryOpen(false);
    setSelectedReportId(null);
  };

  const columnHelper = createColumnHelper<PatientResult>();

  const columns = useMemo(() => [
    {
      id: 'select',
      header: ({ table }: any) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() ? 'indeterminate' : false)}
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
    {
      id: 'actions',
      header: 'Actions',
      enableHiding: false,
      cell: (props: any) => {
        const reportId = props.row.original.attached_report?._id;
        return (
          <div className="flex gap-2">
            {reportId ? (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 h-7 text-xs"
                onClick={() => handleViewHistory(reportId)}
              >
                <History size={14} />
                History
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">No report</span>
            )}
          </div>
        );
      },
    },
    columnHelper.accessor('name', {
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
        const patientId = props.row.original.pac_patinet_id || props.row.original.patient?.patient_id || '-';
        return <CellWithCopy content={patientId} cellId={`${props.row.id}-case-id`} />;
      },
    }),
    columnHelper.display({
      id: 'age',
      header: 'Age',
      cell: (props) => {
        const age = props.row.original.age || props.row.original.patient?.age || '-';
        return <CellWithCopy content={String(age)} cellId={`${props.row.id}-age`} />;
      },
    }),
    columnHelper.display({
      id: 'sex',
      header: 'Sex',
      cell: (props) => {
        const sex = props.row.original.sex || props.row.original.patient?.sex || '-';
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
      header: 'Study Description',
      cell: (info) => <CellWithCopy content={info.getValue() || '-'} cellId={`${info.row.id}-desc`} />,
    }),
    columnHelper.accessor('modality', {
      header: 'Modality',
      cell: (info) => <CellWithCopy content={info.getValue() || '-'} cellId={`${info.row.id}-modality`} />,
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
  ], []);

  if (loading) {
    return (
      <Card className="border-black/20 shadow-sm">
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading patients...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-black/20 shadow-sm">
        <CardContent className="py-8 text-center text-red-500">
          Error: {error}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-black/20 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-xl font-bold">Patient Results</CardTitle>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{patients.length} results</span>
            <Button variant="outline" className="gap-2">
              <Download size={16} />
              Download Reports
            </Button>
            <Button onClick={onExport} className="gap-2">
              <FileOutput size={16} />
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            data={patients}
            columns={columns}
            isLoading={loading}
            error={error}
            emptyMessage="No patients found"
            loadingMessage="Loading patients..."
            columnVisibility={columnVisibility}
            onColumnVisibilityChange={setColumnVisibility}
            showColumnToggle={true}
            enableRowSelection={true}
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            showBorder={true}
          />
        </CardContent>
      </Card>

      {selectedReportId && (
        <ReportVersionHistory
          reportId={selectedReportId}
          open={versionHistoryOpen}
          onClose={handleCloseVersionHistory}
        />
      )}
    </>
  );
};
