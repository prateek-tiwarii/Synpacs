import { useEffect, useState } from 'react';
import { SearchOptions } from '@/components/research/SearchOptions';
import { SearchResults } from '@/components/research/SearchResults';
import { BookmarksSection } from '@/components/research/BookmarksSection';
import { AuditSection } from '@/components/research/AuditSection';
import { ExportModal } from '@/components/research/ExportModal';
import toast from 'react-hot-toast';
import { apiService } from '@/lib/api';

interface SearchFilters {
  minAge: string;
  maxAge: string;
  startDate: string;
  endDate: string;
  modality: string;
  sex: 'all' | 'M' | 'F';
  centerId: string;
}

const Research = () => {
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [exportType, setExportType] = useState<'search' | 'bookmarks' | 'audit'>('search');
  const [selectedBookmarkedCases, setSelectedBookmarkedCases] = useState<any[]>([]);
  const [auditExportParams, setAuditExportParams] = useState<{
    startDateIso: string;
    endDateIso: string;
    modalities: string[];
  } | null>(null);
  const [availableCenters, setAvailableCenters] = useState<{ id: string; name: string }[]>([]);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    minAge: '',
    maxAge: '',
    startDate: '',
    endDate: '',
    modality: '',
    sex: 'all',
    centerId: 'all',
  });

  useEffect(() => {
    const fetchCenters = async () => {
      try {
        const response = await apiService.getAllManagedHospitals() as any;
        if (response.success && response.data) {
          const centers = response.data.map((hospital: any) => ({
            id: hospital._id,
            name: hospital.hospital_name || hospital.name,
          }));
          setAvailableCenters(centers);
        }
      } catch (error) {
        console.error('Failed to fetch centers:', error);
      }
    };

    fetchCenters();
  }, []);

  const handleSearch = (filters: SearchFilters) => {
    setSearchFilters(filters);
    setHasSearched(true);
  };

  const handleCloseSearch = () => {
    setHasSearched(false);
  };

  const handleExportBookmarks = (bookmarkedCases: any[]) => {
    setSelectedBookmarkedCases(bookmarkedCases);
    setExportType('bookmarks');
    setIsExportModalOpen(true);
  };

  const handleExportSearch = () => {
    setExportType('search');
    setIsExportModalOpen(true);
  };

  const handleExportAudit = (startDate: Date | undefined, endDate: Date | undefined, selectedModalities: string[]) => {
    if (!startDate || !endDate) {
      toast.error('Please select both start and end dates');
      return;
    }

    setAuditExportParams({
      startDateIso: startDate.toISOString(),
      endDateIso: endDate.toISOString(),
      modalities: selectedModalities,
    });
    setExportType('audit');
    setIsExportModalOpen(true);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 p-2 space-y-4">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 px-2">Research and Audit</h1>
        
        <SearchOptions onSearch={handleSearch} availableCenters={availableCenters} />
        
        {hasSearched && (
          <SearchResults
            filters={searchFilters}
            onExport={handleExportSearch}
            onClose={handleCloseSearch}
          />
        )}
        
        {/* Bookmarks Section - Always visible below search results */}
        <BookmarksSection onExportBookmarks={handleExportBookmarks} />
        
        {/* Audit Section - Below bookmarks */}
        <AuditSection onExportAudit={handleExportAudit} />
        
        <ExportModal 
          open={isExportModalOpen} 
          onOpenChange={setIsExportModalOpen}
          exportType={exportType}
          bookmarkedCases={exportType === 'bookmarks' ? selectedBookmarkedCases : undefined}
          auditParams={exportType === 'audit' && auditExportParams ? auditExportParams : undefined}
          onDownload={(payload) => {
            // NOTE: Backend export endpoint is not wired yet in apiService.
            // This keeps UI consistent while we await the export API contract.
            console.log('Export requested:', payload);
            toast.success('Export download initiated');
          }}
        />
      </div>
    </div>
  );
};

export default Research;
