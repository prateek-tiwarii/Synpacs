import { useState, useEffect, useMemo, memo, useCallback } from "react";
import toast from "react-hot-toast";
import {
  ZoomIn,
  Move,
  Contrast,
  SunMoon,
  Ruler,
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  Maximize2,
  Download,
  Undo2,
  Redo2,
  Pencil,
  Circle,
  Square,
  Type,
  SlidersHorizontal,
  RefreshCw,
  Crosshair,
  Layers,
  ScrollText,
  Star,
  Plus,
  CornerDownRight,
  GitBranch,
  LayoutGrid,
  Check,
  Box,
  Settings,
  ChevronDown,
  ScanLine,
  Copy,
  RectangleVertical,
  RectangleHorizontal,
  Link,
  Unlink,
  Hand,
} from "lucide-react";
import { SettingsDrawer } from "./SettingsDrawer";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { openReportInSingleWindow } from "@/lib/reportWindow";

// CT Window Presets with standard W/L values
const CT_PRESETS = [
  { key: "1", name: "Original", width: null, center: null },
  { key: "2", name: "Lung", width: 1500, center: -500 },
  { key: "3", name: "Mediastinum", width: 350, center: 50 },
  { key: "4", name: "Bone", width: 2500, center: 500 },
  { key: "5", name: "Brain", width: 80, center: 40 },
  { key: "6", name: "Stroke", width: 8, center: 32 },
  { key: "7", name: "Liver", width: 150, center: 30 },
] as const;

interface ToolButtonProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  description?: string;
  isToggle?: boolean;
}

const ToolButton = ({
  icon,
  label,
  active = false,
  onClick,
  onMouseDown,
  disabled = false,
  description,
  isToggle = false,
}: ToolButtonProps) => {
  const getButtonClass = () => {
    if (disabled) {
      return "opacity-30 cursor-not-allowed text-gray-500";
    }
    if (isToggle) {
      return active
        ? "text-white hover:bg-gray-700/50"
        : "text-gray-500 opacity-50 hover:opacity-75";
    }
    return active
      ? "bg-blue-600 text-white"
      : "text-gray-300 hover:bg-gray-700";
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={disabled ? undefined : onClick}
          onMouseDown={disabled ? undefined : onMouseDown}
          onContextMenu={onMouseDown ? (e) => e.preventDefault() : undefined}
          disabled={disabled}
          className={`flex flex-col items-center justify-center p-2 rounded transition-colors min-w-[48px] ${getButtonClass()}`}
        >
          {icon}
          <span className="text-[10px] mt-1 whitespace-nowrap">{label}</span>
        </button>
      </TooltipTrigger>
      {description && (
        <TooltipContent
          side="bottom"
          className="bg-gray-800 border-gray-700 text-gray-200"
        >
          <p>{description}</p>
        </TooltipContent>
      )}
    </Tooltip>
  );
};

const ToolDivider = () => <div className="w-px h-10 bg-gray-600 mx-1" />;

import {
  DEFAULT_MIP_INTENSITY,
  getPaneScale,
  useViewerContext,
} from "../ViewerLayout";
import { apiService } from "@/lib/api";
import type { MPRMode, ViewerTool, MouseButton, MouseButtonBindings } from "../ViewerLayout";

const VIEWER_TOOL_IDS = new Set<string>([
  "Stack", "Pan", "Zoom", "Contrast", "FreeRotate", "SpineLabeling",
  "Length", "Ellipse", "Rectangle", "Freehand", "Text", "Angle", "CobbsAngle", "HU",
]);

const isBindableTool = (toolId: string): toolId is ViewerTool =>
  VIEWER_TOOL_IDS.has(toolId);

const MOUSE_BUTTON_LABELS: { button: MouseButton; label: string; color: string }[] = [
  { button: 0, label: "L", color: "bg-blue-400" },
  { button: 1, label: "M", color: "bg-green-400" },
  { button: 2, label: "R", color: "bg-red-400" },
];

const getMouseButtonsForTool = (toolId: ViewerTool) =>
  toolId === "SpineLabeling" ? [] : MOUSE_BUTTON_LABELS;

const MouseBindingBar = memo(({ toolId, mouseBindings }: {
  toolId: ViewerTool;
  mouseBindings: MouseButtonBindings;
}) => {
  const buttons = getMouseButtonsForTool(toolId);
  if (buttons.length === 0) return null;

  const boundButtons = buttons.filter(({ button }) => mouseBindings[button] === toolId);
  if (boundButtons.length === 0) return null;

  return (
    <div className="flex w-full justify-center gap-[2px] px-1 mt-0.5">
      {boundButtons.map(({ button, label, color }) => (
        <span
          key={button}
          className={`h-[10px] flex-1 rounded-sm text-[6px] leading-[10px] font-bold select-none text-center ${color} text-gray-900`}
          title={`${label === "L" ? "Left" : label === "M" ? "Middle" : "Right"} click → ${toolId}`}
        >
          {label}
        </span>
      ))}
    </div>
  );
});

import { buildGridLayoutId, parseGridLayout } from "@/lib/gridLayout";

const LAYOUT_PICKER_MAX_ROWS = 5;
const LAYOUT_PICKER_MAX_COLS = 5;

// MPR dropdown: only 2D MPR and 3D MPR (Axial/Coronal/Sagittal are separate toolbar buttons).
// Sole difference: 2D = orthogonal planes only; 3D = allows oblique plane rotation (user can rotate slice angle freely).
const MPR_DROPDOWN_MODES: {
  id: MPRMode;
  label: string;
  description: string;
}[] = [
  { id: "2D-MPR", label: "2D MPR", description: "Orthogonal planes only (Axial, Coronal, Sagittal)" },
  { id: "3D-MPR", label: "3D MPR", description: "Free oblique plane rotation" },
];

const ViewerHeader = () => {
  const {
    caseData,
    activeTool,
    setActiveTool,
    viewTransform,
    setViewTransform,
    setAnnotations,
    setSelectedAnnotationId,
    undo,
    redo,
    canUndo,
    canRedo,
    saveToHistory,
    gridLayout,
    setGridLayout,
    paneStates,
    setPaneStates,
    activePaneIndex,
    setActivePaneSeries,
    temporaryMPRSeries,
    selectedTemporarySeriesId,
    setSelectedTemporarySeriesId,
    selectedSeries,
    requestMPRGeneration,
    pendingMPRGeneration,
    showOverlays,
    setShowOverlays,
    shortcuts,
    stackSpeed,
    setStackSpeed,
    mipIntensity,
    setMIPIntensity,
    showScoutLine,
    setShowScoutLine,
    isVRTActive,
    setIsVRTActive,
    mprSyncMode,
    setMprSyncMode,
    mprSyncNowRef,
    is2DMPRActive,
    setIs2DMPRActive,
    mprLayoutPreset,
    setMprLayoutPreset,
    mouseBindings,
    setMouseBinding,
    assignToolToButton,
  } = useViewerContext();

  const handleExportDicomZip = useCallback(async () => {
    if (!caseData?._id) {
      toast.error("No case loaded to export");
      return;
    }
    try {
      toast.loading("Preparing DICOM ZIP…", { id: "export-dicom" });
      const { blob, filename } = await apiService.exportCaseDicomZip(caseData._id);
      apiService.downloadBlob(blob, filename);
      toast.success("Download started", { id: "export-dicom" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed", { id: "export-dicom" });
    }
  }, [caseData?._id]);

  const handleCopyCurrentFrame = useCallback(async () => {
    const activeCanvas =
      document.querySelector<HTMLCanvasElement>(
        'canvas[data-viewer-canvas="true"][data-viewer-active="true"]',
      ) ??
      document.querySelector<HTMLCanvasElement>('canvas[data-viewer-canvas="true"]');

    if (!activeCanvas) {
      toast.error("No image available to copy");
      return;
    }

    if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
      toast.error("Clipboard image copy not supported in this browser");
      return;
    }

    try {
      const blob = await new Promise<Blob | null>((resolve) => {
        activeCanvas.toBlob(resolve, "image/png");
      });
      if (!blob) {
        toast.error("Failed to capture image");
        return;
      }
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast.success("Copied current frame to clipboard");
    } catch (error) {
      console.error("Failed to copy image to clipboard", error);
      toast.error("Failed to copy image to clipboard");
    }
  }, []);

  const [activeTab, setActiveTab] = useState<
    "Favourites" | "Tools" | "Measurement"
  >("Favourites");

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLayoutMenuOpen, setIsLayoutMenuOpen] = useState(false);
  const [isProjectionMenuOpen, setIsProjectionMenuOpen] = useState(false);
  const [layoutHover, setLayoutHover] = useState<{
    rows: number;
    cols: number;
  } | null>(null);

  const [favourites, setFavourites] = useState<string[]>(() => {
    const saved = localStorage.getItem("viewer_favourites");
    return saved ? JSON.parse(saved) : ["Stack", "Pan", "Zoom", "Length"];
  });

  useEffect(() => {
    localStorage.setItem("viewer_favourites", JSON.stringify(favourites));
  }, [favourites]);

  const selectedLayout = useMemo(
    () => parseGridLayout(gridLayout) ?? { rows: 1, cols: 1 },
    [gridLayout],
  );
  const previewLayout = layoutHover ?? selectedLayout;

  const handleLayoutSelect = (rows: number, cols: number) => {
    setGridLayout(buildGridLayoutId(rows, cols));
    setLayoutHover(null);
    setIsLayoutMenuOpen(false);
  };

  // Apply CT preset
  const applyPreset = (preset: (typeof CT_PRESETS)[number]) => {
    setViewTransform((prev) => ({
      ...prev,
      windowWidth: preset.width,
      windowCenter: preset.center,
    }));
    saveToHistory();
  };

  const handleRotateCw = () => {
    setViewTransform((prev) => ({
      ...prev,
      rotation: (prev.rotation + 90) % 360,
    }));
    saveToHistory();
  };

  const handleRotateCcw = () => {
    setViewTransform((prev) => ({
      ...prev,
      rotation: (prev.rotation - 90 + 360) % 360,
    }));
    saveToHistory();
  };

  const handleFlipH = () => {
    setViewTransform((prev) => ({ ...prev, flipH: !prev.flipH }));
    saveToHistory();
  };

  const handleFlipV = () => {
    setViewTransform((prev) => ({ ...prev, flipV: !prev.flipV }));
    saveToHistory();
  };

  const handleInvert = () => {
    setViewTransform((prev) => ({ ...prev, invert: !prev.invert }));
    saveToHistory();
  };

  const handleMPROrientation = useCallback(
    (mode: "Axial" | "Coronal" | "Sagittal") => {
      const existingTempSeries = temporaryMPRSeries.find(
        (ts) => ts.sourceSeriesId === selectedSeries?._id && ts.mprMode === mode,
      );
      const activePaneSeriesId = paneStates[activePaneIndex]?.seriesId ?? null;
      const isActivePaneAlreadyThis =
        existingTempSeries && activePaneSeriesId === existingTempSeries.id;
      if (isActivePaneAlreadyThis) {
        toast(`This pane is already in ${mode} orientation`);
        return;
      }
      if (existingTempSeries) {
        setSelectedTemporarySeriesId(existingTempSeries.id);
        setActivePaneSeries(existingTempSeries.id);
      } else {
        requestMPRGeneration(mode);
      }
    },
    [
      temporaryMPRSeries,
      selectedSeries?._id,
      paneStates,
      activePaneIndex,
      setSelectedTemporarySeriesId,
      setActivePaneSeries,
      requestMPRGeneration,
    ],
  );

  const handleReset = () => {
    setViewTransform({
      x: 0,
      y: 0,
      scale: getPaneScale(1),
      rotation: 0,
      flipH: false,
      flipV: false,
      invert: false,
      windowWidth: null,
      windowCenter: null,
    });
    setAnnotations([]);
    setSelectedAnnotationId(null);
    setActiveTool("Stack");
    setSelectedTemporarySeriesId(null);
    setGridLayout("1x1");
    setShowScoutLine(false);
    setPaneStates((prev) =>
      prev.map((pane) => ({
        ...pane,
        currentImageIndex: 0,
        viewTransform: {
          x: 0,
          y: 0,
          scale: getPaneScale(1),
          rotation: 0,
          flipH: false,
          flipV: false,
          invert: false,
          windowWidth: null,
          windowCenter: null,
        },
        annotations: [],
        selectedAnnotationId: null,
      })),
    );
    saveToHistory();
  };

  // Global Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Check for modifier keys alone
      if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return;

      // VRT mode: block all shortcuts except Escape to exit
      if (isVRTActive) {
        if (e.key === "Escape") {
          e.preventDefault();
          setIsVRTActive(false);
        }
        return;
      }

      // Match shortcut key case-insensitively so "S" and "s" both work
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const shortcut = shortcuts.find(
        (s) => (s.key.length === 1 ? s.key.toLowerCase() : s.key) === key,
      );
      if (shortcut) {
        e.preventDefault();

        switch (shortcut.id) {
          case "Window1": applyPreset(CT_PRESETS[0]); break;
          case "Window2": applyPreset(CT_PRESETS[1]); break;
          case "Window3": applyPreset(CT_PRESETS[2]); break;
          case "Window4": applyPreset(CT_PRESETS[3]); break;
          case "Window5": applyPreset(CT_PRESETS[4]); break;
          case "Window6": applyPreset(CT_PRESETS[5]); break;
          case "Window7": applyPreset(CT_PRESETS[6]); break;
          case "ToolLine": assignToolToButton(0, "Length"); break;
          case "ToolDistance": assignToolToButton(0, "Length"); break;
          case "ToolAngle": assignToolToButton(0, "Angle"); break;
          case "ToolEllipse": assignToolToButton(0, "Ellipse"); break;
          case "ToolCircle": assignToolToButton(0, "Ellipse"); break;
          case "ToolFreehand": assignToolToButton(0, "Freehand"); break;
          case "ToolHU": assignToolToButton(0, "HU"); break;
          case "ToolSpineLabeling": assignToolToButton(0, "SpineLabeling"); break;
          case "NavZoom": assignToolToButton(0, "Zoom"); break;
          case "NavPan": assignToolToButton(0, "Pan"); break;
          case "NavScroll": assignToolToButton(0, "Stack"); break;
          case "NavContrast": assignToolToButton(0, "Contrast"); break;
          case "NavReset": handleReset(); break;
          case "TransRotateCW": handleRotateCw(); break;
          case "TransRotateCCW": handleRotateCcw(); break;
          case "TransFlipH": handleFlipH(); break;
          case "TransFlipV": handleFlipV(); break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    shortcuts,
    assignToolToButton,
    handleReset,
    handleRotateCw,
    handleRotateCcw,
    handleFlipH,
    handleFlipV,
    saveToHistory,
    isVRTActive,
    setIsVRTActive,
  ]);

  interface ViewerToolBaseConfig {
    label: string;
    icon: React.ReactNode;
    category: string;
    active?: boolean;
    disabled?: boolean;
    description?: string;
    isToggle?: boolean;
  }

  interface ViewerToolConfig extends ViewerToolBaseConfig {
    id: ViewerTool;
    type: "tool";
  }

  interface ViewerActionConfig extends ViewerToolBaseConfig {
    id: string;
    type: "action";
    onClick?: () => void;
  }

  interface ViewerDropdownConfig extends ViewerToolBaseConfig {
    id: string;
    type: "dropdown";
    onClick?: () => void;
  }

  type ViewerToolConfigItem =
    | ViewerToolConfig
    | ViewerActionConfig
    | ViewerDropdownConfig;

  const AVAILABLE_TOOLS: ViewerToolConfigItem[] = useMemo(
    () => [
      {
        id: "Stack",
        label: "Stack",
        icon: <Layers size={18} />,
        category: "Tools",
        type: "dropdown",
        active: activeTool === "Stack",
        description: "Scroll through slices (Mouse Wheel or Drag)",
      },
      {
        id: "Pan",
        label: "Pan",
        icon: <Move size={18} />,
        category: "Tools",
        type: "tool",
        active: activeTool === "Pan",
        description: "Move the image around (Drag)",
      },
      {
        id: "Zoom",
        label: "Zoom",
        icon: <ZoomIn size={18} />,
        category: "Tools",
        type: "tool",
        active: activeTool === "Zoom",
        description: "Zoom in/out (Drag up/down)",
      },
      {
        id: "Fit",
        label: "Fit",
        icon: <Maximize2 size={18} />,
        category: "Tools",
        type: "action",
        onClick: () =>
          setViewTransform((prev) => ({ ...prev, x: 0, y: 0, scale: getPaneScale(1) })),
        description: "Reset zoom to fit container",
      },
      {
        id: "Contrast",
        label: "Contrast",
        icon: <Contrast size={18} />,
        category: "Tools",
        type: "tool",
        active: activeTool === "Contrast",
        description: "Adjust brightness/contrast (Drag L/R: Width, U/D: Center)",
      },
      {
        id: "Presets",
        label: "Presets",
        icon: <SlidersHorizontal size={18} />,
        category: "Tools",
        type: "dropdown",
        description: "Quick window/level settings for different tissue types",
      },
      {
        id: "Reset",
        label: "Reset",
        icon: <RefreshCw size={18} />,
        category: "Tools",
        type: "action",
        onClick: handleReset,
        description: "Reset all transforms and measurements",
      },
      {
        id: "Layout",
        label: "Layout",
        icon: <LayoutGrid size={18} />,
        category: "Tools",
        type: "dropdown",
        description: "Change the grid layout (e.g., 2x3, 4x4)",
      },
      {
        id: "MPR-Axial",
        label: "Axial",
        icon: <Circle size={18} />,
        category: "Tools",
        type: "action",
        onClick: () => handleMPROrientation("Axial"),
        description: "Top-down view (MPR)",
      },
      {
        id: "MPR-Coronal",
        label: "Coronal",
        icon: <RectangleVertical size={18} />,
        category: "Tools",
        type: "action",
        onClick: () => handleMPROrientation("Coronal"),
        description: "Front-to-back view (MPR)",
      },
      {
        id: "MPR-Sagittal",
        label: "Sagittal",
        icon: <RectangleHorizontal size={18} />,
        category: "Tools",
        type: "action",
        onClick: () => handleMPROrientation("Sagittal"),
        description: "Side view (MPR)",
      },
      {
        id: "MPR",
        label: "MPR",
        icon: <Box size={18} />,
        category: "Tools",
        type: "dropdown",
        description: "2D MPR (orthogonal planes only) or 3D MPR (free oblique rotation)",
      },
      {
        id: "Projection",
        label: "Projection",
        icon: <ScanLine size={18} />,
        category: "Tools",
        type: "dropdown",
        description: "MIP / MiniMIP intensity projection — slab thickness control",
      },
      {
        id: "SpineLabeling",
        label: "Spine Labeling",
        icon: <Pencil size={18} />,
        category: "Tools",
        type: "tool",
        active: activeTool === "SpineLabeling",
        description: "Auto-sequentially place vertebra labels from a selected start point",
      },
      {
        id: "RotateCw",
        label: "Rotate CW",
        icon: <RotateCw size={18} />,
        category: "Tools",
        type: "action",
        onClick: handleRotateCw,
        description: "Rotate image 90° clockwise",
      },
      {
        id: "RotateCcw",
        label: "Rotate CCW",
        icon: <RotateCcw size={18} />,
        category: "Tools",
        type: "action",
        onClick: handleRotateCcw,
        description: "Rotate image 90° counter-clockwise",
      },
      {
        id: "FreeRotate",
        label: "Free Rotate",
        icon: <RotateCcw size={18} />,
        category: "Tools",
        type: "tool",
        active: activeTool === "FreeRotate",
        description: "Drag around image center to rotate (Shift for fine control)",
      },
      {
        id: "FlipH",
        label: "Flip H",
        icon: <FlipHorizontal size={18} />,
        category: "Tools",
        type: "action",
        onClick: handleFlipH,
        description: "Flip image horizontally",
      },
      {
        id: "FlipV",
        label: "Flip V",
        icon: <FlipVertical size={18} />,
        category: "Tools",
        type: "action",
        onClick: handleFlipV,
        description: "Flip image vertically",
      },
      {
        id: "Invert",
        label: "Invert",
        icon: <SunMoon size={18} />,
        category: "Tools",
        type: "action",
        active: viewTransform.invert,
        onClick: handleInvert,
        description: "Invert image colors",
      },
      {
        id: "Length",
        label: "Length",
        icon: <Ruler size={18} />,
        category: "Measurement",
        type: "tool",
        active: activeTool === "Length",
        description: "Measure distance between two points",
      },
      {
        id: "Ellipse",
        label: "Ellipse",
        icon: <Circle size={18} />,
        category: "Measurement",
        type: "tool",
        active: activeTool === "Ellipse",
        description: "Measure area and HU values in an elliptical region",
      },
      {
        id: "Rectangle",
        label: "Rectangle",
        icon: <Square size={18} />,
        category: "Measurement",
        type: "tool",
        active: activeTool === "Rectangle",
        description: "Measure area and HU values in a rectangular region",
      },
      {
        id: "Freehand",
        label: "Freehand",
        icon: <Pencil size={18} />,
        category: "Measurement",
        type: "tool",
        active: activeTool === "Freehand",
        description: "Draw a freehand region to measure area and HU",
      },
      {
        id: "Text",
        label: "Text",
        icon: <Type size={18} />,
        category: "Measurement",
        type: "tool",
        active: activeTool === "Text",
        description: "Add a text annotation to the image",
      },
      {
        id: "Angle",
        label: "Angle",
        icon: <CornerDownRight size={18} />,
        category: "Measurement",
        type: "tool",
        active: activeTool === "Angle",
        description: "Measure angle between three points",
      },
      {
        id: "CobbsAngle",
        label: "Cobb's",
        icon: <GitBranch size={18} />,
        category: "Measurement",
        type: "tool",
        active: activeTool === "CobbsAngle",
        description: "Measure Cobb's angle using two lines",
      },
      {
        id: "HU",
        label: "HU",
        icon: <Crosshair size={18} />,
        category: "Measurement",
        type: "tool",
        active: activeTool === "HU",
        description: "Get Hounsfield Unit value at a specific point",
      },
      {
        id: "Overlays",
        label: "Overlays",
        icon: <Layers size={18} />,
        category: "Tools",
        type: "action",
        active: showOverlays,
        onClick: () => setShowOverlays(!showOverlays),
        description: "Toggle patient info and image metadata overlays",
        isToggle: true,
      },
      {
        id: "ScoutLine",
        label: "Scout",
        icon: <ScanLine size={18} />,
        category: "Tools",
        type: "action",
        active: showScoutLine,
        onClick: () => setShowScoutLine(!showScoutLine),
        description: "Toggle scout line between panes (visible in multi-pane layouts)",
        isToggle: true,
        disabled: gridLayout === "1x1",
      },
    ],
    [
      activeTool,
      handleRotateCw,
      handleRotateCcw,
      handleFlipH,
      handleFlipV,
      handleInvert,
      viewTransform.invert,
      handleReset,
      handleMPROrientation,
      setViewTransform,
      showOverlays,
      setShowOverlays,
      showScoutLine,
      setShowScoutLine,
      gridLayout,
    ],
  );

  const handleToolClick = (tool: ViewerToolConfigItem) => {
    if (tool.disabled) return;
    if (tool.type === "tool") {
      // Assign tool to LEFT so highlight and actual binding stay in sync
      assignToolToButton(0, tool.id);
    } else if (tool.onClick) {
      tool.onClick();
    }
  };

  const handleToolMouseDown = useCallback((e: React.MouseEvent, tool: ViewerToolConfigItem) => {
    if (tool.disabled) return;
    if (tool.type !== "tool") return;
    e.preventDefault();
    const button = e.button as MouseButton;
    assignToolToButton(button, tool.id);
  }, [assignToolToButton]);

  const toggleFavourite = (toolId: string) => {
    setFavourites((prev) =>
      prev.includes(toolId)
        ? prev.filter((id) => id !== toolId)
        : [...prev, toolId],
    );
  };

  type ProjectionModeType = "none" | "MIP" | "MiniMIP";

  const activeProjectionMode: ProjectionModeType = (() => {
    if (!selectedTemporarySeriesId) return "none";
    const ts = temporaryMPRSeries.find((s) => s.id === selectedTemporarySeriesId);
    if (ts?.mprMode === "MIP") return "MIP";
    if (ts?.mprMode === "MiniMIP") return "MiniMIP";
    return "none";
  })();

  const projectionSliderBaseClassName =
    "w-full appearance-none rounded-full outline-none cursor-pointer transition-[filter] duration-150 hover:brightness-110 active:brightness-125 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:shadow-[0_0_0_1px_rgba(0,0,0,0.35)] [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2";

  const projectionSliderClassName = `${projectionSliderBaseClassName} h-2 [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-thumb]:-mt-1 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-moz-range-track]:h-2 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-webkit-slider-thumb]:bg-amber-300 [&::-webkit-slider-thumb]:border-amber-100 [&::-moz-range-thumb]:bg-amber-300 [&::-moz-range-thumb]:border-amber-100`;

  const handleProjectionModeSelect = useCallback(
    (mode: ProjectionModeType) => {
      if (mode === "none") {
        setSelectedTemporarySeriesId(null);
        setMIPIntensity(0);
        setViewTransform((prev) => ({
          ...prev,
          x: 0,
          y: 0,
          scale: getPaneScale(1),
        }));
        return;
      }

      const existing = selectedSeries
        ? temporaryMPRSeries.find(
            (ts) => ts.sourceSeriesId === selectedSeries._id && ts.mprMode === mode,
          )
        : null;

      if (mipIntensity === 0) {
        setMIPIntensity(DEFAULT_MIP_INTENSITY);
      }

      if (existing) {
        setSelectedTemporarySeriesId(existing.id);
      } else {
        requestMPRGeneration(mode);
      }
    },
    [
      selectedSeries,
      temporaryMPRSeries,
      setSelectedTemporarySeriesId,
      setViewTransform,
      requestMPRGeneration,
      mipIntensity,
      setMIPIntensity,
    ],
  );

  const renderLayoutDropdownContent = () => (
    <DropdownMenuContent
      align="start"
      className="bg-gray-900/95 border-gray-700 text-gray-200 p-1.5 shadow-2xl"
    >
      <div
        className="grid gap-1"
        style={{
          gridTemplateColumns: `repeat(${LAYOUT_PICKER_MAX_COLS}, minmax(0, 1fr))`,
        }}
        onMouseLeave={() => setLayoutHover(null)}
      >
        {Array.from({ length: LAYOUT_PICKER_MAX_ROWS }).map((_, rowIndex) =>
          Array.from({ length: LAYOUT_PICKER_MAX_COLS }).map((__, colIndex) => {
            const rows = rowIndex + 1;
            const cols = colIndex + 1;
            const isHighlighted =
              rowIndex < previewLayout.rows && colIndex < previewLayout.cols;
            const isSelected =
              rows === selectedLayout.rows && cols === selectedLayout.cols;

            return (
              <button
                key={`${rows}x${cols}`}
                type="button"
                onMouseEnter={() => setLayoutHover({ rows, cols })}
                onFocus={() => setLayoutHover({ rows, cols })}
                onClick={() => handleLayoutSelect(rows, cols)}
                className={`h-6 w-6 rounded border transition-all duration-150 ${isHighlighted
                  ? "bg-amber-400/85 border-amber-100/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
                  : "bg-gray-800/80 border-gray-700 hover:border-gray-500 hover:bg-gray-700/80"
                  } ${isSelected ? "ring-2 ring-amber-200/80 ring-offset-1 ring-offset-gray-900" : ""}`}
                aria-label={`Set layout ${rows} by ${cols}`}
              />
            );
          }),
        )}
      </div>
    </DropdownMenuContent>
  );

  const isProjectionGenerating =
    pendingMPRGeneration !== null &&
    (pendingMPRGeneration.mode === "MIP" || pendingMPRGeneration.mode === "MiniMIP");

  const renderProjectionDropdownContent = () => {
    const slabValue = mipIntensity;
    const fillPercent = (slabValue / 50) * 100;
    const fillColor = "#f59e0b";
    const trackColor = "#334155";
    const showSlab = activeProjectionMode !== "none";

    return (
      <DropdownMenuContent
        align="start"
        className="w-72 bg-gray-900 border-gray-700 text-gray-200 p-3"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="text-[11px] text-gray-400 mb-2 font-medium uppercase tracking-wider">
          Projection Mode
        </div>
        <div className="flex gap-1 mb-1">
          {(["none", "MIP", "MiniMIP"] as const).map((mode) => {
            const label = mode === "none" ? "Normal" : mode;
            const isActive = activeProjectionMode === mode;
            const isPending =
              isProjectionGenerating && pendingMPRGeneration?.mode === mode;
            return (
              <button
                key={mode}
                type="button"
                disabled={isPending}
                onClick={() => handleProjectionModeSelect(mode)}
                className={`flex-1 text-xs py-1.5 px-2 rounded font-medium transition-colors flex items-center justify-center gap-1.5 ${
                  isActive
                    ? "bg-amber-500/90 text-gray-900"
                    : isPending
                    ? "bg-gray-700 text-gray-300"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
                }`}
              >
                {isPending && (
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {label}
              </button>
            );
          })}
        </div>

        {showSlab && (
          <>
            <div className="text-[11px] text-gray-400 mb-1.5 mt-3 font-medium">Slab Thickness</div>
            <div className="flex items-center justify-between mb-1.5">
              <button
                type="button"
                onClick={() => setMIPIntensity(DEFAULT_MIP_INTENSITY)}
                disabled={slabValue === DEFAULT_MIP_INTENSITY}
                className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors border-amber-400/40 text-amber-200 hover:bg-amber-500/10 ${
                  slabValue === DEFAULT_MIP_INTENSITY
                    ? "opacity-40 cursor-not-allowed hover:bg-transparent"
                    : ""
                }`}
              >
                Reset
              </button>
              <span className="text-[11px] px-1.5 py-0.5 rounded border font-medium text-amber-100 border-amber-400/60 bg-amber-400/20">
                {slabValue}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={50}
              step={1}
              value={slabValue}
              onInput={(e) => {
                const v = parseInt((e.target as HTMLInputElement).value, 10);
                setMIPIntensity(v);
              }}
              onChange={(e) => {
                const v = parseInt((e.target as HTMLInputElement).value, 10);
                setMIPIntensity(v);
              }}
              style={{
                background: `linear-gradient(90deg, ${fillColor} 0%, ${fillColor} ${fillPercent}%, ${trackColor} ${fillPercent}%, ${trackColor} 100%)`,
              }}
              className={projectionSliderClassName}
            />
            <div className="text-[10px] text-gray-500 mt-2">
              {activeProjectionMode === "MIP"
                ? "Max intensity — vessels, angiography"
                : "Min intensity — airways, lung"}
            </div>
          </>
        )}
      </DropdownMenuContent>
    );
  };

  if (!caseData) return null;

  // 2D MPR mode: dedicated header with compact tool palette + exit button
  if (is2DMPRActive) {
    const mprTools: { tool: ViewerTool; icon: React.ReactNode; label: string }[] = [
      { tool: "Stack", icon: <Layers size={16} />, label: "Scroll" },
      { tool: "Pan", icon: <Move size={16} />, label: "Pan" },
      { tool: "Zoom", icon: <ZoomIn size={16} />, label: "Zoom" },
      { tool: "Contrast", icon: <Contrast size={16} />, label: "W/L" },
      { tool: "FreeRotate", icon: <RotateCw size={16} />, label: "Rotate" },
      { tool: "Length", icon: <Ruler size={16} />, label: "Length" },
      { tool: "Angle", icon: <CornerDownRight size={16} />, label: "Angle" },
      { tool: "Ellipse", icon: <Circle size={16} />, label: "Ellipse" },
      { tool: "Rectangle", icon: <Square size={16} />, label: "Rect" },
      { tool: "HU", icon: <Crosshair size={16} />, label: "HU" },
    ];

    return (
      <TooltipProvider>
        <header className="bg-gray-900 border-b border-gray-700">
          <div className="flex items-center justify-between px-4 py-1.5">
            <div className="flex items-center gap-3">
              <Layers size={18} className="text-green-400" />
              <span className="text-sm font-medium text-white">2D MPR View</span>
              <div className="w-px h-6 bg-gray-700 mx-1" />
              {/* Compact tool palette */}
              <div className="flex items-center gap-0.5">
                {mprTools.map(({ tool, icon, label }) => (
                  <div key={tool} className="flex flex-col items-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            assignToolToButton(e.button as MouseButton, tool);
                          }}
                          onContextMenu={(e) => e.preventDefault()}
                          className={`flex items-center gap-1 px-2 py-1.5 rounded text-xs transition-colors ${
                            activeTool === tool
                              ? "bg-blue-600 text-white"
                              : "text-gray-400 hover:text-white hover:bg-gray-800"
                          }`}
                        >
                          {icon}
                          <span className="hidden xl:inline">{label}</span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="bg-gray-800 border-gray-700 text-gray-200">
                        <p>{label}</p>
                      </TooltipContent>
                    </Tooltip>
                    <MouseBindingBar toolId={tool} mouseBindings={mouseBindings} />
                  </div>
                ))}
              </div>
              <div className="w-px h-6 bg-gray-700 mx-1" />
              {/* Window presets */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1 px-2 py-1.5 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
                    <SunMoon size={14} />
                    <span>Presets</span>
                    <ChevronDown size={12} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-gray-800 border-gray-700">
                  {CT_PRESETS.map((preset) => (
                    <DropdownMenuItem
                      key={preset.key}
                      onClick={() => {
                        setViewTransform((prev) => ({
                          ...prev,
                          windowWidth: preset.width,
                          windowCenter: preset.center,
                        }));
                      }}
                      className="text-gray-200 hover:bg-gray-700 text-xs"
                    >
                      <span className="text-gray-500 mr-2">{preset.key}</span>
                      {preset.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex items-center gap-2">
              {/* Crosshair / Scout line toggle — visible in all 3 planes */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setShowScoutLine(!showScoutLine)}
                    className={`flex items-center gap-1 px-2 py-1.5 rounded text-xs transition-colors ${
                      showScoutLine ? "bg-green-600/80 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"
                    }`}
                  >
                    <Crosshair size={14} />
                    <span>Crosshair</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-gray-800 border-gray-700 text-gray-200">
                  <p>Toggle crosshair in all 3 planes</p>
                </TooltipContent>
              </Tooltip>
              {/* MPR layout arrangement */}
              <select
                value={mprLayoutPreset}
                onChange={(e) => setMprLayoutPreset(e.target.value as typeof mprLayoutPreset)}
                className="bg-black/80 text-white text-xs px-2 py-1.5 rounded border border-gray-600 hover:border-gray-400 cursor-pointer outline-none focus:border-green-500"
                title="MPR layout"
              >
                <option value="left-large">Left large</option>
                <option value="right-large">Right large</option>
                <option value="top-large">Top large</option>
                <option value="bottom-large">Bottom large</option>
                <option value="1x3">1×3 row</option>
                <option value="3x1">3×1 column</option>
              </select>
              <span className="text-xs text-gray-500">Press Escape to exit</span>
              <button
                onClick={() => setIs2DMPRActive(false)}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors font-medium"
              >
                Exit MPR
              </button>
            </div>
          </div>
        </header>
      </TooltipProvider>
    );
  }

  // 3D MPR mode: header with sync tool options + exit button
  if (isVRTActive) {
    return (
      <TooltipProvider>
        <header className="bg-gray-900 border-b border-gray-700">
          <div className="flex items-center justify-between px-4 py-2.5">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <Box size={18} className="text-purple-400" />
                <span className="text-sm font-medium text-white">3D MPR View</span>
                <span className="text-xs text-gray-500">Press Escape or click Exit to return</span>
              </div>
              <div className="flex items-center gap-0.5 rounded-md border border-gray-600 bg-black/60 py-0.5 pl-0.5 pr-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setMprSyncMode("auto")}
                      className={`rounded p-1.5 transition-colors ${
                        mprSyncMode === "auto"
                          ? "bg-blue-600 text-white"
                          : "text-gray-400 hover:bg-gray-700 hover:text-white"
                      }`}
                    >
                      <Link size={18} strokeWidth={2} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="bg-gray-800 border-gray-700 text-gray-200">
                    <p>Auto Sync – match slices by position/orientation</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setMprSyncMode("manual")}
                      className={`rounded p-1.5 transition-colors ${
                        mprSyncMode === "manual"
                          ? "bg-blue-600 text-white"
                          : "text-gray-400 hover:bg-gray-700 hover:text-white"
                      }`}
                    >
                      <Unlink size={18} strokeWidth={2} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="bg-gray-800 border-gray-700 text-gray-200">
                    <p>Manual Sync – link selected panes only</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setMprSyncMode("none")}
                      className={`rounded p-1.5 transition-colors ${
                        mprSyncMode === "none"
                          ? "bg-blue-600 text-white"
                          : "text-gray-400 hover:bg-gray-700 hover:text-white"
                      }`}
                    >
                      <Hand size={18} strokeWidth={2} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="bg-gray-800 border-gray-700 text-gray-200">
                    <p>No Sync – panes independent</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              {mprSyncMode === "manual" && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => mprSyncNowRef.current?.()}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded border border-blue-500 transition-colors font-medium"
                    >
                      Sync Now
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="bg-gray-800 border-gray-700 text-gray-200">
                    <p>Apply active pane state to all panes</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <button
              onClick={() => setIsVRTActive(false)}
              className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors font-medium"
            >
              Exit 3D MPR
            </button>
          </div>
        </header>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <header className="bg-gray-900 border-b border-gray-700">
        {/* Tab Navigation */}
        <div className="flex items-center justify-between gap-1 px-4 py-0.5 border-b border-gray-800 bg-gray-900/50">
          <div className="flex gap-4">
            {(["Favourites", "Tools", "Measurement"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 text-xs font-medium transition-colors border-b-2 -mb-px ${activeTab === tab
                  ? "text-blue-500 border-blue-500 bg-blue-500/5"
                  : "text-gray-400 border-transparent hover:text-gray-300 hover:bg-gray-800/50"
                  }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              <RefreshCw size={14} />
              <span>Reset</span>
            </button>
            <button
              type="button"
              className="cursor-pointer text-gray-400 hover:text-white transition-colors"
              onClick={() => setIsSettingsOpen(true)}
              aria-label="Open settings"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>

        <SettingsDrawer
          open={isSettingsOpen}
          onOpenChange={setIsSettingsOpen}
        />

        {/* Toolbar Content */}
        <div className="flex items-center gap-1 px-4 py-0.5 overflow-x-auto min-h-[44px]">
          {activeTab === "Tools" && (
            <div className="flex items-center gap-1">
              {AVAILABLE_TOOLS.filter((t) => t.category === "Tools").map(
                (tool) =>
                  tool.type === "dropdown" && tool.id === "Stack" ? (
                    <div key={tool.id} className="flex flex-col items-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenu
                          onOpenChange={(open) => {
                            if (open) assignToolToButton(0, "Stack");
                          }}
                        >
                          <DropdownMenuTrigger asChild>
                            <button
                              onClick={() => assignToolToButton(0, "Stack")}
                              className={`flex flex-col items-center justify-center p-2 rounded transition-colors min-w-[48px] ${
                                activeTool === "Stack"
                                  ? "bg-blue-600 text-white"
                                  : "text-gray-300 hover:bg-gray-700"
                              }`}
                            >
                              <div className="flex items-center gap-0.5">
                                {tool.icon}
                                <ChevronDown size={12} className="opacity-60" />
                              </div>
                              <span className="text-[10px] mt-1 whitespace-nowrap">
                                {tool.label}
                              </span>
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="start"
                            className="w-48 bg-gray-900 border-gray-700 text-gray-200 p-3"
                          >
                            <div className="text-xs text-gray-400 mb-2">Stack Speed</div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-gray-500">Slow</span>
                              <input
                                type="range"
                                min="1"
                                max="10"
                                value={stackSpeed}
                                onChange={(e) => setStackSpeed(Number(e.target.value))}
                                className="flex-1 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                              />
                              <span className="text-xs text-gray-500">Fast</span>
                            </div>
                            <div className="text-center text-xs text-white mt-2 font-mono">{stackSpeed}</div>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TooltipTrigger>
                      {tool.description && (
                        <TooltipContent
                          side="bottom"
                          className="bg-gray-800 border-gray-700 text-gray-200"
                        >
                          <p>{tool.description}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                    <MouseBindingBar toolId="Stack" mouseBindings={mouseBindings} />
                    </div>
                  ) : tool.type === "dropdown" && tool.id === "Presets" ? (
                    <Tooltip key={tool.id}>
                      <TooltipTrigger asChild>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="flex flex-col items-center justify-center p-2 rounded transition-colors min-w-[48px] text-gray-300 hover:bg-gray-700"
                            >
                              {tool.icon}
                              <span className="text-[10px] mt-1 whitespace-nowrap">
                                {tool.label}
                              </span>
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="start"
                            className="w-48 bg-gray-900 border-gray-700 text-gray-200"
                          >
                            <DropdownMenuLabel className="text-gray-400 text-xs">
                              CT Window Presets
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-gray-800" />
                            {CT_PRESETS.map((preset) => (
                              <DropdownMenuItem
                                key={preset.key}
                                onClick={() => applyPreset(preset)}
                                className="focus:bg-gray-800 focus:text-white cursor-pointer"
                              >
                                <div className="flex items-center justify-between w-full">
                                  <span>{preset.name}</span>
                                  <span className="text-gray-500 text-xs ml-2">
                                    {preset.key}
                                  </span>
                                </div>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TooltipTrigger>
                      {tool.description && (
                        <TooltipContent
                          side="bottom"
                          className="bg-gray-800 border-gray-700 text-gray-200"
                        >
                          <p>{tool.description}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  ) : tool.type === "dropdown" && tool.id === "Layout" ? (
                    <Tooltip key={tool.id}>
                      <TooltipTrigger asChild>
                        <DropdownMenu
                          open={isLayoutMenuOpen}
                          onOpenChange={(open) => {
                            setIsLayoutMenuOpen(open);
                            if (!open) {
                              setLayoutHover(null);
                            }
                          }}
                        >
                          <DropdownMenuTrigger asChild>
                            <button
                              className="flex flex-col items-center justify-center p-2 rounded transition-colors min-w-[48px] text-gray-300 hover:bg-gray-700"
                            >
                              {tool.icon}
                              <span className="text-[10px] mt-1 whitespace-nowrap">
                                {tool.label}
                              </span>
                            </button>
                          </DropdownMenuTrigger>
                          {renderLayoutDropdownContent()}
                        </DropdownMenu>
                      </TooltipTrigger>
                      {tool.description && (
                        <TooltipContent
                          side="bottom"
                          className="bg-gray-800 border-gray-700 text-gray-200"
                        >
                          <p>{tool.description}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  ) : tool.type === "dropdown" && tool.id === "MPR" ? (
                    <Tooltip key={tool.id}>
                      <TooltipTrigger asChild>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="flex flex-col items-center justify-center p-2 rounded transition-colors min-w-[48px] text-gray-300 hover:bg-gray-700"
                            >
                              {tool.icon}
                              <span className="text-[10px] mt-1 whitespace-nowrap">
                                {tool.label}
                              </span>
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="start"
                            className="w-56 bg-gray-900 border-gray-700 text-gray-200"
                          >
                            <DropdownMenuLabel className="text-gray-400 text-xs px-3 py-1.5">
                              Generate MPR View
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-gray-800" />
                            <DropdownMenuItem
                              onClick={() => {
                                if (!selectedTemporarySeriesId) {
                                  toast("You are already in Standard orientation");
                                  return;
                                }
                                setSelectedTemporarySeriesId(null);
                              }}
                              className="focus:bg-gray-800 focus:text-white cursor-pointer px-3 py-2"
                            >
                              <div className="flex items-center gap-3 w-full">
                                <div className="w-4 flex-shrink-0">
                                  {!selectedTemporarySeriesId && (
                                    <Check size={14} className="text-blue-500" />
                                  )}
                                </div>
                                <span className="flex-shrink-0">Standard</span>
                                <span className="text-gray-500 text-xs ml-auto">
                                  Original series
                                </span>
                              </div>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-gray-800" />
                            <DropdownMenuLabel className="text-gray-400 text-xs px-3 py-1.5">
                              MPR (2D or 3D only)
                            </DropdownMenuLabel>
                            {MPR_DROPDOWN_MODES.map((mode) => {
                              const existingTempSeries = temporaryMPRSeries.find(
                                (ts) =>
                                  ts.sourceSeriesId === selectedSeries?._id &&
                                  ts.mprMode === mode.id,
                              );
                              const isSelected =
                                existingTempSeries?.id === selectedTemporarySeriesId;
                              return (
                                <DropdownMenuItem
                                  key={mode.id}
                                  onClick={() => {
                                    if (isSelected) {
                                      toast(`You are already in ${mode.label} orientation`);
                                      return;
                                    }
                                    if (existingTempSeries) {
                                      setSelectedTemporarySeriesId(
                                        existingTempSeries.id,
                                      );
                                    } else {
                                      requestMPRGeneration(mode.id);
                                    }
                                  }}
                                  className="focus:bg-gray-800 focus:text-white cursor-pointer px-3 py-2"
                                >
                                  <div className="flex items-center gap-3 w-full">
                                    <div className="w-4 flex-shrink-0">
                                      {isSelected && (
                                        <Check size={14} className="text-blue-500" />
                                      )}
                                    </div>
                                    <span className="flex-shrink-0">
                                      {mode.label}
                                    </span>
                                    <span className="text-gray-500 text-xs ml-auto">
                                      {existingTempSeries ? "View" : "Generate"}
                                    </span>
                                  </div>
                                </DropdownMenuItem>
                              );
                            })}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TooltipTrigger>
                      {tool.description && (
                        <TooltipContent
                          side="bottom"
                          className="bg-gray-800 border-gray-700 text-gray-200"
                        >
                          <p>{tool.description}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  ) : tool.type === "dropdown" && tool.id === "Projection" ? (
                    <Tooltip key={tool.id}>
                      <TooltipTrigger asChild>
                        <DropdownMenu
                          open={isProjectionMenuOpen}
                          onOpenChange={setIsProjectionMenuOpen}
                        >
                          <DropdownMenuTrigger asChild>
                            <button
                              className={`flex flex-col items-center justify-center p-2 rounded transition-colors min-w-[48px] ${
                                activeProjectionMode !== "none"
                                  ? "bg-amber-600 text-white"
                                  : "text-gray-300 hover:bg-gray-700"
                              }`}
                            >
                              <div className="flex items-center gap-0.5">
                                {tool.icon}
                                <ChevronDown size={12} className="opacity-60" />
                              </div>
                              <span className="text-[10px] mt-1 whitespace-nowrap">
                                {activeProjectionMode === "none" ? "Projection" : activeProjectionMode}
                              </span>
                            </button>
                          </DropdownMenuTrigger>
                          {renderProjectionDropdownContent()}
                        </DropdownMenu>
                      </TooltipTrigger>
                      {tool.description && (
                        <TooltipContent
                          side="bottom"
                          className="bg-gray-800 border-gray-700 text-gray-200"
                        >
                          <p>{tool.description}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  ) : isBindableTool(tool.id) ? (
                    <div key={tool.id} className="flex flex-col items-center">
                      <ToolButton
                        icon={tool.icon}
                        label={tool.label}
                        active={tool.active}
                        disabled={tool.disabled}
                        description={tool.description}
                        onClick={() => handleToolClick(tool)}
                        onMouseDown={(e) => handleToolMouseDown(e, tool)}
                        isToggle={tool.isToggle}
                      />
                      <MouseBindingBar toolId={tool.id} mouseBindings={mouseBindings} />
                    </div>
                  ) : (
                    <ToolButton
                      key={tool.id}
                      icon={tool.icon}
                      label={tool.label}
                      active={tool.active}
                      disabled={tool.disabled}
                      description={tool.description}
                      onClick={() => handleToolClick(tool)}
                      onMouseDown={(e) => handleToolMouseDown(e, tool)}
                      isToggle={tool.isToggle}
                    />
                  ),
              )}
            </div>
          )}

          {activeTab === "Measurement" && (
            <div className="flex items-center gap-1">
              {AVAILABLE_TOOLS.filter((t) => t.category === "Measurement").map(
                (tool) => (
                  <div key={tool.id} className="flex flex-col items-center">
                    <ToolButton
                      icon={tool.icon}
                      label={tool.label}
                      active={tool.active}
                      disabled={!!tool.disabled}
                      description={tool.description}
                      onClick={() => handleToolClick(tool)}
                      onMouseDown={(e) => handleToolMouseDown(e, tool)}
                      isToggle={tool.isToggle}
                    />
                    {isBindableTool(tool.id) && (
                      <MouseBindingBar toolId={tool.id} mouseBindings={mouseBindings} />
                    )}
                  </div>
                ),
              )}
            </div>
          )}

          {activeTab === "Favourites" && (
            <div className="flex items-center gap-1">
              {favourites.map((favId) => {
                const tool = AVAILABLE_TOOLS.find((t) => t.id === favId);
                if (!tool) return null;
                if (tool.type === "dropdown" && tool.id === "Stack") {
                  return (
                    <div key={tool.id} className="flex flex-col items-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenu
                          onOpenChange={(open) => {
                            if (open) assignToolToButton(0, "Stack");
                          }}
                        >
                          <DropdownMenuTrigger asChild>
                            <button
                              onClick={() => assignToolToButton(0, "Stack")}
                              className={`flex flex-col items-center justify-center p-2 rounded transition-colors min-w-[48px] ${
                                activeTool === "Stack"
                                  ? "bg-blue-600 text-white"
                                  : "text-gray-300 hover:bg-gray-700"
                              }`}
                            >
                              <div className="flex items-center gap-0.5">
                                {tool.icon}
                                <ChevronDown size={12} className="opacity-60" />
                              </div>
                              <span className="text-[10px] mt-1 whitespace-nowrap">
                                {tool.label}
                              </span>
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="start"
                            className="w-48 bg-gray-900 border-gray-700 text-gray-200 p-3"
                          >
                            <div className="text-xs text-gray-400 mb-2">Stack Speed</div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-gray-500">Slow</span>
                              <input
                                type="range"
                                min="1"
                                max="10"
                                value={stackSpeed}
                                onChange={(e) => setStackSpeed(Number(e.target.value))}
                                className="flex-1 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                              />
                              <span className="text-xs text-gray-500">Fast</span>
                            </div>
                            <div className="text-center text-xs text-white mt-2 font-mono">{stackSpeed}</div>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TooltipTrigger>
                      {tool.description && (
                        <TooltipContent
                          side="bottom"
                          className="bg-gray-800 border-gray-700 text-gray-200"
                        >
                          <p>{tool.description}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                    <MouseBindingBar toolId="Stack" mouseBindings={mouseBindings} />
                    </div>
                  );
                }
                if (tool.type === "dropdown" && tool.id === "Presets") {
                  return (
                    <Tooltip key={tool.id}>
                      <TooltipTrigger asChild>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="flex flex-col items-center justify-center p-2 rounded transition-colors min-w-[48px] text-gray-300 hover:bg-gray-700"
                            >
                              {tool.icon}
                              <span className="text-[10px] mt-1 whitespace-nowrap">
                                {tool.label}
                              </span>
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="start"
                            className="w-48 bg-gray-900 border-gray-700 text-gray-200"
                          >
                            <DropdownMenuLabel className="text-gray-400 text-xs">
                              CT Window Presets
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-gray-800" />
                            {CT_PRESETS.map((preset) => (
                              <DropdownMenuItem
                                key={preset.key}
                                onClick={() => applyPreset(preset)}
                                className="focus:bg-gray-800 focus:text-white cursor-pointer"
                              >
                                <div className="flex items-center justify-between w-full">
                                  <span>{preset.name}</span>
                                  <span className="text-gray-500 text-xs ml-2">
                                    {preset.key}
                                  </span>
                                </div>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TooltipTrigger>
                      {tool.description && (
                        <TooltipContent
                          side="bottom"
                          className="bg-gray-800 border-gray-700 text-gray-200"
                        >
                          <p>{tool.description}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  );
                }
                if (tool.type === "dropdown" && tool.id === "Layout") {
                  return (
                    <Tooltip key={tool.id}>
                      <TooltipTrigger asChild>
                        <DropdownMenu
                          open={isLayoutMenuOpen}
                          onOpenChange={(open) => {
                            setIsLayoutMenuOpen(open);
                            if (!open) {
                              setLayoutHover(null);
                            }
                          }}
                        >
                          <DropdownMenuTrigger asChild>
                            <button
                              className="flex flex-col items-center justify-center p-2 rounded transition-colors min-w-[48px] text-gray-300 hover:bg-gray-700"
                            >
                              {tool.icon}
                              <span className="text-[10px] mt-1 whitespace-nowrap">
                                {tool.label}
                              </span>
                            </button>
                          </DropdownMenuTrigger>
                          {renderLayoutDropdownContent()}
                        </DropdownMenu>
                      </TooltipTrigger>
                      {tool.description && (
                        <TooltipContent
                          side="bottom"
                          className="bg-gray-800 border-gray-700 text-gray-200"
                        >
                          <p>{tool.description}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  );
                }
                if (tool.type === "dropdown" && tool.id === "MPR") {
                  return (
                    <Tooltip key={tool.id}>
                      <TooltipTrigger asChild>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="flex flex-col items-center justify-center p-2 rounded transition-colors min-w-[48px] text-gray-300 hover:bg-gray-700"
                            >
                              {tool.icon}
                              <span className="text-[10px] mt-1 whitespace-nowrap">
                                {tool.label}
                              </span>
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="start"
                            className="w-56 bg-gray-900 border-gray-700 text-gray-200"
                          >
                            <DropdownMenuLabel className="text-gray-400 text-xs px-3 py-1.5">
                              Generate MPR View
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-gray-800" />
                            <DropdownMenuItem
                              onClick={() => {
                                if (!selectedTemporarySeriesId) {
                                  toast("You are already in Standard orientation");
                                  return;
                                }
                                setSelectedTemporarySeriesId(null);
                              }}
                              className="focus:bg-gray-800 focus:text-white cursor-pointer px-3 py-2"
                            >
                              <div className="flex items-center gap-3 w-full">
                                <div className="w-4 flex-shrink-0">
                                  {!selectedTemporarySeriesId && (
                                    <Check size={14} className="text-blue-500" />
                                  )}
                                </div>
                                <span className="flex-shrink-0">Standard</span>
                                <span className="text-gray-500 text-xs ml-auto">
                                  Original series
                                </span>
                              </div>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-gray-800" />
                            <DropdownMenuLabel className="text-gray-400 text-xs px-3 py-1.5">
                              MPR (2D or 3D only)
                            </DropdownMenuLabel>
                            {MPR_DROPDOWN_MODES.map((mode) => {
                              const existingTempSeries = temporaryMPRSeries.find(
                                (ts) =>
                                  ts.sourceSeriesId === selectedSeries?._id &&
                                  ts.mprMode === mode.id,
                              );
                              const isSelected =
                                existingTempSeries?.id === selectedTemporarySeriesId;
                              return (
                                <DropdownMenuItem
                                  key={mode.id}
                                  onClick={() => {
                                    if (isSelected) {
                                      toast(`You are already in ${mode.label} orientation`);
                                      return;
                                    }
                                    if (existingTempSeries) {
                                      setSelectedTemporarySeriesId(
                                        existingTempSeries.id,
                                      );
                                    } else {
                                      requestMPRGeneration(mode.id);
                                    }
                                  }}
                                  className="focus:bg-gray-800 focus:text-white cursor-pointer px-3 py-2"
                                >
                                  <div className="flex items-center gap-3 w-full">
                                    <div className="w-4 flex-shrink-0">
                                      {isSelected && (
                                        <Check size={14} className="text-blue-500" />
                                      )}
                                    </div>
                                    <span className="flex-shrink-0">
                                      {mode.label}
                                    </span>
                                    <span className="text-gray-500 text-xs ml-auto">
                                      {existingTempSeries ? "View" : "Generate"}
                                    </span>
                                  </div>
                                </DropdownMenuItem>
                              );
                            })}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TooltipTrigger>
                      {tool.description && (
                        <TooltipContent
                          side="bottom"
                          className="bg-gray-800 border-gray-700 text-gray-200"
                        >
                          <p>{tool.description}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  );
                }
                if (tool.type === "dropdown" && tool.id === "Projection") {
                  return (
                    <Tooltip key={tool.id}>
                      <TooltipTrigger asChild>
                        <DropdownMenu
                          open={isProjectionMenuOpen}
                          onOpenChange={setIsProjectionMenuOpen}
                        >
                          <DropdownMenuTrigger asChild>
                            <button
                              className={`flex flex-col items-center justify-center p-2 rounded transition-colors min-w-[48px] ${
                                activeProjectionMode !== "none"
                                  ? "bg-amber-600 text-white"
                                  : "text-gray-300 hover:bg-gray-700"
                              }`}
                            >
                              <div className="flex items-center gap-0.5">
                                {tool.icon}
                                <ChevronDown size={12} className="opacity-60" />
                              </div>
                              <span className="text-[10px] mt-1 whitespace-nowrap">
                                {activeProjectionMode === "none" ? "Projection" : activeProjectionMode}
                              </span>
                            </button>
                          </DropdownMenuTrigger>
                          {renderProjectionDropdownContent()}
                        </DropdownMenu>
                      </TooltipTrigger>
                      {tool.description && (
                        <TooltipContent
                          side="bottom"
                          className="bg-gray-800 border-gray-700 text-gray-200"
                        >
                          <p>{tool.description}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  );
                }
                if (isBindableTool(tool.id)) {
                  return (
                    <div key={tool.id} className="flex flex-col items-center">
                      <ToolButton
                        icon={tool.icon}
                        label={tool.label}
                        active={tool.active}
                        disabled={!!tool.disabled}
                        description={tool.description}
                        onClick={() => handleToolClick(tool)}
                        onMouseDown={(e) => handleToolMouseDown(e, tool)}
                        isToggle={tool.isToggle}
                      />
                      <MouseBindingBar toolId={tool.id} mouseBindings={mouseBindings} />
                    </div>
                  );
                }
                return (
                  <ToolButton
                    key={tool.id}
                    icon={tool.icon}
                    label={tool.label}
                    active={tool.active}
                    disabled={!!tool.disabled}
                    description={tool.description}
                    onClick={() => handleToolClick(tool)}
                    onMouseDown={(e) => handleToolMouseDown(e, tool)}
                    isToggle={tool.isToggle}
                  />
                );
              })}

              <ToolDivider />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex flex-col items-center justify-center p-2 rounded transition-colors min-w-[48px] text-gray-400 hover:bg-gray-800 hover:text-white">
                    <div className="relative">
                      <Star size={18} />
                      <Plus
                        size={10}
                        className="absolute -top-1 -right-1 bg-blue-600 rounded-full"
                      />
                    </div>
                    <span className="text-[10px] mt-1 whitespace-nowrap">
                      Edit
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-56 bg-gray-900 border-gray-700 text-gray-200"
                >
                  <DropdownMenuLabel className="text-gray-400 text-xs">
                    Customise Favourites
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-gray-800" />
                  <div className="max-h-[300px] overflow-y-auto">
                    <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-gray-500 mt-2 px-2">
                      General Tools
                    </DropdownMenuLabel>
                    {AVAILABLE_TOOLS.filter((t) => t.category === "Tools").map(
                      (tool) => (
                        <DropdownMenuCheckboxItem
                          key={tool.id}
                          checked={favourites.includes(tool.id)}
                          onCheckedChange={() => toggleFavourite(tool.id)}
                          className="focus:bg-gray-800 focus:text-white"
                        >
                          <div className="flex items-center gap-2">
                            {tool.icon}
                            <span>{tool.label}</span>
                          </div>
                        </DropdownMenuCheckboxItem>
                      ),
                    )}
                    <DropdownMenuSeparator className="bg-gray-800" />
                    <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-gray-500 mt-2 px-2">
                      Annotation Tools
                    </DropdownMenuLabel>
                    {AVAILABLE_TOOLS.filter(
                      (t) => t.category === "Measurement",
                    ).map((tool) => (
                      <DropdownMenuCheckboxItem
                        key={tool.id}
                        checked={favourites.includes(tool.id)}
                        onCheckedChange={() => toggleFavourite(tool.id)}
                        className="focus:bg-gray-800 focus:text-white"
                      >
                        <div className="flex items-center gap-2">
                          {tool.icon}
                          <span>{tool.label}</span>
                        </div>
                      </DropdownMenuCheckboxItem>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          <div className="flex-1" />

          <div className="flex items-center gap-1 mr-4">
            <div className="flex items-center gap-0.5">
              <ToolButton
                icon={<Undo2 size={18} />}
                label="Undo"
                onClick={undo}
                disabled={!canUndo}
                description="Undo last action (Ctrl+Z)"
              />
              <ToolButton
                icon={<Redo2 size={18} />}
                label="Redo"
                onClick={redo}
                disabled={!canRedo}
                description="Redo last undone action (Ctrl+Y)"
              />
            </div>

            <ToolDivider />

            <div className="flex items-center gap-0.5">
              <ToolButton
                icon={<ScrollText size={18} />}
                label="Report"
                description="View and edit the study report"
                onClick={() => openReportInSingleWindow(caseData._id)}
              />
            </div>
          </div>

          {/* Export Group */}
          <div className="flex items-center gap-0.5 border-l border-gray-700 pl-4">
            <ToolButton
              icon={<Copy size={18} />}
              label="Copy"
              description="Copy current frame to clipboard (PNG)"
              onClick={handleCopyCurrentFrame}
            />
            <ToolButton
              icon={<Download size={18} />}
              label="Export"
              description="Download case as DICOM ZIP (original images only; excludes MPR/MIP)"
              onClick={handleExportDicomZip}
            />
          </div>
        </div>
      </header>
    </TooltipProvider>
  );
};

export default ViewerHeader;
