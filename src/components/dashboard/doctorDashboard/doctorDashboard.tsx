import { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import DoctorDashboardHeader from './molecules/DoctorDashboardHeader';
import MessageDialog from './molecules/MessageDialog';
import DocumentDialog from './molecules/DocumentDialog';
import AssignedPatientsTable from './molecules/AssignedPatientsTable';
import type { Patient } from '@/components/patient/PacDetailsModal';
import type { FilterState } from '@/components/common/FilterPanel';
import { toast } from 'react-hot-toast';

type TabType = 'Unreported' | 'Reported' | 'All Cases' | 'Drafted';

const DEFAULT_MODALITIES = {
  ALL: false, DT: false, SC: false, AN: false,
  US: false, ECHO: false, CR: false, XA: false,
  MR: false, CTMR: false, PX: false, DX: false,
  MR2: false, NM: false, RF: false, CT: false,
};

const VALID_TABS: TabType[] = ['Unreported', 'Reported', 'All Cases', 'Drafted'];
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

const DoctorDashboard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isFilterCollapsed, setIsFilterCollapsed] = useState(false);
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

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
    return '1W';
  }, [searchParams]);

  // Helper to get default dates (7 days ago to today)
  const getDefaultDates = () => {
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    return {
      startDate: formatDate(sevenDaysAgo),
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
      newParams.delete('gender');
      newParams.delete('modalities');
      // Reset period to default
      newParams.set('period', '1W');
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
      />

      <div className='flex flex-col gap-2 p-4 rounded-2xl bg-white'>
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