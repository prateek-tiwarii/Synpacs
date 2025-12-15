import { useState } from 'react';
import { SearchOptions } from '@/components/research/SearchOptions';
import { SearchResults } from '@/components/research/SearchResults';
import { ExportModal } from '@/components/research/ExportModal';

const Research = () => {
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 p-2 space-y-6">
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 px-2">Research</h1>
        
        <SearchOptions />
        
        <SearchResults onExport={() => setIsExportModalOpen(true)} />
        
        <ExportModal 
          open={isExportModalOpen} 
          onOpenChange={setIsExportModalOpen} 
        />
      </div>
    </div>
  );
};

export default Research;
