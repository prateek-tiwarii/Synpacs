import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Download, Loader2 } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { apiService } from '@/lib/api';

interface PatientDetailsProps {
    patientName: string;
    patientId: string;
    age: string;
    sex: string;
    referredBy: string;
    studyDate: string;
    studyDescription: string;
    modality: string;
}

interface PreviousStudy {
    _id: string;
    study_date: string;
    study_time?: string;
    modality: string;
    study_name: string;
    accession_number?: string;
    content?: Record<string, any>;
    content_html?: string;
    content_plain_text?: string;
    is_signed_off?: boolean;
    created_at: string;
    signed_off_at?: string;
}

interface LoadReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onReplace: () => void;
    onAppend: () => void;
    studyName: string;
}

function LoadReportModal({ isOpen, onClose, onReplace, onAppend, studyName }: LoadReportModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md bg-gray-800 border-gray-700 text-gray-100">
                <DialogHeader>
                    <DialogTitle className="text-gray-100">Load Previous Report</DialogTitle>
                    <DialogDescription className="text-gray-400">
                        How would you like to load "{studyName}"?
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-3 py-4">
                    <Button
                        onClick={onReplace}
                        className="w-full justify-start bg-red-600 hover:bg-red-700 text-white"
                    >
                        <span className="font-semibold">Replace Current Content</span>
                        <span className="ml-2 text-xs opacity-75">⚠️ This will overwrite all existing text</span>
                    </Button>
                    <Button
                        onClick={onAppend}
                        className="w-full justify-start bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        <span className="font-semibold">Append to Current Report</span>
                        <span className="ml-2 text-xs opacity-75">✓ Keeps existing text</span>
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export function PatientDetailsSection({ 
    patientName, 
    patientId, 
    age, 
    sex, 
    referredBy, 
    studyDate, 
    studyDescription, 
    modality,
    onLoadReport,
}: PatientDetailsProps & { onLoadReport?: (content: string, mode: 'replace' | 'append') => void }) {
    const [previousStudies, setPreviousStudies] = useState<PreviousStudy[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedStudy, setSelectedStudy] = useState<PreviousStudy | null>(null);
    const [showLoadModal, setShowLoadModal] = useState(false);

    useEffect(() => {
        const fetchPreviousStudies = async () => {
            if (!patientId || patientId === 'N/A') return;
            
            try {
                setLoading(true);
                // This API endpoint needs to be implemented in the backend
                const response: any = await apiService.request(`/api/v1/reports/patient/${patientId}`, {
                    method: 'GET',
                });
                
                if (response.success && response.data) {
                    // Sort by date, latest first
                    const sorted = response.data.sort((a: any, b: any) => 
                        new Date(b.study_date).getTime() - new Date(a.study_date).getTime()
                    );
                    setPreviousStudies(sorted);
                }
            } catch (error) {
                console.error('Failed to fetch previous studies:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchPreviousStudies();
    }, [patientId]);

    const handleOpenPdf = async (reportId: string) => {
        try {
            await apiService.downloadReport(reportId);
            // PDF download is handled by the API
            console.log('PDF download initiated for report:', reportId);
        } catch (error) {
            console.error('Failed to open PDF:', error);
        }
    };

    const handleLoadReport = (study: PreviousStudy) => {
        setSelectedStudy(study);
        setShowLoadModal(true);
    };

    const handleReplace = () => {
        if (selectedStudy && onLoadReport) {
            const content = selectedStudy.content_html || selectedStudy.content_plain_text || '';
            onLoadReport(content, 'replace');
        }
        setShowLoadModal(false);
        setSelectedStudy(null);
    };

    const handleAppend = () => {
        if (selectedStudy && onLoadReport) {
            const content = selectedStudy.content_html || selectedStudy.content_plain_text || '';
            onLoadReport(content, 'append');
        }
        setShowLoadModal(false);
        setSelectedStudy(null);
    };

    return (
        <div className="border border-gray-700 rounded-lg overflow-hidden bg-gray-900/50 mb-4">
            {/* Patient Details Section */}
            <div className="bg-gray-800 px-4 py-2 border-b border-gray-700">
                <h3 className="text-sm font-semibold text-gray-100">Patient Details</h3>
            </div>
            <div className="p-4">
                <table className="w-full text-sm">
                    <tbody>
                        <tr className="border-b border-gray-700/50">
                            <td className="py-2 pr-4 text-gray-400 font-medium w-1/4">Patient Name:</td>
                            <td className="py-2 text-gray-200">{patientName}</td>
                        </tr>
                        <tr className="border-b border-gray-700/50">
                            <td className="py-2 pr-4 text-gray-400 font-medium">Age / Sex:</td>
                            <td className="py-2 text-gray-200">{age} / {sex}</td>
                        </tr>
                        <tr className="border-b border-gray-700/50">
                            <td className="py-2 pr-4 text-gray-400 font-medium">Patient ID:</td>
                            <td className="py-2 text-gray-200">{patientId}</td>
                        </tr>
                        <tr className="border-b border-gray-700/50">
                            <td className="py-2 pr-4 text-gray-400 font-medium">Referring Consultant:</td>
                            <td className="py-2 text-gray-200">{referredBy}</td>
                        </tr>
                        <tr className="border-b border-gray-700/50">
                            <td className="py-2 pr-4 text-gray-400 font-medium">Study Date:</td>
                            <td className="py-2 text-gray-200">{studyDate}</td>
                        </tr>
                        <tr className="border-b border-gray-700/50">
                            <td className="py-2 pr-4 text-gray-400 font-medium">Study Description:</td>
                            <td className="py-2 text-gray-200">{studyDescription}</td>
                        </tr>
                        <tr>
                            <td className="py-2 pr-4 text-gray-400 font-medium">Modality:</td>
                            <td className="py-2 text-gray-200">{modality}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Previous Studies Section */}
            <div className="bg-gray-800 px-4 py-2 border-t border-gray-700">
                <h3 className="text-sm font-semibold text-gray-100">Previous Studies</h3>
            </div>
            <div className="p-4">
                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                        <span className="ml-2 text-sm text-gray-400">Loading previous studies...</span>
                    </div>
                ) : previousStudies.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">No previous studies found for this patient</p>
                ) : (
                    <div className="space-y-2">
                        {previousStudies.map((study) => (
                            <div 
                                key={study._id} 
                                className="flex items-center justify-between p-3 bg-gray-800/50 rounded border border-gray-700/50 hover:bg-gray-800 transition-colors"
                            >
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-200">{study.study_name}</p>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        {study.study_date} • {study.modality}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleOpenPdf(study._id)}
                                        className="h-7 px-2 text-xs border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
                                    >
                                        <Download size={12} className="mr-1" />
                                        PDF
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleLoadReport(study)}
                                        className="h-7 px-2 text-xs border-gray-600 text-gray-300 hover:bg-blue-600 hover:text-white hover:border-blue-600"
                                    >
                                        <FileText size={12} className="mr-1" />
                                        Load
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Load Report Modal */}
            {selectedStudy && (
                <LoadReportModal
                    isOpen={showLoadModal}
                    onClose={() => {
                        setShowLoadModal(false);
                        setSelectedStudy(null);
                    }}
                    onReplace={handleReplace}
                    onAppend={handleAppend}
                    studyName={selectedStudy.study_name}
                />
            )}
        </div>
    );
}
