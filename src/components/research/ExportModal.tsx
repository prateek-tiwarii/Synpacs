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
  exportType?: 'search' | 'bookmarks';
  bookmarkedCases?: any[];
}

export const ExportModal: React.FC<ExportModalProps> = ({ 
  open, 
  onOpenChange, 
  exportType = 'search',
  bookmarkedCases = []
}) => {
  const [fileFormat, setFileFormat] = useState('excel');
  const [selectedColumns, setSelectedColumns] = useState({
    patientId: true,
    patientName: true,
    age: true,
    sex: true,
    modality: true,
    case: true,
    studyDate: true,
    accessionNumber: true,
    center: true,
    referringDoctor: true,
  });
  
  const [includeBookmarkNotes, setIncludeBookmarkNotes] = useState(true);

  const handleColumnToggle = (column: string) => {
    setSelectedColumns(prev => ({ ...prev, [column]: !(prev as any)[column] }));
  };

  const exportCount = exportType === 'bookmarks' ? bookmarkedCases.length : 'all filtered';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Export - {exportType === 'bookmarks' ? 'Bookmarked Cases' : 'Patient Results'}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="format" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
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
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="patientId" 
                    checked={selectedColumns.patientId}
                    onCheckedChange={() => handleColumnToggle('patientId')}
                  />
                  <Label htmlFor="patientId" className="cursor-pointer">Patient ID</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="patientName" 
                    checked={selectedColumns.patientName}
                    onCheckedChange={() => handleColumnToggle('patientName')}
                  />
                  <Label htmlFor="patientName" className="cursor-pointer">Patient Name</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="age" 
                    checked={selectedColumns.age}
                    onCheckedChange={() => handleColumnToggle('age')}
                  />
                  <Label htmlFor="age" className="cursor-pointer">Age</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="sex" 
                    checked={selectedColumns.sex}
                    onCheckedChange={() => handleColumnToggle('sex')}
                  />
                  <Label htmlFor="sex" className="cursor-pointer">Sex</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="modality" 
                    checked={selectedColumns.modality}
                    onCheckedChange={() => handleColumnToggle('modality')}
                  />
                  <Label htmlFor="modality" className="cursor-pointer">Modality</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="case" 
                    checked={selectedColumns.case}
                    onCheckedChange={() => handleColumnToggle('case')}
                  />
                  <Label htmlFor="case" className="cursor-pointer">Case</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="studyDate" 
                    checked={selectedColumns.studyDate}
                    onCheckedChange={() => handleColumnToggle('studyDate')}
                  />
                  <Label htmlFor="studyDate" className="cursor-pointer">Study Date</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="accessionNumber" 
                    checked={selectedColumns.accessionNumber}
                    onCheckedChange={() => handleColumnToggle('accessionNumber')}
                  />
                  <Label htmlFor="accessionNumber" className="cursor-pointer">Accession Number</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="center" 
                    checked={selectedColumns.center}
                    onCheckedChange={() => handleColumnToggle('center')}
                  />
                  <Label htmlFor="center" className="cursor-pointer">Center</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="referringDoctor" 
                    checked={selectedColumns.referringDoctor}
                    onCheckedChange={() => handleColumnToggle('referringDoctor')}
                  />
                  <Label htmlFor="referringDoctor" className="cursor-pointer">Referring Doctor</Label>
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
              // TODO: Implement actual export logic
              console.log('Exporting...', { 
                fileFormat, 
                selectedColumns, 
                exportType,
                includeBookmarkNotes: exportType === 'bookmarks' ? includeBookmarkNotes : false,
                data: exportType === 'bookmarks' ? bookmarkedCases : []
              });
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
