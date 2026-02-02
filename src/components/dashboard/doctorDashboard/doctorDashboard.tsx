import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import DoctorDashboardHeader from './molecules/DoctorDashboardHeader';
import MessageDialog from './molecules/MessageDialog';
import DocumentDialog from './molecules/DocumentDialog';
import AssignedPatientsTable from './molecules/AssignedPatientsTable';
import type { Patient } from '@/components/patient/PacDetailsModal';
import type { FilterState } from '@/components/common/FilterPanel';
import { toast } from 'react-hot-toast';
import { apiService } from '@/lib/api';

type TabType = 'Unreported' | 'Reported' | 'All Cases' | 'Drafted';

const DEFAULT_MODALITIES = {
  ALL: true, DT: true, SC: true, AN: true,
  US: true, ECHO: true, CR: true, XA: true,
  MR: true, CTMR: true, PX: true, DX: true,
  MR2: true, NM: true, RF: true, CT: true,
};

const VALID_TABS: TabType[] = ['Unreported', 'Drafted', 'Reported', 'All Cases'];
const VALID_PERIODS = ['1D', '2D', '3D', '1W', '2W'];

// Helper to parse modalities from URL
const parseModalitiesFromUrl = (modalityParam: string | null): typeof DEFAULT_MODALITIES => {
  const modalities = { ...DEFAULT_MODALITIES };
  if (modalityParam) {
    const selectedModalities = modalityParam.split(',');
    selectedModalities.forEach((mod) => {
      if (mod in modalities) {
        modalities[mod as keyof typeof modalities] = true;
      }
    });
  }
  return modalities;
};

// Helper to serialize modalities to URL
const serializeModalitiesToUrl = (modalities: typeof DEFAULT_MODALITIES): string | null => {
  const selected = Object.entries(modalities)
    .filter(([_, isSelected]) => isSelected)
    .map(([key]) => key);
  return selected.length > 0 ? selected.join(',') : null;
};

// Helper to parse report status from URL
const parseReportStatusFromUrl = (reportStatusParam: string | null): { reported: boolean; drafted: boolean; unreported: boolean } => {
  const defaultStatus = { reported: false, drafted: false, unreported: false };
  if (!reportStatusParam) return defaultStatus;

  const selected = reportStatusParam.split(',');
  return {
    reported: selected.includes('reported'),
    drafted: selected.includes('drafted'),
    unreported: selected.includes('unreported'),
  };
};

// Helper to serialize report status to URL
const serializeReportStatusToUrl = (reportStatus: { reported: boolean; drafted: boolean; unreported: boolean }): string | null => {
  const selected = [];
  if (reportStatus.reported) selected.push('reported');
  if (reportStatus.drafted) selected.push('drafted');
  if (reportStatus.unreported) selected.push('unreported');
  return selected.length > 0 ? selected.join(',') : null;
};

// Helper to parse centers from URL
const parseCentersFromUrl = (centersParam: string | null): string[] => {
  if (!centersParam) return [];
  return centersParam.split(',');
};

// Helper to serialize centers to URL
const serializeCentersToUrl = (centers: string[]): string | null => {
  return centers.length > 0 ? centers.join(',') : null;
};

// Helper to parse study status from URL
const parseStudyStatusFromUrl = (studyStatusParam: string | null): { reported: boolean; drafted: boolean; unreported: boolean; reviewed: boolean } => {
  const defaultStatus = { reported: false, drafted: false, unreported: false, reviewed: false };
  if (!studyStatusParam) return defaultStatus;

  const selected = studyStatusParam.split(',');
  return {
    reported: selected.includes('reported'),
    drafted: selected.includes('drafted'),
    unreported: selected.includes('unreported'),
    reviewed: selected.includes('reviewed'),
  };
};

// Helper to serialize study status to URL
const serializeStudyStatusToUrl = (studyStatus: { reported: boolean; drafted: boolean; unreported: boolean; reviewed: boolean }): string | null => {
  const selected = [];
  if (studyStatus.reported) selected.push('reported');
  if (studyStatus.drafted) selected.push('drafted');
  if (studyStatus.unreported) selected.push('unreported');
  if (studyStatus.reviewed) selected.push('reviewed');
  return selected.length > 0 ? selected.join(',') : null;
};

const DoctorDashboard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isFilterCollapsed, setIsFilterCollapsed] = useState(true);
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [availableCenters, setAvailableCenters] = useState<{ id: string; name: string }[]>([]);

  // Fetch available centers
  useEffect(() => {
    const fetchCenters = async () => {
      try {
        const response = await apiService.getAllManagedHospitals() as any;
        if (response.success && response.data) {
          const centers = response.data.map((hospital: any) => ({
            id: hospital._id,
            name: hospital.hospital_name || hospital.name
          }));
          setAvailableCenters(centers);
        }
      } catch (error) {
        console.error('Failed to fetch centers:', error);
      }
    };
    fetchCenters();
  }, []);

  // Derive activeTab from URL
  const activeTab = useMemo<TabType>(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && VALID_TABS.includes(tabParam as TabType)) {
      return tabParam as TabType;
    }
    return 'Unreported';
  }, [searchParams]);

  // Derive activePeriod from URL
  const activePeriod = useMemo<string>(() => {
    const periodParam = searchParams.get('period');
    if (periodParam && VALID_PERIODS.includes(periodParam)) {
      return periodParam;
    }
    return '1M';
  }, [searchParams]);

  // Helper to get default dates (30 days ago to today)
  const getDefaultDates = () => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    return {
      startDate: formatDate(thirtyDaysAgo),
      endDate: formatDate(today),
    };
  };

  // Derive filters from URL
  const filters = useMemo<FilterState>(() => {
    const genderParam = searchParams.get('gender');
    const defaultDates = getDefaultDates();
    return {
      patientName: searchParams.get('patientName') || '',
      patientId: searchParams.get('patientId') || '',
      bodyPart: searchParams.get('bodyPart') || '',
      startDate: searchParams.get('startDate') || defaultDates.startDate,
      endDate: searchParams.get('endDate') || defaultDates.endDate,
      status: searchParams.get('status') || 'all',
      gender: {
        M: genderParam === 'M' || genderParam === 'MF',
        F: genderParam === 'F' || genderParam === 'MF',
      },
      hospital: searchParams.get('hospital') || '',
      centers: parseCentersFromUrl(searchParams.get('centers')),
      studyStatus: parseStudyStatusFromUrl(searchParams.get('studyStatus')),
      reportStatus: parseReportStatusFromUrl(searchParams.get('reportStatus')),
      modalities: parseModalitiesFromUrl(searchParams.get('modalities')),
    };
  }, [searchParams]);

  // Setter for activeTab
  const setActiveTab = useCallback((tab: TabType) => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      newParams.set('tab', tab);
      return newParams;
    });
  }, [setSearchParams]);

  // Setter for activePeriod
  const setActivePeriod = useCallback((period: string) => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      newParams.set('period', period);
      return newParams;
    });
  }, [setSearchParams]);

  // Handler for filter changes
  const onFilterChange = useCallback((newFilters: FilterState) => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);

      // Set text filters
      if (newFilters.patientName) {
        newParams.set('patientName', newFilters.patientName);
      } else {
        newParams.delete('patientName');
      }

      if (newFilters.patientId) {
        newParams.set('patientId', newFilters.patientId);
      } else {
        newParams.delete('patientId');
      }

      if (newFilters.bodyPart) {
        newParams.set('bodyPart', newFilters.bodyPart);
      } else {
        newParams.delete('bodyPart');
      }

      if (newFilters.startDate) {
        newParams.set('startDate', newFilters.startDate);
      } else {
        newParams.delete('startDate');
      }

      if (newFilters.endDate) {
        newParams.set('endDate', newFilters.endDate);
      } else {
        newParams.delete('endDate');
      }

      if (newFilters.status && newFilters.status !== 'all') {
        newParams.set('status', newFilters.status);
      } else {
        newParams.delete('status');
      }

      // Handle report status
      const reportStatusStr = serializeReportStatusToUrl(newFilters.reportStatus);
      if (reportStatusStr) {
        newParams.set('reportStatus', reportStatusStr);
      } else {
        newParams.delete('reportStatus');
      }

      // Handle gender
      if (newFilters.gender.M && newFilters.gender.F) {
        newParams.set('gender', 'MF');
      } else if (newFilters.gender.M) {
        newParams.set('gender', 'M');
      } else if (newFilters.gender.F) {
        newParams.set('gender', 'F');
      } else {
        newParams.delete('gender');
      }

      // Handle modalities
      const modalitiesStr = serializeModalitiesToUrl(newFilters.modalities);
      if (modalitiesStr) {
        newParams.set('modalities', modalitiesStr);
      } else {
        newParams.delete('modalities');
      }

      // Handle centers
      const centersStr = serializeCentersToUrl(newFilters.centers || []);
      if (centersStr) {
        newParams.set('centers', centersStr);
      } else {
        newParams.delete('centers');
      }

      // Handle study status
      const studyStatusStr = serializeStudyStatusToUrl(newFilters.studyStatus || { reported: false, drafted: false, unreported: false, reviewed: false });
      if (studyStatusStr) {
        newParams.set('studyStatus', studyStatusStr);
      } else {
        newParams.delete('studyStatus');
      }

      return newParams;
    });
  }, [setSearchParams]);

  // Handler for filter reset
  const onFilterReset = useCallback(() => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      // Remove all filter params
      newParams.delete('patientName');
      newParams.delete('patientId');
      newParams.delete('bodyPart');
      newParams.delete('startDate');
      newParams.delete('endDate');
      newParams.delete('status');
      newParams.delete('reportStatus');
      newParams.delete('gender');
      newParams.delete('modalities');
      newParams.delete('centers');
      newParams.delete('studyStatus');
      // Reset period to default
      newParams.set('period', '1M');
      return newParams;
    });
  }, [setSearchParams]);



  const handleNoteSuccess = () => {
    toast.success('Note added successfully for patient');
  };

  return (
    <div className="min-h-screen flex flex-col gap-2">

      <DoctorDashboardHeader
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isFilterCollapsed={isFilterCollapsed}
        setIsFilterCollapsed={setIsFilterCollapsed}
        onFilterChange={onFilterChange}
        onFilterReset={onFilterReset}
        setActivePeriod={setActivePeriod}
        activePeriod={activePeriod}
        filters={filters}
        availableCenters={availableCenters}
      />

      <div className='flex flex-col gap-2 px-4 py-2 rounded-2xl bg-white'>
        <AssignedPatientsTable
          setSelectedPatient={setSelectedPatient}
          setMessageDialogOpen={setMessageDialogOpen}
          setDocumentDialogOpen={setDocumentDialogOpen}
          filters={filters}
          activeTab={activeTab}
        />
      </div>



      <MessageDialog
        open={messageDialogOpen}
        onOpenChange={setMessageDialogOpen}
        patient={selectedPatient}
        onSuccess={handleNoteSuccess}
      />

      {/* Document Dialog */}
      <DocumentDialog
        open={documentDialogOpen}
        onOpenChange={setDocumentDialogOpen}
        patient={selectedPatient}
      />
    </div>
  );
};

export default DoctorDashboard;