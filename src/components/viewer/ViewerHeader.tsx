import {
    ZoomIn,
    Move,
    Contrast,
    Ruler,
    RotateCw,
    FlipHorizontal,
    FlipVertical,
    Grid3X3,
    Maximize2,
    Download,
    Share2,
    Printer,
    Undo2,
    Redo2,
    Pencil,
    Circle,
    Square,
    Type,
    SlidersHorizontal,
    LayoutGrid,
    RefreshCw,
    Crosshair,
    Layers,
    ScrollText,
    ArrowLeft
} from 'lucide-react';

interface ToolButtonProps {
    icon: React.ReactNode;
    label: string;
    active?: boolean;
    onClick?: () => void;
    disabled?: boolean;
}

const ToolButton = ({ icon, label, active = false, onClick, disabled = false }: ToolButtonProps) => (
    <button
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        className={`flex flex-col items-center justify-center p-2 rounded transition-colors min-w-[48px] ${active ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'
            } ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
        title={label}
    >
        {icon}
        <span className="text-[10px] mt-1 whitespace-nowrap">{label}</span>
    </button>
);

const ToolDivider = () => <div className="w-px h-10 bg-gray-600 mx-1" />;

import { useViewerContext } from '../ViewerLayout';
import { formatDate } from '@/lib/helperFunctions';
import { useNavigate } from 'react-router-dom';



const ViewerHeader = () => {
    const {
        caseData,
        selectedSeries,
        currentImageIndex,
        activeTool,
        setActiveTool,
        setViewTransform,
        setAnnotations,
        undo,
        redo,
        canUndo,
        canRedo,
        saveToHistory
    } = useViewerContext();

    const navigate = useNavigate();

    if (!caseData) return null;

    const patientName = caseData.patient?.name || 'Unknown';
    const mrn = caseData.patient?.patient_id || 'N/A';
    const dob = formatDate(caseData.patient?.date_of_birth || '');
    const caseDesc = caseData.description || 'N/A';
    const caseDate = formatDate(caseData.case_date || '');

    // Format DOB if it's YYYYMMDD or similar, depending on API. Assuming string for now.
    // Format Date if needed.

    const seriesNumber = selectedSeries?.series_number || 0;
    const totalSeries = caseData.series_count || 0;
    const imageCount = selectedSeries?.image_count || 0;
    const currentImage = imageCount > 0 ? currentImageIndex + 1 : 0;

    const handleRotate = () => {
        setViewTransform(prev => ({ ...prev, rotation: (prev.rotation + 90) % 360 }));
        saveToHistory();
    };

    const handleFlipH = () => {
        setViewTransform(prev => ({ ...prev, flipH: !prev.flipH }));
        saveToHistory();
    };

    const handleFlipV = () => {
        setViewTransform(prev => ({ ...prev, flipV: !prev.flipV }));
        saveToHistory();
    };

    const handleReset = () => {
        setViewTransform({
            x: 0,
            y: 0,
            scale: 1,
            rotation: 0,
            flipH: false,
            flipV: false
        });
        setAnnotations([]);
        saveToHistory();
    };


    return (
        <header className="bg-gray-900 border-b border-gray-700 px-4 py-1">
            {/* Top bar with patient info */}
            <div className="flex items-center justify-between text-sm text-gray-400 mb-2 pt-2">
                <div className='flex items-center gap-6'>
                    <div
                        className='flex items-center gap-2 cursor-pointer hover:text-white transition-colors'
                        onClick={() => navigate('/dashboard')}
                    >
                        <ArrowLeft size={16} />
                        <span>Back</span>
                    </div>
                    <div className="flex items-center gap-6">
                        <span className="text-white font-semibold">PATIENT: {patientName.toUpperCase()}</span>
                        <span>MRN: {mrn}</span>
                        <span>DOB: {dob}</span>
                        <span>Case: {caseDesc}</span>
                        <span>Date: {caseDate}</span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-green-400">● Connected</span>
                    <span>Series: {seriesNumber}/{totalSeries}</span>
                    <span>Image: {currentImage}/{imageCount} </span>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
                {/* Navigation Group */}
                <div className="flex items-center gap-0.5">
                    <ToolButton
                        icon={<Layers size={18} />}
                        label="Stack"
                        active={activeTool === 'Stack'}
                        onClick={() => setActiveTool('Stack')}
                    />
                    <ToolButton
                        icon={<Move size={18} />}
                        label="Pan"
                        active={activeTool === 'Pan'}
                        onClick={() => setActiveTool('Pan')}
                    />
                    <ToolButton
                        icon={<ZoomIn size={18} />}
                        label="Zoom"
                        active={activeTool === 'Zoom'}
                        onClick={() => setActiveTool('Zoom')}
                    />
                    <ToolButton
                        icon={<Maximize2 size={18} />}
                        label="Fit"
                        onClick={() => setViewTransform(prev => ({ ...prev, x: 0, y: 0, scale: 1 }))}
                    />
                </div>

                <ToolDivider />

                {/* Window/Level Group */}
                <div className="flex items-center gap-0.5">
                    <ToolButton icon={<Contrast size={18} />} label="W/L" disabled />
                    <ToolButton icon={<SlidersHorizontal size={18} />} label="Presets" disabled />
                    <ToolButton icon={<RefreshCw size={18} />} label="Reset" onClick={handleReset} />
                </div>

                <ToolDivider />

                {/* Transform Group */}
                <div className="flex items-center gap-0.5">
                    <ToolButton icon={<RotateCw size={18} />} label="Rotate" onClick={handleRotate} />
                    <ToolButton icon={<FlipHorizontal size={18} />} label="Flip H" onClick={handleFlipH} />
                    <ToolButton icon={<FlipVertical size={18} />} label="Flip V" onClick={handleFlipV} />
                </div>

                <ToolDivider />

                {/* Annotation Group */}
                <div className="flex items-center gap-0.5">
                    <ToolButton
                        icon={<Ruler size={18} />}
                        label="Length"
                        active={activeTool === 'Length'}
                        onClick={() => setActiveTool('Length')}
                    />
                    <ToolButton
                        icon={<Circle size={18} />}
                        label="Ellipse"
                        active={activeTool === 'Ellipse'}
                        onClick={() => setActiveTool('Ellipse')}
                    />
                    <ToolButton
                        icon={<Square size={18} />}
                        label="Rectangle"
                        active={activeTool === 'Rectangle'}
                        onClick={() => setActiveTool('Rectangle')}
                    />
                    <ToolButton
                        icon={<Pencil size={18} />}
                        label="Freehand"
                        active={activeTool === 'Freehand'}
                        onClick={() => setActiveTool('Freehand')}
                    />
                    <ToolButton
                        icon={<Type size={18} />}
                        label="Text"
                        active={activeTool === 'Text'}
                        onClick={() => setActiveTool('Text')}
                    />
                    <ToolButton icon={<Crosshair size={18} />} label="Probe" disabled />
                </div>

                <ToolDivider />

                {/* Layout Group */}
                <div className="flex items-center gap-0.5">
                    <ToolButton icon={<Grid3X3 size={18} />} label="MPR" disabled />
                    <ToolButton icon={<LayoutGrid size={18} />} label="Layout" disabled />
                </div>

                <ToolDivider />

                {/* Undo/Redo */}
                <div className="flex items-center gap-0.5">
                    <ToolButton icon={<Undo2 size={18} />} label="Undo" onClick={undo} disabled={!canUndo} />
                    <ToolButton icon={<Redo2 size={18} />} label="Redo" onClick={redo} disabled={!canRedo} />
                </div>

                <ToolDivider />

                <div className="flex items-center gap-0.5">
                    <ToolButton
                        icon={<ScrollText size={18} />}
                        label="Report"
                        onClick={() => window.open(`/case/${caseData._id}/report`, '_window')}
                    // onClick={() => window.open(`/case/${caseData._id}/report`, '_blank', 'width=1200,height=800')}
                    />
                </div>

                <div className="flex-1" />

                {/* Export Group */}
                <div className="flex items-center gap-0.5">
                    <ToolButton icon={<Download size={18} />} label="Export" />
                    <ToolButton icon={<Printer size={18} />} label="Print" />
                    <ToolButton icon={<Share2 size={18} />} label="Share" />
                </div>
            </div>
        </header>
    );
};

export default ViewerHeader;