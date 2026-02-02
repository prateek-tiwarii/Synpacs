import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

// Shared export columns configuration - used across all export locations
// These columns match the standard patient data columns displayed in tables
export const EXPORT_COLUMNS = [
  { id: 'patientId', label: 'Patient ID', defaultChecked: true },
  { id: 'patientName', label: 'Patient Name', defaultChecked: true },
  { id: 'dob', label: 'Date of Birth', defaultChecked: false },
  { id: 'age', label: 'Age', defaultChecked: true },
  { id: 'sex', label: 'Sex', defaultChecked: true },
  { id: 'modality', label: 'Modality', defaultChecked: true },
  { id: 'caseId', label: 'Case ID', defaultChecked: true },
  { id: 'studyDate', label: 'Study Date', defaultChecked: true },
  { id: 'studyTime', label: 'Study Time', defaultChecked: true },
  { id: 'historyDate', label: 'History Date & Time', defaultChecked: true },
  { id: 'reportingDate', label: 'Reporting Date & Time', defaultChecked: true },
  { id: 'accessionNumber', label: 'Accession Number', defaultChecked: true },
  { id: 'center', label: 'Center', defaultChecked: true },
  { id: 'referringDoctor', label: 'Referring Doctor', defaultChecked: true },
  { id: 'assignedDoctor', label: 'Assigned Doctor', defaultChecked: false },
  { id: 'imageCount', label: 'Image Count', defaultChecked: true },
  { id: 'description', label: 'Study Description', defaultChecked: true },
  { id: 'bodyPart', label: 'Body Part', defaultChecked: false },
  { id: 'caseType', label: 'Case Type', defaultChecked: true },
  { id: 'reported', label: 'Reported', defaultChecked: true },
  { id: 'reportStatus', label: 'Report Status (Draft/Final)', defaultChecked: false },
  { id: 'status', label: 'Status', defaultChecked: false },
  { id: 'priority', label: 'Priority', defaultChecked: false },
  { id: 'seriesCount', label: 'Series Count', defaultChecked: true },
  { id: 'instanceCount', label: 'Instance Count', defaultChecked: true },
] as const;

// Helper to get default selected columns
export const getDefaultExportColumns = (): Record<string, boolean> => {
  return EXPORT_COLUMNS.reduce((acc, col) => {
    acc[col.id] = col.defaultChecked;
    return acc;
  }, {} as Record<string, boolean>);
};

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exportType?: 'search' | 'bookmarks' | 'audit';
  bookmarkedCases?: any[];

  auditParams?: {
    startDateIso: string;
    endDateIso: string;
    modalities: string[];
  };

  onDownload?: (payload: {
    exportType: 'search' | 'bookmarks' | 'audit';
    fileFormat: string;
    selectedColumns: Record<string, boolean>;
    includeBookmarkNotes: boolean;
    bookmarkedCases?: any[];
    auditParams?: {
      startDateIso: string;
      endDateIso: string;
      modalities: string[];
    };
  }) => void | Promise<void>;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  open,
  onOpenChange,
  exportType = 'search',
  bookmarkedCases = [],
  auditParams,
  onDownload,
}) => {
  const [fileFormat, setFileFormat] = useState('excel');
  const [selectedColumns, setSelectedColumns] = useState<Record<string, boolean>>(getDefaultExportColumns);
  const [includeBookmarkNotes, setIncludeBookmarkNotes] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const handleColumnToggle = (column: string) => {
    setSelectedColumns(prev => ({ ...prev, [column]: !prev[column] }));
  };

  const exportTitle =
    exportType === 'bookmarks'
      ? 'Bookmarked Cases'
      : exportType === 'audit'
        ? 'Audit'
        : 'Patient Results';

  const exportCount =
    exportType === 'bookmarks'
      ? bookmarkedCases.length
      : exportType === 'audit'
        ? 'audit filtered'
        : 'all filtered';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-150 max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Export - {exportTitle}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="format" className="w-full">
          <TabsList className={`grid w-full ${exportType === 'bookmarks' ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <TabsTrigger value="format" className="flex-1">Format</TabsTrigger>
            <TabsTrigger value="columns" className="flex-1">Columns</TabsTrigger>
            {exportType === 'bookmarks' && (
              <TabsTrigger value="notes" className="flex-1">Bookmark Notes</TabsTrigger>
            )}
          </TabsList>

          {/* File Format Tab */}
          <TabsContent value="format" className="space-y-4 py-4">
            <div className="space-y-3">
              <h3 className="text-sm font-medium">File Format</h3>
              <RadioGroup value={fileFormat} onValueChange={setFileFormat}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="excel" id="excel" />
                  <Label htmlFor="excel" className="cursor-pointer">.xlsx (Excel)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="word" id="word" />
                  <Label htmlFor="word" className="cursor-pointer">.docx (Word)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="csv" id="csv" />
                  <Label htmlFor="csv" className="cursor-pointer">.csv (CSV)</Label>
                </div>
              </RadioGroup>
            </div>
          </TabsContent>

          {/* Columns Tab */}
          <TabsContent value="columns" className="space-y-4 py-4">
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Select Columns to Include</h3>
              <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-2">
                {EXPORT_COLUMNS.map((column) => (
                  <div key={column.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={column.id}
                      checked={selectedColumns[column.id] ?? false}
                      onCheckedChange={() => handleColumnToggle(column.id)}
                    />
                    <Label htmlFor={column.id} className="cursor-pointer text-sm">{column.label}</Label>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Bookmark Notes Tab - Only for bookmarks export */}
          {exportType === 'bookmarks' && (
            <TabsContent value="notes" className="space-y-4 py-4">
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Bookmark Notes & Comments</h3>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="includeNotes" 
                      checked={includeBookmarkNotes}
                      onCheckedChange={(checked) => setIncludeBookmarkNotes(checked as boolean)}
                    />
                    <Label htmlFor="includeNotes" className="cursor-pointer">
                      Include all bookmark notes and comments in export
                    </Label>
                  </div>
                  
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-xs text-blue-800">
                      <strong>Note:</strong> When enabled, all notes, flags, and comments associated with bookmarked cases will be exported in a separate column/section.
                    </p>
                  </div>

                  {bookmarkedCases.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm text-muted-foreground mb-2">Preview:</p>
                      <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-md p-2 bg-slate-50">
                        {bookmarkedCases.map((caseItem, index) => (
                          <div key={index} className="text-xs mb-2 last:mb-0">
                            <span className="font-medium">{caseItem.name}</span>
                            {caseItem.notes && caseItem.notes.length > 0 && (
                              <span className="text-slate-600"> - {caseItem.notes.length} note(s)</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <span className="text-sm text-muted-foreground">
            Exporting {exportCount} row(s)
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
              Cancel
            </Button>
            <Button
              disabled={isExporting}
              onClick={async () => {
                const payload = {
                  exportType,
                  fileFormat,
                  selectedColumns,
                  includeBookmarkNotes: exportType === 'bookmarks' ? includeBookmarkNotes : false,
                  bookmarkedCases: exportType === 'bookmarks' ? bookmarkedCases : [],
                  auditParams: exportType === 'audit' ? auditParams : undefined,
                };

                if (onDownload) {
                  setIsExporting(true);
                  try {
                    await onDownload(payload);
                    onOpenChange(false);
                  } catch {
                    // Error is handled in the onDownload callback
                  } finally {
                    setIsExporting(false);
                  }
                } else {
                  console.log('Exporting...', payload);
                  onOpenChange(false);
                }
              }}
            >
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                'Download'
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
