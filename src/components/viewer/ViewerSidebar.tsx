import { useEffect, useRef, useState, type DragEvent } from "react";
import { ChevronDown, ChevronRight, Image, Layers, X, Calendar } from "lucide-react";
import {
  useViewerContext,
  type TemporaryMPRSeries,
} from "@/components/ViewerLayout";
import toast from "react-hot-toast";
import { getCookie } from "@/lib/cookies";
import { generateDicomInstanceThumbnail } from "@/lib/dicom/thumbnail";
import { applyWindowLevel } from "@/lib/mpr";

interface Series {
  _id: string;
  series_uid: string;
  description: string;
  modality: string;
  series_number: number;
  case_id: string;
  image_count: number;
}

const SERIES_DND_MIME = "application/x-sync-pacs-series";

interface DragSeriesPayload {
  seriesId: string;
  kind: "regular" | "mpr";
}

const setSeriesDragData = (
  event: DragEvent<HTMLDivElement>,
  payload: DragSeriesPayload,
) => {
  event.dataTransfer.effectAllowed = "copyMove";
  event.dataTransfer.setData(SERIES_DND_MIME, JSON.stringify(payload));
  event.dataTransfer.setData("text/plain", payload.seriesId);
};

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
  thumbnailUrl?: string | null;
  loadProgress?: { fetched: number; total: number } | null;
  isDownloaded?: boolean;
  dragPayload?: DragSeriesPayload;
  isDraggable?: boolean;
}

// Compact series item with image count
const SeriesItem = ({
  series,
  isSelected,
  onClick,
  thumbnailUrl = null,
  loadProgress,
  isDownloaded = false,
  dragPayload,
  isDraggable = true,
}: SeriesItemProps) => (
  <div
    draggable={isDraggable}
    onDragStart={(event) => {
      if (!dragPayload) return;
      setSeriesDragData(event, dragPayload);
    }}
    onClick={onClick}
    className={`rounded-lg overflow-hidden border transition-all ${
      isDraggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
    } ${
      isSelected
        ? "border-blue-500 bg-blue-500/10 shadow-[0_0_0_1px_rgba(59,130,246,0.45)]"
        : "border-gray-700 bg-gray-900/70 hover:border-gray-500 hover:bg-gray-800/70"
    }`}
  >
    <div className="p-2">
      {/* Thumbnail */}
      <div
        className="w-full aspect-[4/3] rounded-md flex items-center justify-center relative overflow-hidden"
        style={{ backgroundColor: getSeriesColor(series.description) }}
      >
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={`${series.description} preview`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <Image size={24} className="text-gray-500/60" />
        )}
        <span className="absolute top-0.5 left-0.5 text-[8px] bg-black/60 px-0.5 rounded text-white font-mono">
          {series.modality}
        </span>
      </div>

      {/* Series info */}
      <div className="mt-2 min-w-0">
        <p className="text-[10px] text-blue-300 font-semibold tracking-wide">
          SERIES {series.series_number}
        </p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="text-[11px] text-white font-medium leading-tight break-words h-8 overflow-hidden">
            {series.description || "Untitled series"}
          </p>
        </div>
        <div className="mt-1.5">
          <p className="text-[11px] text-gray-400">
            {series.image_count} images
          </p>
          {isDownloaded && !loadProgress && (
            <div className="mt-1">
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400/90">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Downloaded
              </span>
            </div>
          )}
        </div>
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
  dragPayload?: DragSeriesPayload;
  isDraggable?: boolean;
}

const MPRSeriesItem = ({
  series,
  isSelected,
  onClick,
  onRemove,
  dragPayload,
  isDraggable = true,
}: MPRSeriesItemProps) => {
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const previewCanvas = previewCanvasRef.current;
    if (!previewCanvas) return;

    const previewSlice =
      series.slices[Math.floor(series.sliceCount / 2)] || series.slices[0];
    if (!previewSlice) {
      return;
    }

    try {
      const previewImageData =
        previewSlice.imageData ||
        (previewSlice.rawData
          ? applyWindowLevel(
              previewSlice.rawData,
              previewSlice.width,
              previewSlice.height,
              series.windowCenter,
              series.windowWidth,
            )
          : null);
      if (!previewImageData) {
        return;
      }

      const sourceCanvas = document.createElement("canvas");
      sourceCanvas.width = previewSlice.width;
      sourceCanvas.height = previewSlice.height;
      const sourceCtx = sourceCanvas.getContext("2d");
      const previewCtx = previewCanvas.getContext("2d");
      if (!sourceCtx || !previewCtx) {
        return;
      }

      sourceCtx.putImageData(previewImageData, 0, 0);

      const maxPreviewWidth = 160;
      const maxPreviewHeight = 120;
      const scale = Math.min(
        maxPreviewWidth / previewSlice.width,
        maxPreviewHeight / previewSlice.height,
        1,
      );
      const previewWidth = Math.max(1, Math.round(previewSlice.width * scale));
      const previewHeight = Math.max(
        1,
        Math.round(previewSlice.height * scale),
      );

      previewCanvas.width = previewWidth;
      previewCanvas.height = previewHeight;
      previewCtx.clearRect(0, 0, previewWidth, previewHeight);
      previewCtx.imageSmoothingEnabled = true;
      previewCtx.drawImage(sourceCanvas, 0, 0, previewWidth, previewHeight);
    } catch {
      // Ignore preview rendering failures and keep fallback icon style.
    }
  }, [series.sliceCount, series.slices, series.windowCenter, series.windowWidth]);

  return (
    <div
      draggable={isDraggable}
      onDragStart={(event) => {
        if (!dragPayload) return;
        setSeriesDragData(event, dragPayload);
      }}
      onClick={onClick}
      className={`rounded-lg overflow-hidden border transition-all relative ${
        isDraggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
      } ${
        isSelected
          ? "border-purple-500 bg-purple-500/10 shadow-[0_0_0_1px_rgba(168,85,247,0.45)]"
          : "border-gray-700 bg-gray-900/70 hover:border-gray-500 hover:bg-gray-800/70"
      }`}
    >
      {/* Remove button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute right-1 top-1 z-10 p-1 bg-black/40 hover:bg-red-600/70 rounded transition-colors"
        title="Remove MPR series"
      >
        <X size={12} className="text-gray-300 hover:text-white" />
      </button>

      <div className="p-2">
        {/* Thumbnail */}
        <div className="w-full aspect-[4/3] rounded-md flex items-center justify-center relative overflow-hidden bg-purple-900/30">
          <canvas
            ref={previewCanvasRef}
            aria-label={`${series.mprMode} preview`}
            className="w-full h-full"
          />
          <Layers
            size={22}
            className="absolute text-purple-400/30 pointer-events-none"
          />
          <span className="absolute top-0.5 left-0.5 text-[8px] bg-purple-600/80 px-0.5 rounded text-white font-mono">
            MPR
          </span>
        </div>

        {/* Series info */}
        <div className="mt-2 min-w-0">
          <p className="text-[10px] text-purple-300 font-semibold tracking-wide">
            {series.mprMode}
          </p>
          <p className="text-[11px] text-white font-medium leading-tight break-words h-8 overflow-hidden mt-1">
            {series.description || `${series.mprMode} MPR`}
          </p>
          <p className="text-[11px] text-gray-400 mt-1.5">
            {series.sliceCount} slices
          </p>
        </div>
      </div>
    </div>
  );
};

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
    downloadedSeriesIds,
    isVRTActive,
  } = useViewerContext();
  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
  const [seriesThumbnails, setSeriesThumbnails] = useState<
    Record<string, string | null>
  >({});
  const seriesThumbnailsRef = useRef<Record<string, string | null>>({});

  // Handle selecting a regular series (deselect any temp series)
  const handleSelectSeries = (series: Series) => {
    if (isVRTActive) {
      toast("Exit VRT mode before switching series");
      return;
    }
    setSelectedSeries(series);
    setSelectedTemporarySeriesId(null);
  };

  // Handle selecting a temporary MPR series
  const handleSelectTempSeries = (tempSeries: TemporaryMPRSeries) => {
    if (isVRTActive) {
      toast("Exit VRT mode before switching series");
      return;
    }
    setSelectedTemporarySeriesId(tempSeries.id);
  };

  useEffect(() => {
    if (!caseData?.series?.length) {
      seriesThumbnailsRef.current = {};
      setSeriesThumbnails({});
      return;
    }

    const activeSeries = caseData.series.filter((series) => series.image_count > 0);
    const activeSeriesIds = new Set(activeSeries.map((series) => series._id));
    const nextThumbnails: Record<string, string | null> = {};
    for (const [seriesId, thumbnailUrl] of Object.entries(seriesThumbnailsRef.current)) {
      if (activeSeriesIds.has(seriesId)) {
        nextThumbnails[seriesId] = thumbnailUrl;
      }
    }
    seriesThumbnailsRef.current = nextThumbnails;
    setSeriesThumbnails(nextThumbnails);

    const token = getCookie("jwt");
    const missingSeries = activeSeries.filter(
      (series) => !(series._id in nextThumbnails),
    );
    if (missingSeries.length === 0) {
      return;
    }

    let cancelled = false;
    const queue = [...missingSeries];
    const workerCount = Math.min(2, queue.length);

    const loadOneSeriesThumbnail = async (seriesId: string) => {
      const middleResponse = await fetch(
        `${API_BASE_URL}/api/v1/series/${seriesId}/middle-instance`,
        {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );

      if (!middleResponse.ok) {
        throw new Error(`Middle instance lookup failed (${middleResponse.status})`);
      }

      const middlePayload = await middleResponse.json();
      const middleInstanceUid = middlePayload?.data?.instance_uid as
        | string
        | undefined;

      if (!middleInstanceUid) {
        throw new Error("Middle instance UID missing");
      }

      return generateDicomInstanceThumbnail(middleInstanceUid, {
        apiBaseUrl: API_BASE_URL,
        authToken: token || undefined,
        size: 96,
      });
    };

    const runWorker = async () => {
      while (!cancelled) {
        const currentSeries = queue.shift();
        if (!currentSeries) return;

        try {
          const thumbnailUrl = await loadOneSeriesThumbnail(currentSeries._id);
          if (!cancelled) {
            setSeriesThumbnails((prev) => {
              const next = {
                ...prev,
                [currentSeries._id]: thumbnailUrl,
              };
              seriesThumbnailsRef.current = next;
              return next;
            });
          }
        } catch (error) {
          console.error(
            `Failed to generate thumbnail for series ${currentSeries._id}`,
            error,
          );
          if (!cancelled) {
            setSeriesThumbnails((prev) => {
              const next = {
                ...prev,
                [currentSeries._id]: null,
              };
              seriesThumbnailsRef.current = next;
              return next;
            });
          }
        }
      }
    };

    void Promise.all(Array.from({ length: workerCount }, () => runWorker()));

    return () => {
      cancelled = true;
    };
  }, [API_BASE_URL, caseData?.series]);

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

      {/* VRT active indicator */}
      {isVRTActive && (
        <div className="px-3 py-2 bg-purple-900/30 border-b border-purple-800/50">
          <p className="text-[11px] text-purple-400 font-medium">VRT Mode Active</p>
          <p className="text-[10px] text-gray-500">Exit VRT to switch series</p>
        </div>
      )}

      {/* Studies List */}
      <div className={`flex-1 overflow-y-auto ${isVRTActive ? "opacity-50" : ""}`}>
        {/* Current Study */}
        <StudyAccordion
          date={formatCaseDate(caseData.case_date)}
          description={caseData.description}
          seriesCount={caseData.series_count}
          imageCount={caseData.instance_count}
          defaultOpen={true}
          isCurrent={true}
        >
          <div className="grid grid-cols-2 gap-2">
            {caseData.series
              .filter((series) => series.image_count > 0)
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
                  thumbnailUrl={seriesThumbnails[series._id] ?? null}
                  dragPayload={{ seriesId: series._id, kind: "regular" }}
                  isDraggable={!isVRTActive}
                  loadProgress={
                    seriesLoadProgress?.seriesId === series._id
                      ? { fetched: seriesLoadProgress.fetched, total: seriesLoadProgress.total }
                      : null
                  }
                  isDownloaded={downloadedSeriesIds.has(series._id)}
                />
              ))}
          </div>
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
              <div className="grid grid-cols-2 gap-2">
                {currentTempSeries.map((tempSeries) => (
                  <MPRSeriesItem
                    key={tempSeries.id}
                    series={tempSeries}
                    isSelected={selectedTemporarySeriesId === tempSeries.id}
                    onClick={() => handleSelectTempSeries(tempSeries)}
                    onRemove={() => removeTemporaryMPRSeries(tempSeries.id)}
                    dragPayload={{ seriesId: tempSeries.id, kind: "mpr" }}
                    isDraggable={!isVRTActive}
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
