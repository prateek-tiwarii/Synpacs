import { Outlet, useParams } from "react-router-dom";
import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import ViewerHeader from "./viewer/ViewerHeader";
import ViewerSidebar from "./viewer/ViewerSidebar";
import { apiService } from "@/lib/api";
import { getGridLayoutPaneCount, parseGridLayout } from "@/lib/gridLayout";
import { Loader2 } from "lucide-react";

interface Series {
  _id: string;
  series_uid: string;
  description: string;
  modality: string;
  series_number: number;
  case_id: string;
  image_count: number;
}

interface Patient {
  _id: string;
  patient_id: string;
  date_of_birth: string;
  dob?: string;
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
  case_uid: string;
  accession_number: string;
  body_part: string;
  description: string;
  hospital_id: string;
  modality: string;
  patient_id: string;
  case_date: string;
  case_time: string;
  assigned_to: AssignedTo;
  case_type: string;
  priority: string;
  status: string;
  updatedAt: string;
  isBookmarked: boolean;
  hospital_name?: string;
  center_name?: string;
  patient: Patient;
  series: Series[];
  series_count: number;
  instance_count: number;
}

export type ViewerTool =
  | "Stack"
  | "Pan"
  | "Zoom"
  | "Contrast"
  | "FreeRotate"
  | "SpineLabeling"
  | "Length"
  | "Ellipse"
  | "Rectangle"
  | "Freehand"
  | "Text"
  | "Angle"
  | "CobbsAngle"
  | "HU";

// MPR Mode types
export type MPRMode =
  | "Axial"
  | "Coronal"
  | "Sagittal"
  | "2D-MPR"
  | "3D-MPR"
  | "MiniMIP"
  | "MIP";

// Crosshair indices for MPR views
export interface CrosshairIndices {
  x: number; // Column index (Sagittal position)
  y: number; // Row index (Coronal position)
  z: number; // Slice index (Axial position)
}

// Temporary MPR Series - stored in memory only
export interface MPRSliceData {
  index: number;
  imageData?: ImageData; // Optional windowed image cache (generated lazily for performance)
  rawData?: Int16Array; // Raw HU slice data for lazy windowing
  width: number;
  height: number;
}

export interface TemporaryMPRSeries {
  id: string; // Unique ID for this temp series
  sourceSeriesId: string; // Original series this was generated from
  mprMode: MPRMode; // Which MPR mode generated this
  description: string; // Display name
  slices: MPRSliceData[]; // Pre-rendered slices
  sliceCount: number;
  createdAt: number; // Timestamp
  windowCenter: number;
  windowWidth: number;
  physicalAspectRatio?: number; // Physical width/height ratio accounting for spacing
  projectionSlabHalfSize?: number; // Used for live projection updates
}

export type GridLayout = `${number}x${number}`;

// Mouse button binding types
export type MouseButton = 0 | 1 | 2; // 0=Left, 1=Middle, 2=Right
export type MouseButtonBindings = Partial<Record<MouseButton, ViewerTool>>;

export interface ViewTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  invert: boolean;
  windowWidth: number | null;
  windowCenter: number | null;
}

export interface HUStats {
  mean: number;
  min: number;
  max: number;
  area: number; // mm²
  perimeter?: number; // mm (for Freehand)
}

export interface Annotation {
  id: string;
  type:
  | "Length"
  | "Ellipse"
  | "Rectangle"
  | "Freehand"
  | "Text"
  | "Angle"
  | "CobbsAngle"
  | "HU";
  points: { x: number; y: number }[];
  huValue?: number; // For single point HU measurement
  text?: string;
  color: string;
  index?: number; // Measurement index (1, 2, 3...)
  huStats?: HUStats; // HU statistics for regions
  angleDegrees?: number; // For angle measurements
  distanceMm?: number; // For length measurements
  imageIndex?: number; // Slice index where annotation was created
  textSize?: number; // Font size for text annotations (default 18)
  textRotation?: number; // Rotation angle in degrees for text annotations
  sourceTool?: "SpineLabeling"; // Marks annotations created via spine auto-labeling
}

// Keyboard Shortcut interface
export interface Shortcut {
  id: string;
  label: string;
  key: string;
  category: "Display Windows" | "Tools" | "Navigation" | "Transform";
}

// Pane state for multi-pane layout
export interface PaneState {
  seriesId: string | null;
  currentImageIndex: number;
  viewTransform: ViewTransform;
  annotations: Annotation[];
  selectedAnnotationId: string | null;
}

interface ViewerContextType {
  caseData: CaseData | null;
  selectedSeries: Series | null;
  setSelectedSeries: (series: Series | null) => void;
  loading: boolean;
  error: string | null;
  currentImageIndex: number;
  setCurrentImageIndex: (index: number) => void;
  activeTool: ViewerTool;
  setActiveTool: (tool: ViewerTool) => void;
  viewTransform: ViewTransform;
  setViewTransform: (
    transform: ViewTransform | ((prev: ViewTransform) => ViewTransform),
  ) => void;
  annotations: Annotation[];
  setAnnotations: (
    annotations: Annotation[] | ((prev: Annotation[]) => Annotation[]),
  ) => void;
  selectedAnnotationId: string | null;
  setSelectedAnnotationId: (id: string | null) => void;
  deleteSelectedAnnotation: () => void;
  deleteAnnotationById: (id: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  saveToHistory: () => void;
  isFullscreen: boolean;
  setIsFullscreen: (full: boolean) => void;
  toggleFullscreen: () => void;
  // Grid layout
  gridLayout: GridLayout;
  setGridLayout: (layout: GridLayout) => void;
  paneStates: PaneState[];
  setPaneStates: React.Dispatch<React.SetStateAction<PaneState[]>>;
  activePaneIndex: number;
  setActivePaneIndex: (index: number) => void;
  setActivePaneSeries: (seriesId: string) => void;
  // MPR state
  crosshairIndices: CrosshairIndices;
  setCrosshairIndices: (
    indices: CrosshairIndices | ((prev: CrosshairIndices) => CrosshairIndices),
  ) => void;
  // Temporary MPR series (in-memory only)
  temporaryMPRSeries: TemporaryMPRSeries[];
  addTemporaryMPRSeries: (
    series: TemporaryMPRSeries,
    options?: { autoSelect?: boolean },
  ) => void;
  removeTemporaryMPRSeries: (id: string) => void;
  selectedTemporarySeriesId: string | null;
  setSelectedTemporarySeriesId: (id: string | null) => void;
  // MPR generation requests
  pendingMPRGeneration: { mode: MPRMode; seriesId: string } | null;
  requestMPRGeneration: (mode: MPRMode) => void;
  clearPendingMPRGeneration: () => void;
  // Overlays
  showOverlays: boolean;
  setShowOverlays: (show: boolean) => void;
  // Series load progress
  seriesLoadProgress: { seriesId: string; fetched: number; total: number } | null;
  setSeriesLoadProgress: (progress: { seriesId: string; fetched: number; total: number } | null) => void;
  downloadedSeriesIds: Set<string>;
  markSeriesAsDownloaded: (seriesId: string) => void;
  clearDownloadedSeriesIds: () => void;
  // Shortcuts
  shortcuts: Shortcut[];
  updateShortcut: (id: string, newKey: string) => void;
  // Stack speed (1-10, default 4)
  stackSpeed: number;
  setStackSpeed: (speed: number) => void;
  // MiniMIP intensity (controls slab half-size)
  miniMIPIntensity: number;
  setMiniMIPIntensity: (intensity: number) => void;
  // MIP intensity (controls slab half-size)
  mipIntensity: number;
  setMIPIntensity: (intensity: number) => void;
  // Scout line
  showScoutLine: boolean;
  setShowScoutLine: (show: boolean) => void;
  // VRT (3D Volume Rendering) mode
  isVRTActive: boolean;
  setIsVRTActive: (active: boolean) => void;
  // Mouse button → tool bindings
  mouseBindings: MouseButtonBindings;
  setMouseBinding: (button: MouseButton, tool: ViewerTool | null) => void;
}

const ViewerContext = createContext<ViewerContextType | undefined>(undefined);

export const useViewerContext = () => {
  const context = useContext(ViewerContext);
  if (!context) {
    throw new Error("useViewerContext must be used within ViewerLayout");
  }
  return context;
};

export function ViewerLayout() {
  const { id } = useParams();
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<Series | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [activeTool, setActiveTool] = useState<ViewerTool>("Stack");
  const [viewTransform, setViewTransform] = useState<ViewTransform>({
    x: 0,
    y: 0,
    scale: 1.2,
    rotation: 0,
    flipH: false,
    flipV: false,
    invert: false,
    windowWidth: null,
    windowCenter: null,
  });
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<
    string | null
  >(null);
  const [history, setHistory] = useState<
    { annotations: Annotation[]; transform: ViewTransform }[]
  >([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [gridLayout, setGridLayoutState] = useState<GridLayout>("1x1");
  const [paneStates, setPaneStates] = useState<PaneState[]>([]);
  const [activePaneIndex, setActivePaneIndex] = useState(0);

  // MPR state
  const [crosshairIndices, setCrosshairIndices] = useState<CrosshairIndices>({
    x: 0,
    y: 0,
    z: 0,
  });

  // Temporary MPR series (in-memory only, lost on page refresh)
  const [temporaryMPRSeries, setTemporaryMPRSeries] = useState<
    TemporaryMPRSeries[]
  >([]);
  const temporaryMPRSeriesRef = useRef<TemporaryMPRSeries[]>([]);
  const [selectedTemporarySeriesId, setSelectedTemporarySeriesId] = useState<
    string | null
  >(null);

  // Pending MPR generation request (set by header, consumed by CaseViewer)
  const [pendingMPRGeneration, setPendingMPRGeneration] = useState<{
    mode: MPRMode;
    seriesId: string;
  } | null>(null);

  const [showOverlays, setShowOverlays] = useState(true);
  const [seriesLoadProgress, setSeriesLoadProgress] = useState<{
    seriesId: string;
    fetched: number;
    total: number;
  } | null>(null);
  const [downloadedSeriesIds, setDownloadedSeriesIds] = useState<Set<string>>(
    new Set(),
  );
  const [stackSpeed, setStackSpeed] = useState(4); // 1-10, default 4
  const [miniMIPIntensity, setMiniMIPIntensity] = useState(5); // slab half-size (0-20)
  const [mipIntensity, setMIPIntensity] = useState(20); // slab half-size (0-80)
  const [showScoutLine, setShowScoutLine] = useState(false);
  const [isVRTActive, setIsVRTActive] = useState(false);

  // Mouse button → tool bindings (persisted in localStorage)
  const [mouseBindings, setMouseBindingsState] = useState<MouseButtonBindings>(() => {
    const saved = localStorage.getItem("viewer_mouse_bindings");
    return saved ? JSON.parse(saved) : {};
  });

  const setMouseBinding = useCallback((button: MouseButton, tool: ViewerTool | null) => {
    setMouseBindingsState((prev) => {
      const next = { ...prev };
      if (tool !== null) {
        next[button] = tool;
      } else {
        delete next[button];
      }
      localStorage.setItem("viewer_mouse_bindings", JSON.stringify(next));
      return next;
    });
  }, []);

  // Window presets have fixed keys (1-7), other shortcuts start empty for user to assign
  const DEFAULT_SHORTCUTS: Shortcut[] = [
    { id: "Window1", label: "Original", key: "1", category: "Display Windows" },
    { id: "Window2", label: "Lung", key: "2", category: "Display Windows" },
    { id: "Window3", label: "Mediastinum", key: "3", category: "Display Windows" },
    { id: "Window4", label: "Bone", key: "4", category: "Display Windows" },
    { id: "Window5", label: "Brain", key: "5", category: "Display Windows" },
    { id: "Window6", label: "Stroke", key: "6", category: "Display Windows" },
    { id: "Window7", label: "Liver", key: "7", category: "Display Windows" },
    { id: "ToolLine", label: "Line", key: "", category: "Tools" },
    { id: "ToolDistance", label: "Distance", key: "", category: "Tools" },
    { id: "ToolAngle", label: "Angle", key: "", category: "Tools" },
    { id: "ToolEllipse", label: "Ellipse", key: "", category: "Tools" },
    { id: "ToolCircle", label: "Circle", key: "", category: "Tools" },
    { id: "ToolFreehand", label: "Freehand", key: "", category: "Tools" },
    { id: "ToolHU", label: "HU Point", key: "", category: "Tools" },
    { id: "ToolSpineLabeling", label: "Spine Labeling", key: "", category: "Tools" },
    { id: "NavZoom", label: "Zoom", key: "", category: "Navigation" },
    { id: "NavPan", label: "Pan", key: "", category: "Navigation" },
    { id: "NavScroll", label: "Scroll", key: "", category: "Navigation" },
    { id: "NavContrast", label: "Contrast", key: "", category: "Navigation" },
    { id: "NavReset", label: "Reset", key: "", category: "Navigation" },
    { id: "TransRotateCW", label: "Rotate CW", key: "", category: "Transform" },
    { id: "TransRotateCCW", label: "Rotate CCW", key: "", category: "Transform" },
    { id: "TransFlipH", label: "Flip H", key: "", category: "Transform" },
    { id: "TransFlipV", label: "Flip V", key: "", category: "Transform" },
  ];

  const [shortcuts, setShortcuts] = useState<Shortcut[]>(() => {
    const saved = localStorage.getItem("viewer_shortcuts");
    return saved ? JSON.parse(saved) : DEFAULT_SHORTCUTS;
  });

  const updateShortcut = (id: string, newKey: string) => {
    setShortcuts((prev) => {
      const updated = prev.map((s) => (s.id === id ? { ...s, key: newKey } : s));
      localStorage.setItem("viewer_shortcuts", JSON.stringify(updated));
      return updated;
    });
  };

  useEffect(() => {
    temporaryMPRSeriesRef.current = temporaryMPRSeries;
  }, [temporaryMPRSeries]);

  // Add a temporary MPR series and auto-select it
  const addTemporaryMPRSeries = (
    series: TemporaryMPRSeries,
    options?: { autoSelect?: boolean },
  ) => {
    const autoSelect = options?.autoSelect ?? true;
    const previousSeries = temporaryMPRSeriesRef.current;
    const existingIndex = previousSeries.findIndex(
      (s) =>
        s.sourceSeriesId === series.sourceSeriesId &&
        s.mprMode === series.mprMode,
    );

    let newId = series.id;
    let nextSeries = previousSeries;

    if (existingIndex >= 0) {
      // Replace existing, keep stable id so pane references remain valid
      newId = previousSeries[existingIndex].id;
      nextSeries = [...previousSeries];
      nextSeries[existingIndex] = { ...series, id: newId };
    } else {
      nextSeries = [...previousSeries, series];
    }

    temporaryMPRSeriesRef.current = nextSeries;
    setTemporaryMPRSeries(nextSeries);

    if (!autoSelect) {
      return;
    }

    // Auto-select the newly added/updated series
    setSelectedTemporarySeriesId(newId);

    const resetTransform = {
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0,
      flipH: false,
      flipV: false,
      invert: false,
      windowWidth: null as number | null,
      windowCenter: null as number | null,
    };

    // Reset single-view transform so generated MPR opens fit-to-view
    setViewTransform((prev) => ({
      ...prev,
      ...resetTransform,
    }));

    // Immediately show generated MPR in the active pane
    setPaneStates((prev) => {
      const targetPaneIndex = gridLayout === "1x1" ? 0 : activePaneIndex;
      const nextStates = [...prev];
      if (nextStates[targetPaneIndex]) {
        nextStates[targetPaneIndex] = {
          ...nextStates[targetPaneIndex],
          seriesId: newId,
          currentImageIndex: 0,
          viewTransform: {
            ...nextStates[targetPaneIndex].viewTransform,
            ...resetTransform,
          },
        };
      } else if (targetPaneIndex === 0) {
        nextStates[0] = {
          ...createDefaultPaneState(newId),
          viewTransform: {
            ...createDefaultPaneState(newId).viewTransform,
            ...resetTransform,
          },
        };
      }
      return nextStates;
    });
  };

  // Remove a temporary MPR series
  const removeTemporaryMPRSeries = (id: string) => {
    setTemporaryMPRSeries((prev) => {
      const next = prev.filter((s) => s.id !== id);
      temporaryMPRSeriesRef.current = next;
      return next;
    });
    if (selectedTemporarySeriesId === id) {
      setSelectedTemporarySeriesId(null);
    }
  };

  // Request MPR generation (called from header dropdown)
  const requestMPRGeneration = (mode: MPRMode) => {
    if (selectedSeries) {
      setPendingMPRGeneration({ mode, seriesId: selectedSeries._id });
    }
  };

  // Clear pending MPR generation (called after generation completes)
  const clearPendingMPRGeneration = () => {
    setPendingMPRGeneration(null);
  };

  const markSeriesAsDownloaded = useCallback((seriesId: string) => {
    if (!seriesId) return;
    setDownloadedSeriesIds((prev) => {
      if (prev.has(seriesId)) return prev;
      const next = new Set(prev);
      next.add(seriesId);
      return next;
    });
  }, []);

  const clearDownloadedSeriesIds = useCallback(() => {
    setDownloadedSeriesIds(new Set());
  }, []);

  const createDefaultPaneState = (seriesId: string | null): PaneState => ({
    seriesId,
    currentImageIndex: 0,
    viewTransform: {
      x: 0,
      y: 0,
      scale: 0.65,
      rotation: 0,
      flipH: false,
      flipV: false,
      invert: false,
      windowWidth: null,
      windowCenter: null,
    },
    annotations: [],
    selectedAnnotationId: null,
  });

  // Get number of panes for current layout
  const getLayoutPaneCount = (layout: GridLayout): number =>
    getGridLayoutPaneCount(layout);

  const setGridLayout = (layout: GridLayout) => {
    const normalizedLayout = parseGridLayout(layout) ? layout : "1x1";
    if (normalizedLayout === gridLayout) return;

    const previousPaneCount = getLayoutPaneCount(gridLayout);
    const nextPaneCount = getLayoutPaneCount(normalizedLayout);

    if (nextPaneCount > previousPaneCount) {
      setPaneStates((prev) => {
        const nextStates = [...prev];
        const primarySeriesId =
          selectedTemporarySeriesId ??
          selectedSeries?._id ??
          nextStates[0]?.seriesId ??
          null;

        if (primarySeriesId) {
          if (nextStates[0]) {
            nextStates[0] = {
              ...nextStates[0],
              seriesId: primarySeriesId,
              currentImageIndex: 0,
            };
          } else {
            nextStates[0] = createDefaultPaneState(primarySeriesId);
          }
        }

        const assignedIds = new Set(
          nextStates
            .slice(0, previousPaneCount)
            .map((pane) => pane?.seriesId)
            .filter((id): id is string => Boolean(id)),
        );

        const regularSeriesIds = (caseData?.series || [])
          .filter((series) => series.image_count > 0)
          .sort((a, b) => a.series_number - b.series_number)
          .map((series) => series._id);
        const temporarySeriesIds = temporaryMPRSeries.map((series) => series.id);
        const candidateSeriesIds = [
          selectedTemporarySeriesId,
          selectedSeries?._id,
          ...regularSeriesIds,
          ...temporarySeriesIds,
        ].filter((id): id is string => Boolean(id));

        let candidateCursor = 0;
        for (let i = previousPaneCount; i < nextPaneCount; i++) {
          let selectedId: string | null = null;
          while (candidateCursor < candidateSeriesIds.length && !selectedId) {
            const candidateId = candidateSeriesIds[candidateCursor];
            candidateCursor += 1;
            if (!assignedIds.has(candidateId)) {
              selectedId = candidateId;
            }
          }

          if (nextStates[i]) {
            nextStates[i] = {
              ...nextStates[i],
              seriesId: selectedId,
              currentImageIndex: 0,
            };
          } else {
            nextStates[i] = createDefaultPaneState(selectedId);
          }

          if (selectedId) {
            assignedIds.add(selectedId);
          }
        }

        return nextStates;
      });
    }

    setGridLayoutState(normalizedLayout);
  };

  // Auto-enable scout line when switching to multi-pane layout
  useEffect(() => {
    if (gridLayout !== "1x1") {
      setShowScoutLine(true);
    }
  }, [gridLayout]);

  // Initialize/update pane states when layout or series change
  useEffect(() => {
    const paneCount = getLayoutPaneCount(gridLayout);
    const series = caseData?.series || [];

    setPaneStates((prev) => {
      const newStates: PaneState[] = [];
      for (let i = 0; i < paneCount; i++) {
        if (prev[i]) {
          // Keep existing pane state
          newStates.push(prev[i]);
        } else {
          // Create new pane state, auto-populate with series if available
          const seriesForPane = series[i] || null;
          newStates.push(createDefaultPaneState(seriesForPane?._id || null));
        }
      }
      return newStates;
    });

    // Adjust active pane index if it's out of bounds
    if (activePaneIndex >= paneCount) {
      setActivePaneIndex(0);
    }
  }, [gridLayout, caseData?.series]);

  // Set series for the active pane
  const setActivePaneSeries = (seriesId: string) => {
    setPaneStates((prev) => {
      const newStates = [...prev];
      if (newStates[activePaneIndex]) {
        newStates[activePaneIndex] = {
          ...newStates[activePaneIndex],
          seriesId: seriesId,
        };
      }
      return newStates;
    });
  };

  const deleteAnnotationById = (id: string) => {
    const currentIndex = annotations.findIndex((a) => a.id === id);
    if (currentIndex === -1) return;

    const newAnnotations = annotations.filter((a) => a.id !== id);

    // Re-index remaining annotations
    const reindexed = newAnnotations.map((ann, idx) => ({
      ...ann,
      index: idx + 1,
    }));

    setAnnotations(reindexed);

    // Select next annotation if available (for sequential delete)
    if (reindexed.length > 0) {
      const nextIndex = Math.min(currentIndex, reindexed.length - 1);
      setSelectedAnnotationId(reindexed[nextIndex].id);
    } else {
      setSelectedAnnotationId(null);
    }

    // Save to history
    const newState = {
      annotations: reindexed,
      transform: { ...viewTransform },
    };
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1);
      return [...newHistory, newState];
    });
    setHistoryIndex((prev) => prev + 1);
  };

  const deleteSelectedAnnotation = () => {
    if (!selectedAnnotationId) return;
    deleteAnnotationById(selectedAnnotationId);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(
          `Error attempting to enable full-screen mode: ${err.message}`,
        );
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Wrapper to reset W/L and view state when switching series
  const handleSetSelectedSeries = (series: Series | null) => {
    setSelectedSeries(series);
    // Keep pane assignment in sync with selected series.
    if (series) {
      setPaneStates((prev) => {
        const newStates = [...prev];
        const targetPaneIndex = gridLayout === "1x1" ? 0 : activePaneIndex;
        if (newStates[targetPaneIndex]) {
          newStates[targetPaneIndex] = {
            ...newStates[targetPaneIndex],
            seriesId: series._id,
            currentImageIndex: 0,
          };
        } else if (targetPaneIndex === 0) {
          newStates[0] = createDefaultPaneState(series._id);
        }
        return newStates;
      });
    }
    // Reset W/L to original (null means use DICOM default)
    setViewTransform((prev) => ({
      ...prev,
      windowWidth: null,
      windowCenter: null,
      // Also reset other view transforms
      x: 0,
      y: 0,
      scale: 1.2,
      rotation: 0,
      flipH: false,
      flipV: false,
      invert: false,
    }));
    // Reset image index
    setCurrentImageIndex(0);
    // Clear annotations for new series
    setAnnotations([]);
    setSelectedAnnotationId(null);
    // Clear history
    setHistory([]);
    setHistoryIndex(-1);
  };

  const saveToHistory = () => {
    const newState = {
      annotations: [...annotations],
      transform: { ...viewTransform },
    };
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1);
      return [...newHistory, newState];
    });
    setHistoryIndex((prev) => prev + 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setAnnotations(prevState.annotations);
      setViewTransform(prevState.transform);
      setHistoryIndex((prev) => prev - 1);
    } else if (historyIndex === 0) {
      setAnnotations([]);
      setViewTransform({
        x: 0,
        y: 0,
        scale: 1.2,
        rotation: 0,
        flipH: false,
        flipV: false,
        invert: false,
        windowWidth: null,
        windowCenter: null,
      });
      setHistoryIndex(-1);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setAnnotations(nextState.annotations);
      setViewTransform(nextState.transform);
      setHistoryIndex((prev) => prev + 1);
    }
  };

  useEffect(() => {
    const fetchCaseData = async () => {
      if (!id) return;

      try {
        setLoading(true);
        setError(null);
        clearDownloadedSeriesIds();
        setSeriesLoadProgress(null);
        console.log(`Fetching case data for ID: ${id}`);
        const response = (await apiService.getCaseById(id)) as {
          success: boolean;
          data: CaseData;
        };
        console.log("Case data response:", response);

        if (response.success && response.data) {
          console.log(`Case loaded. Series count: ${response.data.series?.length || 0}, Instance count: ${response.data.instance_count}`);
          setCaseData(response.data);
          // Select series 1 by default, or the first series if series 1 doesn't exist
          if (response.data.series && response.data.series.length > 0) {
            console.log("Available series:", response.data.series.map(s => ({ id: s._id, num: s.series_number, desc: s.description, modality: s.modality })));
            const seriesOne = response.data.series.find(
              (s) => s.series_number === 1,
            );
            const defaultSeries = seriesOne || response.data.series[0];
            console.log("Selecting default series:", defaultSeries);
            setSelectedSeries(defaultSeries);
          } else {
            console.warn("No series found in case data");
          }
        } else {
          console.warn("Case data response invalid:", response);
        }
      } catch (err) {
        console.error("Error fetching case data:", err);
        setError(
          err instanceof Error ? err.message : "Failed to fetch case data",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchCaseData();
  }, [id, clearDownloadedSeriesIds]);

  const contextValue: ViewerContextType = {
    caseData,
    selectedSeries,
    setSelectedSeries: handleSetSelectedSeries,
    loading,
    error,
    currentImageIndex,
    setCurrentImageIndex,
    activeTool,
    setActiveTool,
    viewTransform,
    setViewTransform,
    annotations,
    setAnnotations,
    selectedAnnotationId,
    setSelectedAnnotationId,
    deleteSelectedAnnotation,
    deleteAnnotationById,
    undo,
    redo,
    canUndo: historyIndex >= 0,
    canRedo: historyIndex < history.length - 1,
    saveToHistory,
    isFullscreen,
    setIsFullscreen,
    toggleFullscreen,
    gridLayout,
    setGridLayout,
    paneStates,
    setPaneStates,
    activePaneIndex,
    setActivePaneIndex,
    setActivePaneSeries,
    crosshairIndices,
    setCrosshairIndices,
    temporaryMPRSeries,
    addTemporaryMPRSeries,
    removeTemporaryMPRSeries,
    selectedTemporarySeriesId,
    setSelectedTemporarySeriesId,
    pendingMPRGeneration,
    requestMPRGeneration,
    clearPendingMPRGeneration,
    showOverlays,
    setShowOverlays,
    seriesLoadProgress,
    setSeriesLoadProgress,
    downloadedSeriesIds,
    markSeriesAsDownloaded,
    clearDownloadedSeriesIds,
    shortcuts,
    updateShortcut,
    stackSpeed,
    setStackSpeed,
    miniMIPIntensity,
    setMiniMIPIntensity,
    mipIntensity,
    setMIPIntensity,
    showScoutLine,
    setShowScoutLine,
    isVRTActive,
    setIsVRTActive,
    mouseBindings,
    setMouseBinding,
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-black text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-gray-400">Loading case...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen w-full bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-2">Error loading case</p>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <ViewerContext.Provider value={contextValue}>
      <div className="min-h-screen w-full bg-black text-white flex flex-col h-screen overflow-hidden">
        <ViewerHeader />
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {!isVRTActive && <ViewerSidebar />}
          <main className="flex-1 min-w-0 min-h-0">
            <Outlet />
          </main>
        </div>
      </div>
    </ViewerContext.Provider>
  );
}
