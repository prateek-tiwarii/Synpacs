import { useState } from "react";
import { ChevronDown, ChevronRight, Image, Layers, X, Calendar } from "lucide-react";
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

interface SeriesItemProps {
  series: Series;
  isSelected: boolean;
  onClick: () => void;
  loadProgress?: { fetched: number; total: number } | null;
}

// Compact series item with image count
const SeriesItem = ({
  series,
  isSelected,
  onClick,
  loadProgress,
}: SeriesItemProps) => (
  <div
    onClick={onClick}
    className={`cursor-pointer rounded-lg overflow-hidden border transition-all ${
      isSelected
        ? "border-blue-500 bg-blue-500/10"
        : "border-gray-700 hover:border-gray-500 hover:bg-gray-800/50"
    }`}
  >
    <div className="flex items-center gap-2 p-2">
      {/* Thumbnail */}
      <div
        className="w-12 h-12 rounded flex items-center justify-center relative flex-shrink-0"
        style={{ backgroundColor: getSeriesColor(series.description) }}
      >
        <Image size={20} className="text-gray-500/50" />
        <span className="absolute top-0.5 left-0.5 text-[8px] bg-black/60 px-0.5 rounded text-white font-mono">
          {series.modality}
        </span>
      </div>

      {/* Series info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <p className="text-xs text-white font-medium truncate">
            S{series.series_number}: {series.description}
          </p>
        </div>
        <p className="text-[11px] text-gray-400 mt-0.5">
          {series.image_count} images
        </p>
      </div>
    </div>

    {/* Download Progress Bar */}
    {loadProgress && loadProgress.total > 0 && (
      <div className="w-full h-1 bg-black">
        <div
          className="h-full bg-blue-500 transition-all duration-300"
          style={{
            width: `${(loadProgress.fetched / loadProgress.total) * 100}%`,
          }}
        />
      </div>
    )}
  </div>
);

// MPR Series Item
interface MPRSeriesItemProps {
  series: TemporaryMPRSeries;
  isSelected: boolean;
  onClick: () => void;
  onRemove: () => void;
}

const MPRSeriesItem = ({
  series,
  isSelected,
  onClick,
  onRemove,
}: MPRSeriesItemProps) => (
  <div
    onClick={onClick}
    className={`cursor-pointer rounded-lg overflow-hidden border transition-all relative ${
      isSelected
        ? "border-purple-500 bg-purple-500/10"
        : "border-gray-700 hover:border-gray-500 hover:bg-gray-800/50"
    }`}
  >
    <div className="flex items-center gap-2 p-2">
      {/* Thumbnail */}
      <div className="w-12 h-12 rounded flex items-center justify-center relative flex-shrink-0 bg-purple-900/30">
        <Layers size={20} className="text-purple-400/50" />
        <span className="absolute top-0.5 left-0.5 text-[8px] bg-purple-600/80 px-0.5 rounded text-white font-mono">
          MPR
        </span>
      </div>

      {/* Series info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-purple-300 font-medium truncate">
          {series.mprMode}
        </p>
        <p className="text-[11px] text-gray-400 mt-0.5">
          {series.sliceCount} slices
        </p>
      </div>

      {/* Remove button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="p-1 hover:bg-red-600/50 rounded transition-colors"
        title="Remove MPR series"
      >
        <X size={14} className="text-gray-400 hover:text-white" />
      </button>
    </div>
  </div>
);

// Study accordion for grouping series by date
interface StudyAccordionProps {
  date: string;
  description: string;
  seriesCount: number;
  imageCount: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
  isCurrent?: boolean;
}

const StudyAccordion = ({
  date,
  description,
  seriesCount,
  imageCount,
  children,
  defaultOpen = false,
  isCurrent = false,
}: StudyAccordionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`border-b border-gray-700 ${isCurrent ? "bg-gray-800/30" : ""}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 p-2 hover:bg-gray-800 transition-colors text-left"
      >
        {isOpen ? (
          <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
        )}
        <Calendar size={14} className="text-gray-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs text-white font-medium">{date}</p>
            {isCurrent && (
              <span className="text-[9px] bg-blue-600 px-1 rounded text-white">Current</span>
            )}
          </div>
          <p className="text-[10px] text-gray-400 truncate">
            {description} • {seriesCount} series • {imageCount} images
          </p>
        </div>
      </button>
      {isOpen && <div className="px-2 pb-2 space-y-1">{children}</div>}
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
      {/* Patient Header */}
      <div className="p-3 border-b border-gray-700 bg-gray-800/50">
        <p className="text-sm font-semibold text-white truncate">
          {caseData.patient?.name || "Unknown Patient"}
        </p>
        <p className="text-[11px] text-gray-400 mt-0.5">
          ID: {caseData.patient?.patient_id || "N/A"} • {caseData.patient?.sex || "U"}
        </p>
      </div>

      {/* Studies List */}
      <div className="flex-1 overflow-y-auto">
        {/* Current Study */}
        <StudyAccordion
          date={formatCaseDate(caseData.case_date)}
          description={caseData.description}
          seriesCount={caseData.series_count}
          imageCount={caseData.instance_count}
          defaultOpen={true}
          isCurrent={true}
        >
          {caseData.series
            .sort((a, b) => a.series_number - b.series_number)
            .map((series) => (
              <SeriesItem
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
        </StudyAccordion>

        {/* Placeholder for previous studies - would be populated from API */}
        {/* Previous studies would be fetched based on patient_id and displayed here */}

        {/* Temporary MPR Series Section */}
        {currentTempSeries.length > 0 && (
          <div className="border-b border-gray-700">
            <div className="p-2">
              <p className="text-[10px] text-purple-400 font-medium mb-2 flex items-center gap-1">
                <Layers size={10} />
                Generated MPR Views
              </p>
              <div className="space-y-1">
                {currentTempSeries.map((tempSeries) => (
                  <MPRSeriesItem
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

      {/* Footer with selected series info */}
      <div className="p-2 border-t border-gray-700 bg-gray-800/50">
        <div className="text-[10px] text-gray-400">
          <span className="text-gray-500">Selected: </span>
          <span className="text-white">
            {selectedSeries ? `S${selectedSeries.series_number}` : "None"}
          </span>
          {selectedSeries && (
            <span className="text-gray-500"> • {selectedSeries.image_count} images</span>
          )}
        </div>
      </div>
    </aside>
  );
};

export default ViewerSidebar;
