/**
 * useMPRSliceWorker — React hook for on-demand MPR slice extraction via Web Worker.
 *
 * Manages the worker lifecycle, per-slice caching, and prefetching so that
 * progressive 2D-MPR loading shows slices as quickly as possible.
 */

import { useCallback, useEffect, useRef } from "react";
import type { VolumeData } from "./volumeBuilder";
import type { PlaneType } from "./mprSampler";

const MAX_CACHE_ENTRIES = 300;

interface PendingRequest {
  resolve: (data: { data: Int16Array; width: number; height: number }) => void;
  reject: (err: Error) => void;
}

export function useMPRSliceWorker() {
  const workerRef = useRef<Worker | null>(null);
  const callbackMapRef = useRef<Map<number, PendingRequest>>(new Map());
  const requestIdRef = useRef(0);
  const cacheRef = useRef<
    Map<string, { data: Int16Array; width: number; height: number }>
  >(new Map());
  const volumeSeriesIdRef = useRef<string | null>(null);
  const isReadyRef = useRef(false);
  const pendingInitResolveRef = useRef<(() => void) | null>(null);

  const handleMessage = useCallback((e: MessageEvent) => {
    const { type, payload } = e.data;

    if (type === "ready") {
      isReadyRef.current = true;
      pendingInitResolveRef.current?.();
      pendingInitResolveRef.current = null;
      return;
    }

    if (type === "sliceResult") {
      const { plane, index, requestId, buffer, width, height } = payload;
      const data = new Int16Array(buffer);
      const key = `${plane}_${index}`;
      const entry = { data, width, height };
      cacheRef.current.set(key, entry);

      // LRU eviction
      if (cacheRef.current.size > MAX_CACHE_ENTRIES) {
        const firstKey = cacheRef.current.keys().next().value;
        if (firstKey !== undefined && firstKey !== key) {
          cacheRef.current.delete(firstKey);
        }
      }

      const pending = callbackMapRef.current.get(requestId);
      if (pending) {
        pending.resolve(entry);
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
      new URL("./mprSlice.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = handleMessage;
    workerRef.current = worker;
    return worker;
  }, [handleMessage]);

  const initVolume = useCallback(
    (volume: VolumeData, seriesId?: string): Promise<void> => {
      // Skip re-init for same series
      if (
        seriesId &&
        seriesId === volumeSeriesIdRef.current &&
        isReadyRef.current
      ) {
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
    (
      plane: PlaneType,
      index: number,
    ): Promise<{ data: Int16Array; width: number; height: number }> => {
      const key = `${plane}_${index}`;
      const cached = cacheRef.current.get(key);
      if (cached) return Promise.resolve(cached);

      const worker = workerRef.current;
      if (!worker || !isReadyRef.current) {
        return Promise.reject(new Error("Worker not initialized"));
      }

      const requestId = ++requestIdRef.current;
      return new Promise((resolve, reject) => {
        callbackMapRef.current.set(requestId, { resolve, reject });
        worker.postMessage({
          type: "extractSlice",
          payload: { plane, index, requestId },
        });
      });
    },
    [],
  );

  const prefetch = useCallback(
    (
      plane: PlaneType,
      centerIndex: number,
      range: number,
      totalSliceCount: number,
    ) => {
      const worker = workerRef.current;
      if (!worker || !isReadyRef.current) return;

      const indices: number[] = [];
      for (let d = 1; d <= range; d++) {
        const above = centerIndex + d;
        const below = centerIndex - d;
        if (
          above < totalSliceCount &&
          !cacheRef.current.has(`${plane}_${above}`)
        ) {
          indices.push(above);
        }
        if (below >= 0 && !cacheRef.current.has(`${plane}_${below}`)) {
          indices.push(below);
        }
      }

      if (indices.length === 0) return;

      const requestId = ++requestIdRef.current;
      worker.postMessage({
        type: "extractBatch",
        payload: { plane, indices, requestId },
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
    callbackMapRef.current.forEach((p) =>
      p.reject(new Error("Worker terminated")),
    );
    callbackMapRef.current.clear();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      callbackMapRef.current.forEach((p) =>
        p.reject(new Error("Hook unmounted")),
      );
      callbackMapRef.current.clear();
    };
  }, []);

  return { initVolume, computeSlice, prefetch, clearCache, terminate };
}
