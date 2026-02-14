import { useState, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import {
  ZoomIn,
  Move,
  Contrast,
  SunMoon,
  Ruler,
  RotateCw,
  RotateCcw,
  RefreshCcw,
  FlipHorizontal,
  FlipVertical,
  Maximize2,
  Download,
  Share2,
  Printer,
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
  disabled?: boolean;
  description?: string;
  isToggle?: boolean; // Toggle style: no bg, dull when off
}

const ToolButton = ({
  icon,
  label,
  active = false,
  onClick,
  disabled = false,
  description,
  isToggle = false,
}: ToolButtonProps) => {
  const getButtonClass = () => {
    if (disabled) {
      return "opacity-30 cursor-not-allowed text-gray-500";
    }
    if (isToggle) {
      // Toggle style: no background, just dull when inactive
      return active
        ? "text-white hover:bg-gray-700/50"
        : "text-gray-500 opacity-50 hover:opacity-75";
    }
    // Default style: blue bg when active
    return active
      ? "bg-blue-600 text-white"
      : "text-gray-300 hover:bg-gray-700";
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={disabled ? undefined : onClick}
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

import { useViewerContext } from "../ViewerLayout";
import type { GridLayout, MPRMode } from "../ViewerLayout";

// Grid layout options
const GRID_LAYOUTS: {
  id: GridLayout;
  label: string;
  rows: number;
  cols: number;
}[] = [
    { id: "1x1", label: "1×1", rows: 1, cols: 1 },
    { id: "1x2", label: "1×2", rows: 1, cols: 2 },
    { id: "2x2", label: "2×2", rows: 2, cols: 2 },
  ];

// MPR mode options
const MPR_MODES: {
  id: MPRMode;
  label: string;
  description: string;
}[] = [
    { id: "Axial", label: "Axial", description: "Top-down view" },
    { id: "Coronal", label: "Coronal", description: "Front-to-back view" },
    { id: "Sagittal", label: "Sagittal", description: "Side view" },
    { id: "2D-MPR", label: "2D MPR", description: "Three linked views" },
    { id: "3D-MPR", label: "3D MPR", description: "Oblique plane" },
    { id: "MiniMIP", label: "MiniMIP", description: "Thin-slab Max Intensity Projection" },
  ];

const ViewerHeader = () => {
  const {
    caseData,
    activeTool,
    setActiveTool,
    viewTransform,
    setViewTransform,
    setAnnotations,
    undo,
    redo,
    canUndo,
    canRedo,
    saveToHistory,
    gridLayout,
    setGridLayout,
    temporaryMPRSeries,
    selectedTemporarySeriesId,
    setSelectedTemporarySeriesId,
    selectedSeries,
    requestMPRGeneration,
    showOverlays,
    setShowOverlays,
    shortcuts,
    stackSpeed,
    setStackSpeed,
    showScoutLine,
    setShowScoutLine,
    isVRTActive,
    setIsVRTActive,
  } = useViewerContext();

  const [activeTab, setActiveTab] = useState<
    "Favourites" | "Tools" | "Measurement"
  >("Favourites");

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [favourites, setFavourites] = useState<string[]>(() => {
    const saved = localStorage.getItem("viewer_favourites");
    return saved ? JSON.parse(saved) : ["Stack", "Pan", "Zoom", "Length"];
  });

  useEffect(() => {
    localStorage.setItem("viewer_favourites", JSON.stringify(favourites));
  }, [favourites]);

  // Apply CT preset
  const applyPreset = (preset: (typeof CT_PRESETS)[number]) => {
    setViewTransform((prev) => ({
      ...prev,
      windowWidth: preset.width,
      windowCenter: preset.center,
    }));
    saveToHistory();
  };


  if (!caseData) return null;

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

  const handleReset = () => {
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
    setAnnotations([]);
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

      const shortcut = shortcuts.find((s) => s.key === e.key);
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
          case "ToolLine": setActiveTool("Length"); break;
          case "ToolDistance": setActiveTool("Length"); break;
          case "ToolAngle": setActiveTool("Angle"); break;
          case "ToolEllipse": setActiveTool("Ellipse"); break;
          case "ToolCircle": setActiveTool("Ellipse"); break;
          case "ToolFreehand": setActiveTool("Freehand"); break;
          case "ToolHU": setActiveTool("HU"); break;
          case "NavZoom": setActiveTool("Zoom"); break;
          case "NavPan": setActiveTool("Pan"); break;
          case "NavScroll": setActiveTool("Stack"); break;
          case "NavContrast": setActiveTool("Contrast"); break;
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
    setActiveTool,
    handleReset,
    handleRotateCw,
    handleRotateCcw,
    handleFlipH,
    handleFlipV,
    saveToHistory,
    isVRTActive,
    setIsVRTActive,
  ]);

  interface ViewerToolConfig {
    id: string;
    label: string;
    icon: React.ReactNode;
    category: string;
    type: "tool" | "action" | "dropdown";
    active?: boolean;
    onClick?: () => void;
    disabled?: boolean;
    description?: string;
    isToggle?: boolean;
  }

  const AVAILABLE_TOOLS: ViewerToolConfig[] = useMemo(
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
          setViewTransform((prev) => ({ ...prev, x: 0, y: 0, scale: 1.2 })),
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
        description: "Change the grid layout (e.g., 1x1, 2x2)",
      },
      {
        id: "MPR",
        label: "MPR",
        icon: <Box size={18} />,
        category: "Tools",
        type: "dropdown",
        description: "Generate Multi-Planar Reconstruction views",
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
        icon: <RefreshCcw size={18} />,
        category: "Tools",
        type: "tool",
        active: activeTool === "FreeRotate",
        description: "Freely rotate the image by dragging",
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
      setViewTransform,
      showOverlays,
      setShowOverlays,
      showScoutLine,
      setShowScoutLine,
      gridLayout,
    ],
  );

  const handleToolClick = (tool: any) => {
    if (tool.disabled) return;
    if (tool.type === "tool") {
      setActiveTool(tool.id);
    } else if (tool.onClick) {
      tool.onClick();
    }
  };

  const toggleFavourite = (toolId: string) => {
    setFavourites((prev) =>
      prev.includes(toolId)
        ? prev.filter((id) => id !== toolId)
        : [...prev, toolId],
    );
  };

  // VRT mode: show minimal header with exit button only
  if (isVRTActive) {
    return (
      <TooltipProvider>
        <header className="bg-gray-900 border-b border-gray-700">
          <div className="flex items-center justify-between px-4 py-2.5">
            <div className="flex items-center gap-3">
              <Box size={18} className="text-purple-400" />
              <span className="text-sm font-medium text-white">3D Volume Rendering</span>
              <span className="text-xs text-gray-500">Press Escape or click Exit to return</span>
            </div>
            <button
              onClick={() => setIsVRTActive(false)}
              className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors font-medium"
            >
              Exit VRT
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
        <div className="flex items-center justify-between gap-1 px-4 border-b border-gray-800 bg-gray-900/50">
          <div>
            {(["Favourites", "Tools", "Measurement"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${activeTab === tab
                  ? "text-blue-500 border-blue-500 bg-blue-500/5"
                  : "text-gray-400 border-transparent hover:text-gray-300 hover:bg-gray-800/50"
                  }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div
            className="cursor-pointer text-gray-400 hover:text-white transition-colors"
            onClick={() => setIsSettingsOpen(true)}
          >
            <Settings size={20} />
          </div>
        </div>

        <SettingsDrawer
          open={isSettingsOpen}
          onOpenChange={setIsSettingsOpen}
        />

        {/* Toolbar Content */}
        <div className="flex items-center gap-1 px-4 py-1 overflow-x-auto min-h-[56px]">
          {activeTab === "Tools" && (
            <div className="flex items-center gap-1">
              {AVAILABLE_TOOLS.filter((t) => t.category === "Tools").map(
                (tool) =>
                  tool.type === "dropdown" && tool.id === "Stack" ? (
                    <Tooltip key={tool.id}>
                      <TooltipTrigger asChild>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              onClick={() => setActiveTool("Stack")}
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
                            className="w-40 bg-gray-900 border-gray-700 text-gray-200"
                          >
                            <DropdownMenuLabel className="text-gray-400 text-xs">
                              Grid Layout
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-gray-800" />
                            {GRID_LAYOUTS.map((layout) => (
                              <DropdownMenuItem
                                key={layout.id}
                                onClick={() => setGridLayout(layout.id)}
                                className="focus:bg-gray-800 focus:text-white cursor-pointer"
                              >
                                <div className="flex items-center justify-between w-full">
                                  <div className="flex items-center gap-2">
                                    {gridLayout === layout.id && (
                                      <Check size={14} className="text-blue-500" />
                                    )}
                                    <span
                                      className={
                                        gridLayout !== layout.id ? "ml-5" : ""
                                      }
                                    >
                                      {layout.label}
                                    </span>
                                  </div>
                                  <span className="text-gray-500 text-xs">
                                    {layout.rows * layout.cols} pane
                                    {layout.rows * layout.cols > 1 ? "s" : ""}
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
                              MPR Modes
                            </DropdownMenuLabel>
                            {MPR_MODES.map((mode) => {
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
                  ) : (
                    <ToolButton
                      key={tool.id}
                      icon={tool.icon}
                      label={tool.label}
                      active={tool.active}
                      disabled={tool.disabled}
                      description={tool.description}
                      onClick={() => handleToolClick(tool)}
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
                  <ToolButton
                    key={tool.id}
                    icon={tool.icon}
                    label={tool.label}
                    active={tool.active}
                    disabled={!!tool.disabled}
                    description={tool.description}
                    onClick={() => handleToolClick(tool)}
                    isToggle={tool.isToggle}
                  />
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
                    <Tooltip key={tool.id}>
                      <TooltipTrigger asChild>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              onClick={() => setActiveTool("Stack")}
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
                            className="w-40 bg-gray-900 border-gray-700 text-gray-200"
                          >
                            <DropdownMenuLabel className="text-gray-400 text-xs">
                              Grid Layout
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-gray-800" />
                            {GRID_LAYOUTS.map((layout) => (
                              <DropdownMenuItem
                                key={layout.id}
                                onClick={() => setGridLayout(layout.id)}
                                className="focus:bg-gray-800 focus:text-white cursor-pointer"
                              >
                                <div className="flex items-center justify-between w-full">
                                  <div className="flex items-center gap-2">
                                    {gridLayout === layout.id && (
                                      <Check size={14} className="text-blue-500" />
                                    )}
                                    <span
                                      className={
                                        gridLayout !== layout.id ? "ml-5" : ""
                                      }
                                    >
                                      {layout.label}
                                    </span>
                                  </div>
                                  <span className="text-gray-500 text-xs">
                                    {layout.rows * layout.cols} pane
                                    {layout.rows * layout.cols > 1 ? "s" : ""}
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
                              MPR Modes
                            </DropdownMenuLabel>
                            {MPR_MODES.map((mode) => {
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
                return (
                  <ToolButton
                    key={tool.id}
                    icon={tool.icon}
                    label={tool.label}
                    active={tool.active}
                    disabled={!!tool.disabled}
                    description={tool.description}
                    onClick={() => handleToolClick(tool)}
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
                onClick={() =>
                  window.open(
                    `/case/${caseData._id}/report`,
                    "_blank",
                    "width=1200,height=800",
                  )
                }
              />
            </div>
          </div>

          {/* Export Group */}
          <div className="flex items-center gap-0.5 border-l border-gray-700 pl-4">
            <ToolButton icon={<Download size={18} />} label="Export" description="Download image as DICOM, JPEG or BMP" />
            <ToolButton icon={<Printer size={18} />} label="Print" description="Print the current view" />
            <ToolButton icon={<Share2 size={18} />} label="Share" description="Share the case with other users" />
          </div>
        </div>
      </header>
    </TooltipProvider>
  );
};

export default ViewerHeader;
