import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyWindowLevel,
  type ObliquePlane,
  type VolumeData,
  cross,
  dot,
  normalize,
  sampleObliquePlane,
} from "@/lib/mpr";

interface ObliqueMPRViewerProps {
  volume: VolumeData;
  className?: string;
}

type PlaneOrientation = "Axial" | "Coronal" | "Sagittal";
type Vec3 = [number, number, number];
type SyncMode = "auto" | "manual";

interface RotationState {
  pitch: number;
  yaw: number;
}

interface PaneSyncState {
  crosshair: Vec3;
  rotation: RotationState;
}

interface PlaneDefinition {
  plane: ObliquePlane;
  baseWidth: number;
  baseHeight: number;
  uMmPerVoxel: number;
  vMmPerVoxel: number;
}

interface PaneMetrics {
  drawX: number;
  drawY: number;
  drawWidth: number;
  drawHeight: number;
  sampleWidth: number;
  sampleHeight: number;
  handleX: number;
  handleY: number;
}

interface DragState {
  mode: "rotate" | "move";
  pane: PlaneOrientation;
  lastX: number;
  lastY: number;
}

const PLANE_ORDER: PlaneOrientation[] = ["Axial", "Coronal", "Sagittal"];
const SCOUT_COLORS: Record<PlaneOrientation, string> = {
  Axial: "#00ff00",
  Coronal: "#ffff00",
  Sagittal: "#00ffff",
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const rotateVector = (vector: Vec3, pitchDeg: number, yawDeg: number): Vec3 => {
  const pitch = (pitchDeg * Math.PI) / 180;
  const yaw = (yawDeg * Math.PI) / 180;

  const cosX = Math.cos(pitch);
  const sinX = Math.sin(pitch);
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);

  const x1 = vector[0];
  const y1 = vector[1] * cosX - vector[2] * sinX;
  const z1 = vector[1] * sinX + vector[2] * cosX;

  const x2 = x1 * cosY + z1 * sinY;
  const y2 = y1;
  const z2 = -x1 * sinY + z1 * cosY;

  return [x2, y2, z2];
};

const addVec = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const subVec = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scaleVec = (v: Vec3, scalar: number): Vec3 => [v[0] * scalar, v[1] * scalar, v[2] * scalar];
const cloneVec3 = (value: Vec3): Vec3 => [value[0], value[1], value[2]];
const cloneRotation = (value: RotationState): RotationState => ({
  pitch: value.pitch,
  yaw: value.yaw,
});
const createPaneSyncStateMap = (
  crosshair: Vec3,
  rotation: RotationState,
): Record<PlaneOrientation, PaneSyncState> => ({
  Axial: { crosshair: cloneVec3(crosshair), rotation: cloneRotation(rotation) },
  Coronal: { crosshair: cloneVec3(crosshair), rotation: cloneRotation(rotation) },
  Sagittal: { crosshair: cloneVec3(crosshair), rotation: cloneRotation(rotation) },
});

const clampToVolume = (point: Vec3, volume: VolumeData): Vec3 => {
  const [cols, rows, slices] = volume.dimensions;
  return [
    clamp(point[0], 0, cols - 1),
    clamp(point[1], 0, rows - 1),
    clamp(point[2], 0, slices - 1),
  ];
};

const getPlaneBaseVectors = (
  orientation: PlaneOrientation,
  volume: VolumeData,
): { normal: Vec3; u: Vec3; v: Vec3; width: number; height: number } => {
  const [cols, rows, slices] = volume.dimensions;
  if (orientation === "Axial") {
    return {
      normal: [0, 0, 1],
      u: [1, 0, 0],
      v: [0, 1, 0],
      width: cols,
      height: rows,
    };
  }
  if (orientation === "Coronal") {
    return {
      normal: [0, 1, 0],
      u: [1, 0, 0],
      v: [0, 0, -1],
      width: cols,
      height: slices,
    };
  }
  return {
    normal: [1, 0, 0],
    u: [0, 1, 0],
    v: [0, 0, -1],
    width: rows,
    height: slices,
  };
};

export function ObliqueMPRViewer({
  volume,
  className = "",
}: ObliqueMPRViewerProps) {
  const paneContainerRefs = useRef<Record<PlaneOrientation, HTMLDivElement | null>>({
    Axial: null,
    Coronal: null,
    Sagittal: null,
  });
  const paneCanvasRefs = useRef<Record<PlaneOrientation, HTMLCanvasElement | null>>({
    Axial: null,
    Coronal: null,
    Sagittal: null,
  });
  const paneOffscreenRefs = useRef<Partial<Record<PlaneOrientation, HTMLCanvasElement>>>({});
  const paneMetricsRef = useRef<Partial<Record<PlaneOrientation, PaneMetrics>>>({});
  const dragStateRef = useRef<DragState | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const volumeCenter = useMemo<Vec3>(
    () => [volume.dimensions[0] / 2, volume.dimensions[1] / 2, volume.dimensions[2] / 2],
    [volume.dimensions],
  );

  const [majorPane, setMajorPane] = useState<PlaneOrientation>("Axial");
  const [activePane, setActivePane] = useState<PlaneOrientation>("Axial");
  const [layoutTick, setLayoutTick] = useState(0);
  const [syncMode, setSyncMode] = useState<SyncMode>("auto");
  const [autoSyncState, setAutoSyncState] = useState<PaneSyncState>(() => ({
    crosshair: cloneVec3(volumeCenter),
    rotation: { pitch: 0, yaw: 0 },
  }));
  const [manualPaneStates, setManualPaneStates] = useState<
    Record<PlaneOrientation, PaneSyncState>
  >(() => createPaneSyncStateMap(volumeCenter, { pitch: 0, yaw: 0 }));

  useEffect(() => {
    const resetRotation = { pitch: 0, yaw: 0 };
    setAutoSyncState({
      crosshair: cloneVec3(volumeCenter),
      rotation: resetRotation,
    });
    setManualPaneStates(createPaneSyncStateMap(volumeCenter, resetRotation));
    setSyncMode("auto");
    setMajorPane("Axial");
    setActivePane("Axial");
  }, [volumeCenter]);

  const paneSyncStates = useMemo<Record<PlaneOrientation, PaneSyncState>>(() => {
    if (syncMode === "auto") {
      return {
        Axial: autoSyncState,
        Coronal: autoSyncState,
        Sagittal: autoSyncState,
      };
    }
    return manualPaneStates;
  }, [autoSyncState, manualPaneStates, syncMode]);

  const setPaneCrosshair = useCallback(
    (paneId: PlaneOrientation, nextCrosshair: Vec3) => {
      const clamped = clampToVolume(nextCrosshair, volume);
      if (syncMode === "auto") {
        setAutoSyncState((prev) => ({
          ...prev,
          crosshair: clamped,
        }));
        return;
      }
      setManualPaneStates((prev) => ({
        ...prev,
        [paneId]: {
          ...prev[paneId],
          crosshair: clamped,
        },
      }));
    },
    [syncMode, volume],
  );

  const setPaneRotation = useCallback(
    (
      paneId: PlaneOrientation,
      updater: (prev: RotationState) => RotationState,
    ) => {
      if (syncMode === "auto") {
        setAutoSyncState((prev) => ({
          ...prev,
          rotation: updater(prev.rotation),
        }));
        return;
      }
      setManualPaneStates((prev) => ({
        ...prev,
        [paneId]: {
          ...prev[paneId],
          rotation: updater(prev[paneId].rotation),
        },
      }));
    },
    [syncMode],
  );

  const handleSyncModeChange = useCallback(
    (nextMode: SyncMode) => {
      if (nextMode === syncMode) return;

      if (nextMode === "manual") {
        setManualPaneStates(
          createPaneSyncStateMap(
            autoSyncState.crosshair,
            autoSyncState.rotation,
          ),
        );
        setSyncMode("manual");
        return;
      }

      const source = manualPaneStates[activePane] ?? manualPaneStates.Axial;
      setAutoSyncState({
        crosshair: cloneVec3(source.crosshair),
        rotation: cloneRotation(source.rotation),
      });
      setSyncMode("auto");
    },
    [activePane, autoSyncState, manualPaneStates, syncMode],
  );

  const handleManualSyncNow = useCallback(() => {
    if (syncMode !== "manual") return;
    const source = manualPaneStates[activePane] ?? manualPaneStates.Axial;
    setManualPaneStates(
      createPaneSyncStateMap(source.crosshair, source.rotation),
    );
  }, [activePane, manualPaneStates, syncMode]);

  const planes = useMemo<Record<PlaneOrientation, PlaneDefinition>>(() => {
    const definitions = {} as Record<PlaneOrientation, PlaneDefinition>;
    PLANE_ORDER.forEach((planeId) => {
      const paneState = paneSyncStates[planeId];
      const base = getPlaneBaseVectors(planeId, volume);
      const rotatedNormal = normalize(
        rotateVector(
          base.normal,
          paneState.rotation.pitch,
          paneState.rotation.yaw,
        ),
      ) as Vec3;
      const rotatedU = normalize(
        rotateVector(base.u, paneState.rotation.pitch, paneState.rotation.yaw),
      ) as Vec3;
      const rotatedV = normalize(
        rotateVector(base.v, paneState.rotation.pitch, paneState.rotation.yaw),
      ) as Vec3;
      const [spX, spY, spZ] = volume.spacing;
      const uMmPerVoxel = Math.hypot(
        rotatedU[0] * spX,
        rotatedU[1] * spY,
        rotatedU[2] * spZ,
      );
      const vMmPerVoxel = Math.hypot(
        rotatedV[0] * spX,
        rotatedV[1] * spY,
        rotatedV[2] * spZ,
      );

      // Keep sampling planes centered in view; only move them along their normal.
      const normalOffset = dot(
        subVec(paneState.crosshair, volumeCenter),
        rotatedNormal,
      );
      const planeOrigin = clampToVolume(
        addVec(volumeCenter, scaleVec(rotatedNormal, normalOffset)),
        volume,
      );

      definitions[planeId] = {
        plane: {
          origin: planeOrigin,
          normal: rotatedNormal,
          u: rotatedU,
          v: rotatedV,
          rotation: 0,
        },
        baseWidth: base.width,
        baseHeight: base.height,
        uMmPerVoxel,
        vMmPerVoxel,
      };
    });
    return definitions;
  }, [paneSyncStates, volume, volumeCenter]);

  const renderPane = useCallback(
    (paneId: PlaneOrientation) => {
      const container = paneContainerRefs.current[paneId];
      const canvas = paneCanvasRefs.current[paneId];
      if (!container || !canvas) return;

      const cssWidth = Math.max(1, Math.round(container.clientWidth));
      const cssHeight = Math.max(1, Math.round(container.clientHeight));
      const dpr = window.devicePixelRatio || 1;
      const pixelWidth = Math.max(1, Math.round(cssWidth * dpr));
      const pixelHeight = Math.max(1, Math.round(cssHeight * dpr));

      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssWidth, cssHeight);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, cssWidth, cssHeight);

      const pane = planes[paneId];
      const sourceAspect =
        (pane.baseWidth * pane.uMmPerVoxel) /
        Math.max(1e-6, pane.baseHeight * pane.vMmPerVoxel);
      const longEdge = clamp(Math.round(Math.max(cssWidth, cssHeight)), 192, 640);
      let sampleWidth = longEdge;
      let sampleHeight = longEdge;
      if (sourceAspect >= 1) {
        sampleHeight = clamp(Math.round(longEdge / sourceAspect), 128, 640);
      } else {
        sampleWidth = clamp(Math.round(longEdge * sourceAspect), 128, 640);
      }

      const rawSlice = sampleObliquePlane(
        volume,
        pane.plane,
        sampleWidth,
        sampleHeight,
      );
      const imageData = applyWindowLevel(
        rawSlice,
        sampleWidth,
        sampleHeight,
        volume.windowCenter ?? 40,
        volume.windowWidth ?? 400,
      );

      let offscreen = paneOffscreenRefs.current[paneId];
      if (!offscreen) {
        offscreen = document.createElement("canvas");
        paneOffscreenRefs.current[paneId] = offscreen;
      }
      if (offscreen.width !== sampleWidth || offscreen.height !== sampleHeight) {
        offscreen.width = sampleWidth;
        offscreen.height = sampleHeight;
      }
      const offscreenCtx = offscreen.getContext("2d");
      if (!offscreenCtx) return;
      offscreenCtx.putImageData(imageData, 0, 0);

      const outputAspect =
        (sampleWidth * pane.uMmPerVoxel) /
        Math.max(1e-6, sampleHeight * pane.vMmPerVoxel);
      const containerAspect = cssWidth / cssHeight;
      let drawWidth = cssWidth;
      let drawHeight = cssHeight;
      if (outputAspect > containerAspect) {
        drawHeight = cssWidth / outputAspect;
      } else {
        drawWidth = cssHeight * outputAspect;
      }
      const letterboxRatio =
        1 - (drawWidth * drawHeight) / Math.max(1, cssWidth * cssHeight);
      if (letterboxRatio > 0.35) {
        // For extreme anisotropic stacks, prefer a centered fill strategy
        // to avoid huge black gaps in coronal/sagittal panes.
        if (outputAspect > containerAspect) {
          drawWidth = cssHeight * outputAspect;
          drawHeight = cssHeight;
        } else {
          drawWidth = cssWidth;
          drawHeight = cssWidth / outputAspect;
        }
      }
      const drawX = (cssWidth - drawWidth) / 2;
      const drawY = (cssHeight - drawHeight) / 2;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(offscreen, drawX, drawY, drawWidth, drawHeight);

      const planeOrigin = pane.plane.origin as Vec3;
      const paneCrosshair = paneSyncStates[paneId].crosshair;
      const toCrosshair = subVec(paneCrosshair, planeOrigin);
      const uOffset = dot(toCrosshair, pane.plane.u as Vec3);
      const vOffset = dot(toCrosshair, pane.plane.v as Vec3);
      const handleX = clamp(
        drawX + drawWidth / 2 + uOffset * (drawWidth / sampleWidth),
        drawX,
        drawX + drawWidth,
      );
      const handleY = clamp(
        drawY + drawHeight / 2 + vOffset * (drawHeight / sampleHeight),
        drawY,
        drawY + drawHeight,
      );

      PLANE_ORDER.filter((other) => other !== paneId).forEach((other) => {
        const lineDir = normalize(
          cross(
            pane.plane.normal,
            planes[other].plane.normal,
          ) as Vec3,
        ) as Vec3;
        let dirX = dot(lineDir, pane.plane.u as Vec3);
        let dirY = dot(lineDir, pane.plane.v as Vec3);
        const magnitude = Math.hypot(dirX, dirY);
        if (magnitude < 1e-6) return;
        dirX /= magnitude;
        dirY /= magnitude;
        const extension = Math.max(drawWidth, drawHeight) * 1.25;

        ctx.save();
        ctx.strokeStyle = SCOUT_COLORS[other];
        ctx.lineWidth = 1.6;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.moveTo(handleX - dirX * extension, handleY - dirY * extension);
        ctx.lineTo(handleX + dirX * extension, handleY + dirY * extension);
        ctx.stroke();
        ctx.restore();
      });

      ctx.save();
      ctx.strokeStyle = "#ffffff";
      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = 0.95;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(handleX, handleY, 11, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(handleX, handleY, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      paneMetricsRef.current[paneId] = {
        drawX,
        drawY,
        drawWidth,
        drawHeight,
        sampleWidth,
        sampleHeight,
        handleX,
        handleY,
      };
    },
    [paneSyncStates, planes, volume],
  );

  const renderAll = useCallback(() => {
    PLANE_ORDER.forEach((paneId) => renderPane(paneId));
  }, [renderPane]);

  useEffect(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(() => {
      animationFrameRef.current = null;
      renderAll();
    });
  }, [renderAll, layoutTick]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      setLayoutTick((prev) => prev + 1);
    });
    PLANE_ORDER.forEach((paneId) => {
      const container = paneContainerRefs.current[paneId];
      if (container) observer.observe(container);
    });
    return () => observer.disconnect();
  }, []);

  const updateCrosshairFromScreen = useCallback(
    (paneId: PlaneOrientation, clientX: number, clientY: number) => {
      const metrics = paneMetricsRef.current[paneId];
      const container = paneContainerRefs.current[paneId];
      if (!metrics || !container) return;

      const pane = planes[paneId];
      const rect = container.getBoundingClientRect();
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;

      const boundedX = clamp(localX, metrics.drawX, metrics.drawX + metrics.drawWidth);
      const boundedY = clamp(localY, metrics.drawY, metrics.drawY + metrics.drawHeight);

      const uOffset =
        ((boundedX - metrics.drawX) / metrics.drawWidth - 0.5) * metrics.sampleWidth;
      const vOffset =
        ((boundedY - metrics.drawY) / metrics.drawHeight - 0.5) * metrics.sampleHeight;

      const origin = pane.plane.origin as Vec3;
      const moved = addVec(
        addVec(origin, scaleVec(pane.plane.u as Vec3, uOffset)),
        scaleVec(pane.plane.v as Vec3, vOffset),
      );
      setPaneCrosshair(paneId, moved);
    },
    [planes, setPaneCrosshair],
  );

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState) return;

      if (dragState.mode === "rotate") {
        const dx = event.clientX - dragState.lastX;
        const dy = event.clientY - dragState.lastY;
        dragStateRef.current = {
          ...dragState,
          lastX: event.clientX,
          lastY: event.clientY,
        };
        setPaneRotation(dragState.pane, (prev) => ({
          pitch: clamp(prev.pitch - dy * 0.28, -85, 85),
          yaw: prev.yaw + dx * 0.28,
        }));
        return;
      }

      updateCrosshairFromScreen(dragState.pane, event.clientX, event.clientY);
    };

    const handleMouseUp = () => {
      dragStateRef.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [setPaneRotation, updateCrosshairFromScreen]);

  const onPaneMouseDown = useCallback(
    (paneId: PlaneOrientation, event: React.MouseEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      setActivePane(paneId);

      const metrics = paneMetricsRef.current[paneId];
      const container = paneContainerRefs.current[paneId];
      if (!metrics || !container) return;

      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const distSq =
        (x - metrics.handleX) * (x - metrics.handleX) +
        (y - metrics.handleY) * (y - metrics.handleY);
      const isOnHandle = distSq <= 14 * 14;

      dragStateRef.current = {
        mode: isOnHandle ? "rotate" : "move",
        pane: paneId,
        lastX: event.clientX,
        lastY: event.clientY,
      };

      if (!isOnHandle) {
        updateCrosshairFromScreen(paneId, event.clientX, event.clientY);
      }
      event.preventDefault();
    },
    [updateCrosshairFromScreen],
  );

  const onPaneWheel = useCallback(
    (paneId: PlaneOrientation, event: React.WheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      setActivePane(paneId);
      const step = event.deltaY > 0 ? 1 : -1;
      const stepScale = event.shiftKey ? 3 : 1;
      const normal = planes[paneId].plane.normal as Vec3;
      const baseCrosshair = paneSyncStates[paneId].crosshair;
      const moved = addVec(baseCrosshair, scaleVec(normal, step * stepScale));
      setPaneCrosshair(paneId, moved);
    },
    [paneSyncStates, planes, setPaneCrosshair],
  );

  const getSlicePositionLabel = useCallback(
    (paneId: PlaneOrientation): string => {
      const [cols, rows, slices] = volume.dimensions;
      const paneCrosshair = paneSyncStates[paneId].crosshair;
      if (paneId === "Axial") {
        return `${Math.round(paneCrosshair[2]) + 1} / ${slices}`;
      }
      if (paneId === "Coronal") {
        return `${Math.round(paneCrosshair[1]) + 1} / ${rows}`;
      }
      return `${Math.round(paneCrosshair[0]) + 1} / ${cols}`;
    },
    [paneSyncStates, volume.dimensions],
  );

  const minorPanes = PLANE_ORDER.filter((paneId) => paneId !== majorPane);

  const renderPaneCard = (
    paneId: PlaneOrientation,
    isMajor: boolean,
  ) => (
    <div
      key={paneId}
      className={`relative h-full w-full min-h-0 overflow-hidden bg-black ${
        activePane === paneId
          ? "ring-2 ring-green-500 ring-inset"
          : "ring-1 ring-gray-700 ring-inset"
      }`}
      onMouseDown={(event) => onPaneMouseDown(paneId, event)}
      onWheel={(event) => onPaneWheel(paneId, event)}
      onContextMenu={(event) => event.preventDefault()}
      ref={(element) => {
        paneContainerRefs.current[paneId] = element;
      }}
    >
      <canvas
        ref={(element) => {
          paneCanvasRefs.current[paneId] = element;
        }}
        className="w-full h-full"
      />

      <div className="absolute top-2 left-2 z-10 bg-black/70 px-2 py-1 rounded text-[11px] font-mono text-white border border-gray-700">
        {paneId}
      </div>
      <div className="absolute bottom-2 left-2 z-10 bg-black/70 px-2 py-1 rounded text-[11px] font-mono text-gray-300 border border-gray-700">
        {getSlicePositionLabel(paneId)}
      </div>

      {isMajor && (
        <>
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20">
            <select
              value={majorPane}
              onChange={(event) => setMajorPane(event.target.value as PlaneOrientation)}
              onClick={(event) => event.stopPropagation()}
              className="bg-black/85 text-white text-xs px-2 py-1 rounded border border-gray-600 hover:border-gray-400 cursor-pointer outline-none focus:border-green-500"
            >
              <option value="Axial">Axial</option>
              <option value="Coronal">Coronal</option>
              <option value="Sagittal">Sagittal</option>
            </select>
          </div>

          <div className="absolute top-2 right-2 z-20 flex items-center gap-2">
            <select
              value={syncMode}
              onChange={(event) => handleSyncModeChange(event.target.value as SyncMode)}
              onClick={(event) => event.stopPropagation()}
              className="bg-black/85 text-white text-xs px-2 py-1 rounded border border-gray-600 hover:border-gray-400 cursor-pointer outline-none focus:border-green-500"
              title={syncMode === "auto" ? "Auto Sync enabled" : "Manual Sync enabled"}
            >
              <option value="auto">Auto Sync</option>
              <option value="manual">Manual Sync</option>
            </select>
            {syncMode === "manual" && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  handleManualSyncNow();
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 rounded border border-blue-500 transition-colors"
                title="Apply active pane state to all panes"
              >
                Sync Now
              </button>
            )}
          </div>

          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 bg-black/75 px-2 py-1 rounded text-[10px] text-gray-300 border border-gray-700 whitespace-nowrap">
            Drag center point to rotate in 3D | Drag elsewhere to move scout point | Wheel to move slab
          </div>

        </>
      )}
    </div>
  );

  return (
    <div className={`flex-1 flex flex-col bg-black pb-1 ${className}`}>
      <div className="flex-1 flex bg-black divide-x divide-gray-800">
        <div className="w-1/2 h-full min-h-0">{renderPaneCard(majorPane, true)}</div>
        <div className="w-1/2 h-full min-h-0 flex flex-col divide-y divide-gray-800">
          <div className="flex-1 h-1/2 min-h-0">{renderPaneCard(minorPanes[0], false)}</div>
          <div className="flex-1 h-1/2 min-h-0">{renderPaneCard(minorPanes[1], false)}</div>
        </div>
      </div>
    </div>
  );
}

export default ObliqueMPRViewer;
