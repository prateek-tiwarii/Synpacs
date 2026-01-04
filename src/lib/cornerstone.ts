import * as cornerstone from '@cornerstonejs/core'
import { RenderingEngine, Enums } from '@cornerstonejs/core'
import dicomImageLoaderDefault, { init as initDicomImageLoader } from '@cornerstonejs/dicom-image-loader'

const RENDERING_ENGINE_ID = 'myRenderingEngine'
let renderingEngine: RenderingEngine | null = null
let cornerstoneInitialized = false
let initPromise: Promise<void> | null = null

export async function initializeCornerstone() {
    // Prevent duplicate initialization (React Strict Mode calls effects twice)
    if (cornerstoneInitialized && renderingEngine) {
        return
    }

    // If already initializing, return the same promise
    if (initPromise) {
        return initPromise
    }

    initPromise = (async () => {
        try {
            // Initialize cornerstone core
            await cornerstone.init()

            // Initialize DICOM image loader
            initDicomImageLoader({
                maxWebWorkers: navigator.hardwareConcurrency || 1,
            })

            // Create the rendering engine
            renderingEngine = new RenderingEngine(RENDERING_ENGINE_ID)

            cornerstoneInitialized = true
        } catch (error) {
            initPromise = null
            throw error
        }
    })()

    return initPromise
}

export function isCornerstoneReady(): boolean {
    return cornerstoneInitialized && renderingEngine !== null
}

// Synchronous version for use in event handlers and cleanup - throws if not ready
export function getRenderingEngineSync(): RenderingEngine {
    if (!renderingEngine) {
        throw new Error('Cornerstone not initialized')
    }
    return renderingEngine
}

export async function getRenderingEngine(): Promise<RenderingEngine> {
    // If not initialized or rendering engine is null, try to initialize
    if (!cornerstoneInitialized || !renderingEngine) {
        await initializeCornerstone()
    }

    if (!renderingEngine) {
        throw new Error('Cornerstone initialization failed')
    }
    return renderingEngine
}

export function createImageId(instanceUid: string): string {
    // Create wadouri image ID for the DICOM instance
    // Uses the backend route: GET /api/v1/instances/:instance_uid/dicom
    return `wadouri:/api/v1/instances/${instanceUid}/dicom`
}

// Re-export for convenience
export { cornerstone, dicomImageLoaderDefault as dicomImageLoader, Enums, RenderingEngine }
