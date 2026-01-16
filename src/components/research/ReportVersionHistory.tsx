import React, { useState, useEffect } from 'react';
import { History, ChevronRight, FileText, User, Calendar } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiService } from '@/lib/api';
import { format } from 'date-fns';

interface ReportVersion {
  version_number: number;
  title: string;
  content: any;
  content_html?: string;
  content_plain_text?: string;
  impression?: string;
  modified_by?: {
    full_name: string;
    email: string;
  };
  modified_at: string;
  change_description?: string;
  is_current?: boolean;
}

interface VersionHistoryResponse {
  success: boolean;
  data: {
    current_version: number;
    total_versions: number;
    version_history: ReportVersion[];
  };
}

interface VersionDetailResponse {
  success: boolean;
  data: ReportVersion;
}

interface ReportVersionHistoryProps {
  reportId: string;
  open: boolean;
  onClose: () => void;
}

export const ReportVersionHistory: React.FC<ReportVersionHistoryProps> = ({
  reportId,
  open,
  onClose,
}) => {
  const [versions, setVersions] = useState<ReportVersion[]>([]);
  const [currentVersion, setCurrentVersion] = useState<number>(1);
  const [selectedVersion, setSelectedVersion] = useState<ReportVersion | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && reportId) {
      fetchVersionHistory();
    }
  }, [open, reportId]);

  const fetchVersionHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiService.request<VersionHistoryResponse>(
        `/api/v1/reports/${reportId}/versions`
      );

      if (response.success) {
        setCurrentVersion(response.data.current_version);
        const allVersions = [...response.data.version_history].sort(
          (a, b) => b.version_number - a.version_number
        );
        setVersions(allVersions);
      } else {
        setError('Failed to fetch version history');
      }
    } catch (err: any) {
      console.error('Error fetching version history:', err);
      setError(err.message || 'Failed to fetch version history');
    } finally {
      setLoading(false);
    }
  };

  const fetchVersionDetails = async (versionNumber: number) => {
    try {
      setDetailLoading(true);
      
      const response = await apiService.request<VersionDetailResponse>(
        `/api/v1/reports/${reportId}/versions/${versionNumber}`
      );

      if (response.success) {
        setSelectedVersion(response.data);
      }
    } catch (err: any) {
      console.error('Error fetching version details:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleVersionClick = (version: ReportVersion) => {
    fetchVersionDetails(version.version_number);
  };

  const handleClose = () => {
    setSelectedVersion(null);
    setVersions([]);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Report Version History
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-4 h-[600px]">
          {/* Version List */}
          <div className="w-1/3 border-r pr-4">
            <div className="mb-3">
              <p className="text-sm text-muted-foreground">
                Current Version: <span className="font-semibold text-foreground">v{currentVersion}</span>
              </p>
            </div>
            
            <ScrollArea className="h-[520px]">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-muted-foreground">Loading versions...</p>
                </div>
              ) : error ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-red-500 text-sm">{error}</p>
                </div>
              ) : versions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FileText className="w-8 h-8 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground text-sm">No previous versions</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    This is the first version of the report
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Current version button */}
                  <Button
                    variant={selectedVersion?.is_current ? "secondary" : "ghost"}
                    className="w-full justify-start text-left h-auto py-3"
                    onClick={() => fetchVersionDetails(currentVersion)}
                  >
                    <div className="flex flex-col items-start w-full">
                      <div className="flex items-center gap-2 w-full">
                        <span className="font-medium">Version {currentVersion}</span>
                        <Badge variant="default" className="text-xs">Current</Badge>
                        <ChevronRight className="w-4 h-4 ml-auto" />
                      </div>
                    </div>
                  </Button>

                  {/* Historical versions */}
                  {versions.map((version) => (
                    <Button
                      key={version.version_number}
                      variant={selectedVersion?.version_number === version.version_number ? "secondary" : "ghost"}
                      className="w-full justify-start text-left h-auto py-3"
                      onClick={() => handleVersionClick(version)}
                    >
                      <div className="flex flex-col items-start w-full">
                        <div className="flex items-center gap-2 w-full">
                          <span className="font-medium">Version {version.version_number}</span>
                          <ChevronRight className="w-4 h-4 ml-auto" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(version.modified_at), 'MMM dd, yyyy HH:mm')}
                        </p>
                        {version.change_description && (
                          <p className="text-xs text-muted-foreground truncate max-w-full">
                            {version.change_description}
                          </p>
                        )}
                      </div>
                    </Button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Version Details */}
          <div className="w-2/3 pl-2">
            {detailLoading ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">Loading version details...</p>
              </div>
            ) : selectedVersion ? (
              <ScrollArea className="h-[550px]">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        {selectedVersion.title || 'Untitled Report'}
                      </CardTitle>
                      <Badge variant={selectedVersion.is_current ? "default" : "secondary"}>
                        {selectedVersion.is_current ? 'Current' : `v${selectedVersion.version_number}`}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-2">
                      {selectedVersion.modified_by && (
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          <span>{selectedVersion.modified_by.full_name}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {format(new Date(selectedVersion.modified_at), 'MMM dd, yyyy HH:mm')}
                        </span>
                      </div>
                    </div>
                    {selectedVersion.change_description && (
                      <p className="text-sm text-muted-foreground mt-2 italic">
                        "{selectedVersion.change_description}"
                      </p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {selectedVersion.impression && (
                        <div>
                          <h4 className="font-semibold text-sm mb-1">Impression</h4>
                          <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                            {selectedVersion.impression}
                          </p>
                        </div>
                      )}
                      <div>
                        <h4 className="font-semibold text-sm mb-1">Report Content</h4>
                        <div 
                          className="prose prose-sm max-w-none bg-muted p-4 rounded-md overflow-auto max-h-[350px]"
                          dangerouslySetInnerHTML={{ 
                            __html: selectedVersion.content_html || selectedVersion.content_plain_text || 'No content available' 
                          }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </ScrollArea>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <FileText className="w-12 h-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">Select a version to view details</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
