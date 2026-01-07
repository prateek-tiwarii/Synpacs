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
    study_id: string;
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
    study_uid: string;
    accession_number: string;
    body_part: string;
    description: string;
    hospital_id: string;
    modality: string;
    patient_id: string;
    study_date: string;
    study_time: string;
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

interface ReportContextType {
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
    const [caseData, setCaseData] = useState<CaseData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchCaseData = async () => {
            if (!id) return;

            try {
                setLoading(true);
                setError(null);
                const response = await apiService.getCaseById(id) as { success: boolean; data: CaseData };
                if (response.success && response.data) {
                    setCaseData(response.data);
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch case data');
            } finally {
                setLoading(false);
            }
        };

        fetchCaseData();
    }, [id]);

    const contextValue: ReportContextType = {
        caseData,
        loading,
        error,
    };

    if (loading) {
        return (
            <div className="min-h-screen w-full bg-slate-100 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 text-cyan-600 animate-spin" />
                    <p className="text-slate-500">Loading report...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen w-full bg-slate-100 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-500 mb-2">Error loading report</p>
                    <p className="text-slate-500 text-sm">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <ReportContext.Provider value={contextValue}>
            <div className="min-h-screen w-full bg-slate-100 flex flex-col h-screen overflow-hidden">
                <Outlet />
            </div>
        </ReportContext.Provider>
    );
}
