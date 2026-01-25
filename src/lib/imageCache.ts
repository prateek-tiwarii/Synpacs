/**
 * Global Image Cache Service
 *
 * Provides a singleton cache for DICOM image data that persists across
 * component re-renders and is shared between DicomViewer and MPR generation.
 *
 * Benefits:
 * - Download each DICOM file only once
 * - Share cache between all viewers (DicomViewer, MPR, etc.)
 * - Reduce network bandwidth and loading times
 * - Automatic memory management
 */

interface CacheEntry {
  data: ArrayBuffer;
  timestamp: number;
  size: number;
}

class ImageCacheService {
  private cache: Map<string, CacheEntry>;
  private totalSize: number;
  private maxSize: number; // Maximum cache size in bytes (default 2GB)
  private hits: number;
  private misses: number;

  constructor(maxSizeMB: number = 2048) {
    this.cache = new Map();
    this.totalSize = 0;
    this.maxSize = maxSizeMB * 1024 * 1024; // Convert MB to bytes
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get image data from cache
   * IMPORTANT: Returns a COPY to prevent detached ArrayBuffer issues
   */
  get(instanceUid: string): ArrayBuffer | null {
    const entry = this.cache.get(instanceUid);
    if (entry) {
      this.hits++;
      entry.timestamp = Date.now(); // Update LRU timestamp
      // Return a copy to prevent detachment issues when buffer is transferred
      return entry.data.slice(0);
    }
    this.misses++;
    return null;
  }

  /**
   * Store image data in cache
   */
  set(instanceUid: string, data: ArrayBuffer): void {
    const size = data.byteLength;

    // Check if we need to make space
    while (this.totalSize + size > this.maxSize && this.cache.size > 0) {
      this.evictOldest();
    }

    // Add to cache
    this.cache.set(instanceUid, {
      data,
      timestamp: Date.now(),
      size,
    });
    this.totalSize += size;
  }

  /**
   * Check if image is in cache
   */
  has(instanceUid: string): boolean {
    return this.cache.has(instanceUid);
  }

  /**
   * Evict oldest (least recently used) entry
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      const entry = this.cache.get(oldestKey)!;
      this.cache.delete(oldestKey);
      this.totalSize -= entry.size;
    }
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.totalSize = 0;
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      entries: this.cache.size,
      totalSizeMB: (this.totalSize / (1024 * 1024)).toFixed(2),
      maxSizeMB: (this.maxSize / (1024 * 1024)).toFixed(0),
      hits: this.hits,
      misses: this.misses,
      hitRate:
        this.hits + this.misses > 0
          ? ((this.hits / (this.hits + this.misses)) * 100).toFixed(1) + "%"
          : "0%",
    };
  }

  /**
   * Remove specific entry from cache
   */
  delete(instanceUid: string): boolean {
    const entry = this.cache.get(instanceUid);
    if (entry) {
      this.cache.delete(instanceUid);
      this.totalSize -= entry.size;
      return true;
    }
    return false;
  }

  /**
   * Fetch and cache image if not already cached
   */
  async fetchAndCache(
    instanceUid: string,
    apiBaseUrl: string,
    authToken: string,
  ): Promise<ArrayBuffer> {
    // Check cache first
    const cached = this.get(instanceUid);
    if (cached) {
      return cached;
    }

    // Fetch from API
    const response = await fetch(
      `${apiBaseUrl}/api/v1/instances/${instanceUid}/dicom`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch instance ${instanceUid}: ${response.statusText}`,
      );
    }

    const data = await response.arrayBuffer();

    // Cache it
    this.set(instanceUid, data);

    return data;
  }
}

// Export singleton instance
export const imageCache = new ImageCacheService(2048); // 2GB cache

// Export for debugging
if (typeof window !== "undefined") {
  (window as any).__imageCache = imageCache;
}
