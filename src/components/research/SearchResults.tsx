import React from 'react';
import { Download, FileOutput } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

interface PatientResult {
  id: string;
  patientId: string;
  name: string;
  age: number;
  sex: string;
  modality: string;
  study: string;
  center: string;
  reportedOn: string;
}

const dummyData: PatientResult[] = [
  { id: '1', patientId: 'PT-2024-001', name: 'John Smith', age: 45, sex: 'Male', modality: 'CT', study: 'Chest CT with contrast', center: 'City Hospital', reportedOn: '2024-01-15' },
  { id: '2', patientId: 'PT-2024-002', name: 'Sarah Johnson', age: 32, sex: 'Female', modality: 'MRI', study: 'Brain MRI without contrast', center: 'Metro Imaging', reportedOn: '2024-01-16' },
  { id: '3', patientId: 'PT-2024-003', name: 'Michael Brown', age: 67, sex: 'Male', modality: 'X-ray', study: 'Lumbar spine X-ray', center: 'Sunrise Center', reportedOn: '2024-01-17' },
];

interface SearchResultsProps {
  onExport: () => void;
}

export const SearchResults: React.FC<SearchResultsProps> = ({ onExport }) => {
  return (
    <Card className="border-black/20 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-xl font-bold">Patient Results</CardTitle>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">3 results</span>
          <Button variant="outline" className="gap-2">
            <Download size={16} />
            Download Reports
          </Button>
          <Button onClick={onExport} className="gap-2">
            <FileOutput size={16} />
            Export
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox />
              </TableHead>
              <TableHead>Patient ID</TableHead>
              <TableHead>Patient Name</TableHead>
              <TableHead>Age</TableHead>
              <TableHead>Sex</TableHead>
              <TableHead>Modality</TableHead>
              <TableHead>Study</TableHead>
              <TableHead>Center</TableHead>
              <TableHead>Reported On</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dummyData.map((patient) => (
              <TableRow key={patient.id}>
                <TableCell>
                  <Checkbox />
                </TableCell>
                <TableCell className="font-medium">{patient.patientId}</TableCell>
                <TableCell>{patient.name}</TableCell>
                <TableCell>{patient.age}</TableCell>
                <TableCell>{patient.sex}</TableCell>
                <TableCell>{patient.modality}</TableCell>
                <TableCell>{patient.study}</TableCell>
                <TableCell>{patient.center}</TableCell>
                <TableCell>{patient.reportedOn}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
