import { useState } from 'react';
import DoctorDashboardHeader from './molecules/DoctorDashboardHeader';
import MessageDialog from './molecules/MessageDialog';
import DocumentDialog from './molecules/DocumentDialog';
import AssignedPatientsTable from './molecules/AssignedPatientsTable';
import type { Patient } from '@/components/patient/PacDetailsModal';
import type { FilterState } from '@/components/common/FilterPanel';
import { toast } from 'react-hot-toast';

const DoctorDashboard = () => {
  const [activeTab, setActiveTab] = useState<'Unreported' | 'Reported' | 'All Cases' | 'Drafted'>('Unreported');
  const [isFilterCollapsed, setIsFilterCollapsed] = useState(false);
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [activePeriod, setActivePeriod] = useState<string>('1D');

  const [_filters, setFilters] = useState<FilterState>({
    patientName: '',
    patientId: '',
    bodyPart: '',
    hospital: '',
    startDate: '',
    endDate: '',
    status: 'all',
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
  };

  const onFilterReset = () => {
    setFilters({
      patientName: '',
      patientId: '',
      bodyPart: '',
      hospital: '',
      startDate: '',
      endDate: '',
      status: 'all',
      gender: { M: false, F: false },
      modalities: {
        ALL: false, DT: false, SC: false, AN: false,
        US: false, ECHO: false, CR: false, XA: false,
        MR: false, CTMR: false, PX: false, DX: false,
        MR2: false, NM: false, RF: false, CT: false,
      },
    });
    setActivePeriod('1D');
  };



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
          filters={_filters}
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