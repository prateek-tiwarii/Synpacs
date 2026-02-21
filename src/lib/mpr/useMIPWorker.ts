/**
 * useMIPWorker — React hook for on-demand MIP slice computation via Web Worker.
 *
 * Manages the worker lifecycle, per-slice caching, and prefetching so that
 * MIP activation and slab slider changes are near-instant.
 */

import { useCallback, useEffect, useRef } from "react";
import type { VolumeData } from "./volumeBuilder";

const MAX_CACHE_ENTRIES = 200;

interface PendingRequest {
  resolve: (data: Int16Array) => void;
  reject: (err: Error) => void;
}

export function useMIPWorker() {
  const workerRef = useRef<Worker | null>(null);
  const callbackMapRef = useRef<Map<number, PendingRequest>>(new Map());
  const requestIdRef = useRef(0);
  const cacheRef = useRef<Map<string, Int16Array>>(new Map());
  const volumeSeriesIdRef = useRef<string | null>(null);
  const isReadyRef = useRef(false);
  const pendingInitResolveRef = useRef<(() => void) | null>(null);

  // Cache listener that routes worker messages to pending promises
  const handleMessage = useCallback((e: MessageEvent) => {
    const { type, payload } = e.data;

    if (type === "ready") {
      isReadyRef.current = true;
      pendingInitResolveRef.current?.();
      pendingInitResolveRef.current = null;
      return;
    }

    if (type === "sliceResult") {
      const { z, slabHalfSize, requestId, buffer } = payload;
      const data = new Int16Array(buffer);
      const key = `${z}_${slabHalfSize}`;
      cacheRef.current.set(key, data);

      // LRU eviction
      if (cacheRef.current.size > MAX_CACHE_ENTRIES) {
        const firstKey = cacheRef.current.keys().next().value;
        if (firstKey !== undefined && firstKey !== key) {
          cacheRef.current.delete(firstKey);
        }
      }

      const pending = callbackMapRef.current.get(requestId);
      if (pending) {
        pending.resolve(data);
        callbackMapRef.current.delete(requestId);
      }
      return;
    }

    if (type === "error") {
      const pending = callbackMapRef.current.get(payload.requestId);
      if (pending) {
        pending.reject(new Error(payload.message));
        callbackMapRef.current.delete(payload.requestId);
      }
    }
  }, []);

  const ensureWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;

    const worker = new Worker(
      new URL("./mipProjection.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = handleMessage;
    workerRef.current = worker;
    return worker;
  }, [handleMessage]);

  const initVolume = useCallback(
    (volume: VolumeData, seriesId?: string): Promise<void> => {
      // Skip re-init for same series
      if (seriesId && seriesId === volumeSeriesIdRef.current && isReadyRef.current) {
        return Promise.resolve();
      }

      const worker = ensureWorker();
      isReadyRef.current = false;
      volumeSeriesIdRef.current = seriesId ?? null;
      cacheRef.current.clear();

      // Copy the buffer so the original volume stays intact
      const bufferCopy = volume.data.buffer.slice(0);

      return new Promise<void>((resolve) => {
        pendingInitResolveRef.current = resolve;
        worker.postMessage(
          {
            type: "init",
            payload: {
              cols: volume.dimensions[0],
              rows: volume.dimensions[1],
              totalSlices: volume.dimensions[2],
              buffer: bufferCopy,
            },
          },
          [bufferCopy],
        );
      });
    },
    [ensureWorker],
  );

  const computeSlice = useCallback(
    (z: number, slabHalfSize: number): Promise<Int16Array> => {
      const key = `${z}_${slabHalfSize}`;
      const cached = cacheRef.current.get(key);
      if (cached) return Promise.resolve(cached);

      const worker = workerRef.current;
      if (!worker || !isReadyRef.current) {
        return Promise.reject(new Error("Worker not initialized"));
      }

      const requestId = ++requestIdRef.current;
      return new Promise<Int16Array>((resolve, reject) => {
        callbackMapRef.current.set(requestId, { resolve, reject });
        worker.postMessage({
          type: "computeSlice",
          payload: { z, slabHalfSize, requestId },
        });
      });
    },
    [],
  );

  const prefetch = useCallback(
    (centerZ: number, range: number, slabHalfSize: number, totalSliceCount: number) => {
      const worker = workerRef.current;
      if (!worker || !isReadyRef.current) return;

      const indices: number[] = [];
      for (let d = 1; d <= range; d++) {
        const above = centerZ + d;
        const below = centerZ - d;
        if (above < totalSliceCount && !cacheRef.current.has(`${above}_${slabHalfSize}`)) {
          indices.push(above);
        }
        if (below >= 0 && !cacheRef.current.has(`${below}_${slabHalfSize}`)) {
          indices.push(below);
        }
      }

      if (indices.length === 0) return;

      const requestId = ++requestIdRef.current;
      worker.postMessage({
        type: "computeBatch",
        payload: { indices, slabHalfSize, requestId },
      });
    },
    [],
  );

  const clearCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  const terminate = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    isReadyRef.current = false;
    volumeSeriesIdRef.current = null;
    cacheRef.current.clear();
    // Reject any pending requests
    callbackMapRef.current.forEach((p) => p.reject(new Error("Worker terminated")));
    callbackMapRef.current.clear();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      callbackMapRef.current.forEach((p) => p.reject(new Error("Hook unmounted")));
      callbackMapRef.current.clear();
    };
  }, []);

  return { initVolume, computeSlice, prefetch, clearCache, terminate };
}
