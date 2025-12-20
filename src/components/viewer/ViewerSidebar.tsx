import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, Image, Loader2 } from 'lucide-react';
import { apiService } from '@/lib/api';

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

interface CaseData {
    _id: string;
    study_uid: string;
    body_part: string;
    description: string;
    modality: string;
    study_date: string;
    patient: Patient;
    series: Series[];
    series_count: number;
    instance_count: number;
}

const formatStudyDate = (dateStr: string) => {
    if (!dateStr || dateStr.length !== 8) return dateStr;
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

// Generate a consistent color based on series description
const getSeriesColor = (description: string): string => {
    const colors = ['#2a2a3a', '#3a2a2a', '#2a3a2a', '#2a3a3a', '#3a3a2a', '#3a2a3a', '#2a2a4a', '#4a2a2a'];
    let hash = 0;
    for (let i = 0; i < description.length; i++) {
        hash = description.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

interface SeriesThumbnailProps {
    series: Series;
    isSelected: boolean;
    onClick: () => void;
}

const SeriesThumbnail = ({ series, isSelected, onClick }: SeriesThumbnailProps) => (
    <div
        onClick={onClick}
        className={`cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${isSelected ? 'border-blue-500 ring-2 ring-blue-500/50' : 'border-gray-700 hover:border-gray-500'
            }`}
    >
        {/* Mock CT Image Thumbnail */}
        <div
            className="h-24 flex items-center justify-center relative"
            style={{ backgroundColor: getSeriesColor(series.description) }}
        >
            {/* Simulated CT scan appearance */}
            <div className="absolute inset-2 rounded-full border border-gray-500/30 flex items-center justify-center">
                <div className="w-1/2 h-1/2 rounded-full bg-gradient-radial from-gray-400/20 to-transparent" />
            </div>
            <Image size={32} className="text-gray-500/50 absolute" />

            {/* Modality badge */}
            <span className="absolute top-1 left-1 text-[10px] bg-black/60 px-1 rounded text-white font-mono">
                {series.modality}
            </span>

            {/* Image count */}
            <span className="absolute bottom-1 right-1 text-[10px] bg-black/60 px-1 rounded text-white font-mono">
                {series.image_count} imgs
            </span>
        </div>

        {/* Series info */}
        <div className="bg-gray-800 p-2">
            <p className="text-xs text-white font-medium truncate">Series {series.series_number}</p>
            <p className="text-[10px] text-gray-400 truncate">{series.description}</p>
        </div>
    </div>
);

interface StudyAccordionProps {
    title: string;
    studyDate: string;
    seriesCount: number;
    children: React.ReactNode;
    defaultOpen?: boolean;
}

const StudyAccordion = ({ title, studyDate, seriesCount, children, defaultOpen = true }: StudyAccordionProps) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="border-b border-gray-700">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center gap-2 p-3 hover:bg-gray-800 transition-colors text-left"
            >
                {isOpen ? (
                    <ChevronDown size={16} className="text-gray-400" />
                ) : (
                    <ChevronRight size={16} className="text-gray-400" />
                )}
                <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{title}</p>
                    <p className="text-xs text-gray-400">{studyDate} • {seriesCount} series</p>
                </div>
            </button>
            {isOpen && (
                <div className="p-3 pt-0">
                    {children}
                </div>
            )}
        </div>
    );
};

const ViewerSidebar = () => {
    const { id } = useParams();
    const [selectedSeries, setSelectedSeries] = useState<string>('');
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
                    // Select the first series with the most images by default
                    if (response.data.series && response.data.series.length > 0) {
                        const sortedSeries = [...response.data.series].sort((a, b) => b.image_count - a.image_count);
                        setSelectedSeries(sortedSeries[0]._id);
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

    const selectedSeriesData = caseData?.series.find(s => s._id === selectedSeries);

    if (loading) {
        return (
            <aside className="w-64 bg-gray-900 border-r border-gray-700 flex flex-col h-[calc(100vh-88px)] items-center justify-center">
                <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                <p className="text-gray-400 text-sm mt-2">Loading...</p>
            </aside>
        );
    }

    if (error || !caseData) {
        return (
            <aside className="w-64 bg-gray-900 border-r border-gray-700 flex flex-col h-[calc(100vh-88px)] items-center justify-center p-4">
                <p className="text-red-400 text-sm text-center">{error || 'No data available'}</p>
            </aside>
        );
    }

    return (
        <aside className="w-64 bg-gray-900 border-r border-gray-700 flex flex-col h-[calc(100vh-88px)] overflow-hidden">
            {/* Header */}
            <div className="p-3 border-b border-gray-700">
                <h2 className="text-sm font-semibold text-white">Study Navigator</h2>
                <p className="text-xs text-gray-400 mt-1">{caseData.series_count} series • {caseData.instance_count} images</p>
            </div>

            {/* Series List */}
            <div className="flex-1 overflow-y-auto">
                <StudyAccordion
                    title={caseData.description}
                    studyDate={formatStudyDate(caseData.study_date)}
                    seriesCount={caseData.series_count}
                    defaultOpen
                >
                    <div className="grid grid-cols-2 gap-2">
                        {caseData.series
                            .sort((a, b) => a.series_number - b.series_number)
                            .map((series) => (
                                <SeriesThumbnail
                                    key={series._id}
                                    series={series}
                                    isSelected={selectedSeries === series._id}
                                    onClick={() => setSelectedSeries(series._id)}
                                />
                            ))}
                    </div>
                </StudyAccordion>
            </div>

            {/* Footer with info */}
            <div className="p-3 border-t border-gray-700 bg-gray-800/50">
                <div className="text-xs text-gray-400 space-y-1">
                    <div className="flex justify-between">
                        <span>Selected:</span>
                        <span className="text-white truncate ml-2">
                            {selectedSeriesData?.description || 'None'}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span>Images:</span>
                        <span className="text-white">{selectedSeriesData?.image_count || 0}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Modality:</span>
                        <span className="text-white">{selectedSeriesData?.modality || 'N/A'}</span>
                    </div>
                </div>
            </div>
        </aside>
    );
};

export default ViewerSidebar;