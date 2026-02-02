import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  }) => void;
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
  const [selectedColumns, setSelectedColumns] = useState({
    patientId: true,
    patientName: true,
    dob: false,
    age: true,
    sex: true,
    modality: true,
    caseId: true,
    studyDate: true,
    studyTime: true,
    historyDate: true,
    reportingDate: true,
    accessionNumber: true,
    center: true,
    referringDoctor: true,
    imageCount: true,
    description: true,
    caseType: true,
    reported: true,
    status: false,
    priority: false,
    seriesCount: true,
    instanceCount: true,
  });
  
  const [includeBookmarkNotes, setIncludeBookmarkNotes] = useState(true);

  const handleColumnToggle = (column: string) => {
    setSelectedColumns(prev => ({ ...prev, [column]: !(prev as any)[column] }));
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
            <TabsTrigger value="format">Format</TabsTrigger>
            <TabsTrigger value="columns">Columns</TabsTrigger>
            {exportType === 'bookmarks' && (
              <TabsTrigger value="notes">Bookmark Notes</TabsTrigger>
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
              <div className="grid grid-cols-2 gap-3 max-h-100 overflow-y-auto pr-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="patientId" 
                    checked={selectedColumns.patientId}
                    onCheckedChange={() => handleColumnToggle('patientId')}
                  />
                  <Label htmlFor="patientId" className="cursor-pointer text-sm">Patient ID</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="patientName" 
                    checked={selectedColumns.patientName}
                    onCheckedChange={() => handleColumnToggle('patientName')}
                  />
                  <Label htmlFor="patientName" className="cursor-pointer text-sm">Patient Name</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="dob" 
                    checked={(selectedColumns as any).dob}
                    onCheckedChange={() => handleColumnToggle('dob')}
                  />
                  <Label htmlFor="dob" className="cursor-pointer text-sm">DOB</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="age" 
                    checked={selectedColumns.age}
                    onCheckedChange={() => handleColumnToggle('age')}
                  />
                  <Label htmlFor="age" className="cursor-pointer text-sm">Age</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="sex" 
                    checked={selectedColumns.sex}
                    onCheckedChange={() => handleColumnToggle('sex')}
                  />
                  <Label htmlFor="sex" className="cursor-pointer text-sm">Sex</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="modality" 
                    checked={selectedColumns.modality}
                    onCheckedChange={() => handleColumnToggle('modality')}
                  />
                  <Label htmlFor="modality" className="cursor-pointer text-sm">Modality</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="caseId" 
                    checked={(selectedColumns as any).caseId}
                    onCheckedChange={() => handleColumnToggle('caseId')}
                  />
                  <Label htmlFor="caseId" className="cursor-pointer text-sm">Case ID</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="studyDate" 
                    checked={selectedColumns.studyDate}
                    onCheckedChange={() => handleColumnToggle('studyDate')}
                  />
                  <Label htmlFor="studyDate" className="cursor-pointer text-sm">Study Date</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="studyTime" 
                    checked={(selectedColumns as any).studyTime}
                    onCheckedChange={() => handleColumnToggle('studyTime')}
                  />
                  <Label htmlFor="studyTime" className="cursor-pointer text-sm">Study Time</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="historyDate" 
                    checked={(selectedColumns as any).historyDate}
                    onCheckedChange={() => handleColumnToggle('historyDate')}
                  />
                  <Label htmlFor="historyDate" className="cursor-pointer text-sm">History Date & Time</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="reportingDate" 
                    checked={(selectedColumns as any).reportingDate}
                    onCheckedChange={() => handleColumnToggle('reportingDate')}
                  />
                  <Label htmlFor="reportingDate" className="cursor-pointer text-sm">Reporting Date & Time</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="accessionNumber" 
                    checked={selectedColumns.accessionNumber}
                    onCheckedChange={() => handleColumnToggle('accessionNumber')}
                  />
                  <Label htmlFor="accessionNumber" className="cursor-pointer text-sm">Accession Number</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="center" 
                    checked={selectedColumns.center}
                    onCheckedChange={() => handleColumnToggle('center')}
                  />
                  <Label htmlFor="center" className="cursor-pointer text-sm">Center</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="referringDoctor" 
                    checked={selectedColumns.referringDoctor}
                    onCheckedChange={() => handleColumnToggle('referringDoctor')}
                  />
                  <Label htmlFor="referringDoctor" className="cursor-pointer text-sm">Referring Doctor</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="imageCount" 
                    checked={(selectedColumns as any).imageCount}
                    onCheckedChange={() => handleColumnToggle('imageCount')}
                  />
                  <Label htmlFor="imageCount" className="cursor-pointer text-sm">Image Count</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="description" 
                    checked={(selectedColumns as any).description}
                    onCheckedChange={() => handleColumnToggle('description')}
                  />
                  <Label htmlFor="description" className="cursor-pointer text-sm">Study Description</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="caseType" 
                    checked={(selectedColumns as any).caseType}
                    onCheckedChange={() => handleColumnToggle('caseType')}
                  />
                  <Label htmlFor="caseType" className="cursor-pointer text-sm">Case Type</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="reported" 
                    checked={(selectedColumns as any).reported}
                    onCheckedChange={() => handleColumnToggle('reported')}
                  />
                  <Label htmlFor="reported" className="cursor-pointer text-sm">Reported</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="status" 
                    checked={(selectedColumns as any).status}
                    onCheckedChange={() => handleColumnToggle('status')}
                  />
                  <Label htmlFor="status" className="cursor-pointer text-sm">Status</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="priority" 
                    checked={(selectedColumns as any).priority}
                    onCheckedChange={() => handleColumnToggle('priority')}
                  />
                  <Label htmlFor="priority" className="cursor-pointer text-sm">Priority</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="seriesCount" 
                    checked={(selectedColumns as any).seriesCount}
                    onCheckedChange={() => handleColumnToggle('seriesCount')}
                  />
                  <Label htmlFor="seriesCount" className="cursor-pointer text-sm">Series Count</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="instanceCount" 
                    checked={(selectedColumns as any).instanceCount}
                    onCheckedChange={() => handleColumnToggle('instanceCount')}
                  />
                  <Label htmlFor="instanceCount" className="cursor-pointer text-sm">Instance Count</Label>
                </div>
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
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              const payload = {
                exportType,
                fileFormat,
                selectedColumns: selectedColumns as unknown as Record<string, boolean>,
                includeBookmarkNotes: exportType === 'bookmarks' ? includeBookmarkNotes : false,
                bookmarkedCases: exportType === 'bookmarks' ? bookmarkedCases : [],
                auditParams: exportType === 'audit' ? auditParams : undefined,
              };

              if (onDownload) {
                onDownload(payload);
              } else {
                // Backwards-compatible fallback until real export is wired everywhere.
                console.log('Exporting...', payload);
              }

              onOpenChange(false);
            }}>
              Download
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
