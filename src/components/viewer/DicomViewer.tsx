import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import dicomParser from 'dicom-parser';
import { decode as decodeJ2K } from '@abasb75/openjpeg';
import { Loader2, Maximize, Minimize } from 'lucide-react';
import { useViewerContext, type Annotation } from '../ViewerLayout';

// Instance metadata interface matching the ACTUAL API response
interface Instance {
    instance_uid: string;
    imageId: string; // Kept for compatibility if needed, but we use instance_uid for fetching
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

interface DicomViewerProps {
    instances: Instance[];
    className?: string;
}
export function DicomViewer({ instances, className = '' }: DicomViewerProps) {
    const {
        setCurrentImageIndex: setGlobalImageIndex,
        activeTool,
        viewTransform,
        setViewTransform,
        annotations,
        setAnnotations,
        saveToHistory,
        isFullscreen,
        toggleFullscreen
    } = useViewerContext();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    // Sync local index with global context for header display
    useEffect(() => {
        setGlobalImageIndex(currentImageIndex);
    }, [currentImageIndex, setGlobalImageIndex]);

    const screenToImage = useCallback((screenX: number, screenY: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();

        // 1. Shift to canvas center
        let x = (screenX - rect.left) - canvas.width / 2;
        let y = (screenY - rect.top) - canvas.height / 2;

        // 2. Inverse Pan
        x -= viewTransform.x;
        y -= viewTransform.y;

        // 3. Inverse Zoom
        x /= viewTransform.scale;
        y /= viewTransform.scale;

        // 4. Inverse Rotation
        const angle = (-viewTransform.rotation * Math.PI) / 180;
        const rx = x * Math.cos(angle) - y * Math.sin(angle);
        const ry = x * Math.sin(angle) + y * Math.cos(angle);
        x = rx;
        y = ry;

        // 5. Inverse Flips
        if (viewTransform.flipH) x = -x;
        if (viewTransform.flipV) y = -y;

        return { x, y };
    }, [viewTransform]);

    // Ref to store the current decoded bitmap for rendering
    const currentBitmap = useRef<ImageBitmap | null>(null);

    // Mouse interaction state
    const isDragging = useRef(false);
    const lastMousePos = useRef({ x: 0, y: 0 });
    const currentAnnotation = useRef<Annotation | null>(null);

    // Cache for storing downloaded DICOM files (ArrayBuffers)
    // Map<instance_uid, ArrayBuffer>
    const imageCache = useRef<Map<string, ArrayBuffer>>(new Map());
    const prefetchStarted = useRef(false);
    const activeRequests = useRef(0);
    const MAX_CONCURRENT_REQUESTS = 5;

    // Memoize sorted instances to prevent infinite re-renders
    const sortedInstances = useMemo(() =>
        [...instances].sort((a, b) => a.sort_key - b.sort_key),
        [instances]
    );

    const renderAnnotations = useCallback((ctx: CanvasRenderingContext2D) => {
        ctx.strokeStyle = '#00ff00';
        ctx.fillStyle = '#00ff00';
        ctx.lineWidth = 2 / viewTransform.scale;
        ctx.font = `${14 / viewTransform.scale}px sans-serif`;

        const allAnnotations = [...annotations, ...(currentAnnotation.current ? [currentAnnotation.current] : [])];

        allAnnotations.forEach(ann => {
            if (!ann || !ann.points || ann.points.length < 1) return;

            ctx.beginPath();
            if (ann.type === 'Freehand' || ann.type === 'Length') {
                ctx.moveTo(ann.points[0].x, ann.points[0].y);
                ann.points.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
                ctx.stroke();

                if (ann.type === 'Length' && ann.points.length === 2) {
                    const currentInstance = sortedInstances[currentImageIndex];
                    let distText = '';
                    const dx = ann.points[1].x - ann.points[0].x;
                    const dy = ann.points[1].y - ann.points[0].y;

                    if (currentInstance?.pixel_spacing && currentInstance.pixel_spacing.length === 2) {
                        const [psX, psY] = currentInstance.pixel_spacing;
                        const distMm = Math.sqrt(Math.pow(dx * psX, 2) + Math.pow(dy * psY, 2)).toFixed(2);
                        distText = `${distMm} mm`;
                    } else {
                        const distPx = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2)).toFixed(2);
                        distText = `${distPx} px`;
                    }
                    ctx.fillText(distText, ann.points[1].x + 5, ann.points[1].y + 5);
                }
            } else if (ann.type === 'Rectangle') {
                const p1 = ann.points[0];
                const p2 = ann.points[1] || p1;
                ctx.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
            } else if (ann.type === 'Ellipse') {
                const p1 = ann.points[0];
                const p2 = ann.points[1] || p1;
                const centerX = (p1.x + p2.x) / 2;
                const centerY = (p1.y + p2.y) / 2;
                const radiusX = Math.abs(p2.x - p1.x) / 2;
                const radiusY = Math.abs(p2.y - p1.y) / 2;
                ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
                ctx.stroke();
            } else if (ann.type === 'Text') {
                ctx.fillText(ann.text || 'Text', ann.points[0].x, ann.points[0].y);
            }
        });
    }, [annotations, viewTransform.scale]);

    // Rendering logic: Draw bitmap with transforms
    const renderCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !currentBitmap.current) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size to container size for responsive rendering
        const rect = canvas.parentElement?.getBoundingClientRect();
        if (rect) {
            if (canvas.width !== rect.width || canvas.height !== rect.height) {
                canvas.width = rect.width;
                canvas.height = rect.height;
            }
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();

        // 1. Center the coordinate system
        ctx.translate(canvas.width / 2, canvas.height / 2);

        // 2. Apply Pan
        ctx.translate(viewTransform.x, viewTransform.y);

        // 3. Apply Zoom
        ctx.scale(viewTransform.scale, viewTransform.scale);

        // 4. Apply Rotation
        ctx.rotate((viewTransform.rotation * Math.PI) / 180);

        // 5. Apply Flips
        const scaleX = viewTransform.flipH ? -1 : 1;
        const scaleY = viewTransform.flipV ? -1 : 1;
        ctx.scale(scaleX, scaleY);

        // 6. Draw image centered
        const img = currentBitmap.current;
        ctx.drawImage(img, -img.width / 2, -img.height / 2);

        // 7. Render annotations in the transformed space
        renderAnnotations(ctx);

        ctx.restore();
    }, [viewTransform, annotations, renderAnnotations]);

    // Redraw when transform changes or on resize
    useEffect(() => {
        renderCanvas();
    }, [renderCanvas]);

    useEffect(() => {
        window.addEventListener('resize', renderCanvas);
        return () => window.removeEventListener('resize', renderCanvas);
    }, [renderCanvas]);
    // Pre-fetch logic
    useEffect(() => {
        if (sortedInstances.length <= 1) return;

        // Only start pre-fetching if we haven't started yet and user has moved past the first image
        // Or un-comment below to eager load everything immediately 
        // if (!prefetchStarted.current) { 
        if (!prefetchStarted.current && currentImageIndex > 0) {
            prefetchStarted.current = true;

            const queue = sortedInstances.filter(inst => !imageCache.current.has(inst.instance_uid));

            // We'll process the queue with a simple concurrency limiter
            let queueIndex = 0;

            let fetchedCount = 0;

            const processQueue = async () => {
                if (queueIndex >= queue.length) return;

                // Check if we can start more requests
                while (activeRequests.current < MAX_CONCURRENT_REQUESTS && queueIndex < queue.length) {
                    const instance = queue[queueIndex++];
                    activeRequests.current++;

                    const url = `/api/v1/instances/${instance.instance_uid}/dicom`;

                    fetch(url)
                        .then(res => {
                            if (!res.ok) throw new Error('Fetch failed');
                            return res.arrayBuffer();
                        })
                        .then(buffer => {
                            imageCache.current.set(instance.instance_uid, buffer);
                            fetchedCount++;
                            // Optional: Update progress UI
                        })
                        .catch(err => console.error(`Failed to prefetch ${instance.instance_uid}:`, err))
                        .finally(() => {
                            activeRequests.current--;
                            processQueue(); // Loop
                        });
                }
            };

            processQueue();
        }
    }, [currentImageIndex, sortedInstances]);

    // Load and Render Image
    useEffect(() => {
        if (sortedInstances.length === 0) return;

        let mounted = true;
        const currentInstance = sortedInstances[currentImageIndex];
        const instanceUrl = `/api/v1/instances/${currentInstance.instance_uid}/dicom`;

        const loadImage = async () => {
            try {
                setIsLoading(true);
                setError(null);

                let arrayBuffer: ArrayBuffer;
                if (imageCache.current.has(currentInstance.instance_uid)) {
                    arrayBuffer = imageCache.current.get(currentInstance.instance_uid)!;
                } else {
                    const response = await fetch(instanceUrl);
                    if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
                    arrayBuffer = await response.arrayBuffer();
                    if (mounted) imageCache.current.set(currentInstance.instance_uid, arrayBuffer);
                }

                if (!mounted) return;

                const byteArray = new Uint8Array(arrayBuffer);
                const dataSet = dicomParser.parseDicom(byteArray);
                const rows = dataSet.uint16('x00280010') || currentInstance.rows;
                const columns = dataSet.uint16('x00280011') || currentInstance.columns;
                const winCenter = dataSet.floatString('x00281050') || currentInstance.window_center || 40;
                const winWidth = dataSet.floatString('x00281051') || currentInstance.window_width || 400;
                const slope = dataSet.floatString('x00281053') || currentInstance.rescale_slope || 1;
                const intercept = dataSet.floatString('x00281052') || currentInstance.rescale_intercept || 0;
                const pixelRepresentation = dataSet.uint16('x00280103') ?? 0;
                const transferSyntax = dataSet.string('x00020010');
                const pixelDataElement = dataSet.elements.x7fe00010;

                if (!pixelDataElement) throw new Error('Pixel Data not found');

                let pixelData: Int16Array | Uint16Array;
                const safeLength = pixelDataElement.length > 0 ? pixelDataElement.length : arrayBuffer.byteLength - pixelDataElement.dataOffset;
                const rawPixelData = new Uint8Array(arrayBuffer, pixelDataElement.dataOffset, safeLength);

                const isJ2K = transferSyntax === '1.2.840.10008.1.2.4.90' || transferSyntax === '1.2.840.10008.1.2.4.91';

                if (isJ2K) {
                    let j2kStart = 0;
                    for (let i = 0; i < 4000 && i < rawPixelData.length - 1; i++) {
                        if (rawPixelData[i] === 0xFF && rawPixelData[i + 1] === 0x4F) { j2kStart = i; break; }
                    }
                    const decoded = await decodeJ2K(rawPixelData.slice(j2kStart).buffer);
                    let rawDecodedBytes = new Uint8Array(decoded.decodedBuffer);

                    // Simple endian check
                    let temp = new Uint16Array(rawDecodedBytes.buffer, rawDecodedBytes.byteOffset, 100);
                    if (Math.max(...Array.from(temp)) < 256) {
                        const swapped = new Uint8Array(rawDecodedBytes.length);
                        for (let i = 0; i < rawDecodedBytes.length; i += 2) {
                            swapped[i] = rawDecodedBytes[i + 1]; swapped[i + 1] = rawDecodedBytes[i];
                        }
                        rawDecodedBytes = swapped;
                    }

                    pixelData = pixelRepresentation === 1
                        ? new Int16Array(rawDecodedBytes.buffer, rawDecodedBytes.byteOffset, rawDecodedBytes.byteLength / 2)
                        : new Uint16Array(rawDecodedBytes.buffer, rawDecodedBytes.byteOffset, rawDecodedBytes.byteLength / 2);
                } else {
                    const rawData = byteArray.buffer.slice(pixelDataElement.dataOffset, pixelDataElement.dataOffset + safeLength);
                    pixelData = pixelRepresentation === 1 ? new Int16Array(rawData) : new Uint16Array(rawData);
                }

                if (!mounted) return;

                // Step 4: Apply Window/Level to RGBA
                const rgbaData = new Uint8ClampedArray(columns * rows * 4);
                const minValue = winCenter - winWidth / 2;
                for (let i = 0; i < pixelData.length; i++) {
                    const val = pixelData[i] * slope + intercept;
                    let display = ((val - minValue) / winWidth) * 255;
                    display = Math.max(0, Math.min(255, display));
                    const idx = i * 4;
                    rgbaData[idx] = rgbaData[idx + 1] = rgbaData[idx + 2] = display;
                    rgbaData[idx + 3] = 255;
                }

                // Create Bitmap
                const imageData = new ImageData(rgbaData, columns, rows);
                currentBitmap.current = await createImageBitmap(imageData);

                if (mounted) {
                    renderCanvas();
                    setIsLoading(false);
                }
            } catch (err) {
                console.error(err);
                if (mounted) { setError(err instanceof Error ? err.message : 'Render Error'); setIsLoading(false); }
            }
        };

        loadImage();
        return () => { mounted = false; };
    }, [currentImageIndex, sortedInstances, renderCanvas]);

    // Interaction Handlers
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        isDragging.current = true;
        lastMousePos.current = { x: e.clientX, y: e.clientY };

        if (['Length', 'Ellipse', 'Rectangle', 'Freehand', 'Text'].includes(activeTool)) {
            const pos = screenToImage(e.clientX, e.clientY);
            const id = Math.random().toString(36).substr(2, 9);

            if (activeTool === 'Text') {
                const text = prompt('Enter annotation text:');
                if (text) {
                    const newAnnotation: Annotation = {
                        id,
                        type: 'Text',
                        points: [pos],
                        text,
                        color: '#00ff00'
                    };
                    setAnnotations(prev => [...prev, newAnnotation]);
                    saveToHistory();
                }
                isDragging.current = false;
            } else {
                currentAnnotation.current = {
                    id,
                    type: activeTool as any,
                    points: [pos],
                    color: '#00ff00'
                };
            }
        }
    }, [activeTool, screenToImage, setAnnotations, saveToHistory]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDragging.current) return;

        const deltaX = e.clientX - lastMousePos.current.x;
        const deltaY = e.clientY - lastMousePos.current.y;
        lastMousePos.current = { x: e.clientX, y: e.clientY };

        if (activeTool === 'Pan') {
            setViewTransform(prev => ({ ...prev, x: prev.x + deltaX, y: prev.y + deltaY }));
        } else if (activeTool === 'Zoom') {
            setViewTransform(prev => ({ ...prev, scale: Math.max(0.1, prev.scale - deltaY * 0.01) }));
        } else if (activeTool === 'Stack') {
            if (Math.abs(deltaY) > 5) {
                const direction = deltaY > 0 ? 1 : -1;
                setCurrentImageIndex(prev => Math.max(0, Math.min(prev + direction, sortedInstances.length - 1)));
            }
        } else if (['Length', 'Ellipse', 'Rectangle', 'Freehand'].includes(activeTool)) {
            if (currentAnnotation.current) {
                const pos = screenToImage(e.clientX, e.clientY);
                if (activeTool === 'Freehand') {
                    currentAnnotation.current.points.push(pos);
                } else {
                    currentAnnotation.current.points[1] = pos;
                }
                renderCanvas();
            }
        }
    }, [activeTool, setViewTransform, sortedInstances.length, screenToImage, renderCanvas]);

    const handleMouseUp = useCallback(() => {
        if (isDragging.current && currentAnnotation.current) {
            setAnnotations(prev => [...prev, currentAnnotation.current!]);
            currentAnnotation.current = null;
            saveToHistory();
            renderCanvas();
        }
        isDragging.current = false;
    }, [setAnnotations, saveToHistory, renderCanvas]);

    // Also keep wheel for fast scrolling regardless of tool
    const handleWheel = useCallback((event: WheelEvent) => {
        event.preventDefault();
        if (sortedInstances.length <= 1) return;
        const delta = event.deltaY > 0 ? 1 : -1;
        setCurrentImageIndex(prev => Math.max(0, Math.min(prev + delta, sortedInstances.length - 1)));
    }, [sortedInstances.length]);

    useEffect(() => {
        const element = canvasRef.current;
        if (!element) return;
        element.addEventListener('wheel', handleWheel, { passive: false });
        return () => element.removeEventListener('wheel', handleWheel);
    }, [handleWheel]);

    return (
        <div
            className={`relative bg-black flex items-center justify-center overflow-hidden cursor-crosshair ${className}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            <canvas ref={canvasRef} className="max-w-full max-h-full" />

            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
            )}

            {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 px-4 text-center">
                    <p className="text-red-400 text-sm">Error: {error}</p>
                </div>
            )}

            {!error && sortedInstances.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 px-4 py-2 rounded-lg pointer-events-none text-white text-sm font-mono">
                    Image {currentImageIndex + 1} / {sortedInstances.length}
                </div>
            )}

            <button
                onClick={(e) => {
                    e.stopPropagation();
                    toggleFullscreen();
                }}
                className="absolute bottom-4 right-4 p-2 bg-gray-800/80 hover:bg-gray-700 text-white rounded-lg transition-colors border border-gray-600 shadow-lg"
                title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
            >
                {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
        </div>
    );
}

export default DicomViewer;

