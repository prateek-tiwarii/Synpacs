import { useState } from "react";
import { ChevronDown, ChevronRight, Image, Layers, X } from "lucide-react";
import {
  useViewerContext,
  type TemporaryMPRSeries,
} from "@/components/ViewerLayout";

interface Series {
  _id: string;
  series_uid: string;
  description: string;
  modality: string;
  series_number: number;
  case_id: string;
  image_count: number;
}

const formatCaseDate = (dateStr: string) => {
  if (!dateStr || dateStr.length !== 8) return dateStr;
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

// Generate a consistent color based on series description
const getSeriesColor = (description: string): string => {
  const colors = [
    "#2a2a3a",
    "#3a2a2a",
    "#2a3a2a",
    "#2a3a3a",
    "#3a3a2a",
    "#3a2a3a",
    "#2a2a4a",
    "#4a2a2a",
  ];
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
  loadProgress?: { fetched: number; total: number } | null;
}

const SeriesThumbnail = ({
  series,
  isSelected,
  onClick,
  loadProgress,
}: SeriesThumbnailProps) => (
  <div
    onClick={onClick}
    className={`cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
      isSelected
        ? "border-blue-500 ring-2 ring-blue-500/50"
        : "border-gray-700 hover:border-gray-500"
    }`}
  >
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
      <p className="text-xs text-white font-medium truncate">
        Series {series.series_number}
      </p>
      <p className="text-[10px] text-gray-400 truncate">{series.description}</p>
    </div>

    {/* Download Progress Bar */}
    {loadProgress && loadProgress.total > 0 && (
      <div className="w-full h-1 bg-black">
        <div
          className="h-full bg-white transition-all duration-300"
          style={{
            width: `${(loadProgress.fetched / loadProgress.total) * 100}%`,
          }}
        />
      </div>
    )}
  </div>
);

// MPR Series Thumbnail
interface MPRSeriesThumbnailProps {
  series: TemporaryMPRSeries;
  isSelected: boolean;
  onClick: () => void;
  onRemove: () => void;
}

const MPRSeriesThumbnail = ({
  series,
  isSelected,
  onClick,
  onRemove,
}: MPRSeriesThumbnailProps) => (
  <div
    onClick={onClick}
    className={`cursor-pointer rounded-lg overflow-hidden border-2 transition-all relative ${
      isSelected
        ? "border-purple-500 ring-2 ring-purple-500/50"
        : "border-gray-700 hover:border-gray-500"
    }`}
  >
    {/* Remove button */}
    <button
      onClick={(e) => {
        e.stopPropagation();
        onRemove();
      }}
      className="absolute top-1 right-1 z-10 p-0.5 bg-black/70 hover:bg-red-600 rounded transition-colors"
      title="Remove MPR series"
    >
      <X size={12} className="text-white" />
    </button>

    <div
      className="h-24 flex items-center justify-center relative"
      style={{ backgroundColor: "#2a2a4a" }}
    >
      {/* MPR icon */}
      <Layers size={32} className="text-purple-400/50 absolute" />

      {/* MPR badge */}
      <span className="absolute top-1 left-1 text-[10px] bg-purple-600/80 px-1 rounded text-white font-mono">
        MPR
      </span>

      {/* Slice count */}
      <span className="absolute bottom-1 right-1 text-[10px] bg-black/60 px-1 rounded text-white font-mono">
        {series.sliceCount} slices
      </span>
    </div>

    {/* Series info */}
    <div className="bg-gray-800 p-2">
      <p className="text-xs text-purple-300 font-medium truncate">
        {series.mprMode}
      </p>
      <p className="text-[10px] text-gray-400 truncate">{series.description}</p>
    </div>
  </div>
);

interface CaseAccordionProps {
  title: string;
  caseDate: string;
  seriesCount: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const CaseAccordion = ({
  title,
  caseDate,
  seriesCount,
  children,
  defaultOpen = true,
}: CaseAccordionProps) => {
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
          <p className="text-xs text-gray-400">
            {caseDate} • {seriesCount} series
          </p>
        </div>
      </button>
      {isOpen && <div className="p-3 pt-0">{children}</div>}
    </div>
  );
};

const ViewerSidebar = () => {
  const {
    caseData,
    selectedSeries,
    setSelectedSeries,
    temporaryMPRSeries,
    removeTemporaryMPRSeries,
    selectedTemporarySeriesId,
    setSelectedTemporarySeriesId,
    seriesLoadProgress,
  } = useViewerContext();

  // Handle selecting a regular series (deselect any temp series)
  const handleSelectSeries = (series: Series) => {
    setSelectedSeries(series);
    setSelectedTemporarySeriesId(null);
  };

  // Handle selecting a temporary MPR series
  const handleSelectTempSeries = (tempSeries: TemporaryMPRSeries) => {
    setSelectedTemporarySeriesId(tempSeries.id);
  };

  if (!caseData) {
    return (
      <aside className="w-64 bg-gray-900 border-r border-gray-700 flex flex-col items-center justify-center p-4">
        <p className="text-red-400 text-sm text-center">No data available</p>
      </aside>
    );
  }

  // Get temp series for the current selected series
  const currentTempSeries = temporaryMPRSeries.filter(
    (ts) => ts.sourceSeriesId === selectedSeries?._id,
  );

  return (
    <aside className="w-64 bg-gray-900 border-r border-gray-700 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-gray-700">
        <h2 className="text-sm font-semibold text-white">Case Navigator</h2>
        <p className="text-xs text-gray-400 mt-1">
          {caseData.series_count} series • {caseData.instance_count} images
        </p>
      </div>

      {/* Series List */}
      <div className="flex-1 overflow-y-auto">
        <CaseAccordion
          title={caseData.description}
          caseDate={formatCaseDate(caseData.case_date)}
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
                  isSelected={
                    selectedSeries?._id === series._id &&
                    !selectedTemporarySeriesId
                  }
                  onClick={() => handleSelectSeries(series)}
                  loadProgress={
                    seriesLoadProgress?.seriesId === series._id
                      ? { fetched: seriesLoadProgress.fetched, total: seriesLoadProgress.total }
                      : null
                  }
                />
              ))}
          </div>
        </CaseAccordion>

        {/* Temporary MPR Series Section */}
        {currentTempSeries.length > 0 && (
          <div className="border-b border-gray-700">
            <div className="p-3 pb-0">
              <p className="text-xs text-purple-400 font-medium mb-2 flex items-center gap-1">
                <Layers size={12} />
                Generated MPR Views
              </p>
            </div>
            <div className="p-3 pt-2">
              <div className="grid grid-cols-2 gap-2">
                {currentTempSeries.map((tempSeries) => (
                  <MPRSeriesThumbnail
                    key={tempSeries.id}
                    series={tempSeries}
                    isSelected={selectedTemporarySeriesId === tempSeries.id}
                    onClick={() => handleSelectTempSeries(tempSeries)}
                    onRemove={() => removeTemporaryMPRSeries(tempSeries.id)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer with info */}
      <div className="p-3 border-t border-gray-700 bg-gray-800/50">
        <div className="text-xs text-gray-400 space-y-1">
          <div className="flex justify-between">
            <span>Selected:</span>
            <span className="text-white truncate ml-2">
              {selectedSeries?.description || "None"}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Images:</span>
            <span className="text-white">
              {selectedSeries?.image_count || 0}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Modality:</span>
            <span className="text-white">
              {selectedSeries?.modality || "N/A"}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default ViewerSidebar;
