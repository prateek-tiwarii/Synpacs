import { useState } from 'react';
import DoctorDashboardHeader from './molecules/DoctorDashboardHeader';
import MessageDialog from './molecules/MessageDialog';
import DocumentDialog from './molecules/DocumentDialog';
import AssignedPatientsTable from './molecules/AssignedPatientsTable';
import type { Patient } from '@/components/patient/PacDetailsModal';
import type { VisibilityState } from '@tanstack/react-table';

interface FilterState {
  patientName: string;
  patientId: string;
  bodyPart: string;
  hospital: string;
  startDate: string;
  endDate: string;
  gender: {
    M: boolean;
    F: boolean;
  };
  modalities: {
    ALL: boolean;
    DT: boolean;
    SC: boolean;
    AN: boolean;
    US: boolean;
    ECHO: boolean;
    CR: boolean;
    XA: boolean;
    MR: boolean;
    CTMR: boolean;
    PX: boolean;
    DX: boolean;
    MR2: boolean;
    NM: boolean;
    RF: boolean;
    CT: boolean;
  };
}

const DoctorDashboard = () => {
  const [activeTab, setActiveTab] = useState<'Unreported' | 'Reported' | 'All Cases' | 'Drafted'>('Unreported');
  const [isFilterCollapsed, setIsFilterCollapsed] = useState(false);
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [activePeriod, setActivePeriod] = useState<string>('1D');
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    name: true,
    pac_patinet_id: true,
    age: true,
    sex: true,
    study_description: true,
    treatment_type: true,
    status: true,
    referring_doctor: true,
    date_of_capture: true,
    pac_images_count: true,
    hospital_id: false,
    accession_number: true,
  });

  const [_filters, setFilters] = useState<FilterState>({
    patientName: '',
    patientId: '',
    bodyPart: '',
    hospital: '',
    startDate: '',
    endDate: '',
    gender: { M: false, F: false },
    modalities: {
      ALL: false, DT: false, SC: false, AN: false,
      US: false, ECHO: false, CR: false, XA: false,
      MR: false, CTMR: false, PX: false, DX: false,
      MR2: false, NM: false, RF: false, CT: false,
    },
  });

  const onFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    console.log('Filters applied:', newFilters);
  };

  const onFilterReset = () => {
    setFilters({
      patientName: '',
      patientId: '',
      bodyPart: '',
      hospital: '',
      startDate: '',
      endDate: '',
      gender: { M: false, F: false },
      modalities: {
        ALL: false, DT: false, SC: false, AN: false,
        US: false, ECHO: false, CR: false, XA: false,
        MR: false, CTMR: false, PX: false, DX: false,
        MR2: false, NM: false, RF: false, CT: false,
      },
    });
    setActivePeriod('1D');
    console.log('Filters reset');
  };



  const handleNoteSuccess = () => {
    console.log('Note added successfully for patient:', selectedPatient?.name);
    // You can add a toast notification here or refresh patient data
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
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={setColumnVisibility}
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