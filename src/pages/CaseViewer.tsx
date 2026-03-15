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
  getPaneScale,
  type PaneState,
  type TemporaryMPRSeries,
  type MPRSliceData,
  type MPRMode,
  type ViewTransform,
} from "@/components/ViewerLayout";
import { getCookie } from "@/lib/cookies";
import DicomViewer, { type ScoutLine } from "@/components/viewer/DicomViewer";
import SRViewer from "@/components/viewer/SRViewer";
import TemporaryMPRSeriesViewer from "@/components/viewer/TemporaryMPRSeriesViewer";
import ObliqueMPRViewer from "@/components/viewer/ObliqueMPRViewer";
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
  useMIPWorker,
  useMPRSliceWorker,
} from "@/lib/mpr";
import toast from "react-hot-toast";
import { imageCache } from "@/lib/imageCache";
import { getGridLayoutPaneCount, parseGridLayout } from "@/lib/gridLayout";

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

const makeDefaultPaneTransform = (paneCount: number): ViewTransform => ({
  x: 0,
  y: 0,
  scale: getPaneScale(paneCount),
  rotation: 0,
  flipH: false,
  flipV: false,
  invert: false,
  windowWidth: null,
  windowCenter: null,
});

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

interface WindowLevelPreset {
  windowWidth: number;
  windowCenter: number;
}

const estimateWindowLevelFromSlices = (
  slices: MPRSliceData[],
  fallback: WindowLevelPreset,
): WindowLevelPreset => {
  const sampledValues: number[] = [];
  const MAX_SAMPLES = 120000;
  const TARGET_SAMPLES_PER_SLICE = 1024;

  for (const slice of slices) {
    const rawData = slice.rawData;
    if (!rawData || rawData.length === 0) continue;
    if (sampledValues.length >= MAX_SAMPLES) break;

    const stride = Math.max(
      1,
      Math.floor(rawData.length / TARGET_SAMPLES_PER_SLICE),
    );
    for (
      let i = 0;
      i < rawData.length && sampledValues.length < MAX_SAMPLES;
      i += stride
    ) {
      sampledValues.push(rawData[i]);
    }
  }

  if (sampledValues.length < 64) {
    return fallback;
  }

  sampledValues.sort((a, b) => a - b);
  const lastIndex = sampledValues.length - 1;
  const lower = sampledValues[Math.floor(lastIndex * 0.02)];
  const upper = sampledValues[Math.ceil(lastIndex * 0.98)];

  if (!Number.isFinite(lower) || !Number.isFinite(upper) || upper <= lower) {
    return fallback;
  }

  const windowWidth = Math.max(1, upper - lower);
  const windowCenter = lower + windowWidth / 2;
  return { windowWidth, windowCenter };
};

const adjustProjectionWindowForSlab = (
  baseline: WindowLevelPreset,
  baselineSlabHalfSize: number,
  slabHalfSize: number,
  mode: "MiniMIP" | "MIP",
): WindowLevelPreset => {
  const baselineWindowWidth = Math.max(1, baseline.windowWidth);
  const clampedBaselineSlab = Math.max(0, baselineSlabHalfSize);
  const clampedSlab = Math.max(0, slabHalfSize);

  if (clampedSlab <= clampedBaselineSlab) {
    return {
      windowWidth: baselineWindowWidth,
      windowCenter: baseline.windowCenter,
    };
  }

  const slabDelta = clampedSlab - clampedBaselineSlab;
  const widthGainPerStep = mode === "MiniMIP" ? 0.4 : 0.2;
  const centerShiftRatio = mode === "MiniMIP" ? 0.18 : 0.12;

  const windowWidth = baselineWindowWidth * (1 + slabDelta * widthGainPerStep);
  const windowCenter =
    baseline.windowCenter + (windowWidth - baselineWindowWidth) * centerShiftRatio;

  return { windowWidth, windowCenter };
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
  onSliceNeeded?: (index: number) => Promise<Int16Array | null>;
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
  onSliceNeeded,
}: PaneViewerProps) => {
  const { caseData, paneStates, setPaneStates, temporaryMPRSeries, gridLayout, setActivePaneIndex, setSelectedTemporarySeriesId } = useViewerContext();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

  const paneCount = getGridLayoutPaneCount(gridLayout);
  const defaultTransform = makeDefaultPaneTransform(paneCount);

  const series = caseData?.series?.find((s) => s._id === seriesId);
  const selectedTempMPR = temporaryMPRSeries.find((ts) => ts.id === seriesId);
  const paneTransform =
    paneStates[paneIndex]?.viewTransform ?? defaultTransform;

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
          newStates[paneIndex].viewTransform ?? defaultTransform;
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
    [paneIndex, setPaneStates, defaultTransform],
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
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragOver(false);

      const droppedSeriesId = parseDroppedSeriesId(event);
      if (!droppedSeriesId) return;

      const paneCount = getGridLayoutPaneCount(gridLayout);
      const emptyPaneState = (sid: string | null): PaneState => ({
        seriesId: sid,
        currentImageIndex: 0,
        viewTransform: makeDefaultPaneTransform(paneCount),
        annotations: [],
        selectedAnnotationId: null,
      });
      setPaneStates((prev) => {
        const newStates = [...prev];
        while (newStates.length <= paneIndex) {
          newStates.push(emptyPaneState(null));
        }
        newStates[paneIndex] = emptyPaneState(droppedSeriesId);
        return newStates;
      });

      // Activate this pane directly instead of calling onActivate(), which
      // would trigger handleActivatePane → handleSetSelectedSeries. That
      // chain reads paneStates from a stale closure and overwrites the pane
      // we just updated, reverting it to the old series.
      setActivePaneIndex(paneIndex);

      // Sync the global selection to match the *dropped* series so the
      // sidebar / toolbar immediately reflect the new content.
      const temp = temporaryMPRSeries.find((ts) => ts.id === droppedSeriesId);
      if (temp) {
        setSelectedTemporarySeriesId(temp.id);
      } else {
        setSelectedTemporarySeriesId(null);
      }
    },
    [paneIndex, setPaneStates, gridLayout, setActivePaneIndex, temporaryMPRSeries, setSelectedTemporarySeriesId],
  );

  return (
    <div
      className={`relative flex min-h-0 flex-col overflow-hidden bg-black ${isFullscreen ? "h-full" : ""} ${
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
          isActive={isActive}
          viewTransformOverride={paneTransform}
          onViewTransformChangeOverride={handlePaneTransformChange}
          isFullscreenOverride={isFullscreen}
          onToggleFullscreenOverride={onToggleFullscreen}
          onSliceNeeded={
            selectedTempMPR.mprMode === "MiniMIP" || selectedTempMPR.mprMode === "MIP"
              ? onSliceNeeded
              : undefined
          }
        />
      ) : instances.length > 0 ? (
        <DicomViewer
          instances={instances}
          seriesId={seriesId}
          paneIndex={paneIndex}
          isActive={isActive}
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
    crosshairIndices,
    setCrosshairIndices,
    gridLayout,
    paneStates,
    activePaneIndex,
    setActivePaneIndex,
    showScoutLine,
    isVRTActive,
    setIsVRTActive,
    mprSyncMode,
    setMprSyncMode,
    mprSyncNowRef,
    is2DMPRActive,
    setIs2DMPRActive,
    mprLayoutPreset,
    mipIntensity,
    removeTemporaryMPRSeries,
  } = useViewerContext();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSinglePaneDragOver, setIsSinglePaneDragOver] = useState(false);

  // VRT volume reference (kept across renders, not in context to avoid re-renders)
  const vrtVolumeRef = useRef<VolumeData | null>(null);

  // Free the volume reference whenever 3D mode exits.
  useEffect(() => {
    if (!isVRTActive) {
      vrtVolumeRef.current = null;
    }
  }, [isVRTActive]);

  // Track series IDs known to have no instances so we can skip them
  const emptySeriesIds = useRef<Set<string>>(new Set());

  // 2D-MPR split layout state
  const [active2DMPRPane, setActive2DMPRPane] = useState<number>(0); // 0=axial, 1=coronal, 2=sagittal
  const [majorPane2DMPR, setMajorPane2DMPR] = useState<PlaneOrientation>("Axial");
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

  // When activating a pane, sync global selection to that pane so toolbar/MPR apply to the correct pane (each pane operates independently)
  const handleActivatePane = useCallback(
    (paneIdx: number) => {
      setActivePaneIndex(paneIdx);
      const seriesId = paneStates[paneIdx]?.seriesId ?? null;
      if (!seriesId || !caseData?.series) return;
      const temp = temporaryMPRSeries.find((ts) => ts.id === seriesId);
      if (temp) {
        setSelectedTemporarySeriesId(temp.id);
        const src = caseData.series.find((s) => s._id === temp.sourceSeriesId);
        if (src) setSelectedSeries(src);
      } else {
        const src = caseData.series.find((s) => s._id === seriesId);
        if (src) {
          setSelectedSeries(src);
          setSelectedTemporarySeriesId(null);
        }
      }
    },
    [
      paneStates,
      caseData?.series,
      temporaryMPRSeries,
      setActivePaneIndex,
      setSelectedSeries,
      setSelectedTemporarySeriesId,
    ],
  );

  const handleSinglePaneDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (
      !event.dataTransfer.types.includes(SERIES_DND_MIME) &&
      !event.dataTransfer.types.includes("text/plain")
    ) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsSinglePaneDragOver(true);
  }, []);

  const handleSinglePaneDragLeave = useCallback(() => {
    setIsSinglePaneDragOver(false);
  }, []);

  const handleSinglePaneDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsSinglePaneDragOver(false);

      const droppedSeriesId = parseDroppedSeriesId(event);
      if (!droppedSeriesId) return;

      const droppedTempSeries = temporaryMPRSeries.find(
        (tempSeries) => tempSeries.id === droppedSeriesId,
      );
      if (droppedTempSeries) {
        setSelectedTemporarySeriesId(droppedTempSeries.id);
        return;
      }

      const droppedSeries = caseData?.series?.find(
        (series) => series._id === droppedSeriesId,
      );
      if (!droppedSeries) return;

      setSelectedSeries(droppedSeries);
      setSelectedTemporarySeriesId(null);
    },
    [temporaryMPRSeries, setSelectedTemporarySeriesId, caseData?.series, setSelectedSeries],
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
  const [isGeneratingProjection, setIsGeneratingProjection] = useState(false);
  const [mprGenerationProgress, setMprGenerationProgress] = useState({
    phase: "" as string,
    current: 0,
    total: 0,
  });
  const [mprStartTime, setMprStartTime] = useState<number | null>(null);
  const [mprElapsed, setMprElapsed] = useState(0);
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

  // MIP Web Worker for on-demand slice computation
  const mipWorker = useMIPWorker();

  // MPR Slice Web Worker for progressive 2D-MPR loading
  const mprSliceWorker = useMPRSliceWorker();

  // Elapsed time tracker for MPR generation
  useEffect(() => {
    if (!mprStartTime) return;
    const interval = setInterval(() => {
      setMprElapsed(Math.floor((Date.now() - mprStartTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [mprStartTime]);

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

  // Sync 2D MPR pane indices from crosshair once when entering 2D MPR (single voxel across all three planes)
  const hasSynced2DMPRRef = useRef(false);
  useEffect(() => {
    if (!is2DMPRLayout || !mpr2DSeries) {
      hasSynced2DMPRRef.current = false;
      return;
    }
    if (hasSynced2DMPRRef.current) return;
    hasSynced2DMPRRef.current = true;
    const axialTotal = mpr2DSeries.axial ? mpr2DSeries.axial.sliceCount : 0;
    const coronalTotal = mpr2DSeries.coronal?.sliceCount ?? 0;
    const sagittalTotal = mpr2DSeries.sagittal?.sliceCount ?? 0;
    if (axialTotal > 0) setAxialIndex((_prev) => Math.max(0, Math.min(axialTotal - 1, crosshairIndices.z)));
    if (coronalTotal > 0) setCoronalIndex((_prev) => Math.max(0, Math.min(coronalTotal - 1, crosshairIndices.y)));
    if (sagittalTotal > 0) setSagittalIndex((_prev) => Math.max(0, Math.min(sagittalTotal - 1, crosshairIndices.x)));
  }, [is2DMPRLayout, mpr2DSeries, crosshairIndices.x, crosshairIndices.y, crosshairIndices.z]);

  // Scout line computation for 2D-MPR layout (respect global show-scout toggle so crosshair visible in all 3 planes)
  const get2DMPRScoutLines = useCallback(
    (targetPane: number): ScoutLine[] => {
      if (!mpr2DSeries || !showScoutLine) return [];
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
    [mpr2DSeries, instances.length, axialIndex, coronalIndex, sagittalIndex, showScoutLine],
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
    const paneCount = getGridLayoutPaneCount(gridLayout);
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

    const requestedMode = pendingMPRGeneration.mode;
    const isProjectionMode =
      requestedMode === "MiniMIP" || requestedMode === "MIP";
    if (
      (isProjectionMode && isGeneratingProjection) ||
      (!isProjectionMode && isGeneratingMPR)
    ) {
      return;
    }

    // Check if this request is for the current series
    if (pendingMPRGeneration.seriesId !== selectedSeries._id) {
      clearPendingMPRGeneration();
      return;
    }

    // Detect current series orientation and block redundant MPR generation
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
      const mode = pendingMPRGeneration.mode;
      const isProjectionMode = mode === "MiniMIP" || mode === "MIP";
      if (isProjectionMode) {
        setIsGeneratingProjection(true);
      } else {
        setIsGeneratingMPR(true);
        setMprStartTime(Date.now());
        setMprElapsed(0);
      }

      try {
        // Check if we have a cached volume for this series
        let volume = volumeCache.current.get(selectedSeries._id);
        const trackProgress = !isProjectionMode;

        if (!volume) {
          // Validate stackability
          const validation = validateStackability(instances as MPRInstance[]);
          if (!validation.valid) {
            console.error("Series not stackable:", validation.errors);
            return;
          }

          // Sort slices
          const { sortedInstances } = sortSlicesByPosition(
            instances as MPRInstance[],
          );

          if (trackProgress) {
            setMprGenerationProgress({
              phase: "volume",
              current: 0,
              total: instances.length,
            });
          }
          const volumeProgressStep = trackProgress
            ? Math.max(8, Math.floor(instances.length / 50))
            : 0;
          let lastVolumeProgress = 0;
          volume = await buildVolume(
            sortedInstances,
            imageCacheMap.current,
            API_BASE_URL,
            getCookie("jwt") || "",
            trackProgress
              ? (loaded, total) => {
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
                }
              : undefined,
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
          showProgress: boolean = true,
        ): Promise<MPRSliceData[]> => {
          const slices: MPRSliceData[] = new Array(totalSlices);
          const progressUpdateEvery = Math.max(8, Math.floor(totalSlices / 40));
          const yieldEvery = Math.max(6, Math.floor(totalSlices / 100));

          if (showProgress) {
            setMprGenerationProgress({
              phase,
              current: 0,
              total: totalSlices,
            });
          }

          for (let i = 0; i < totalSlices; i++) {
            const sliceResult = extractor(i);

            slices[i] = {
              index: i,
              rawData: sliceResult.data,
              width: sliceResult.width,
              height: sliceResult.height,
            };

            const completed = i + 1;
            if (
              showProgress &&
              (completed === totalSlices || completed % progressUpdateEvery === 0)
            ) {
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

        // 2D vs 3D MPR: only difference is plane constraint — 2D = orthogonal only; 3D = oblique (free slice rotation).
        // Handle 2D-MPR: orthogonal planes only, progressive loading via Web Worker
        if (mode === "2D-MPR") {
          // @ts-ignore - reserved for future plane-specific logic
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

          // Always generate all three planes so 2D MPR has linked crosshair and same behavior for head/abdomen.
          const planes: PlaneType[] = ["Axial", "Coronal", "Sagittal"];

          // Initialize the MPR slice worker with the volume
          await mprSliceWorker.initVolume(volume, selectedSeries._id);

          // Create placeholder series immediately (slices loaded on-demand by worker)
          const generatedSeries: TemporaryMPRSeries[] = [];
          for (const plane of planes) {
            const totalSliceCount = getMaxIndex(volume, plane) + 1;
            const geometry = getSliceGeometry(volume, plane);

            // Placeholder slices with dimensions only — rawData loaded lazily
            const slices: MPRSliceData[] = new Array(totalSliceCount);
            for (let i = 0; i < totalSliceCount; i++) {
              slices[i] = {
                index: i,
                rawData: undefined,
                width: geometry.width,
                height: geometry.height,
              };
            }

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

          // Add all series at once — layout shows immediately
          for (let i = 0; i < generatedSeries.length; i++) {
            const tempSeries = generatedSeries[i];
            addTemporaryMPRSeries(tempSeries, {
              autoSelect: i === generatedSeries.length - 1,
            });
          }

          // Activate dedicated 2D-MPR mode (hides sidebar, shows MPR header)
          setIs2DMPRActive(true);
        }
        // Handle 3D-MPR: oblique plane — user can rotate slice plane angle freely (CPU reformat)
        else if (mode === "3D-MPR") {
          if (gridLayout !== "1x1") {
            toast("3D MPR is only available in 1x1 layout");
            return;
          }
          // Store volume reference and activate focused 3D-MPR mode
          vrtVolumeRef.current = volume;
          setIsVRTActive(true);
          setSelectedTemporarySeriesId(null);
        }
        // Handle MiniMIP/MIP: on-demand axial slab Maximum Intensity Projection via Web Worker
        else if (mode === "MiniMIP" || mode === "MIP") {
          const plane: PlaneType = "Axial";
          const [cols, rows, totalSlices] = volume.dimensions;
          const slabHalfSize = Math.max(0, Math.round(mipIntensity));

          // Initialize the MIP worker with the volume data
          await mipWorker.initVolume(volume, selectedSeries._id);

          // Compute a few sample slices for W/L estimation (~100ms total)
          const sampleIndices = [
            0,
            Math.floor(totalSlices / 4),
            Math.floor(totalSlices / 2),
            Math.floor((3 * totalSlices) / 4),
            totalSlices - 1,
          ].filter((v, i, a) => a.indexOf(v) === i); // dedupe for small volumes

          const sampleSlices: MPRSliceData[] = [];
          for (const z of sampleIndices) {
            const rawData = await mipWorker.computeSlice(z, slabHalfSize, mode);
            sampleSlices.push({ index: z, rawData, width: cols, height: rows });
          }

          const mipWindow = estimateWindowLevelFromSlices(sampleSlices, {
            windowWidth,
            windowCenter,
          });

          // Create placeholder slices (rawData will be loaded on demand by the viewer)
          const slices: MPRSliceData[] = new Array(totalSlices);
          for (let z = 0; z < totalSlices; z++) {
            const sample = sampleSlices.find((s) => s.index === z);
            slices[z] = {
              index: z,
              rawData: sample?.rawData,
              width: cols,
              height: rows,
            };
          }

          const geometry = getSliceGeometry(volume, plane);
          const tempSeries: TemporaryMPRSeries = {
            id: `mpr-${selectedSeries._id}-${mode}-${Date.now()}`,
            sourceSeriesId: selectedSeries._id,
            mprMode: mode as MPRMode,
            description: `${mode} from ${selectedSeries.description || "Series " + selectedSeries.series_number}`,
            slices,
            sliceCount: slices.length,
            createdAt: Date.now(),
            windowCenter: mipWindow.windowCenter,
            windowWidth: mipWindow.windowWidth,
            physicalAspectRatio: geometry.aspectRatio,
            projectionSlabHalfSize: slabHalfSize,
            initialProjectionSlabHalfSize: slabHalfSize,
            initialProjectionWindowCenter: mipWindow.windowCenter,
            initialProjectionWindowWidth: mipWindow.windowWidth,
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
        if (isProjectionMode) {
          setIsGeneratingProjection(false);
        } else {
          setIsGeneratingMPR(false);
          setMprStartTime(null);
          setMprGenerationProgress({ phase: "", current: 0, total: 0 });
        }
      }
    };

    generateMPR();
  }, [
    pendingMPRGeneration,
    selectedSeries,
    instances,
    isGeneratingProjection,
    isGeneratingMPR,
    API_BASE_URL,
    clearPendingMPRGeneration,
    addTemporaryMPRSeries,
    mipWorker,
    viewTransform.windowWidth,
    viewTransform.windowCenter,
    mipIntensity,
    setCrosshairIndices,
    mprSliceWorker,
    setIs2DMPRActive,
  ]);

  // Live projection update: when slab slider changes, update the slab size.
  // Keep worker cache entries keyed by slab size so revisiting a prior value
  // restores the exact same projection slices.
  useEffect(() => {
    if (
      isGeneratingMPR ||
      isGeneratingProjection ||
      !selectedSeries ||
      !selectedTempSeries ||
      (selectedTempSeries.mprMode !== "MiniMIP" &&
        selectedTempSeries.mprMode !== "MIP") ||
      selectedTempSeries.sourceSeriesId !== selectedSeries._id
    ) {
      return;
    }

    const activeProjectionMode = selectedTempSeries.mprMode;
    const slabHalfSize = Math.max(0, Math.round(mipIntensity));
    if (selectedTempSeries.projectionSlabHalfSize === slabHalfSize) {
      return;
    }

    const baselineSlabHalfSize =
      selectedTempSeries.initialProjectionSlabHalfSize ??
      selectedTempSeries.projectionSlabHalfSize ??
      slabHalfSize;
    const baselineWindowCenter =
      selectedTempSeries.initialProjectionWindowCenter ??
      selectedTempSeries.windowCenter;
    const baselineWindowWidth =
      selectedTempSeries.initialProjectionWindowWidth ??
      selectedTempSeries.windowWidth;

    let adjustedWC: number;
    let adjustedWW: number;

    if (slabHalfSize === 0) {
      const volume = volumeCache.current.get(selectedSeries._id);
      adjustedWC = volume?.windowCenter ?? baselineWindowCenter;
      adjustedWW = volume?.windowWidth ?? baselineWindowWidth;
    } else {
      const adjustedProjectionWindow = adjustProjectionWindowForSlab(
        {
          windowCenter: baselineWindowCenter,
          windowWidth: baselineWindowWidth,
        },
        baselineSlabHalfSize,
        slabHalfSize,
        activeProjectionMode,
      );
      adjustedWC = adjustedProjectionWindow.windowCenter;
      adjustedWW = adjustedProjectionWindow.windowWidth;
    }

    // Create placeholder slices (rawData will be loaded on demand by the viewer)
    const [cols, rows, totalSlices] = selectedTempSeries.slices.length > 0
      ? [selectedTempSeries.slices[0].width, selectedTempSeries.slices[0].height, selectedTempSeries.sliceCount]
      : [0, 0, 0];
    const slices: MPRSliceData[] = new Array(totalSlices);
    for (let z = 0; z < totalSlices; z++) {
      slices[z] = { index: z, width: cols, height: rows };
    }

    addTemporaryMPRSeries(
      {
        ...selectedTempSeries,
        slices,
        sliceCount: totalSlices,
        createdAt: Date.now(),
        windowCenter: adjustedWC,
        windowWidth: adjustedWW,
        projectionSlabHalfSize: slabHalfSize,
        initialProjectionSlabHalfSize: baselineSlabHalfSize,
        initialProjectionWindowCenter: baselineWindowCenter,
        initialProjectionWindowWidth: baselineWindowWidth,
      },
      { autoSelect: false },
    );
  }, [
    isGeneratingMPR,
    isGeneratingProjection,
    selectedSeries,
    selectedTempSeries,
    mipIntensity,
    addTemporaryMPRSeries,
  ]);

  // On-demand MIP/MiniMIP slice provider for TemporaryMPRSeriesViewer lazy loading
  const handleMIPSliceNeeded = useCallback(
    async (index: number): Promise<Int16Array | null> => {
      if (
        !selectedTempSeries ||
        (selectedTempSeries.mprMode !== "MiniMIP" &&
          selectedTempSeries.mprMode !== "MIP")
      ) {
        return null;
      }
      const slabHalfSize = selectedTempSeries.projectionSlabHalfSize ?? 0;
      const mode = selectedTempSeries.mprMode;
      try {
        return await mipWorker.computeSlice(index, slabHalfSize, mode);
      } catch {
        return null;
      }
    },
    [selectedTempSeries, mipWorker],
  );

  // On-demand MPR slice providers for progressive 2D-MPR loading
  const handleMPRAxialSliceNeeded = useCallback(
    async (index: number): Promise<Int16Array | null> => {
      try {
        const result = await mprSliceWorker.computeSlice("Axial", index);
        return result.data;
      } catch {
        return null;
      }
    },
    [mprSliceWorker],
  );
  const handleMPRCoronalSliceNeeded = useCallback(
    async (index: number): Promise<Int16Array | null> => {
      try {
        const result = await mprSliceWorker.computeSlice("Coronal", index);
        return result.data;
      } catch {
        return null;
      }
    },
    [mprSliceWorker],
  );
  const handleMPRSagittalSliceNeeded = useCallback(
    async (index: number): Promise<Int16Array | null> => {
      try {
        const result = await mprSliceWorker.computeSlice("Sagittal", index);
        return result.data;
      } catch {
        return null;
      }
    },
    [mprSliceWorker],
  );

  // Stable callbacks for 2D-MPR pane index changes — keep crosshair at same voxel
  const handleAxialIndexChange = useCallback((idx: number) => {
    setAxialIndex(idx);
    setCrosshairIndices((prev) => ({ ...prev, z: idx }));
  }, [setCrosshairIndices]);
  const handleCoronalIndexChange = useCallback((idx: number) => {
    setCoronalIndex(idx);
    setCrosshairIndices((prev) => ({ ...prev, y: idx }));
  }, [setCrosshairIndices]);
  const handleSagittalIndexChange = useCallback((idx: number) => {
    setSagittalIndex(idx);
    setCrosshairIndices((prev) => ({ ...prev, x: idx }));
  }, [setCrosshairIndices]);

  // Crosshair drag handlers — update other panes when the locator circle is dragged (other planes scroll to same voxel)
  const handleAxialCrosshairDrag = useCallback(
    (hRatio: number, vRatio: number) => {
      if (!mpr2DSeries) return;
      const coronalTotal = mpr2DSeries.coronal.sliceCount;
      const sagittalTotal = mpr2DSeries.sagittal.sliceCount;
      const newCoronal = Math.round(vRatio * (coronalTotal - 1));
      const newSagittal = Math.round(hRatio * (sagittalTotal - 1));
      setCoronalIndex(newCoronal);
      setSagittalIndex(newSagittal);
      setCrosshairIndices((prev) => ({ ...prev, y: newCoronal, x: newSagittal }));
    },
    [mpr2DSeries, setCrosshairIndices],
  );
  const handleCoronalCrosshairDrag = useCallback(
    (hRatio: number, vRatio: number) => {
      if (!mpr2DSeries) return;
      const axialTotal = mpr2DSeries.axial ? mpr2DSeries.axial.sliceCount : instances.length;
      const sagittalTotal = mpr2DSeries.sagittal.sliceCount;
      const newAxial = Math.round((1 - vRatio) * (axialTotal - 1));
      const newSagittal = Math.round(hRatio * (sagittalTotal - 1));
      setAxialIndex(newAxial);
      setSagittalIndex(newSagittal);
      setCrosshairIndices((prev) => ({ ...prev, z: newAxial, x: newSagittal }));
    },
    [mpr2DSeries, instances.length, setCrosshairIndices],
  );
  const handleSagittalCrosshairDrag = useCallback(
    (hRatio: number, vRatio: number) => {
      if (!mpr2DSeries) return;
      const axialTotal = mpr2DSeries.axial ? mpr2DSeries.axial.sliceCount : instances.length;
      const coronalTotal = mpr2DSeries.coronal.sliceCount;
      const newAxial = Math.round((1 - vRatio) * (axialTotal - 1));
      const newCoronal = Math.round(hRatio * (coronalTotal - 1));
      setAxialIndex(newAxial);
      setCoronalIndex(newCoronal);
      setCrosshairIndices((prev) => ({ ...prev, z: newAxial, y: newCoronal }));
    },
    [mpr2DSeries, instances.length, setCrosshairIndices],
  );

  // Memoized scout lines for each 2D-MPR pane
  const scoutLinesAxial = useMemo(() => get2DMPRScoutLines(0), [get2DMPRScoutLines]);
  const scoutLinesCoronal = useMemo(() => get2DMPRScoutLines(1), [get2DMPRScoutLines]);
  const scoutLinesSagittal = useMemo(() => get2DMPRScoutLines(2), [get2DMPRScoutLines]);

  // 2D-MPR exit handler — called from header "Exit MPR" button or Escape key
  useEffect(() => {
    if (!is2DMPRActive) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIs2DMPRActive(false);
        setSelectedTemporarySeriesId(null);
        // Clean up 2D-MPR temp series for current source
        if (selectedSeries) {
          temporaryMPRSeries
            .filter(
              (ts) =>
                ts.description.includes("(2D-MPR)") &&
                ts.sourceSeriesId === selectedSeries._id,
            )
            .forEach((ts) => removeTemporaryMPRSeries(ts.id));
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [is2DMPRActive, setIs2DMPRActive, setSelectedTemporarySeriesId, selectedSeries, temporaryMPRSeries, removeTemporaryMPRSeries]);

  // Also exit 2D-MPR when the header exit button sets is2DMPRActive=false
  useEffect(() => {
    if (!is2DMPRActive && mpr2DSeries) {
      // Header set is2DMPRActive to false — clean up temp series
      if (selectedSeries) {
        temporaryMPRSeries
          .filter(
            (ts) =>
              ts.description.includes("(2D-MPR)") &&
              ts.sourceSeriesId === selectedSeries._id,
          )
          .forEach((ts) => removeTemporaryMPRSeries(ts.id));
      }
      setSelectedTemporarySeriesId(null);
      mprSliceWorker.clearCache();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [is2DMPRActive]);

  // Show CPU oblique 3D-MPR viewer when active
  if (isVRTActive && vrtVolumeRef.current) {
    return (
      <div className="flex-1 flex flex-col bg-black h-full relative">
        <ObliqueMPRViewer
          volume={vrtVolumeRef.current}
          className="flex-1"
          syncMode={mprSyncMode}
          onSyncModeChange={setMprSyncMode}
          syncNowCallbackRef={mprSyncNowRef}
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
    const isVolumePhase = mprGenerationProgress.phase === "volume";
    const phaseLabel = isVolumePhase ? "Building 3D Volume" : "Preparing MPR Views";
    const phaseDetail = isVolumePhase
      ? `Fetching & decoding slice ${mprGenerationProgress.current} of ${mprGenerationProgress.total}`
      : "Initializing slice worker...";

    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4 max-w-xs">
          <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
          <div className="text-center">
            <p className="text-white text-sm font-medium">{phaseLabel}</p>
            <p className="text-gray-500 text-xs mt-1">{phaseDetail}</p>
          </div>
          <div className="w-full">
            <div className="flex justify-between text-xs text-gray-400 mb-1.5">
              <span>{progress}%</span>
              {mprElapsed > 0 && <span>{mprElapsed}s elapsed</span>}
            </div>
            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-600 to-purple-400 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          {/* Phase steps indicator */}
          <div className="flex items-center gap-2 text-xs mt-1">
            <div className={`flex items-center gap-1 ${isVolumePhase ? "text-purple-400" : "text-green-400"}`}>
              <div className={`w-2 h-2 rounded-full ${isVolumePhase ? "bg-purple-400 animate-pulse" : "bg-green-400"}`} />
              <span>Volume</span>
            </div>
            <div className="w-4 h-px bg-gray-700" />
            <div className={`flex items-center gap-1 ${!isVolumePhase && mprGenerationProgress.phase ? "text-purple-400" : "text-gray-600"}`}>
              <div className={`w-2 h-2 rounded-full ${!isVolumePhase && mprGenerationProgress.phase ? "bg-purple-400 animate-pulse" : "bg-gray-700"}`} />
              <span>Ready</span>
            </div>
          </div>
        </div>
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

  // 2D-MPR split layout: Left (2 minor panes stacked) | Right (major pane, configurable via dropdown)
  if (is2DMPRLayout && mpr2DSeries) {
    // Map plane → series, scout lines, handlers, slice needed callbacks
    const planeConfig: Record<PlaneOrientation, {
      series: TemporaryMPRSeries | null;
      scoutLines: ScoutLine[];
      onIndexChange: (idx: number) => void;
      onSliceNeeded: (index: number) => Promise<Int16Array | null>;
      onCrosshairDrag: (hRatio: number, vRatio: number) => void;
      paneId: number; // legacy pane id for active state
    }> = {
      Axial: {
        series: mpr2DSeries.axial,
        scoutLines: scoutLinesAxial,
        onIndexChange: handleAxialIndexChange,
        onSliceNeeded: handleMPRAxialSliceNeeded,
        onCrosshairDrag: handleAxialCrosshairDrag,
        paneId: 0,
      },
      Coronal: {
        series: mpr2DSeries.coronal,
        scoutLines: scoutLinesCoronal,
        onIndexChange: handleCoronalIndexChange,
        onSliceNeeded: handleMPRCoronalSliceNeeded,
        onCrosshairDrag: handleCoronalCrosshairDrag,
        paneId: 1,
      },
      Sagittal: {
        series: mpr2DSeries.sagittal,
        scoutLines: scoutLinesSagittal,
        onIndexChange: handleSagittalIndexChange,
        onSliceNeeded: handleMPRSagittalSliceNeeded,
        onCrosshairDrag: handleSagittalCrosshairDrag,
        paneId: 2,
      },
    };

    const allPlanes: PlaneOrientation[] = ["Axial", "Coronal", "Sagittal"];
    const minorPlanes = allPlanes.filter((p) => p !== majorPane2DMPR);
    const major = planeConfig[majorPane2DMPR];
    const minor0 = planeConfig[minorPlanes[0]];
    const minor1 = planeConfig[minorPlanes[1]];

    const renderPane = (
      cfg: typeof major,
      isCompact: boolean,
      controlledIdx: number,
    ) => {
      // If no temp series for this plane, use DicomViewer (fallback; normally all three planes exist)
      if (!cfg.series) {
        return (
          <DicomViewer
            instances={instances}
            seriesId={selectedSeries._id}
            className="h-full"
            scoutLines={cfg.scoutLines}
            onImageIndexChange={cfg.onIndexChange}
            isActive={active2DMPRPane === cfg.paneId}
          />
        );
      }
      return (
        <TemporaryMPRSeriesViewer
          series={cfg.series}
          className="h-full"
          scoutLines={cfg.scoutLines}
          onImageIndexChange={cfg.onIndexChange}
          isActive={active2DMPRPane === cfg.paneId}
          onSliceNeeded={cfg.onSliceNeeded}
          onCrosshairDrag={cfg.onCrosshairDrag}
          compact={isCompact}
          controlledIndex={controlledIdx}
        />
      );
    };

    const paneClass = (paneId: number) =>
      `min-h-0 min-w-0 overflow-hidden relative bg-black flex-1 ${active2DMPRPane === paneId ? "ring-2 ring-green-500 ring-inset" : "ring-1 ring-gray-700 ring-inset"}`;
    const majorDropdown = (
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20">
        <select
          value={majorPane2DMPR}
          onChange={(e) => setMajorPane2DMPR(e.target.value as PlaneOrientation)}
          onClick={(e) => e.stopPropagation()}
          className="bg-black/80 text-white text-xs px-2 py-1 rounded border border-gray-600 hover:border-gray-400 cursor-pointer outline-none focus:border-green-500 appearance-auto"
        >
          <option value="Axial">Axial</option>
          <option value="Coronal">Coronal</option>
          <option value="Sagittal">Sagittal</option>
        </select>
      </div>
    );

    // Layout presets: left-large (default), right-large, top-large, bottom-large, 1x3, 3x1
    if (mprLayoutPreset === "1x3") {
      return (
        <div className="flex-1 flex bg-black h-full divide-x divide-gray-800">
          {(["Axial", "Coronal", "Sagittal"] as const).map((plane, _i) => (
            <div key={plane} className={paneClass(planeConfig[plane].paneId)} onClick={() => setActive2DMPRPane(planeConfig[plane].paneId)}>
              {renderPane(planeConfig[plane], true, plane === "Axial" ? axialIndex : plane === "Coronal" ? coronalIndex : sagittalIndex)}
            </div>
          ))}
        </div>
      );
    }
    if (mprLayoutPreset === "3x1") {
      return (
        <div className="flex-1 flex flex-col bg-black h-full divide-y divide-gray-800">
          {(["Axial", "Coronal", "Sagittal"] as const).map((plane) => (
            <div key={plane} className={paneClass(planeConfig[plane].paneId)} onClick={() => setActive2DMPRPane(planeConfig[plane].paneId)}>
              {renderPane(planeConfig[plane], true, plane === "Axial" ? axialIndex : plane === "Coronal" ? coronalIndex : sagittalIndex)}
            </div>
          ))}
        </div>
      );
    }
    if (mprLayoutPreset === "right-large") {
      return (
        <div className="flex-1 flex bg-black h-full divide-x divide-gray-800">
          <div className="w-1/2 flex flex-col min-w-0 divide-y divide-gray-800">
            <div className={paneClass(minor0.paneId)} onClick={() => setActive2DMPRPane(minor0.paneId)}>{renderPane(minor0, true, minorPlanes[0] === "Axial" ? axialIndex : minorPlanes[0] === "Coronal" ? coronalIndex : sagittalIndex)}</div>
            <div className={paneClass(minor1.paneId)} onClick={() => setActive2DMPRPane(minor1.paneId)}>{renderPane(minor1, true, minorPlanes[1] === "Axial" ? axialIndex : minorPlanes[1] === "Coronal" ? coronalIndex : sagittalIndex)}</div>
          </div>
          <div className={`w-1/2 min-w-0 ${paneClass(major.paneId)}`} onClick={() => setActive2DMPRPane(major.paneId)}>
            {renderPane(major, false, majorPane2DMPR === "Axial" ? axialIndex : majorPane2DMPR === "Coronal" ? coronalIndex : sagittalIndex)}
            {majorDropdown}
          </div>
        </div>
      );
    }
    if (mprLayoutPreset === "top-large") {
      return (
        <div className="flex-1 flex flex-col bg-black h-full divide-y divide-gray-800">
          <div className={`h-1/2 min-h-0 ${paneClass(major.paneId)}`} onClick={() => setActive2DMPRPane(major.paneId)}>
            {renderPane(major, false, majorPane2DMPR === "Axial" ? axialIndex : majorPane2DMPR === "Coronal" ? coronalIndex : sagittalIndex)}
            {majorDropdown}
          </div>
          <div className="h-1/2 flex min-h-0 divide-x divide-gray-800">
            <div className={paneClass(minor0.paneId)} onClick={() => setActive2DMPRPane(minor0.paneId)}>{renderPane(minor0, true, minorPlanes[0] === "Axial" ? axialIndex : minorPlanes[0] === "Coronal" ? coronalIndex : sagittalIndex)}</div>
            <div className={paneClass(minor1.paneId)} onClick={() => setActive2DMPRPane(minor1.paneId)}>{renderPane(minor1, true, minorPlanes[1] === "Axial" ? axialIndex : minorPlanes[1] === "Coronal" ? coronalIndex : sagittalIndex)}</div>
          </div>
        </div>
      );
    }
    if (mprLayoutPreset === "bottom-large") {
      return (
        <div className="flex-1 flex flex-col bg-black h-full divide-y divide-gray-800">
          <div className="h-1/2 flex min-h-0 divide-x divide-gray-800">
            <div className={paneClass(minor0.paneId)} onClick={() => setActive2DMPRPane(minor0.paneId)}>{renderPane(minor0, true, minorPlanes[0] === "Axial" ? axialIndex : minorPlanes[0] === "Coronal" ? coronalIndex : sagittalIndex)}</div>
            <div className={paneClass(minor1.paneId)} onClick={() => setActive2DMPRPane(minor1.paneId)}>{renderPane(minor1, true, minorPlanes[1] === "Axial" ? axialIndex : minorPlanes[1] === "Coronal" ? coronalIndex : sagittalIndex)}</div>
          </div>
          <div className={`h-1/2 min-h-0 ${paneClass(major.paneId)}`} onClick={() => setActive2DMPRPane(major.paneId)}>
            {renderPane(major, false, majorPane2DMPR === "Axial" ? axialIndex : majorPane2DMPR === "Coronal" ? coronalIndex : sagittalIndex)}
            {majorDropdown}
          </div>
        </div>
      );
    }
    // left-large (default)
    return (
      <div className="flex-1 flex bg-black h-full divide-x divide-gray-800">
        <div className={`w-1/2 min-w-0 ${paneClass(major.paneId)}`} onClick={() => setActive2DMPRPane(major.paneId)}>
          {renderPane(major, false, majorPane2DMPR === "Axial" ? axialIndex : majorPane2DMPR === "Coronal" ? coronalIndex : sagittalIndex)}
          {majorDropdown}
        </div>
        <div className="w-1/2 flex flex-col min-w-0 divide-y divide-gray-800">
          <div className={paneClass(minor0.paneId)} onClick={() => setActive2DMPRPane(minor0.paneId)}>
            {renderPane(minor0, true, minorPlanes[0] === "Axial" ? axialIndex : minorPlanes[0] === "Coronal" ? coronalIndex : sagittalIndex)}
          </div>
          <div className={paneClass(minor1.paneId)} onClick={() => setActive2DMPRPane(minor1.paneId)}>
            {renderPane(minor1, true, minorPlanes[1] === "Axial" ? axialIndex : minorPlanes[1] === "Coronal" ? coronalIndex : sagittalIndex)}
          </div>
        </div>
      </div>
    );
  }

  // Multi-pane grid layout
  if (gridLayout !== "1x1") {
    const config = parseGridLayout(gridLayout) ?? { rows: 1, cols: 1 };
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
            onActivate={() => handleActivatePane(paneIdx)}
            onToggleFullscreen={() => setFullscreenPaneIndex(null)}
            onImageIndexChange={handlePaneImageIndexChange}
            scoutLines={getScoutLinesForPane(paneIdx)}
            onSliceNeeded={handleMIPSliceNeeded}
          />
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col bg-black h-full min-h-0">
        <div
          className="flex-1 grid gap-px bg-gray-800"
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
              onActivate={() => handleActivatePane(idx)}
              onToggleFullscreen={() =>
                setFullscreenPaneIndex((prev) => (prev === idx ? null : idx))
              }
              onImageIndexChange={handlePaneImageIndexChange}
              scoutLines={getScoutLinesForPane(idx)}
              onSliceNeeded={handleMIPSliceNeeded}
            />
          ))}
        </div>
      </div>
    );
  }

  // Single-pane (1x1) layout
  return (
    <div
      className={`relative flex-1 flex flex-col bg-black h-full min-h-0 ${
        isSinglePaneDragOver ? "ring-2 ring-amber-400 ring-inset" : ""
      }`}
      onDragOver={handleSinglePaneDragOver}
      onDragLeave={handleSinglePaneDragLeave}
      onDrop={handleSinglePaneDrop}
    >

      {/* Viewer - Temporary MPR series, SR, or DicomViewer */}
      {selectedTempSeries ? (
        <TemporaryMPRSeriesViewer
          series={selectedTempSeries}
          className="flex-1 min-h-0"
          isActive={true}
          onSliceNeeded={
            selectedTempSeries.mprMode === "MiniMIP" || selectedTempSeries.mprMode === "MIP"
              ? handleMIPSliceNeeded
              : undefined
          }
        />
      ) : selectedSeries.modality === "SR" ? (
        <SRViewer instances={instances || []} className="flex-1 min-h-0" />
      ) : (
        <DicomViewer
          instances={instances || []}
          seriesId={selectedSeries._id}
          className="flex-1 min-h-0"
          isActive={true}
        />
      )}

      {isSinglePaneDragOver && (
        <div className="pointer-events-none absolute inset-0 z-20 border-2 border-dashed border-amber-400 bg-amber-500/10 flex items-center justify-center">
          <span className="text-xs text-amber-200 font-medium uppercase tracking-wider">
            Drop Series
          </span>
        </div>
      )}
    </div>
  );
};

export default CaseViewer;
