import { useEffect, useRef, useState, type DragEvent } from "react";
import {
  ChevronDown,
  ChevronRight,
  Image,
  Layers,
  X,
  Calendar,
  FileText,
  Zap,
  Box,
  Crosshair,
  Camera,
  ScanLine,
  Star,
  File,
  Database,
  ClipboardList,
  FileCheck,
} from "lucide-react";
import {
  useViewerContext,
  type TemporaryMPRSeries,
  type SidebarColumns,
  type SidebarPosition,
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

const NON_PREVIEW_MODALITIES = new Set([
  "SR",
  "RTDOSE",
  "RTSTRUCT",
  "RTPLAN",
  "RTRECORD",
  "KO",
  "PR",
  "SEG",
  "REG",
  "FID",
  "DOC",
]);

type ModalityFallback = {
  icon: typeof FileText;
  label: string;
  tooltip: string;
};

const MODALITY_FALLBACK: Record<string, ModalityFallback> = {
  SR: {
    icon: FileText,
    label: "Structured Report",
    tooltip: "Structured Report: machine-readable clinical report (e.g. CAD, measurements)",
  },
  RTDOSE: {
    icon: Zap,
    label: "Dose",
    tooltip: "Dose: radiation dose distribution from treatment planning",
  },
  RTSTRUCT: { icon: Box, label: "RT Structure", tooltip: "RT Structure: contours and regions of interest" },
  RTPLAN: { icon: Crosshair, label: "RT Plan", tooltip: "RT Plan: treatment plan parameters" },
  RTRECORD: { icon: FileText, label: "RT Record", tooltip: "RT Record: treatment session record" },
  SC: {
    icon: Camera,
    label: "Secondary Capture",
    tooltip: "Secondary Capture: screenshots, photos, or non-DICOM images saved as DICOM",
  },
  KO: { icon: Star, label: "Key Object", tooltip: "Key Object: key image selection" },
  PR: { icon: ScanLine, label: "Presentation State", tooltip: "Presentation State: display settings and annotations" },
  SEG: { icon: Layers, label: "Segmentation", tooltip: "Segmentation: segmentation mask or ROI" },
  DOC: { icon: File, label: "Document", tooltip: "Document: PDF or other document" },
  OT: { icon: File, label: "Other", tooltip: "Other: uncategorized modality" },
};

// Description-based fallbacks — checked FIRST so e.g. "Dose Report" / "Examination Report" (SR) get distinct icons
const DESCRIPTION_FALLBACKS: Array<{
  pattern: RegExp;
  icon: typeof FileText;
  label: string;
  tooltip: string;
}> = [
  {
    pattern: /dose\s*report|^dose$/i,
    icon: Zap,
    label: "Dose Report",
    tooltip: "Dose Report: radiation dose summary or report",
  },
  {
    pattern: /examination\s*report|^examination\s*report$/i,
    icon: FileCheck,
    label: "Examination Report",
    tooltip: "Examination Report: clinical examination or study report",
  },
  {
    pattern: /raw\s*data|ct\s*raw/i,
    icon: Database,
    label: "CT Raw Data",
    tooltip: "CT Raw Data: unprocessed or raw CT projection/sinogram data",
  },
  {
    pattern: /patient\s*protocol|protocol\s*summary/i,
    icon: ClipboardList,
    label: "Patient Protocol",
    tooltip: "Patient Protocol: scan protocol or acquisition parameters for the patient",
  },
];

const getModalityFallback = (modality: string): ModalityFallback | null => {
  const key = (modality || "").toUpperCase();
  return MODALITY_FALLBACK[key] ?? null;
};

const getSeriesFallback = (series: { modality?: string; description?: string }): ModalityFallback | null => {
  const desc = (series.description ?? "").trim();
  if (desc) {
    for (const { pattern, icon, label, tooltip } of DESCRIPTION_FALLBACKS) {
      if (pattern.test(desc)) return { icon, label, tooltip };
    }
  }
  return getModalityFallback(series.modality ?? "");
};

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
  thumbnailLoading?: boolean;
  loadProgress?: { fetched: number; total: number } | null;
  isDownloaded?: boolean;
  dragPayload?: DragSeriesPayload;
  isDraggable?: boolean;
  className?: string;
  isCompact?: boolean;
  singleLine?: boolean;
}

const SeriesItemSingleLine = ({
  series,
  isSelected,
  onClick,
  thumbnailUrl = null,
  thumbnailLoading = false,
  loadProgress,
  isDownloaded = false,
  dragPayload,
  isDraggable = true,
  className = "",
}: Omit<SeriesItemProps, "isCompact" | "singleLine">) => (
  <div
    draggable={isDraggable}
    onDragStart={(event) => {
      if (!dragPayload) return;
      setSeriesDragData(event, dragPayload);
    }}
    onClick={onClick}
    className={`rounded-md overflow-hidden border transition-all ${className} ${
      isDraggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
    } ${
      isSelected
        ? "border-blue-500 bg-blue-500/10 shadow-[0_0_0_1px_rgba(59,130,246,0.45)]"
        : "border-gray-700/60 bg-gray-900/70 hover:border-gray-500 hover:bg-gray-800/70"
    }`}
  >
    <div className="flex flex-col p-1.5 gap-1.5">
      {/* Thumbnail */}
      <div className="w-full h-[120px] rounded-md overflow-hidden bg-[#0a0a14] flex items-center justify-center relative">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={`${series.description} preview`}
            className="w-full h-full object-contain"
            loading="lazy"
          />
        ) : thumbnailLoading ? (
          <div className="w-16 h-16 rounded bg-gray-700/40 animate-pulse" />
        ) : (() => {
          const fallback = getSeriesFallback(series);
          if (fallback?.label === "Structured Report") {
            const srTooltip = MODALITY_FALLBACK.SR?.tooltip ?? "Structured Report";
            return (
              <div className="flex flex-col items-center gap-1" title={srTooltip}>
                <FileText size={24} className="text-amber-400/80" />
                <div className="w-12 flex flex-col gap-[2px]">
                  <div className="w-full h-[2px] rounded-full bg-gray-500/50" />
                  <div className="w-[75%] h-[2px] rounded-full bg-gray-500/40" />
                </div>
              </div>
            );
          }
          if (fallback) {
            const FallbackIcon = fallback.icon;
            return (
              <div className="flex flex-col items-center gap-0.5" title={fallback.tooltip}>
                <FallbackIcon size={28} className="text-gray-400" />
                <span className="text-[9px] text-gray-500 font-medium">{fallback.label}</span>
              </div>
            );
          }
          return (
              <div title="Image series">
                <Image size={28} className="text-gray-500" />
              </div>
            );
        })()}
        <span className="absolute top-0.5 left-0.5 bg-black/70 backdrop-blur-sm px-1 rounded text-white font-mono text-[8px]">
          {series.modality}
        </span>
      </div>

      {/* Series info — single compact line */}
      <div className="flex items-center gap-1.5 min-w-0 px-0.5">
        <span className="text-blue-400 font-semibold text-[10px] shrink-0">
          S{series.series_number}
        </span>
        <span className="text-white text-[11px] font-medium truncate flex-1 min-w-0">
          {series.description || "Untitled"}
        </span>
        {isDownloaded && !loadProgress && (
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" title="Downloaded" />
        )}
        <span className="text-gray-500 text-[10px] tabular-nums shrink-0">
          {series.image_count}
        </span>
      </div>
    </div>

    {loadProgress && loadProgress.total > 0 && (
      <div className="w-full h-0.5 bg-black">
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

const SeriesItemCard = ({
  series,
  isSelected,
  onClick,
  thumbnailUrl = null,
  thumbnailLoading = false,
  loadProgress,
  isDownloaded = false,
  dragPayload,
  isDraggable = true,
  className = "",
  isCompact = false,
}: Omit<SeriesItemProps, "singleLine">) => (
  <div
    draggable={isDraggable}
    onDragStart={(event) => {
      if (!dragPayload) return;
      setSeriesDragData(event, dragPayload);
    }}
    onClick={onClick}
    className={`rounded-lg overflow-hidden border transition-all ${className} ${
      isDraggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
    } ${
      isSelected
        ? "border-blue-500 bg-blue-500/10 shadow-[0_0_0_1px_rgba(59,130,246,0.45)]"
        : "border-gray-700 bg-gray-900/70 hover:border-gray-500 hover:bg-gray-800/70"
    }`}
  >
    <div className={isCompact ? "p-1" : "p-1.5"}>
      {/* Thumbnail */}
      <div
        className={`w-full flex items-center justify-center relative overflow-hidden bg-[#0a0a14] ${
          isCompact ? "h-[72px] rounded-sm" : "h-[120px] rounded-md"
        }`}
      >
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={`${series.description} preview`}
            className="w-full h-full object-contain"
            loading="lazy"
          />
        ) : thumbnailLoading ? (
          <div className="w-full h-full flex items-center justify-center">
            <div
              className="rounded bg-gray-700/40 animate-pulse"
              style={{ width: "60%", height: "60%" }}
            />
          </div>
        ) : (() => {
          const fallback = getSeriesFallback(series);
          const srTooltip = MODALITY_FALLBACK.SR?.tooltip ?? "Structured Report";
          if (fallback?.label === "Structured Report") {
            return (
              <div
                className="flex flex-col items-center justify-center w-full h-full px-2"
                title={srTooltip}
              >
                <div
                  className={`bg-gray-800 border border-gray-600/50 rounded shadow-sm flex flex-col items-center justify-center ${
                    isCompact
                      ? "w-[52px] h-[52px] gap-0.5 px-1"
                      : "w-[80px] h-[80px] gap-1 px-2"
                  }`}
                >
                  <FileText
                    size={isCompact ? 14 : 20}
                    className="text-amber-400/90 shrink-0"
                  />
                  <div className="w-full flex flex-col gap-[2px]">
                    <div className="w-full h-[2px] rounded-full bg-gray-500/50" />
                    <div className="w-[75%] h-[2px] rounded-full bg-gray-500/40" />
                    <div className="w-[60%] h-[2px] rounded-full bg-gray-500/30" />
                  </div>
                </div>
                <span
                  className={`text-amber-400/70 font-medium mt-1 ${
                    isCompact ? "text-[7px]" : "text-[9px]"
                  }`}
                >
                  Structured Report
                </span>
              </div>
            );
          }
          if (fallback) {
            const FallbackIcon = fallback.icon;
            return (
              <div
                className="flex flex-col items-center gap-1.5 opacity-80"
                title={fallback.tooltip}
              >
                <div
                  className={`flex items-center justify-center rounded-lg ${
                    isCompact ? "w-8 h-8" : "w-11 h-11"
                  }`}
                  style={{ backgroundColor: getSeriesColor(series.description) }}
                >
                  <FallbackIcon
                    size={isCompact ? 16 : 22}
                    className="text-gray-300"
                  />
                </div>
                <span
                  className={`text-gray-400 font-medium text-center leading-tight px-1 ${
                    isCompact ? "text-[7px]" : "text-[9px]"
                  }`}
                >
                  {fallback.label}
                </span>
              </div>
            );
          }
          return (
            <div className="flex flex-col items-center gap-1.5 opacity-80" title="Image series (no preview)">
              <div
                className={`flex items-center justify-center rounded-lg ${
                  isCompact ? "w-8 h-8" : "w-11 h-11"
                }`}
                style={{ backgroundColor: getSeriesColor(series.description) }}
              >
                <Image
                  size={isCompact ? 16 : 22}
                  className="text-gray-300"
                />
              </div>
              <span
                className={`text-gray-500 font-medium text-center leading-tight px-1 ${
                  isCompact ? "text-[7px]" : "text-[9px]"
                }`}
              >
                No Preview
              </span>
            </div>
          );
        })()}
        <span
          className={`absolute top-0.5 left-0.5 bg-black/70 backdrop-blur-sm px-1 rounded text-white font-mono ${
            isCompact ? "text-[7px]" : "text-[8px]"
          }`}
        >
          {series.modality}
        </span>
      </div>

      {/* Series info */}
      <div className={isCompact ? "min-w-0 mt-1" : "min-w-0 mt-1.5"}>
        <p
          className={`text-blue-300 font-semibold tracking-wide ${
            isCompact ? "text-[9px]" : "text-[10px]"
          }`}
        >
          SERIES {series.series_number}
        </p>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p
            className={`text-white font-medium leading-tight break-words h-8 overflow-hidden ${
              isCompact ? "text-[10px]" : "text-[11px]"
            }`}
          >
            {series.description || "Untitled series"}
          </p>
        </div>
        <div className="mt-1">
          <p
            className={`text-gray-400 ${
              isCompact ? "text-[10px]" : "text-[11px]"
            }`}
          >
            {series.image_count} images
          </p>
          {isDownloaded && !loadProgress && (
            <div className="mt-1 flex items-center">
              <span
                className={`${isCompact ? "h-1.5 w-1.5" : "h-2 w-2"} rounded-full bg-emerald-400`}
                title="Downloaded"
              />
              <span className="sr-only">Downloaded</span>
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

const SeriesItem = ({ singleLine = false, ...props }: SeriesItemProps) =>
  singleLine ? <SeriesItemSingleLine {...props} /> : <SeriesItemCard {...props} />;

// MPR Series Item
interface MPRSeriesItemProps {
  series: TemporaryMPRSeries;
  isSelected: boolean;
  onClick: () => void;
  onRemove: () => void;
  dragPayload?: DragSeriesPayload;
  isDraggable?: boolean;
  className?: string;
  isCompact?: boolean;
}

const SINGLE_PLANE_REFORMAT_MODES = ["Axial", "Coronal", "Sagittal"] as const;

const MPRSeriesItem = ({
  series,
  isSelected,
  onClick,
  onRemove,
  dragPayload,
  isDraggable = true,
  className = "",
  isCompact = false,
}: MPRSeriesItemProps) => {
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const isSinglePlaneReformat = SINGLE_PLANE_REFORMAT_MODES.includes(
    series.mprMode as (typeof SINGLE_PLANE_REFORMAT_MODES)[number],
  );

  // Do not generate/save thumbnails for single-plane reformats (Axial/Coronal/Sagittal)
  useEffect(() => {
    if (isSinglePlaneReformat) return;

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
  }, [
    isSinglePlaneReformat,
    series.sliceCount,
    series.slices,
    series.windowCenter,
    series.windowWidth,
  ]);

  return (
    <div
      draggable={isDraggable}
      onDragStart={(event) => {
        if (!dragPayload) return;
        setSeriesDragData(event, dragPayload);
      }}
      onClick={onClick}
      className={`rounded-lg overflow-hidden border transition-all relative ${className} ${
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

      <div className={isCompact ? "p-1" : "p-1.5"}>
        {/* Thumbnail: not generated for single-plane reformats (Axial/Coronal/Sagittal) */}
        <div
          className={`w-full flex items-center justify-center relative overflow-hidden bg-purple-900/30 ${
            isCompact ? "h-[72px] rounded-sm" : "h-[120px] rounded-md"
          }`}
        >
          {!isSinglePlaneReformat && (
            <canvas
              ref={previewCanvasRef}
              aria-label={`${series.mprMode} preview`}
              className="w-full h-full"
            />
          )}
          <Layers
            size={22}
            className="absolute text-purple-400/30 pointer-events-none"
          />
          <span
            className={`absolute top-0.5 left-0.5 bg-purple-600/80 px-0.5 rounded text-white font-mono ${
              isCompact ? "text-[7px]" : "text-[8px]"
            }`}
          >
            {isSinglePlaneReformat ? series.mprMode : "MPR"}
          </span>
        </div>

        {/* Series info */}
        <div className={isCompact ? "mt-1 min-w-0" : "mt-1.5 min-w-0"}>
          <p
            className={`text-purple-300 font-semibold tracking-wide ${
              isCompact ? "text-[9px]" : "text-[10px]"
            }`}
          >
            {series.mprMode}
          </p>
          <p
            className={`text-white font-medium leading-tight break-words h-8 overflow-hidden mt-0.5 ${
              isCompact ? "text-[10px]" : "text-[11px]"
            }`}
          >
            {series.description || `${series.mprMode} MPR`}
          </p>
          <p
            className={`text-gray-400 mt-1 ${
              isCompact ? "text-[10px]" : "text-[11px]"
            }`}
          >
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
  showHeader?: boolean;
  contentClassName?: string;
}

const StudyAccordion = ({
  date,
  description,
  seriesCount,
  imageCount,
  children,
  defaultOpen = false,
  isCurrent = false,
  showHeader = true,
  contentClassName = "px-2 pb-2 space-y-1",
}: StudyAccordionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (!showHeader) {
    return <div className={contentClassName}>{children}</div>;
  }

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
      {isOpen && <div className={contentClassName}>{children}</div>}
    </div>
  );
};

interface ViewerSidebarProps {
  position?: SidebarPosition;
  columns?: SidebarColumns;
}

const ViewerSidebar = ({ position = "side", columns = 1 }: ViewerSidebarProps) => {
  const {
    caseData,
    selectedSeries,
    setSelectedSeries,
    setActivePaneSeries,
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

  // Handle selecting a regular series (deselect any temp series); set active pane so each pane can show different series
  const handleSelectSeries = (series: Series) => {
    if (isVRTActive) {
      toast("Exit VRT mode before switching series");
      return;
    }
    setSelectedSeries(series);
    setSelectedTemporarySeriesId(null);
    setActivePaneSeries(series._id);
  };

  // Handle selecting a temporary MPR series; set active pane so each pane can show different orientation (e.g. Sagittal in one, Coronal in another)
  const handleSelectTempSeries = (tempSeries: TemporaryMPRSeries) => {
    if (isVRTActive) {
      toast("Exit VRT mode before switching series");
      return;
    }
    setSelectedTemporarySeriesId(tempSeries.id);
    setActivePaneSeries(tempSeries.id);
  };

  useEffect(() => {
    if (!caseData?.series?.length) {
      seriesThumbnailsRef.current = {};
      setSeriesThumbnails({});
      return;
    }

    const activeSeries = caseData.series.filter((series) => {
      if (series.image_count <= 0) return false;
      const modality = (series.modality || "").toUpperCase();
      return !NON_PREVIEW_MODALITIES.has(modality);
    });
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

    const loadOneSeriesThumbnail = async (seriesId: string): Promise<string | null> => {
      const middleResponse = await fetch(
        `${API_BASE_URL}/api/v1/series/${seriesId}/middle-instance`,
        {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );

      // 404 is expected for series that have no renderable instances.
      if (middleResponse.status === 404) {
        return null;
      }

      if (!middleResponse.ok) {
        throw new Error(`Middle instance lookup failed (${middleResponse.status})`);
      }

      const middlePayload = await middleResponse.json();
      const middleInstanceUid = middlePayload?.data?.instance_uid as
        | string
        | undefined;

      if (!middleInstanceUid) {
        return null;
      }

      return generateDicomInstanceThumbnail(middleInstanceUid, {
        apiBaseUrl: API_BASE_URL,
        authToken: token || undefined,
        size: 160,
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

  const isHorizontal = position !== "side";
  const isCompact = isHorizontal;
  const isSingleLine = position === "side" && columns === 1;
  const gridClassName = columns === 2 ? "grid-cols-2 gap-2" : isSingleLine ? "grid-cols-1 gap-1" : "grid-cols-1 gap-3";
  const seriesListClassName = isHorizontal
    ? "flex gap-2 overflow-x-auto pb-1 items-stretch"
    : `grid ${gridClassName}`;
  const seriesItemClassName = isHorizontal
    ? "w-[160px] flex-shrink-0"
    : "";
  const borderClass =
    position === "side"
      ? "border-r"
      : position === "top"
        ? "border-b"
        : "border-t";
  const sizeClass = position === "side" ? "w-64" : "w-full h-44";

  if (!caseData) {
    return (
      <aside
        className={`${sizeClass} bg-gray-900 ${borderClass} border-gray-700 flex flex-col items-center justify-center p-4`}
      >
        <p className="text-red-400 text-sm text-center">No data available</p>
      </aside>
    );
  }

  // Get temp series for the current selected series
  const currentTempSeries = temporaryMPRSeries.filter(
    (ts) =>
      ts.sourceSeriesId === selectedSeries?._id &&
      ts.mprMode !== "MiniMIP" &&
      ts.mprMode !== "MIP",
  );

  return (
    <aside
      className={`${sizeClass} bg-gray-900 ${borderClass} border-gray-700 flex flex-col overflow-hidden`}
    >
      {/* Patient Header */}
      {position === "side" && (
        <div className="p-3 border-b border-gray-700 bg-gray-800/50">
          <p className="text-sm font-semibold text-white truncate">
            {caseData.patient?.name || "Unknown Patient"}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            ID: {caseData.patient?.patient_id || "N/A"} • {caseData.patient?.sex || "U"}
          </p>
        </div>
      )}

      {/* VRT active indicator */}
      {isVRTActive && (
        <div
          className={`${isHorizontal ? "px-2 py-1" : "px-3 py-2"} bg-purple-900/30 border-b border-purple-800/50`}
        >
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
          showHeader={position === "side"}
          contentClassName={isHorizontal ? "px-2 pb-1" : "px-2 pb-2 space-y-1"}
        >
          <div className={seriesListClassName}>
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
                  thumbnailLoading={
                    !(series._id in seriesThumbnails) &&
                    !NON_PREVIEW_MODALITIES.has((series.modality || "").toUpperCase())
                  }
                  dragPayload={{ seriesId: series._id, kind: "regular" }}
                  isDraggable={!isVRTActive}
                  loadProgress={
                    seriesLoadProgress?.seriesId === series._id
                      ? { fetched: seriesLoadProgress.fetched, total: seriesLoadProgress.total }
                      : null
                  }
                  isDownloaded={downloadedSeriesIds.has(series._id)}
                  className={seriesItemClassName}
                  isCompact={isCompact}
                  singleLine={isSingleLine}
                />
              ))}
          </div>
        </StudyAccordion>

        {/* Placeholder for previous studies - would be populated from API */}
        {/* Previous studies would be fetched based on patient_id and displayed here */}

        {/* Temporary MPR Series Section */}
        {currentTempSeries.length > 0 && (
          <div className="border-b border-gray-700">
            <div className={isHorizontal ? "p-1.5" : "p-2"}>
              <p
                className={`text-purple-400 font-medium mb-2 flex items-center gap-1 ${
                  isHorizontal ? "text-[9px]" : "text-[10px]"
                }`}
              >
                <Layers size={10} />
                Generated MPR Views
              </p>
              <div className={seriesListClassName}>
                {currentTempSeries.map((tempSeries) => (
                  <MPRSeriesItem
                    key={tempSeries.id}
                    series={tempSeries}
                    isSelected={selectedTemporarySeriesId === tempSeries.id}
                    onClick={() => handleSelectTempSeries(tempSeries)}
                    onRemove={() => removeTemporaryMPRSeries(tempSeries.id)}
                    dragPayload={{ seriesId: tempSeries.id, kind: "mpr" }}
                    isDraggable={!isVRTActive}
                    className={seriesItemClassName}
                    isCompact={isCompact}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer with selected series info */}
      <div
        className={`${isHorizontal ? "p-1" : "p-2"} border-t border-gray-700 bg-gray-800/50`}
      >
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
