import { Outlet, useParams } from 'react-router-dom'
import { createContext, useContext, useState, useEffect } from 'react'
import ViewerHeader from './viewer/ViewerHeader'
import ViewerSidebar from './viewer/ViewerSidebar'
import { apiService } from '@/lib/api'
import { Loader2 } from 'lucide-react'

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

interface ViewerContextType {
    caseData: CaseData | null;
    selectedSeries: Series | null;
    setSelectedSeries: (series: Series | null) => void;
    loading: boolean;
    error: string | null;
}

const ViewerContext = createContext<ViewerContextType | undefined>(undefined);

export const useViewerContext = () => {
    const context = useContext(ViewerContext);
    if (!context) {
        throw new Error('useViewerContext must be used within ViewerLayout');
    }
    return context;
};

export function ViewerLayout() {
    const { id } = useParams();
    const [caseData, setCaseData] = useState<CaseData | null>(null);
    const [selectedSeries, setSelectedSeries] = useState<Series | null>(null);
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
                    // Select series 1 by default, or the first series if series 1 doesn't exist
                    if (response.data.series && response.data.series.length > 0) {
                        const seriesOne = response.data.series.find(s => s.series_number === 1);
                        const defaultSeries = seriesOne || response.data.series[0];
                        setSelectedSeries(defaultSeries);
                    }
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch case data');
            } finally {
                setLoading(false);
            }
        };

        fetchCaseData();
    }, [id]);

    const contextValue: ViewerContextType = {
        caseData,
        selectedSeries,
        setSelectedSeries,
        loading,
        error,
    };

    if (loading) {
        return (
            <div className="min-h-screen w-full bg-black text-white flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                    <p className="text-gray-400">Loading study...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen w-full bg-black text-white flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-400 mb-2">Error loading study</p>
                    <p className="text-gray-500 text-sm">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <ViewerContext.Provider value={contextValue}>
            <div className="min-h-screen w-full bg-black text-white">
                <ViewerHeader />
                <div className='flex h-full'>
                    <ViewerSidebar />
                    <Outlet />
                </div>
            </div>
        </ViewerContext.Provider>
    )
}
