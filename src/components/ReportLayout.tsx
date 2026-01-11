import { Outlet, useParams } from 'react-router-dom';
import { createContext, useContext, useState, useEffect } from 'react';
import { apiService } from '@/lib/api';
import { Loader2 } from 'lucide-react';

interface Series {
    _id: string;
    series_uid: string;
    description: string;
    modality: string;
    series_number: number;
    case_id: string;
    image_count: number;
}

interface Patient {
    _id: string;
    patient_id: string;
    date_of_birth: string;
    name: string;
    sex: string;
}

interface AssignedTo {
    _id: string;
    email: string;
    full_name: string;
    role: string;
}

interface CaseData {
    _id: string;
    case_uid: string;
    accession_number: string;
    body_part: string;
    description: string;
    hospital_id: string;
    modality: string;
    patient_id: string;
    case_date: string;
    case_time: string;
    assigned_to: AssignedTo;
    case_type: string;
    priority: string;
    status: string;
    updatedAt: string;
    isBookmarked: boolean;
    patient: Patient;
    series: Series[];
    series_count: number;
    instance_count: number;
}

interface ReportData {
    _id: string;
    case_id: CaseData;
    patient_id: Patient;
    assigned_to: AssignedTo;
    hospital_id: string;
    content: Record<string, any>;
    content_html: string;
    content_plain_text: string;
    title: string;
    template_id?: string;
    impression?: string;
    is_draft: boolean;
    is_reviewed: boolean;
    is_signed_off: boolean;
    createdAt: string;
    updatedAt: string;
}

interface ReportContextType {
    reportData: ReportData | null;
    caseData: CaseData | null;
    loading: boolean;
    error: string | null;
}

const ReportContext = createContext<ReportContextType | undefined>(undefined);

export const useReportContext = () => {
    const context = useContext(ReportContext);
    if (!context) {
        throw new Error('useReportContext must be used within ReportLayout');
    }
    return context;
};

export function ReportLayout() {
    const { id } = useParams();
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [caseData, setCaseData] = useState<CaseData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!id) return;

            try {
                setLoading(true);
                setError(null);

                // Try to fetch report first
                const response = await apiService.getReportByCase(id) as { success: boolean; data: ReportData };
                if (response.success && response.data) {
                    setReportData(response.data);
                    setCaseData(response.data.case_id || null);
                }
            } catch (err: any) {
                // If report not found (404), fetch case data instead to allow creating a new report
                const isNotFound = err?.response?.status === 404 ||
                    err?.message?.includes('404') ||
                    err?.message?.includes('not found');

                if (isNotFound) {
                    try {
                        // Fetch case data so we can still show the report editor
                        const caseResponse = await apiService.getCaseById(id) as { success: boolean; data: CaseData };
                        if (caseResponse.success && caseResponse.data) {
                            setCaseData(caseResponse.data);
                            setReportData(null); // No existing report
                        } else {
                            setError('Case not found');
                        }
                    } catch (caseErr) {
                        setError(caseErr instanceof Error ? caseErr.message : 'Failed to fetch case data');
                    }
                } else {
                    setError(err instanceof Error ? err.message : 'Failed to fetch report data');
                }
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [id]);

    const contextValue: ReportContextType = {
        reportData,
        caseData,
        loading,
        error,
    };

    if (loading) {
        return (
            <div className="min-h-screen w-full bg-black flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                    <p className="text-gray-400">Loading report...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen w-full bg-black flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-400 mb-2">Error loading report</p>
                    <p className="text-gray-500 text-sm">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <ReportContext.Provider value={contextValue}>
            <div className="min-h-screen w-full bg-black text-white flex flex-col h-screen overflow-hidden">
                <Outlet />
            </div>
        </ReportContext.Provider>
    );
}

