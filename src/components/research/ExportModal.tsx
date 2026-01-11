import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ open, onOpenChange }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Export - Patient Results</DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* File Format */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">File Format</h3>
            <RadioGroup defaultValue="excel">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="excel" id="excel" />
                <Label htmlFor="excel">.xlsx (Excel)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="word" id="word" />
                <Label htmlFor="word">.docx (Word)</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Columns to Include */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Columns to Include</h3>
            <div className="grid gap-2">
              <div className="flex items-center space-x-2">
                <Checkbox id="patientId" defaultChecked />
                <Label htmlFor="patientId">Patient ID</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="patientName" defaultChecked />
                <Label htmlFor="patientName">Patient Name</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="age" defaultChecked />
                <Label htmlFor="age">Age</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="sex" defaultChecked />
                <Label htmlFor="sex">Sex</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="modality" defaultChecked />
                <Label htmlFor="modality">Modality</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="case" defaultChecked />
                <Label htmlFor="case">Case</Label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <span className="text-sm text-muted-foreground">Exporting all 3 filtered row(s)</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={() => onOpenChange(false)}>
              Download
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
