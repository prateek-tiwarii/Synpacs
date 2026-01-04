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

export type ViewerTool = 'Stack' | 'Pan' | 'Zoom' | 'Length' | 'Ellipse' | 'Rectangle' | 'Freehand' | 'Text';

export interface ViewTransform {
    x: number;
    y: number;
    scale: number;
    rotation: number;
    flipH: boolean;
    flipV: boolean;
}

export interface Annotation {
    id: string;
    type: 'Length' | 'Ellipse' | 'Rectangle' | 'Freehand' | 'Text';
    points: { x: number, y: number }[];
    text?: string;
    color: string;
}

interface ViewerContextType {
    caseData: CaseData | null;
    selectedSeries: Series | null;
    setSelectedSeries: (series: Series | null) => void;
    loading: boolean;
    error: string | null;
    currentImageIndex: number;
    setCurrentImageIndex: (index: number) => void;
    activeTool: ViewerTool;
    setActiveTool: (tool: ViewerTool) => void;
    viewTransform: ViewTransform;
    setViewTransform: (transform: ViewTransform | ((prev: ViewTransform) => ViewTransform)) => void;
    annotations: Annotation[];
    setAnnotations: (annotations: Annotation[] | ((prev: Annotation[]) => Annotation[])) => void;
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    saveToHistory: () => void;
    isFullscreen: boolean;
    setIsFullscreen: (full: boolean) => void;
    toggleFullscreen: () => void;
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
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [activeTool, setActiveTool] = useState<ViewerTool>('Stack');
    const [viewTransform, setViewTransform] = useState<ViewTransform>({
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
        flipH: false,
        flipV: false
    });
    const [annotations, setAnnotations] = useState<Annotation[]>([]);
    const [history, setHistory] = useState<{ annotations: Annotation[], transform: ViewTransform }[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    };

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const saveToHistory = () => {
        const newState = { annotations: [...annotations], transform: { ...viewTransform } };
        setHistory(prev => {
            const newHistory = prev.slice(0, historyIndex + 1);
            return [...newHistory, newState];
        });
        setHistoryIndex(prev => prev + 1);
    };

    const undo = () => {
        if (historyIndex > 0) {
            const prevState = history[historyIndex - 1];
            setAnnotations(prevState.annotations);
            setViewTransform(prevState.transform);
            setHistoryIndex(prev => prev - 1);
        } else if (historyIndex === 0) {
            setAnnotations([]);
            setViewTransform({ x: 0, y: 0, scale: 1, rotation: 0, flipH: false, flipV: false });
            setHistoryIndex(-1);
        }
    };

    const redo = () => {
        if (historyIndex < history.length - 1) {
            const nextState = history[historyIndex + 1];
            setAnnotations(nextState.annotations);
            setViewTransform(nextState.transform);
            setHistoryIndex(prev => prev + 1);
        }
    };

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
        currentImageIndex,
        setCurrentImageIndex,
        activeTool,
        setActiveTool,
        viewTransform,
        setViewTransform,
        annotations,
        setAnnotations,
        undo,
        redo,
        canUndo: historyIndex >= 0,
        canRedo: historyIndex < history.length - 1,
        saveToHistory,
        isFullscreen,
        setIsFullscreen,
        toggleFullscreen,
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
            <div className="min-h-screen w-full bg-black text-white flex flex-col h-screen overflow-hidden">
                <ViewerHeader />
                <div className='flex flex-1 min-h-0 overflow-hidden'>
                    {!isFullscreen && <ViewerSidebar />}
                    <main className="flex-1 min-w-0">
                        <Outlet />
                    </main>
                </div>
            </div>
        </ViewerContext.Provider>
    )
}
