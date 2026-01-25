import { useParams } from "react-router-dom";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  useViewerContext,
  type TemporaryMPRSeries,
  type MPRSliceData,
  type MPRMode,
} from "@/components/ViewerLayout";
import { getCookie } from "@/lib/cookies";
import DicomViewer from "@/components/viewer/DicomViewer";
import SRViewer from "@/components/viewer/SRViewer";
import TemporaryMPRSeriesViewer from "@/components/viewer/TemporaryMPRSeriesViewer";
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
  applyWindowLevel,
} from "@/lib/mpr";
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

const CaseViewer = () => {
  useParams(); // Keep hook call for routing context
  const {
    caseData,
    selectedSeries,
    selectedTemporarySeriesId,
    temporaryMPRSeries,
    pendingMPRGeneration,
    clearPendingMPRGeneration,
    addTemporaryMPRSeries,
    viewTransform,
    setCrosshairIndices,
  } = useViewerContext();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

  const fetchInstances = useCallback(async () => {
    if (!selectedSeries?._id) {
      setInstances([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
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

      if (!response.ok) {
        throw new Error(`Failed to fetch instances: ${response.statusText}`);
      }

      const data: InstancesResponse = await response.json();

      if (Array.isArray(data.instances)) {
        setInstances(data.instances);
      } else {
        console.warn("Unexpected response format:", data);
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
          volume = await buildVolume(
            sortedInstances,
            imageCacheMap.current,
            API_BASE_URL,
            getCookie("jwt") || "",
            (loaded, total) => {
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

        // Handle 2D-MPR: generate all three planes
        if (mode === "2D-MPR") {
          const planes: PlaneType[] = ["Axial", "Coronal", "Sagittal"];

          for (const plane of planes) {
            const maxIndex = getMaxIndex(volume, plane);
            const totalSlices = maxIndex + 1;
            const slices: MPRSliceData[] = [];

            setMprGenerationProgress({
              phase: `slices-${plane}`,
              current: 0,
              total: totalSlices,
            });

            for (let i = 0; i <= maxIndex; i++) {
              const sliceResult = extractSlice(volume, plane, i);
              const imageData = applyWindowLevel(
                sliceResult.data,
                sliceResult.width,
                sliceResult.height,
                windowCenter,
                windowWidth,
              );

              slices.push({
                index: i,
                imageData,
                width: sliceResult.width,
                height: sliceResult.height,
              });

              setMprGenerationProgress({
                phase: `slices-${plane}`,
                current: i + 1,
                total: totalSlices,
              });

              // Yield to UI thread every 10 slices
              if (i % 10 === 0) {
                await new Promise((resolve) => setTimeout(resolve, 0));
              }
            }

            // Create temporary series for this plane
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
            };

            addTemporaryMPRSeries(tempSeries);
          }
        }
        // Handle 3D-MPR: Same as single plane for now (oblique not implemented yet)
        else if (mode === "3D-MPR") {
          // Default to Axial for 3D-MPR (oblique manipulation to be implemented)
          const plane: PlaneType = "Axial";
          const maxIndex = getMaxIndex(volume, plane);
          const totalSlices = maxIndex + 1;
          const slices: MPRSliceData[] = [];

          setMprGenerationProgress({
            phase: "slices",
            current: 0,
            total: totalSlices,
          });

          for (let i = 0; i <= maxIndex; i++) {
            const sliceResult = extractSlice(volume, plane, i);
            const imageData = applyWindowLevel(
              sliceResult.data,
              sliceResult.width,
              sliceResult.height,
              windowCenter,
              windowWidth,
            );

            slices.push({
              index: i,
              imageData,
              width: sliceResult.width,
              height: sliceResult.height,
            });

            setMprGenerationProgress({
              phase: "slices",
              current: i + 1,
              total: totalSlices,
            });

            if (i % 10 === 0) {
              await new Promise((resolve) => setTimeout(resolve, 0));
            }
          }

          const tempSeries: TemporaryMPRSeries = {
            id: `mpr-${selectedSeries._id}-3D-MPR-${Date.now()}`,
            sourceSeriesId: selectedSeries._id,
            mprMode: "3D-MPR" as MPRMode,
            description: `3D-MPR from ${selectedSeries.description || "Series " + selectedSeries.series_number}`,
            slices,
            sliceCount: slices.length,
            createdAt: Date.now(),
            windowCenter,
            windowWidth,
          };

          addTemporaryMPRSeries(tempSeries);
        }
        // Handle single plane (Axial, Coronal, Sagittal)
        else {
          const plane = mode as PlaneType;
          const maxIndex = getMaxIndex(volume, plane);
          const totalSlices = maxIndex + 1;
          const slices: MPRSliceData[] = [];

          setMprGenerationProgress({
            phase: "slices",
            current: 0,
            total: totalSlices,
          });

          for (let i = 0; i <= maxIndex; i++) {
            const sliceResult = extractSlice(volume, plane, i);
            const imageData = applyWindowLevel(
              sliceResult.data,
              sliceResult.width,
              sliceResult.height,
              windowCenter,
              windowWidth,
            );

            slices.push({
              index: i,
              imageData,
              width: sliceResult.width,
              height: sliceResult.height,
            });

            setMprGenerationProgress({
              phase: "slices",
              current: i + 1,
              total: totalSlices,
            });

            // Yield to UI thread every 10 slices
            if (i % 10 === 0) {
              await new Promise((resolve) => setTimeout(resolve, 0));
            }
          }

          // Create the temporary series
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
        <p className="text-gray-400">
          Select a series from the sidebar to view images
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-black h-full">
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
          className="flex-1"
        />
      ) : selectedSeries.modality === "SR" ? (
        <SRViewer instances={instances || []} className="flex-1" />
      ) : (
        <DicomViewer instances={instances || []} className="flex-1" />
      )}
    </div>
  );
};

export default CaseViewer;
