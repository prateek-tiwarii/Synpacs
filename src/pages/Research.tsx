import { useState } from 'react';
import { SearchOptions } from '@/components/research/SearchOptions';
import { SearchResults } from '@/components/research/SearchResults';
import { BookmarksSection } from '@/components/research/BookmarksSection';
import { AuditSection } from '@/components/research/AuditSection';
import { ExportModal } from '@/components/research/ExportModal';
import toast from 'react-hot-toast';

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

const Research = () => {
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [exportType, setExportType] = useState<'search' | 'bookmarks'>('search');
  const [selectedBookmarkedCases, setSelectedBookmarkedCases] = useState<any[]>([]);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    keywords: '',
    minAge: '',
    maxAge: '',
    center: '',
    startDate: '',
    endDate: '',
    modality: '',
    sex: { male: false, female: false },
  });

  const handleSearch = (filters: SearchFilters) => {
    setSearchFilters(filters);
    setHasSearched(true);
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

    // TODO: Implement audit export logic
    console.log('Audit Export:', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      modalities: selectedModalities,
    });

    toast.success('Audit export initiated');
    // You can open a modal or trigger download here
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 p-2 space-y-6">
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 px-2">Research and Audit</h1>
        
        <SearchOptions onSearch={handleSearch} />
        
        {hasSearched && <SearchResults filters={searchFilters} onExport={handleExportSearch} />}
        
        {/* Bookmarks Section - Always visible below search results */}
        <BookmarksSection onExportBookmarks={handleExportBookmarks} />
        
        {/* Audit Section - Below bookmarks */}
        <AuditSection onExportAudit={handleExportAudit} />
        
        <ExportModal 
          open={isExportModalOpen} 
          onOpenChange={setIsExportModalOpen}
          exportType={exportType}
          bookmarkedCases={exportType === 'bookmarks' ? selectedBookmarkedCases : undefined}
        />
      </div>
    </div>
  );
};

export default Research;
