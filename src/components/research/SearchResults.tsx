import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Download, FileOutput, X, ImageIcon, ClipboardCheck, FolderOpen, MessageSquare, Bookmark, Settings } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { apiService } from '@/lib/api';
import { DataTable, CellWithCopy } from '@/components/common/DataTable';
import type { VisibilityState } from '@tanstack/react-table';
import { createColumnHelper } from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import type { Patient } from '@/components/patient/PacDetailsModal';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SearchFilters {
  minAge: string;
  maxAge: string;
  startDate: string;
  endDate: string;
  modality: string;
  sex: 'all' | 'M' | 'F';
  centerId: string;
  keyword: string;
}

interface SearchResultsProps {
  filters: SearchFilters;
  onExport: () => void;
  onClose?: () => void;
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
  case_type: true,
  reported: true,
};

export const SearchResults: React.FC<SearchResultsProps> = ({ filters, onExport, onClose }) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCases, setTotalCases] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

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

  const fetchPatients = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build API filters from SearchFilters
      const apiFilters: any = {};

      // Date range
      if (filters.startDate) apiFilters.start_date = filters.startDate;
      if (filters.endDate) apiFilters.end_date = filters.endDate;

      // Age range
      if (filters.minAge) apiFilters.min_age = filters.minAge;
      if (filters.maxAge) apiFilters.max_age = filters.maxAge;

      // Gender
      if (filters.sex === 'M') apiFilters.gender = 'M';
      if (filters.sex === 'F') apiFilters.gender = 'F';

      // Modality
      if (filters.modality) {
        apiFilters.modality = filters.modality.toUpperCase();
      }

      // Keyword search
      if (filters.keyword && filters.keyword.trim()) {
        apiFilters.keyword = filters.keyword.trim();
      }

      const response = await apiService.getAllCasesWithFilters(currentPage, pageSize, apiFilters) as any;

      if (response.success && response.data?.cases) {
        // Update pagination info
        if (response.pagination) {
          setTotalCases(response.pagination.totalCases || 0);
          setTotalPages(response.pagination.totalPages || 1);
        }
        // Reported-only rule: include only cases with non-draft report
        let filteredData = [...response.data.cases].filter((caseItem: any) => {
          const report = caseItem.attached_report;
          return Boolean(report) && !Boolean(report?.is_draft);
        });

        // Center filter (client-side) – aligns with selectable centers
        if (filters.centerId && filters.centerId !== 'all') {
          filteredData = filteredData.filter((caseItem: any) => caseItem.hospital_id === filters.centerId);
        }

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

        // Age range filter (client-side, based on calculated age)
        const minAge = filters.minAge ? Number(filters.minAge) : undefined;
        const maxAge = filters.maxAge ? Number(filters.maxAge) : undefined;
        if (minAge !== undefined || maxAge !== undefined) {
          filteredData = filteredData.filter((caseItem: any) => {
            const age = Number(calculateAge(caseItem.patient?.dob || ''));
            if (Number.isNaN(age)) return false;
            if (minAge !== undefined && age < minAge) return false;
            if (maxAge !== undefined && age > maxAge) return false;
            return true;
          });
        }

        const mappedPatients: Patient[] = filteredData.map((caseItem: any) => {
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
            accession_number: caseItem.accession_number || '',
            status: caseItem.status || '',
            priority: caseItem.priority || '',
            assigned_to: caseItem.assigned_to || null,
            hospital_name: caseItem.hospital_name || '',
            referring_doctor: caseItem.referring_physician || '',
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
    } catch (err: any) {
      console.error('Error fetching patients:', err);
      setError(err.message || 'Failed to fetch patients');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Fetch patients on mount and when filters or pagination change
  useEffect(() => {
    fetchPatients();
  }, [fetchPatients, currentPage, pageSize]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const columnHelper = createColumnHelper<Patient>();

  const columns = useMemo(() => [
    columnHelper.display({
      id: 'actions',
      header: 'Action',
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
              <TooltipContent>
                <p>View Images</p>
              </TooltipContent>
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
              <TooltipContent>
                <p>View Report</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button className="p-0.5 hover:bg-yellow-50 rounded cursor-pointer" onClick={() => { /* document */ }}>
                  <FolderOpen className="w-3.5 h-3.5 text-yellow-500" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Attached Documents</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button className="p-0.5 hover:bg-blue-50 rounded cursor-pointer" onClick={() => { /* messages */ }}>
                  <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Messages</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button className="p-0.5 hover:bg-yellow-50 rounded cursor-pointer" onClick={() => { /* download */ }}>
                  <Download className="w-3.5 h-3.5 text-yellow-500" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Download</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button className="p-0.5 hover:bg-green-50 rounded cursor-pointer" onClick={() => { /* bookmark */ }}>
                  <Bookmark className="w-3.5 h-3.5 text-green-500" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Save Bookmark</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      ),
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
        const name = info.getValue();
        const caseId = info.row.original._id;
        return (
          <div className="flex items-center gap-2">
            <CellWithCopy content={name || '-'} cellId={`${info.row.id}-name`} />
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
        // Return sortable value: combine date and time
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
        const referringDoctor = (props.row.original as any).referring_doctor || '-';
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
        const caseType = (props.row.original as any).treatment_type || '-';
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
    <div className="border border-slate-200 bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-linear-to-r from-slate-50 to-white border-b border-slate-100">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-700">Patient Results</span>
          <span className="text-xs text-slate-500">{patients.length} results</span>
        </div>
        <div className="flex items-center gap-2">
          {onClose && (
            <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs gap-1.5">
              <X className="w-3.5 h-3.5" />
              Close
            </Button>
          )}
          <Button onClick={onExport} size="sm" className="h-8 text-xs gap-1.5">
            <FileOutput className="w-3.5 h-3.5" />
            Export
          </Button>
        </div>
      </div>

      <div className="p-3">
        <DataTable
          data={patients}
          columns={columns}
          isLoading={loading}
          error={error}
          emptyMessage="No cases found"
          loadingMessage="Loading cases..."
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={setColumnVisibility}
          showColumnToggle={true}
          showBorder={true}
          isColumnModalOpen={isColumnModalOpen}
          onColumnModalOpenChange={setIsColumnModalOpen}
        />
      </div>

      {/* Pagination Footer */}
      {!loading && !error && totalCases > 0 && (
        <div className="flex items-center justify-between px-4 py-3 bg-linear-to-r from-slate-50 to-white border-t border-slate-100">
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-600">
              Showing <span className="font-semibold">{Math.min((currentPage - 1) * pageSize + 1, totalCases)}</span> to{' '}
              <span className="font-semibold">{Math.min(currentPage * pageSize, totalCases)}</span> of{' '}
              <span className="font-semibold">{totalCases}</span> cases
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
    </div>
  );
};
