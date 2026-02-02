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
          onDownload={async (payload) => {
            try {
              // Build the API request payload
              const selectedColumns = Object.entries(payload.selectedColumns)
                .filter(([_, isSelected]) => isSelected)
                .map(([columnId]) => columnId);

              const apiPayload: Parameters<typeof apiService.exportData>[0] = {
                exportType: payload.exportType,
                fileFormat: payload.fileFormat as 'excel' | 'csv' | 'word',
                columns: selectedColumns,
              };

              // Add type-specific filters
              if (payload.exportType === 'search' && searchFilters) {
                apiPayload.searchFilters = {
                  minAge: searchFilters.minAge ? parseInt(searchFilters.minAge) : undefined,
                  maxAge: searchFilters.maxAge ? parseInt(searchFilters.maxAge) : undefined,
                  startDate: searchFilters.startDate || undefined,
                  endDate: searchFilters.endDate || undefined,
                  modality: searchFilters.modality || undefined,
                  sex: searchFilters.sex !== 'all' ? searchFilters.sex : null,
                  centerId: searchFilters.centerId !== 'all' ? searchFilters.centerId : null,
                  reportedOnly: true,
                };
              } else if (payload.exportType === 'bookmarks' && payload.bookmarkedCases) {
                apiPayload.bookmarkOptions = {
                  caseIds: payload.bookmarkedCases.map((c: any) => c._id),
                  includeNotes: payload.includeBookmarkNotes,
                };
              } else if (payload.exportType === 'audit' && payload.auditParams) {
                apiPayload.auditFilters = {
                  startDate: payload.auditParams.startDateIso,
                  endDate: payload.auditParams.endDateIso,
                  modalities: payload.auditParams.modalities,
                };
              }

              // Call the export API
              const blob = await apiService.exportData(apiPayload);

              // Generate filename
              const fileExtension = payload.fileFormat === 'excel' ? 'xlsx' : payload.fileFormat === 'word' ? 'docx' : 'csv';
              const timestamp = new Date().toISOString().split('T')[0];
              const filename = `export_${payload.exportType}_${timestamp}.${fileExtension}`;

              // Trigger download
              apiService.downloadBlob(blob, filename);
              toast.success('Export downloaded successfully');
            } catch (error) {
              console.error('Export failed:', error);
              toast.error(error instanceof Error ? error.message : 'Export failed');
            }
          }}
        />
      </div>
    </div>
  );
};

export default Research;
