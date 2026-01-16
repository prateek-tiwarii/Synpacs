import React, { useState, useEffect } from 'react';
import { Download, FileOutput, History } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ReportVersionHistory } from './ReportVersionHistory';
import { apiService } from '@/lib/api';

interface PatientResult {
  _id: string;
  patientId: string;
  name: string;
  age: string;
  sex: string;
  modality: string;
  caseDescription: string;
  bodyPart: string;
  caseDate: string;
  reportId?: string;
}

interface SearchResultsProps {
  onExport: () => void;
}

export const SearchResults: React.FC<SearchResultsProps> = ({ onExport }) => {
  const [patients, setPatients] = useState<PatientResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiService.getAllCasesWithFilters(1, 50, {}) as any;

      if (response.success && response.data?.cases) {
        const mappedPatients: PatientResult[] = response.data.cases.map((caseItem: any) => {
          const calculateAge = (dob: string): string => {
            if (!dob || dob.length !== 8) return '';
            const year = parseInt(dob.substring(0, 4));
            const month = parseInt(dob.substring(4, 6)) - 1;
            const day = parseInt(dob.substring(6, 8));
            const birthDate = new Date(year, month, day);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
              age--;
            }
            return age.toString();
          };

          const formatCaseDate = (caseDate: string): string => {
            if (!caseDate || caseDate.length !== 8) return caseDate || '';
            const year = caseDate.substring(0, 4);
            const month = caseDate.substring(4, 6);
            const day = caseDate.substring(6, 8);
            return `${year}-${month}-${day}`;
          };

          // Get reportId from attached_report (can be string or object with _id)
          const getReportId = (attachedReport: any): string | undefined => {
            if (!attachedReport) return undefined;
            if (typeof attachedReport === 'string') return attachedReport;
            return attachedReport._id;
          };

          return {
            _id: caseItem._id,
            patientId: caseItem.patient?.patient_id || 'N/A',
            name: caseItem.patient?.name || 'N/A',
            age: calculateAge(caseItem.patient?.dob || ''),
            sex: caseItem.patient?.sex || '',
            modality: caseItem.modality || '',
            caseDescription: caseItem.description || '',
            bodyPart: caseItem.body_part || '',
            caseDate: formatCaseDate(caseItem.case_date),
            reportId: getReportId(caseItem.attached_report),
          };
        });
        setPatients(mappedPatients);
      } else {
        setError(response.message || 'Failed to fetch patients');
      }
    } catch (err: any) {
      console.error('Error fetching patients:', err);
      setError(err.message || 'Failed to fetch patients');
    } finally {
      setLoading(false);
    }
  };

  const handleViewHistory = (reportId: string) => {
    setSelectedReportId(reportId);
    setVersionHistoryOpen(true);
  };

  const handleCloseVersionHistory = () => {
    setVersionHistoryOpen(false);
    setSelectedReportId(null);
  };

  if (loading) {
    return (
      <Card className="border-black/20 shadow-sm">
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading patients...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-black/20 shadow-sm">
        <CardContent className="py-8 text-center text-red-500">
          Error: {error}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-black/20 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-xl font-bold">Patient Results</CardTitle>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{patients.length} results</span>
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
                <TableHead>Case</TableHead>
                <TableHead>Study Description</TableHead>
                <TableHead>Case Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {patients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    No patients found
                  </TableCell>
                </TableRow>
              ) : (
                patients.map((patient) => (
                  <TableRow key={patient._id}>
                    <TableCell>
                      <Checkbox />
                    </TableCell>
                    <TableCell className="font-medium">{patient.patientId}</TableCell>
                    <TableCell>{patient.name}</TableCell>
                    <TableCell>{patient.age}</TableCell>
                    <TableCell>{patient.sex}</TableCell>
                    <TableCell>{patient.modality}</TableCell>
                    <TableCell>{patient.caseDescription}</TableCell>
                    <TableCell>{patient.bodyPart}</TableCell>
                    <TableCell>{patient.caseDate}</TableCell>
                    <TableCell className="text-right">
                      {patient.reportId ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => handleViewHistory(patient.reportId!)}
                        >
                          <History size={14} />
                          History
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">No report</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedReportId && (
        <ReportVersionHistory
          reportId={selectedReportId}
          open={versionHistoryOpen}
          onClose={handleCloseVersionHistory}
        />
      )}
    </>
  );
};
