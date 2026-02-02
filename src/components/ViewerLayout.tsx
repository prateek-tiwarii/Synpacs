import { Outlet, useParams } from "react-router-dom";
import { createContext, useContext, useState, useEffect } from "react";
import ViewerHeader from "./viewer/ViewerHeader";
import ViewerSidebar from "./viewer/ViewerSidebar";
import { apiService } from "@/lib/api";
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
  | "Length"
  | "Ellipse"
  | "Rectangle"
  | "Freehand"
  | "Text"
  | "Angle"
  | "CobbsAngle"
  | "HU";

// MPR Mode types
export type MPRMode = "Axial" | "Coronal" | "Sagittal" | "2D-MPR" | "3D-MPR";

// Crosshair indices for MPR views
export interface CrosshairIndices {
  x: number; // Column index (Sagittal position)
  y: number; // Row index (Coronal position)
  z: number; // Slice index (Axial position)
}

// Temporary MPR Series - stored in memory only
export interface MPRSliceData {
  index: number;
  imageData: ImageData; // Pre-rendered slice with W/L applied
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
}

export type GridLayout = "1x1" | "1x2" | "2x2";

export interface GridLayoutConfig {
  id: GridLayout;
  label: string;
  rows: number;
  cols: number;
}

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
  addTemporaryMPRSeries: (series: TemporaryMPRSeries) => void;
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
  // Shortcuts
  shortcuts: Shortcut[];
  updateShortcut: (id: string, newKey: string) => void;
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
    scale: 1,
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
  const [gridLayout, setGridLayout] = useState<GridLayout>("1x1");
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

  const DEFAULT_SHORTCUTS: Shortcut[] = [
    { id: "Window1", label: "Original Window", key: "1", category: "Display Windows" },
    { id: "Window2", label: "Lung Window", key: "2", category: "Display Windows" },
    { id: "Window3", label: "Bone Window", key: "3", category: "Display Windows" },
    { id: "Window4", label: "Brain Window", key: "4", category: "Display Windows" },
    { id: "Window5", label: "Liver Window", key: "5", category: "Display Windows" },
    { id: "Window6", label: "Infarct", key: "6", category: "Display Windows" },
    { id: "ToolLine", label: "Line Measurement", key: "l", category: "Tools" },
    { id: "ToolDistance", label: "Distance Measurement", key: "d", category: "Tools" },
    { id: "ToolAngle", label: "Angle Measurement", key: "a", category: "Tools" },
    { id: "ToolEllipse", label: "Ellipse", key: "e", category: "Tools" },
    { id: "ToolCircle", label: "Circle", key: "c", category: "Tools" },
    { id: "ToolFreehand", key: "f", label: "Freehand", category: "Tools" },
    { id: "ToolHU", key: "h", label: "HU Point", category: "Tools" },
    { id: "NavZoom", key: "z", label: "Zoom", category: "Navigation" },
    { id: "NavPan", key: "p", label: "Pan", category: "Navigation" },
    { id: "NavScroll", key: "s", label: "Scroll", category: "Navigation" },
    { id: "NavContrast", key: "w", label: "Contrast Adjustment", category: "Navigation" },
    { id: "NavReset", key: "Escape", label: "Reset", category: "Navigation" },
    { id: "TransRotateCW", key: "r", label: "Rotate 90° CW", category: "Transform" },
    { id: "TransRotateCCW", key: "R", label: "Rotate 90° CCW", category: "Transform" },
    { id: "TransFlipH", key: "h", label: "Flip Horizontal", category: "Transform" },
    { id: "TransFlipV", key: "v", label: "Flip Vertical", category: "Transform" },
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

  // Add a temporary MPR series and auto-select it
  const addTemporaryMPRSeries = (series: TemporaryMPRSeries) => {
    let newId = series.id;
    setTemporaryMPRSeries((prev) => {
      // Check if we already have this mode for this source series
      const existingIndex = prev.findIndex(
        (s) =>
          s.sourceSeriesId === series.sourceSeriesId &&
          s.mprMode === series.mprMode,
      );
      if (existingIndex >= 0) {
        // Replace existing, keep same id
        newId = prev[existingIndex].id;
        const updated = [...prev];
        updated[existingIndex] = { ...series, id: newId };
        return updated;
      }
      // Add new
      return [...prev, series];
    });
    // Auto-select the newly added/updated series
    setSelectedTemporarySeriesId(newId);
  };

  // Remove a temporary MPR series
  const removeTemporaryMPRSeries = (id: string) => {
    setTemporaryMPRSeries((prev) => prev.filter((s) => s.id !== id));
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

  // Grid layout configurations
  const GRID_LAYOUTS: GridLayoutConfig[] = [
    { id: "1x1", label: "1×1", rows: 1, cols: 1 },
    { id: "1x2", label: "1×2", rows: 1, cols: 2 },
    { id: "2x2", label: "2×2", rows: 2, cols: 2 },
  ];

  // Get number of panes for current layout
  const getLayoutPaneCount = (layout: GridLayout): number => {
    const config = GRID_LAYOUTS.find((l) => l.id === layout);
    return config ? config.rows * config.cols : 1;
  };

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
          newStates.push({
            seriesId: seriesForPane?._id || null,
            currentImageIndex: 0,
            viewTransform: {
              x: 0,
              y: 0,
              scale: 1,
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
        scale: 1,
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
        const response = (await apiService.getCaseById(id)) as {
          success: boolean;
          data: CaseData;
        };
        if (response.success && response.data) {
          setCaseData(response.data);
          // Select series 1 by default, or the first series if series 1 doesn't exist
          if (response.data.series && response.data.series.length > 0) {
            const seriesOne = response.data.series.find(
              (s) => s.series_number === 1,
            );
            const defaultSeries = seriesOne || response.data.series[0];
            setSelectedSeries(defaultSeries);
          }
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch case data",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchCaseData();
  }, [id]);

  const contextValue: ViewerContextType = {
    caseData,
    selectedSeries,
    setSelectedSeries,
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
    shortcuts,
    updateShortcut,
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
          {!isFullscreen && <ViewerSidebar />}
          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </ViewerContext.Provider>
  );
}
