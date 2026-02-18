import { useParams } from "react-router-dom";
import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  type DragEvent,
} from "react";
import {
  useViewerContext,
  type TemporaryMPRSeries,
  type MPRSliceData,
  type MPRMode,
  type ViewTransform,
} from "@/components/ViewerLayout";
import { getCookie } from "@/lib/cookies";
import DicomViewer, { type ScoutLine } from "@/components/viewer/DicomViewer";
import SRViewer from "@/components/viewer/SRViewer";
import TemporaryMPRSeriesViewer from "@/components/viewer/TemporaryMPRSeriesViewer";
import VRTViewer from "@/components/viewer/VRTViewer";
import { Loader2 } from "lucide-react";
import {
  type Instance as MPRInstance,
  type VolumeData,
  type PlaneType,
  validateStackability,
  sortSlicesByPosition,
  buildVolume,
  extractSlice,
  getMaxIndex,
  calculateSliceNormal,
  getSliceGeometry,
  extractMiniMIPSlice,
} from "@/lib/mpr";
import toast from "react-hot-toast";
import { imageCache } from "@/lib/imageCache";

// Instance interface matching the ACTUAL API response
interface Instance {
  instance_uid: string;
  imageId: string;
  sort_key: number;
  rows: number;
  columns: number;
  pixel_spacing: number[];
  slice_thickness: number;
  image_position_patient: number[];
  image_orientation_patient: number[];
  window_center: number;
  window_width: number;
  rescale_slope: number;
  rescale_intercept: number;
  photometric_interpretation: string;
  samples_per_pixel: number;
  modality: string;
}

interface InstancesResponse {
  seriesId: string;
  count: number;
  instances: Instance[];
}

const DEFAULT_PANE_VIEW_TRANSFORM: ViewTransform = {
  x: 0,
  y: 0,
  scale: 0.65,
  rotation: 0,
  flipH: false,
  flipV: false,
  invert: false,
  windowWidth: null,
  windowCenter: null,
};

const SERIES_DND_MIME = "application/x-sync-pacs-series";

interface DragSeriesPayload {
  seriesId: string;
  kind: "regular" | "mpr";
}

const parseDroppedSeriesId = (event: DragEvent<HTMLDivElement>): string | null => {
  const rawPayload = event.dataTransfer.getData(SERIES_DND_MIME);
  if (rawPayload) {
    try {
      const parsed = JSON.parse(rawPayload) as Partial<DragSeriesPayload>;
      if (typeof parsed.seriesId === "string" && parsed.seriesId.trim()) {
        return parsed.seriesId;
      }
    } catch {
      // ignore malformed payload and fallback to text/plain
    }
  }

  const fallback = event.dataTransfer.getData("text/plain");
  return fallback?.trim() || null;
};

// Self-contained pane viewer for multi-pane grid layout
type PlaneOrientation = "Axial" | "Coronal" | "Sagittal";

interface PaneViewerProps {
  paneIndex: number;
  seriesId: string | null;
  isActive: boolean;
  isFullscreen: boolean;
  onActivate: () => void;
  onToggleFullscreen: () => void;
  onImageIndexChange: (paneIndex: number, index: number, total: number, plane: PlaneOrientation | null, sourceSeriesId: string | null) => void;
  scoutLines: ScoutLine[];
}

const PaneViewer = ({
  paneIndex,
  seriesId,
  isActive,
  isFullscreen,
  onActivate,
  onToggleFullscreen,
  onImageIndexChange,
  scoutLines,
}: PaneViewerProps) => {
  const { caseData, paneStates, setPaneStates, temporaryMPRSeries } = useViewerContext();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

  const series = caseData?.series?.find((s) => s._id === seriesId);
  const selectedTempMPR = temporaryMPRSeries.find((ts) => ts.id === seriesId);
  const paneTransform =
    paneStates[paneIndex]?.viewTransform ?? DEFAULT_PANE_VIEW_TRANSFORM;

  // Select a series for this pane
  const handleSelectSeries = useCallback(
    (newSeriesId: string) => {
      setPaneStates((prev) => {
        const newStates = [...prev];
        if (newStates[paneIndex]) {
          newStates[paneIndex] = {
            ...newStates[paneIndex],
            seriesId: newSeriesId,
            currentImageIndex: 0,
            viewTransform: { ...DEFAULT_PANE_VIEW_TRANSFORM },
          };
        }
        return newStates;
      });
    },
    [paneIndex, setPaneStates],
  );

  const handlePaneTransformChange = useCallback(
    (
      transform:
        | ViewTransform
        | ((prev: ViewTransform) => ViewTransform),
    ) => {
      setPaneStates((prev) => {
        const newStates = [...prev];
        if (!newStates[paneIndex]) return prev;
        const previousTransform =
          newStates[paneIndex].viewTransform ?? DEFAULT_PANE_VIEW_TRANSFORM;
        const nextTransform =
          typeof transform === "function"
            ? transform(previousTransform)
            : transform;
        newStates[paneIndex] = {
          ...newStates[paneIndex],
          viewTransform: nextTransform,
        };
        return newStates;
      });
    },
    [paneIndex, setPaneStates],
  );

  useEffect(() => {
    if (!seriesId || selectedTempMPR) {
      setInstances([]);
      return;
    }
    let cancelled = false;
    setInstances([]);
    setIsLoading(true);
    fetch(`${API_BASE_URL}/api/v1/series/${seriesId}/instances`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getCookie("jwt")}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch instances");
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          const inst = Array.isArray(data.instances) ? data.instances : [];
          setInstances(inst);
        }
      })
      .catch((err) => console.error(`Pane ${paneIndex} fetch error:`, err))
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [seriesId, API_BASE_URL, paneIndex]);

  // Detect orientation of regular series from DICOM metadata
  const detectedPlane: PlaneOrientation | null = useMemo(() => {
    if (instances.length === 0) return null;
    const iop = instances[0]?.image_orientation_patient;
    if (!iop || iop.length !== 6) return null;
    const normal = calculateSliceNormal(iop);
    const absX = Math.abs(normal[0]);
    const absY = Math.abs(normal[1]);
    const absZ = Math.abs(normal[2]);
    if (absZ > absX && absZ > absY) return "Axial";
    if (absY > absX && absY > absZ) return "Coronal";
    if (absX > absY && absX > absZ) return "Sagittal";
    return null;
  }, [instances]);

  // Derive plane and source for MPR temp series
  const mprPlane: PlaneOrientation | null = useMemo(() => {
    if (!selectedTempMPR) return null;
    const mode = selectedTempMPR.mprMode;
    if (mode === "Axial" || mode === "Coronal" || mode === "Sagittal") return mode;
    return null;
  }, [selectedTempMPR]);

  const activePlane = selectedTempMPR ? mprPlane : detectedPlane;
  const activeSourceSeriesId = selectedTempMPR ? selectedTempMPR.sourceSeriesId : seriesId;

  // Report initial image info when instances load
  useEffect(() => {
    if (instances.length > 0) {
      onImageIndexChange(paneIndex, 0, instances.length, activePlane, activeSourceSeriesId);
    }
  }, [instances.length, paneIndex, activePlane, activeSourceSeriesId, onImageIndexChange]);

  // Report MPR series info when MPR is selected
  useEffect(() => {
    if (selectedTempMPR) {
      onImageIndexChange(paneIndex, 0, selectedTempMPR.sliceCount, mprPlane, selectedTempMPR.sourceSeriesId);
    }
  }, [selectedTempMPR, paneIndex, mprPlane, onImageIndexChange]);

  const handleImageIndexChange = useCallback(
    (index: number) => {
      onImageIndexChange(paneIndex, index, instances.length, activePlane, activeSourceSeriesId);
    },
    [paneIndex, instances.length, activePlane, activeSourceSeriesId, onImageIndexChange],
  );

  const handleMPRImageIndexChange = useCallback(
    (index: number) => {
      onImageIndexChange(paneIndex, index, selectedTempMPR?.sliceCount ?? 0, mprPlane, selectedTempMPR?.sourceSeriesId ?? null);
    },
    [paneIndex, selectedTempMPR?.sliceCount, selectedTempMPR?.sourceSeriesId, mprPlane, onImageIndexChange],
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (
      !event.dataTransfer.types.includes(SERIES_DND_MIME) &&
      !event.dataTransfer.types.includes("text/plain")
    ) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragOver(false);

      const droppedSeriesId = parseDroppedSeriesId(event);
      if (!droppedSeriesId) return;

      handleSelectSeries(droppedSeriesId);
      onActivate();
    },
    [handleSelectSeries, onActivate],
  );

  return (
    <div
      className={`relative flex min-h-0 flex-col overflow-hidden ${isFullscreen ? "h-full" : ""} ${
        isDragOver
          ? "ring-2 ring-amber-400 ring-inset"
          : isActive
          ? "ring-2 ring-blue-500 ring-inset"
          : "ring-1 ring-gray-700 ring-inset"
      }`}
      onClick={onActivate}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between px-1.5 py-0.5 bg-gray-900/90 text-[10px] border-b border-gray-800 flex-shrink-0 z-10">
        <span className={`truncate ${seriesId ? "text-gray-300" : "text-gray-500"}`}>
          {selectedTempMPR
            ? selectedTempMPR.description
            : series
            ? `S${series.series_number}: ${series.description || "No description"}`
            : "Drop a series here"}
        </span>
        {seriesId && (
          <span className="text-gray-500 ml-1 flex-shrink-0">
            {selectedTempMPR ? `${selectedTempMPR.sliceCount} slc` : `${instances.length} img`}
          </span>
        )}
      </div>

      {selectedTempMPR ? (
        <TemporaryMPRSeriesViewer
          series={selectedTempMPR}
          className="flex-1 min-h-0"
          scoutLines={scoutLines}
          onImageIndexChange={handleMPRImageIndexChange}
          viewTransformOverride={paneTransform}
          onViewTransformChangeOverride={handlePaneTransformChange}
          isFullscreenOverride={isFullscreen}
          onToggleFullscreenOverride={onToggleFullscreen}
        />
      ) : instances.length > 0 ? (
        <DicomViewer
          instances={instances}
          seriesId={seriesId}
          paneIndex={paneIndex}
          scoutLines={scoutLines}
          onImageIndexChange={handleImageIndexChange}
          className="flex-1 min-h-0"
          paneViewTransform={paneTransform}
          onPaneViewTransformChange={handlePaneTransformChange}
          isPaneFullscreen={isFullscreen}
          onTogglePaneFullscreen={onToggleFullscreen}
        />
      ) : isLoading ? (
        <div className="flex-1 flex items-center justify-center bg-black">
          <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
        </div>
      ) : !seriesId ? (
        <div className="flex-1 flex items-center justify-center bg-black">
          <span className="text-gray-600 text-xs">Drag a series from the left panel and drop it here</span>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-black">
          <span className="text-gray-600 text-xs">No images</span>
        </div>
      )}
      {isDragOver && (
        <div className="pointer-events-none absolute inset-0 z-20 border-2 border-dashed border-amber-400 bg-amber-500/10 flex items-center justify-center">
          <span className="text-xs text-amber-200 font-medium uppercase tracking-wider">
            Drop Series
          </span>
        </div>
      )}
    </div>
  );
};

const CaseViewer = () => {
  useParams(); // Keep hook call for routing context
  const {
    caseData,
    selectedSeries,
    setSelectedSeries,
    selectedTemporarySeriesId,
    setSelectedTemporarySeriesId,
    temporaryMPRSeries,
    pendingMPRGeneration,
    clearPendingMPRGeneration,
    addTemporaryMPRSeries,
    viewTransform,
    setCrosshairIndices,
    gridLayout,
    paneStates,
    activePaneIndex,
    setActivePaneIndex,
    showScoutLine,
    isVRTActive,
    setIsVRTActive,
  } = useViewerContext();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // VRT volume reference (kept across renders, not in context to avoid re-renders)
  const vrtVolumeRef = useRef<VolumeData | null>(null);

  // Track series IDs known to have no instances so we can skip them
  const emptySeriesIds = useRef<Set<string>>(new Set());

  // 2D-MPR split layout state
  const [active2DMPRPane, setActive2DMPRPane] = useState<number>(0); // 0=axial, 1=coronal, 2=sagittal
  const [axialIndex, setAxialIndex] = useState(0);
  const [coronalIndex, setCoronalIndex] = useState(0);
  const [sagittalIndex, setSagittalIndex] = useState(0);
  const [fullscreenPaneIndex, setFullscreenPaneIndex] = useState<number | null>(
    null,
  );

  // Multi-pane scout line tracking: per-pane image index, total, plane, and source
  const [paneImageInfo, setPaneImageInfo] = useState<
    Record<number, { index: number; total: number; plane: PlaneOrientation | null; sourceSeriesId: string | null }>
  >({});

  const handlePaneImageIndexChange = useCallback(
    (paneIdx: number, index: number, total: number, plane: PlaneOrientation | null, sourceSeriesId: string | null) => {
      setPaneImageInfo((prev) => {
        const cur = prev[paneIdx];
        if (cur?.index === index && cur?.total === total && cur?.plane === plane && cur?.sourceSeriesId === sourceSeriesId)
          return prev;
        return { ...prev, [paneIdx]: { index, total, plane, sourceSeriesId } };
      });
    },
    [],
  );

  const clampRatio = (value: number) => Math.max(0, Math.min(1, value));

  const getScoutLinesForPane = useCallback(
    (currentPaneIdx: number): ScoutLine[] => {
      if (!showScoutLine || gridLayout === "1x1") return [];
      const currentInfo = paneImageInfo[currentPaneIdx];
      if (!currentInfo?.plane || !currentInfo.sourceSeriesId) return [];

      const sourcePlaneInfo = {
        Axial: null as null | { ratio: number; paneIdx: number },
        Coronal: null as null | { ratio: number; paneIdx: number },
        Sagittal: null as null | { ratio: number; paneIdx: number },
      };

      Object.entries(paneImageInfo).forEach(([paneIdxStr, info]) => {
        if (
          !info.plane ||
          !info.sourceSeriesId ||
          info.sourceSeriesId !== currentInfo.sourceSeriesId ||
          info.total <= 1
        ) {
          return;
        }

        const ratio = clampRatio(info.index / (info.total - 1));
        sourcePlaneInfo[info.plane] = {
          ratio,
          paneIdx: parseInt(paneIdxStr, 10),
        };
      });

      const planeColors = {
        Axial: "#00ff66",
        Coronal: "#ffe14d",
        Sagittal: "#00d4ff",
      } as const;

      const lines: ScoutLine[] = [];

      if (currentInfo.plane === "Axial") {
        if (sourcePlaneInfo.Coronal) {
          lines.push({
            ratio: sourcePlaneInfo.Coronal.ratio,
            color: planeColors.Coronal,
            label: `Cor P${sourcePlaneInfo.Coronal.paneIdx + 1}`,
            orientation: "horizontal",
          });
        }
        if (sourcePlaneInfo.Sagittal) {
          lines.push({
            ratio: sourcePlaneInfo.Sagittal.ratio,
            color: planeColors.Sagittal,
            label: `Sag P${sourcePlaneInfo.Sagittal.paneIdx + 1}`,
            orientation: "vertical",
          });
        }
      } else if (currentInfo.plane === "Coronal") {
        if (sourcePlaneInfo.Axial) {
          lines.push({
            ratio: clampRatio(1 - sourcePlaneInfo.Axial.ratio),
            color: planeColors.Axial,
            label: `Ax P${sourcePlaneInfo.Axial.paneIdx + 1}`,
            orientation: "horizontal",
          });
        }
        if (sourcePlaneInfo.Sagittal) {
          lines.push({
            ratio: sourcePlaneInfo.Sagittal.ratio,
            color: planeColors.Sagittal,
            label: `Sag P${sourcePlaneInfo.Sagittal.paneIdx + 1}`,
            orientation: "vertical",
          });
        }
      } else if (currentInfo.plane === "Sagittal") {
        if (sourcePlaneInfo.Axial) {
          lines.push({
            ratio: clampRatio(1 - sourcePlaneInfo.Axial.ratio),
            color: planeColors.Axial,
            label: `Ax P${sourcePlaneInfo.Axial.paneIdx + 1}`,
            orientation: "horizontal",
          });
        }
        if (sourcePlaneInfo.Coronal) {
          lines.push({
            ratio: sourcePlaneInfo.Coronal.ratio,
            color: planeColors.Coronal,
            label: `Cor P${sourcePlaneInfo.Coronal.paneIdx + 1}`,
            orientation: "vertical",
          });
        }
      }

      return lines;
    },
    [showScoutLine, gridLayout, paneImageInfo],
  );

  // MPR generation state
  const [isGeneratingMPR, setIsGeneratingMPR] = useState(false);
  const [mprGenerationProgress, setMprGenerationProgress] = useState({
    phase: "" as string,
    current: 0,
    total: 0,
  });
  // Volume cache (in-memory, cleared on page refresh)
  const volumeCache = useRef<Map<string, VolumeData>>(new Map());
  // imageCache is now global singleton from imageCache.ts

  // Create a Map wrapper for imageCache to work with buildVolume API
  const imageCacheMap = useRef<Map<string, ArrayBuffer>>({
    get: (key: string) => imageCache.get(key),
    set: (key: string, value: ArrayBuffer) => imageCache.set(key, value),
    has: (key: string) => imageCache.has(key),
    delete: (key: string) => imageCache.delete(key),
    clear: () => imageCache.clear(),
    forEach: () => { },
    entries: () => [][Symbol.iterator](),
    keys: () => [][Symbol.iterator](),
    values: () => [][Symbol.iterator](),
    [Symbol.iterator]: () => [][Symbol.iterator](),
    [Symbol.toStringTag]: "Map",
    size: 0,
  } as unknown as Map<string, ArrayBuffer>);

  // Find selected temporary series if any
  const selectedTempSeries = selectedTemporarySeriesId
    ? temporaryMPRSeries.find((ts) => ts.id === selectedTemporarySeriesId)
    : null;

  // Detect 2D-MPR layout mode: Axial, Coronal, and Sagittal temp series exist for same source
  const mpr2DSeries = useMemo(() => {
    if (!selectedSeries) return null;
    const sourceId = selectedSeries._id;
    let sourcePlane: PlaneOrientation | null = null;
    if (instances[0]?.image_orientation_patient?.length === 6) {
      const normal = calculateSliceNormal(instances[0].image_orientation_patient);
      const absX = Math.abs(normal[0]);
      const absY = Math.abs(normal[1]);
      const absZ = Math.abs(normal[2]);
      if (absZ > absX && absZ > absY) sourcePlane = "Axial";
      else if (absY > absX && absY > absZ) sourcePlane = "Coronal";
      else if (absX > absY && absX > absZ) sourcePlane = "Sagittal";
    }
    const axial =
      sourcePlane === "Axial"
        ? null
        : temporaryMPRSeries.find(
            (ts) =>
              ts.sourceSeriesId === sourceId &&
              ts.description.includes("(2D-MPR)") &&
              ts.mprMode === "Axial",
          ) ?? null;
    const coronal = temporaryMPRSeries.find(
      (ts) => ts.sourceSeriesId === sourceId && ts.description.includes("(2D-MPR)") && ts.mprMode === "Coronal",
    );
    const sagittal = temporaryMPRSeries.find(
      (ts) => ts.sourceSeriesId === sourceId && ts.description.includes("(2D-MPR)") && ts.mprMode === "Sagittal",
    );
    if (coronal && sagittal) return { axial, coronal, sagittal };
    return null;
  }, [selectedSeries, temporaryMPRSeries, instances]);

  const is2DMPRLayout =
    !!mpr2DSeries &&
    !!selectedTempSeries &&
    selectedTempSeries.description.includes("(2D-MPR)") &&
    selectedTempSeries.sourceSeriesId === selectedSeries?._id;

  // Scout line computation for 2D-MPR layout
  const get2DMPRScoutLines = useCallback(
    (targetPane: number): ScoutLine[] => {
      if (!mpr2DSeries) return [];
      const lines: ScoutLine[] = [];

      // Ratios: position of each pane's current slice as 0-1
      const axialTotal = mpr2DSeries.axial ? mpr2DSeries.axial.sliceCount : instances.length;
      const coronalTotal = mpr2DSeries.coronal.sliceCount;
      const sagittalTotal = mpr2DSeries.sagittal.sliceCount;

      const axialRatio = axialTotal > 1 ? clampRatio(axialIndex / (axialTotal - 1)) : 0;
      const coronalRatio = coronalTotal > 1 ? clampRatio(coronalIndex / (coronalTotal - 1)) : 0;
      const sagittalRatio = sagittalTotal > 1 ? clampRatio(sagittalIndex / (sagittalTotal - 1)) : 0;

      if (targetPane === 0) {
        // Axial view: show Coronal (horizontal) and Sagittal (vertical)
        lines.push({ ratio: coronalRatio, color: "#ffff00", orientation: "horizontal" });
        lines.push({ ratio: sagittalRatio, color: "#00ffff", orientation: "vertical" });
      } else if (targetPane === 1) {
        // Coronal view: show Axial (horizontal, inverted) and Sagittal (vertical)
        lines.push({ ratio: 1 - axialRatio, color: "#00ff00", orientation: "horizontal" });
        lines.push({ ratio: sagittalRatio, color: "#00ffff", orientation: "vertical" });
      } else if (targetPane === 2) {
        // Sagittal view: show Axial (horizontal, inverted) and Coronal (vertical)
        lines.push({ ratio: 1 - axialRatio, color: "#00ff00", orientation: "horizontal" });
        lines.push({ ratio: coronalRatio, color: "#ffff00", orientation: "vertical" });
      }

      return lines;
    },
    [mpr2DSeries, instances.length, axialIndex, coronalIndex, sagittalIndex],
  );

  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

  const fetchInstances = useCallback(async () => {
    if (!selectedSeries?._id) {
      console.log("No series selected, skipping instance fetch");
      setInstances([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    setInstances([]);

    try {
      console.log(`Fetching instances for series: ${selectedSeries._id}`);
      const response = await fetch(
        `${API_BASE_URL}/api/v1/series/${selectedSeries._id}/instances`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getCookie("jwt")}`,
          },
        },
      );

      console.log(`Instance fetch response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Instance fetch error response: ${errorText}`);
        throw new Error(`Failed to fetch instances: ${response.statusText}`);
      }

      const data: InstancesResponse = await response.json();
      console.log("Instance fetch successful:", { seriesId: data.seriesId, count: data.count, instancesLength: data.instances?.length });

      if (Array.isArray(data.instances)) {
        console.log(`Setting ${data.instances.length} instances`);
        setInstances(data.instances);
      } else if (data.instances) {
        // Handle case where instances might be in a different structure
        console.warn("Instances not in array format, attempting conversion:", data);
        const instancesArray = Array.isArray(data.instances) ? data.instances : [];
        setInstances(instancesArray);
      } else {
        console.warn("No instances found in response:", data);
        setInstances([]);
      }
    } catch (err) {
      console.error("Error fetching instances:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch instances",
      );
      setInstances([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedSeries?._id, API_BASE_URL]);

  useEffect(() => {
    fetchInstances();
  }, [fetchInstances]);

  useEffect(() => {
    if (gridLayout === "1x1") {
      setFullscreenPaneIndex(null);
      return;
    }
    const layoutConfig: Record<string, { rows: number; cols: number }> = {
      "1x2": { rows: 1, cols: 2 },
      "2x2": { rows: 2, cols: 2 },
    };
    const config = layoutConfig[gridLayout] || { rows: 1, cols: 1 };
    const paneCount = config.rows * config.cols;
    if (fullscreenPaneIndex !== null && fullscreenPaneIndex >= paneCount) {
      setFullscreenPaneIndex(null);
    }
  }, [gridLayout, fullscreenPaneIndex]);

  // Auto-skip series that return no instances — select the next available series
  useEffect(() => {
    if (isLoading || !selectedSeries || instances.length > 0 || !caseData?.series) return;

    // Mark this series as empty
    emptySeriesIds.current.add(selectedSeries._id);

    // Find the next series that isn't known to be empty
    const sortedSeries = [...caseData.series]
      .filter((s) => s.image_count > 0 && !emptySeriesIds.current.has(s._id))
      .sort((a, b) => a.series_number - b.series_number);

    if (sortedSeries.length > 0) {
      // Pick the next series after the current one, or the first available
      const currentIdx = sortedSeries.findIndex(
        (s) => s.series_number > selectedSeries.series_number,
      );
      const nextSeries = currentIdx >= 0 ? sortedSeries[currentIdx] : sortedSeries[0];
      setSelectedSeries(nextSeries);
    }
  }, [isLoading, instances.length, selectedSeries, caseData?.series, setSelectedSeries]);

  // Handle pending MPR generation
  useEffect(() => {
    if (!pendingMPRGeneration || !selectedSeries || instances.length === 0) {
      return;
    }

    // Check if this request is for the current series
    if (pendingMPRGeneration.seriesId !== selectedSeries._id) {
      clearPendingMPRGeneration();
      return;
    }

    // Detect current series orientation and block redundant MPR generation
    const requestedMode = pendingMPRGeneration.mode;
    if (
      (requestedMode === "Axial" || requestedMode === "Coronal" || requestedMode === "Sagittal") &&
      instances.length > 0 &&
      instances[0].image_orientation_patient?.length === 6
    ) {
      const normal = calculateSliceNormal(instances[0].image_orientation_patient);
      const absX = Math.abs(normal[0]);
      const absY = Math.abs(normal[1]);
      const absZ = Math.abs(normal[2]);

      let detectedOrientation: string | null = null;
      if (absZ > absX && absZ > absY) detectedOrientation = "Axial";
      else if (absY > absX && absY > absZ) detectedOrientation = "Coronal";
      else if (absX > absY && absX > absZ) detectedOrientation = "Sagittal";

      if (detectedOrientation === requestedMode) {
        toast(`You are already in ${requestedMode} orientation`);
        clearPendingMPRGeneration();
        return;
      }
    }

    const generateMPR = async () => {
      setIsGeneratingMPR(true);
      const mode = pendingMPRGeneration.mode;

      try {
        // Check if we have a cached volume for this series
        let volume = volumeCache.current.get(selectedSeries._id);

        if (!volume) {
          // Validate stackability
          const validation = validateStackability(instances as MPRInstance[]);
          if (!validation.valid) {
            console.error("Series not stackable:", validation.errors);
            clearPendingMPRGeneration();
            setIsGeneratingMPR(false);
            return;
          }

          // Sort slices
          const { sortedInstances } = sortSlicesByPosition(
            instances as MPRInstance[],
          );

          // Build volume
          setMprGenerationProgress({
            phase: "volume",
            current: 0,
            total: instances.length,
          });
          const volumeProgressStep = Math.max(
            8,
            Math.floor(instances.length / 50),
          );
          let lastVolumeProgress = 0;
          volume = await buildVolume(
            sortedInstances,
            imageCacheMap.current,
            API_BASE_URL,
            getCookie("jwt") || "",
            (loaded, total) => {
              if (
                loaded !== total &&
                loaded - lastVolumeProgress < volumeProgressStep
              ) {
                return;
              }
              lastVolumeProgress = loaded;
              setMprGenerationProgress({
                phase: "volume",
                current: loaded,
                total,
              });
            },
          );

          // Cache the volume
          volumeCache.current.set(selectedSeries._id, volume);

          // Initialize crosshair to center
          setCrosshairIndices({
            x: Math.floor(volume.dimensions[0] / 2),
            y: Math.floor(volume.dimensions[1] / 2),
            z: Math.floor(volume.dimensions[2] / 2),
          });
        }

        const windowWidth =
          viewTransform.windowWidth ?? volume.windowWidth ?? 400;
        const windowCenter =
          viewTransform.windowCenter ?? volume.windowCenter ?? 40;

        const generateSlices = async (
          totalSlices: number,
          phase: string,
          extractor: (index: number) => {
            data: Int16Array;
            width: number;
            height: number;
          },
        ): Promise<MPRSliceData[]> => {
          const slices: MPRSliceData[] = new Array(totalSlices);
          const progressUpdateEvery = Math.max(8, Math.floor(totalSlices / 40));
          const yieldEvery = Math.max(6, Math.floor(totalSlices / 100));

          setMprGenerationProgress({
            phase,
            current: 0,
            total: totalSlices,
          });

          for (let i = 0; i < totalSlices; i++) {
            const sliceResult = extractor(i);

            slices[i] = {
              index: i,
              rawData: sliceResult.data,
              width: sliceResult.width,
              height: sliceResult.height,
            };

            const completed = i + 1;
            if (completed === totalSlices || completed % progressUpdateEvery === 0) {
              setMprGenerationProgress({
                phase,
                current: completed,
                total: totalSlices,
              });
            }

            if (completed < totalSlices && completed % yieldEvery === 0) {
              await new Promise<void>((resolve) => {
                if (typeof requestAnimationFrame === "function") {
                  requestAnimationFrame(() => resolve());
                } else {
                  setTimeout(() => resolve(), 0);
                }
              });
            }
          }

          return slices;
        };

        // Handle 2D-MPR: generate all three planes
        if (mode === "2D-MPR") {
          let sourcePlane: PlaneOrientation | null = null;
          if (instances[0]?.image_orientation_patient?.length === 6) {
            const normal = calculateSliceNormal(instances[0].image_orientation_patient);
            const absX = Math.abs(normal[0]);
            const absY = Math.abs(normal[1]);
            const absZ = Math.abs(normal[2]);
            if (absZ > absX && absZ > absY) sourcePlane = "Axial";
            else if (absY > absX && absY > absZ) sourcePlane = "Coronal";
            else if (absX > absY && absX > absZ) sourcePlane = "Sagittal";
          }

          // If source stack is already axial, skip redundant axial MPR generation.
          const planes: PlaneType[] =
            sourcePlane === "Axial"
              ? ["Coronal", "Sagittal"]
              : ["Axial", "Coronal", "Sagittal"];

          const generatedSeries: TemporaryMPRSeries[] = [];
          for (const plane of planes) {
            const totalSlices = getMaxIndex(volume, plane) + 1;
            const slices = await generateSlices(
              totalSlices,
              `slices-${plane}`,
              (index) => extractSlice(volume, plane, index),
            );

            // Create temporary series for this plane
            const geometry = getSliceGeometry(volume, plane);
            const tempSeries: TemporaryMPRSeries = {
              id: `mpr-${selectedSeries._id}-${plane}-${Date.now()}`,
              sourceSeriesId: selectedSeries._id,
              mprMode: plane as MPRMode,
              description: `${plane} (2D-MPR) from ${selectedSeries.description || "Series " + selectedSeries.series_number}`,
              slices,
              sliceCount: slices.length,
              createdAt: Date.now(),
              windowCenter,
              windowWidth,
              physicalAspectRatio: geometry.aspectRatio,
            };

            generatedSeries.push(tempSeries);
          }

          for (let i = 0; i < generatedSeries.length; i++) {
            const tempSeries = generatedSeries[i];
            addTemporaryMPRSeries(tempSeries, {
              autoSelect: i === generatedSeries.length - 1,
            });
          }
        }
        // Handle 3D-MPR: Activate VRT (3D Volume Rendering)
        else if (mode === "3D-MPR") {
          if (gridLayout !== "1x1") {
            toast("3D VRT is only available in 1x1 layout");
            clearPendingMPRGeneration();
            setIsGeneratingMPR(false);
            setMprGenerationProgress({ phase: "", current: 0, total: 0 });
            return;
          }
          // Store volume reference and activate VRT mode
          vrtVolumeRef.current = volume;
          setIsVRTActive(true);
          setSelectedTemporarySeriesId(null);
        }
        // Handle MiniMIP: thin-slab Maximum Intensity Projection along axial plane
        else if (mode === "MiniMIP") {
          const plane: PlaneType = "Axial";
          const totalSlices = getMaxIndex(volume, plane) + 1;
          const slabHalfSize = 5; // ~11 slices per slab
          const slices = await generateSlices(totalSlices, "slices", (index) =>
            extractMiniMIPSlice(volume, plane, index, slabHalfSize),
          );

          const geoMiniMIP = getSliceGeometry(volume, plane);
          const tempSeries: TemporaryMPRSeries = {
            id: `mpr-${selectedSeries._id}-MiniMIP-${Date.now()}`,
            sourceSeriesId: selectedSeries._id,
            mprMode: "MiniMIP" as MPRMode,
            description: `MiniMIP from ${selectedSeries.description || "Series " + selectedSeries.series_number}`,
            slices,
            sliceCount: slices.length,
            createdAt: Date.now(),
            windowCenter,
            windowWidth,
            physicalAspectRatio: geoMiniMIP.aspectRatio,
          };

          addTemporaryMPRSeries(tempSeries);
        }
        // Handle single plane (Axial, Coronal, Sagittal)
        else {
          const plane = mode as PlaneType;
          const totalSlices = getMaxIndex(volume, plane) + 1;
          const slices = await generateSlices(totalSlices, "slices", (index) =>
            extractSlice(volume, plane, index),
          );

          // Create the temporary series
          const geoSingle = getSliceGeometry(volume, plane);
          const tempSeries: TemporaryMPRSeries = {
            id: `mpr-${selectedSeries._id}-${plane}-${Date.now()}`,
            sourceSeriesId: selectedSeries._id,
            mprMode: plane as MPRMode,
            description: `${plane} from ${selectedSeries.description || "Series " + selectedSeries.series_number}`,
            slices,
            sliceCount: slices.length,
            createdAt: Date.now(),
            windowCenter,
            windowWidth,
            physicalAspectRatio: geoSingle.aspectRatio,
          };

          // Add and auto-select (addTemporaryMPRSeries handles auto-selection)
          addTemporaryMPRSeries(tempSeries);
        }
      } catch (err) {
        console.error("Failed to generate MPR:", err);
      } finally {
        clearPendingMPRGeneration();
        setIsGeneratingMPR(false);
        setMprGenerationProgress({ phase: "", current: 0, total: 0 });
      }
    };

    generateMPR();
  }, [
    pendingMPRGeneration,
    selectedSeries,
    instances,
    API_BASE_URL,
    clearPendingMPRGeneration,
    addTemporaryMPRSeries,
    viewTransform.windowWidth,
    viewTransform.windowCenter,
    setCrosshairIndices,
  ]);

  // Stable callbacks for 2D-MPR pane index changes (avoid re-render cascades)
  const handleAxialIndexChange = useCallback((idx: number) => setAxialIndex(idx), []);
  const handleCoronalIndexChange = useCallback((idx: number) => setCoronalIndex(idx), []);
  const handleSagittalIndexChange = useCallback((idx: number) => setSagittalIndex(idx), []);

  // Memoized scout lines for each 2D-MPR pane
  const scoutLinesAxial = useMemo(() => get2DMPRScoutLines(0), [get2DMPRScoutLines]);
  const scoutLinesCoronal = useMemo(() => get2DMPRScoutLines(1), [get2DMPRScoutLines]);
  const scoutLinesSagittal = useMemo(() => get2DMPRScoutLines(2), [get2DMPRScoutLines]);

  // VRT exit handler
  const handleExitVRT = useCallback(() => {
    setIsVRTActive(false);
    vrtVolumeRef.current = null;
  }, [setIsVRTActive]);

  // Show VRT viewer when active
  if (isVRTActive && vrtVolumeRef.current) {
    return (
      <div className="flex-1 flex flex-col bg-black h-full relative">
        <VRTViewer
          volume={vrtVolumeRef.current}
          onExit={handleExitVRT}
          className="flex-1"
        />
      </div>
    );
  }

  // Show MPR generation progress
  if (isGeneratingMPR) {
    const progress =
      mprGenerationProgress.total > 0
        ? Math.round(
          (mprGenerationProgress.current / mprGenerationProgress.total) * 100,
        )
        : 0;
    const phaseText =
      mprGenerationProgress.phase === "volume"
        ? "Building volume..."
        : "Generating slices...";

    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-black">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
        <p className="text-gray-400 text-sm mt-3">{phaseText}</p>
        <div className="w-48 h-1 bg-gray-700 rounded mt-3 overflow-hidden">
          <div
            className="h-full bg-purple-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-gray-500 text-xs mt-2">
          {mprGenerationProgress.current} / {mprGenerationProgress.total}
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-gray-400 text-sm">Loading series images...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-black">
        <div className="text-center">
          <p className="text-red-400 mb-2">Error loading images</p>
          <p className="text-gray-500 text-sm">{error}</p>
          <button
            onClick={fetchInstances}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!selectedSeries) {
    return (
      <div className="flex-1 flex items-center justify-center bg-black">
        <div className="text-center">
          <p className="text-gray-400">
            Select a series from the sidebar to view images
          </p>
          {caseData && (!caseData.series || caseData.series.length === 0) && (
            <p className="text-red-400 text-sm mt-4">
              No series found in case. The case data may not be properly loaded.
            </p>
          )}
        </div>
      </div>
    );
  }

  // If instances are empty, the auto-skip effect will handle selecting the next series.
  // Show a loading state while it transitions, or a message if all series are empty.
  if (instances.length === 0 && !isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-black">
        <span className="text-gray-500 text-sm">Loading next series...</span>
      </div>
    );
  }

  // 2D-MPR split layout: Left (Coronal + Sagittal stacked) | Right (Axial)
  if (is2DMPRLayout && mpr2DSeries) {
    return (
      <div className="flex-1 flex bg-black h-full gap-0.5">
        {/* Left column — Coronal (top) + Sagittal (bottom) */}
        <div className="w-1/2 flex flex-col gap-0.5 min-w-0">
          {/* Coronal — top */}
          <div
            className={`flex-1 min-h-0 relative overflow-hidden ${active2DMPRPane === 1 ? "ring-2 ring-green-500 ring-inset" : "ring-1 ring-gray-700 ring-inset"}`}
            onClick={() => setActive2DMPRPane(1)}
          >
            <TemporaryMPRSeriesViewer
              series={mpr2DSeries.coronal}
              className="h-full"
              scoutLines={scoutLinesCoronal}
              onImageIndexChange={handleCoronalIndexChange}
              compact
            />
          </div>
          {/* Sagittal — bottom */}
          <div
            className={`flex-1 min-h-0 relative overflow-hidden ${active2DMPRPane === 2 ? "ring-2 ring-green-500 ring-inset" : "ring-1 ring-gray-700 ring-inset"}`}
            onClick={() => setActive2DMPRPane(2)}
          >
            <TemporaryMPRSeriesViewer
              series={mpr2DSeries.sagittal}
              className="h-full"
              scoutLines={scoutLinesSagittal}
              onImageIndexChange={handleSagittalIndexChange}
              compact
            />
          </div>
        </div>

        {/* Right column — Axial */}
        <div
          className={`w-1/2 min-h-0 min-w-0 overflow-hidden ${active2DMPRPane === 0 ? "ring-2 ring-green-500 ring-inset" : "ring-1 ring-gray-700 ring-inset"}`}
          onClick={() => setActive2DMPRPane(0)}
        >
          {mpr2DSeries.axial ? (
            <TemporaryMPRSeriesViewer
              series={mpr2DSeries.axial}
              className="h-full"
              scoutLines={scoutLinesAxial}
              onImageIndexChange={handleAxialIndexChange}
              compact
            />
          ) : (
            <DicomViewer
              instances={instances}
              seriesId={selectedSeries._id}
              className="h-full"
              scoutLines={scoutLinesAxial}
              onImageIndexChange={handleAxialIndexChange}
            />
          )}
        </div>
      </div>
    );
  }

  // Multi-pane grid layout
  if (gridLayout !== "1x1") {
    const layoutConfig: Record<string, { rows: number; cols: number }> = {
      "1x2": { rows: 1, cols: 2 },
      "2x2": { rows: 2, cols: 2 },
    };
    const config = layoutConfig[gridLayout] || { rows: 1, cols: 1 };
    const paneCount = config.rows * config.cols;

    if (fullscreenPaneIndex !== null) {
      const paneIdx = fullscreenPaneIndex;
      return (
        <div className="flex-1 flex flex-col bg-black h-full min-h-0">
          <PaneViewer
            paneIndex={paneIdx}
            seriesId={paneStates[paneIdx]?.seriesId || null}
            isActive={activePaneIndex === paneIdx}
            isFullscreen={true}
            onActivate={() => setActivePaneIndex(paneIdx)}
            onToggleFullscreen={() => setFullscreenPaneIndex(null)}
            onImageIndexChange={handlePaneImageIndexChange}
            scoutLines={getScoutLinesForPane(paneIdx)}
          />
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col bg-black h-full min-h-0">
        <div
          className="flex-1 grid gap-0.5"
          style={{
            gridTemplateColumns: `repeat(${config.cols}, 1fr)`,
            gridTemplateRows: `repeat(${config.rows}, 1fr)`,
          }}
        >
          {Array.from({ length: paneCount }).map((_, idx) => (
            <PaneViewer
              key={idx}
              paneIndex={idx}
              seriesId={paneStates[idx]?.seriesId || null}
              isActive={activePaneIndex === idx}
              isFullscreen={false}
              onActivate={() => setActivePaneIndex(idx)}
              onToggleFullscreen={() =>
                setFullscreenPaneIndex((prev) => (prev === idx ? null : idx))
              }
              onImageIndexChange={handlePaneImageIndexChange}
              scoutLines={getScoutLinesForPane(idx)}
            />
          ))}
        </div>
      </div>
    );
  }

  // Single-pane (1x1) layout
  return (
    <div className="flex-1 flex flex-col bg-black h-full min-h-0">
      {/* Series info header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900/50 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">
            Series {selectedSeries.series_number}:{" "}
            {selectedSeries.description || "No description"}
          </span>
          <span className="text-xs text-gray-500">
            {selectedSeries.modality} • {instances.length}{" "}
            {selectedSeries.modality === "SR" ? "document(s)" : "images"}
          </span>
        </div>
        {caseData && (
          <span className="text-xs text-gray-500">
            {caseData.patient?.name} • {caseData.accession_number}
          </span>
        )}
      </div>

      {/* Viewer - Temporary MPR series, SR, or DicomViewer */}
      {selectedTempSeries ? (
        <TemporaryMPRSeriesViewer
          series={selectedTempSeries}
          className="flex-1 min-h-0"
        />
      ) : selectedSeries.modality === "SR" ? (
        <SRViewer instances={instances || []} className="flex-1 min-h-0" />
      ) : (
        <DicomViewer
          instances={instances || []}
          seriesId={selectedSeries._id}
          className="flex-1 min-h-0"
        />
      )}
    </div>
  );
};

export default CaseViewer;
