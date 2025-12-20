import {
    ZoomIn,
    ZoomOut,
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
    MousePointer,
    Pencil,
    Circle,
    Square,
    Type,
    SlidersHorizontal,
    LayoutGrid,
    RefreshCw,
    Crosshair
} from 'lucide-react';

interface ToolButtonProps {
    icon: React.ReactNode;
    label: string;
    active?: boolean;
    onClick?: () => void;
}

const ToolButton = ({ icon, label, active = false, onClick }: ToolButtonProps) => (
    <button
        onClick={onClick}
        className={`flex flex-col items-center justify-center p-2 rounded hover:bg-gray-700 transition-colors min-w-[48px] ${active ? 'bg-blue-600 text-white' : 'text-gray-300'
            }`}
        title={label}
    >
        {icon}
        <span className="text-[10px] mt-1 whitespace-nowrap">{label}</span>
    </button>
);

const ToolDivider = () => <div className="w-px h-10 bg-gray-600 mx-1" />;

const ViewerHeader = () => {
    return (
        <header className="bg-gray-900 border-b border-gray-700 px-4 py-1">
            {/* Top bar with patient info */}
            <div className="flex items-center justify-between text-sm text-gray-400 mb-2 pt-2">
                <div className="flex items-center gap-6">
                    <span className="text-white font-semibold">PATIENT: DOE, JOHN</span>
                    <span>MRN: 12345678</span>
                    <span>DOB: 01/15/1985</span>
                    <span>Study: CT CHEST W/CONTRAST</span>
                    <span>Date: 12/20/2024</span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-green-400">● Connected</span>
                    <span>Series: 1/4</span>
                    <span>Image: 45/256</span>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
                {/* Navigation Group */}
                <div className="flex items-center gap-0.5">
                    <ToolButton icon={<MousePointer size={18} />} label="Select" active />
                    <ToolButton icon={<Move size={18} />} label="Pan" />
                    <ToolButton icon={<ZoomIn size={18} />} label="Zoom" />
                    <ToolButton icon={<ZoomOut size={18} />} label="Zoom Out" />
                    <ToolButton icon={<Maximize2 size={18} />} label="Fit" />
                </div>

                <ToolDivider />

                {/* Window/Level Group */}
                <div className="flex items-center gap-0.5">
                    <ToolButton icon={<Contrast size={18} />} label="W/L" />
                    <ToolButton icon={<SlidersHorizontal size={18} />} label="Presets" />
                    <ToolButton icon={<RefreshCw size={18} />} label="Reset" />
                </div>

                <ToolDivider />

                {/* Transform Group */}
                <div className="flex items-center gap-0.5">
                    <ToolButton icon={<RotateCw size={18} />} label="Rotate" />
                    <ToolButton icon={<FlipHorizontal size={18} />} label="Flip H" />
                    <ToolButton icon={<FlipVertical size={18} />} label="Flip V" />
                </div>

                <ToolDivider />

                {/* Annotation Group */}
                <div className="flex items-center gap-0.5">
                    <ToolButton icon={<Ruler size={18} />} label="Length" />
                    <ToolButton icon={<Circle size={18} />} label="Ellipse" />
                    <ToolButton icon={<Square size={18} />} label="Rectangle" />
                    <ToolButton icon={<Pencil size={18} />} label="Freehand" />
                    <ToolButton icon={<Type size={18} />} label="Text" />
                    <ToolButton icon={<Crosshair size={18} />} label="Probe" />
                </div>

                <ToolDivider />

                {/* Layout Group */}
                <div className="flex items-center gap-0.5">
                    <ToolButton icon={<Grid3X3 size={18} />} label="MPR" />
                    <ToolButton icon={<LayoutGrid size={18} />} label="Layout" />
                </div>

                <ToolDivider />

                {/* Undo/Redo */}
                <div className="flex items-center gap-0.5">
                    <ToolButton icon={<Undo2 size={18} />} label="Undo" />
                    <ToolButton icon={<Redo2 size={18} />} label="Redo" />
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