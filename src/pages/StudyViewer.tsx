import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Play, Pause, SkipBack, SkipForward, Grid2X2, Layers, Loader2 } from "lucide-react";
import { apiService } from "@/lib/api";

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

const formatStudyDate = (dateStr: string) => {
    if (!dateStr || dateStr.length !== 8) return dateStr;
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const StudyViewer = () => {
    const { id } = useParams();
    const [currentSlice, setCurrentSlice] = useState(1);
    const [isPlaying, setIsPlaying] = useState(false);
    const [caseData, setCaseData] = useState<CaseData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedSeries, setSelectedSeries] = useState<Series | null>(null);

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
                        setSelectedSeries(sortedSeries[0]);
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

    const totalSlices = selectedSeries?.image_count || 1;

    const handlePrevSlice = () => setCurrentSlice((prev) => Math.max(1, prev - 1));
    const handleNextSlice = () => setCurrentSlice((prev) => Math.min(totalSlices, prev + 1));
    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCurrentSlice(Number(e.target.value));
    };

    // Expose for ViewerSidebar to use via context if needed later
    void setSelectedSeries;

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-black h-[calc(100vh-88px)]">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                    <p className="text-gray-400">Loading study...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex-1 flex items-center justify-center bg-black h-[calc(100vh-88px)]">
                <div className="text-center">
                    <p className="text-red-400 mb-2">Error loading study</p>
                    <p className="text-gray-500 text-sm">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-black h-[calc(100vh-88px)]">
            {/* Main viewport area */}
            <div className="flex-1 relative flex items-center justify-center">
                {/* DICOM Viewport Simulation */}
                <div className="relative w-full h-full max-w-4xl max-h-4xl m-4 bg-gray-950 rounded-lg border border-gray-800 overflow-hidden">
                    {/* Corner annotations - typical PACS overlays */}
                    <div className="absolute top-2 left-2 text-xs text-green-400 font-mono z-10 space-y-0.5">
                        <p>{caseData?.patient?.name || 'N/A'}</p>
                        <p>ID: {caseData?.patient?.patient_id || 'N/A'}</p>
                        <p>{caseData?.modality} {caseData?.body_part}</p>
                        <p>{formatStudyDate(caseData?.study_date || '')}</p>
                    </div>

                    <div className="absolute top-2 right-2 text-xs text-green-400 font-mono text-right z-10 space-y-0.5">
                        <p>AXIAL</p>
                        <p>W: 400 L: 50</p>
                        <p>{selectedSeries?.description || 'N/A'}</p>
                        <p>512 x 512</p>
                    </div>

                    <div className="absolute bottom-2 left-2 text-xs text-green-400 font-mono z-10 space-y-0.5">
                        <p>Image: {currentSlice}/{totalSlices}</p>
                        <p>Series: {selectedSeries?.series_number || 'N/A'}</p>
                        <p>Study ID: {id || 'N/A'}</p>
                    </div>

                    <div className="absolute bottom-2 right-2 text-xs text-green-400 font-mono text-right z-10 space-y-0.5">
                        <p>Zoom: 100%</p>
                        <p>{caseData?.case_type || 'N/A'}</p>
                        <p>Priority: {caseData?.priority || 'N/A'}</p>
                    </div>

                    {/* Orientation markers */}
                    <div className="absolute top-1/2 left-2 -translate-y-1/2 text-yellow-400 font-bold text-lg">R</div>
                    <div className="absolute top-1/2 right-2 -translate-y-1/2 text-yellow-400 font-bold text-lg">L</div>
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 text-yellow-400 font-bold text-lg">A</div>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-yellow-400 font-bold text-lg">P</div>

                    {/* Mock CT Image - Simulated grayscale body cross-section */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="relative w-80 h-80">
                            {/* Body outline */}
                            <div
                                className="absolute inset-0 rounded-full"
                                style={{
                                    background: 'radial-gradient(ellipse at center, #4a4a4a 0%, #3a3a3a 40%, #2a2a2a 60%, #1a1a1a 100%)',
                                    boxShadow: 'inset 0 0 60px rgba(0,0,0,0.8)'
                                }}
                            />

                            {/* Lung areas (darker) */}
                            <div
                                className="absolute top-1/4 left-1/4 w-1/4 h-1/2 rounded-full"
                                style={{
                                    background: 'radial-gradient(ellipse at center, #0a0a0a 0%, #1a1a1a 100%)'
                                }}
                            />
                            <div
                                className="absolute top-1/4 right-1/4 w-1/4 h-1/2 rounded-full"
                                style={{
                                    background: 'radial-gradient(ellipse at center, #0a0a0a 0%, #1a1a1a 100%)'
                                }}
                            />

                            {/* Spine (bright) */}
                            <div
                                className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-8 h-8 rounded"
                                style={{
                                    background: 'radial-gradient(circle at center, #d0d0d0 0%, #808080 100%)'
                                }}
                            />

                            {/* Heart area */}
                            <div
                                className="absolute top-1/3 left-1/2 -translate-x-1/4 w-16 h-20 rounded-full"
                                style={{
                                    background: 'radial-gradient(ellipse at center, #606060 0%, #404040 100%)'
                                }}
                            />

                            {/* Aorta */}
                            <div
                                className="absolute top-1/3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full"
                                style={{
                                    background: 'radial-gradient(circle at center, #505050 0%, #303030 100%)'
                                }}
                            />
                        </div>
                    </div>

                    {/* Slice position indicator bar (right side) */}
                    <div className="absolute right-4 top-16 bottom-16 w-2 bg-gray-800 rounded-full">
                        <div
                            className="absolute w-full bg-blue-500 rounded-full transition-all"
                            style={{
                                height: '4px',
                                top: `${((currentSlice - 1) / Math.max(1, totalSlices - 1)) * 100}%`,
                                transform: 'translateY(-50%)'
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Bottom control bar */}
            <div className="bg-gray-900 border-t border-gray-700 p-3">
                <div className="flex items-center gap-4 max-w-4xl mx-auto">
                    {/* Playback controls */}
                    <div className="flex items-center gap-1">
                        <button
                            className="p-2 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                            onClick={() => setCurrentSlice(1)}
                            title="First slice"
                        >
                            <SkipBack size={18} />
                        </button>
                        <button
                            className="p-2 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                            onClick={handlePrevSlice}
                            title="Previous slice"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <button
                            className={`p-2 rounded transition-colors ${isPlaying ? 'bg-blue-600 text-white' : 'hover:bg-gray-700 text-gray-400 hover:text-white'}`}
                            onClick={() => setIsPlaying(!isPlaying)}
                            title={isPlaying ? 'Pause' : 'Play cine'}
                        >
                            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                        </button>
                        <button
                            className="p-2 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                            onClick={handleNextSlice}
                            title="Next slice"
                        >
                            <ChevronRight size={18} />
                        </button>
                        <button
                            className="p-2 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                            onClick={() => setCurrentSlice(totalSlices)}
                            title="Last slice"
                        >
                            <SkipForward size={18} />
                        </button>
                    </div>

                    {/* Slice slider */}
                    <div className="flex-1 flex items-center gap-3">
                        <span className="text-xs text-gray-400 w-8">1</span>
                        <input
                            type="range"
                            min="1"
                            max={totalSlices}
                            value={currentSlice}
                            onChange={handleSliderChange}
                            className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                        <span className="text-xs text-gray-400 w-8">{totalSlices}</span>
                    </div>

                    {/* Current slice display */}
                    <div className="text-sm text-white font-mono bg-gray-800 px-3 py-1 rounded">
                        {currentSlice} / {totalSlices}
                    </div>

                    {/* Layout controls */}
                    <div className="flex items-center gap-1 border-l border-gray-700 pl-4">
                        <button
                            className="p-2 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                            title="2x2 Layout"
                        >
                            <Grid2X2 size={18} />
                        </button>
                        <button
                            className="p-2 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                            title="Stack view"
                        >
                            <Layers size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudyViewer;
