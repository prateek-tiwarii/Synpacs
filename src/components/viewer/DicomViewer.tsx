import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import dicomParser from 'dicom-parser';
import { decode as decodeJ2K } from '@abasb75/openjpeg';
import { Loader2 } from 'lucide-react';

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
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    // Memoize sorted instances to prevent infinite re-renders
    const sortedInstances = useMemo(() =>
        [...instances].sort((a, b) => a.sort_key - b.sort_key),
        [instances]
    );

    // Helper: Apply Window/Level and Rescale to convert raw pixel data to displayable RGBA
    const applyWindowLevel = (
        pixelData: Int16Array | Uint16Array,
        width: number,
        height: number,
        windowCenter: number,
        windowWidth: number,
        rescaleSlope: number,
        rescaleIntercept: number
    ) => {
        const outputData = new Uint8ClampedArray(width * height * 4); // RGBA

        const minValue = windowCenter - windowWidth / 2;
        const maxValue = windowCenter + windowWidth / 2;

        for (let i = 0; i < pixelData.length; i++) {
            // Step 1: Rescale to Hounsfield Units (HU)
            const rawValue = pixelData[i];
            const pixelValue = rawValue * rescaleSlope + rescaleIntercept;

            // Step 2: Window/Level to 0-255
            let displayValue;
            if (pixelValue <= minValue) {
                displayValue = 0;
            } else if (pixelValue >= maxValue) {
                displayValue = 255;
            } else {
                displayValue = ((pixelValue - minValue) / windowWidth) * 255;
            }

            // Step 3: Write RGBA (grayscale = R=G=B)
            outputData[i * 4] = displayValue;     // R
            outputData[i * 4 + 1] = displayValue; // G
            outputData[i * 4 + 2] = displayValue; // B
            outputData[i * 4 + 3] = 255;          // A (opaque)
        }

        return outputData;
    };

    // Load and Render Image
    useEffect(() => {
        if (sortedInstances.length === 0) return;

        let mounted = true;
        const currentInstance = sortedInstances[currentImageIndex];
        const instanceUrl = `/api/v1/instances/${currentInstance.instance_uid}/dicom`;

        const renderImage = async () => {
            try {
                setIsLoading(true);
                setError(null);

                // Step 1: Fetch the DICOM File
                const response = await fetch(instanceUrl);
                if (!response.ok) {
                    throw new Error(`Failed to fetch DICOM: ${response.statusText}`);
                }
                const arrayBuffer = await response.arrayBuffer();

                if (!mounted) return;

                // Step 2: Parse DICOM with dicom-parser
                const byteArray = new Uint8Array(arrayBuffer);
                const dataSet = dicomParser.parseDicom(byteArray);

                // Extract expected dimensions
                const rows = dataSet.uint16('x00280010') || currentInstance.rows;
                const columns = dataSet.uint16('x00280011') || currentInstance.columns;

                // Extract Window/Level
                const winCenter = dataSet.floatString('x00281050') || currentInstance.window_center || 40;
                const winWidth = dataSet.floatString('x00281051') || currentInstance.window_width || 400;
                const slope = dataSet.floatString('x00281053') || currentInstance.rescale_slope || 1;
                const intercept = dataSet.floatString('x00281052') || currentInstance.rescale_intercept || 0;
                const pixelRepresentation = dataSet.uint16('x00280103') ?? 0; // 0 = unsigned, 1 = signed

                console.log('DICOM Tags:', { rows, columns, winCenter, winWidth, slope, intercept, pixelRepresentation });

                // Check Transfer Syntax
                const transferSyntax = dataSet.string('x00020010');
                console.log('Transfer Syntax:', transferSyntax);

                // Get Pixel Data Element
                const pixelDataElement = dataSet.elements.x7fe00010;
                if (!pixelDataElement) {
                    throw new Error('Pixel Data element not found');
                }

                let pixelData: Int16Array | Uint16Array;

                // Helper to swap bytes (Little Endian <-> Big Endian)
                const swapBytes = (data: Uint8Array) => {
                    const len = data.length;
                    if (len % 2 !== 0) return data; // Should be even for 16-bit
                    const swapped = new Uint8Array(len);
                    for (let i = 0; i < len; i += 2) {
                        swapped[i] = data[i + 1];
                        swapped[i + 1] = data[i];
                    }
                    return swapped;
                };

                // Decode Pixel Data
                const isJ2K = transferSyntax === '1.2.840.10008.1.2.4.90' || transferSyntax === '1.2.840.10008.1.2.4.91';

                // Read from dataOffset to end of buffer to be safe, or use length if valid
                const safeLength = (pixelDataElement.length && pixelDataElement.length > 0)
                    ? pixelDataElement.length
                    : arrayBuffer.byteLength - pixelDataElement.dataOffset;

                const rawPixelData = new Uint8Array(arrayBuffer, pixelDataElement.dataOffset, safeLength);

                if (isJ2K) {
                    // Locate JPEG 2000 SOC marker (FF 4F)
                    let j2kStart = 0;
                    for (let i = 0; i < 4000 && i < rawPixelData.length - 1; i++) {
                        if (rawPixelData[i] === 0xFF && rawPixelData[i + 1] === 0x4F) {
                            j2kStart = i;
                            break;
                        }
                    }

                    if (j2kStart === 0 && (rawPixelData[0] !== 0xFF || rawPixelData[1] !== 0x4F)) {
                        console.warn('J2K SOC marker not found in first 4000 bytes, trying from 0');
                    }

                    const j2kData = rawPixelData.slice(j2kStart);
                    console.log('Decoding J2K, length:', j2kData.byteLength);

                    const decoded = await decodeJ2K(j2kData.buffer);

                    // J2K decoding result might be Big Endian, while JS TypedArrays are Host Endian (Little Endian)
                    // We check if we need to swap bytes by checking the value range.
                    // If values are all < 256 (for a 16-bit CT), it's likely we need to swap.

                    let rawDecodedBytes = new Uint8Array(decoded.decodedBuffer);

                    // Temporary view to check stats
                    let tempView = new Uint16Array(rawDecodedBytes.buffer, rawDecodedBytes.byteOffset, rawDecodedBytes.byteLength / 2);
                    let localMax = 0;
                    // Check a sample to determine range
                    for (let i = 0; i < tempView.length; i += 500) {
                        if (tempView[i] > localMax) localMax = tempView[i];
                    }

                    console.log('Pre-swap Max:', localMax);

                    if (localMax < 256) {
                        console.log('Max value < 256 for 16-bit J2K. Swapping bytes...');
                        rawDecodedBytes = swapBytes(rawDecodedBytes);
                    }

                    if (pixelRepresentation === 1) {
                        pixelData = new Int16Array(rawDecodedBytes.buffer, rawDecodedBytes.byteOffset, rawDecodedBytes.byteLength / 2);
                    } else {
                        pixelData = new Uint16Array(rawDecodedBytes.buffer, rawDecodedBytes.byteOffset, rawDecodedBytes.byteLength / 2);
                    }

                } else {
                    // Assume uncompressed or fallback
                    if (transferSyntax === '1.2.840.10008.1.2.1' || transferSyntax === '1.2.840.10008.1.2') {
                        const rawData = byteArray.buffer.slice(pixelDataElement.dataOffset, pixelDataElement.dataOffset + safeLength);
                        if (pixelRepresentation === 1) {
                            pixelData = new Int16Array(rawData);
                        } else {
                            pixelData = new Uint16Array(rawData);
                        }
                    } else {
                        // Attempt J2K fallback
                        let j2kStart = 0;
                        for (let i = 0; i < 4000 && i < rawPixelData.length - 1; i++) {
                            if (rawPixelData[i] === 0xFF && rawPixelData[i + 1] === 0x4F) {
                                j2kStart = i;
                                break;
                            }
                        }
                        const j2kData = rawPixelData.slice(j2kStart);
                        const decoded = await decodeJ2K(j2kData.buffer);

                        let rawDecodedBytes = new Uint8Array(decoded.decodedBuffer);
                        let tempView = new Uint16Array(rawDecodedBytes.buffer, rawDecodedBytes.byteOffset, rawDecodedBytes.byteLength / 2);
                        let localMax = 0;
                        for (let i = 0; i < tempView.length; i += 500) {
                            if (tempView[i] > localMax) localMax = tempView[i];
                        }

                        if (localMax < 256) {
                            console.log('Max value < 256 for 16-bit J2K (fallback). Swapping bytes...');
                            rawDecodedBytes = swapBytes(rawDecodedBytes);
                        }

                        if (pixelRepresentation === 1) {
                            pixelData = new Int16Array(rawDecodedBytes.buffer, rawDecodedBytes.byteOffset, rawDecodedBytes.byteLength / 2);
                        } else {
                            pixelData = new Uint16Array(rawDecodedBytes.buffer, rawDecodedBytes.byteOffset, rawDecodedBytes.byteLength / 2);
                        }
                    }
                }

                if (!mounted) return;

                // Debug Pixel Values post-process
                let min = pixelData[0], max = pixelData[0];
                for (let i = 0; i < pixelData.length; i += 100) { // Sample
                    if (pixelData[i] < min) min = pixelData[i];
                    if (pixelData[i] > max) max = pixelData[i];
                }
                console.log('Pixel Data Stats (Final):', { min, max, length: pixelData.length, winCenter, winWidth, slope, intercept });

                // Step 4: Apply Window/Level
                const rgbaData = applyWindowLevel(
                    pixelData,
                    columns,
                    rows,
                    winCenter,
                    winWidth,
                    slope,
                    intercept
                );

                const renderCanvas = () => {
                    const canvas = canvasRef.current;
                    if (canvas) {
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            canvas.width = columns;
                            canvas.height = rows;
                            const imageData = new ImageData(rgbaData, columns, rows);
                            ctx.putImageData(imageData, 0, 0);
                        }
                    }
                };

                renderCanvas(); setIsLoading(false);

            } catch (err) {
                console.error('Error rendering DICOM:', err);
                if (mounted) {
                    setError(err instanceof Error ? err.message : 'Unknown error rendering DICOM');
                    setIsLoading(false);
                }
            }
        };

        renderImage();

        return () => {
            mounted = false;
        };
    }, [currentImageIndex, sortedInstances]);

    // Handle mouse wheel scrolling
    const handleWheel = useCallback((event: WheelEvent) => {
        event.preventDefault();
        if (sortedInstances.length <= 1) return;

        const delta = event.deltaY > 0 ? 1 : -1;
        setCurrentImageIndex(prev => {
            const newIndex = Math.max(0, Math.min(prev + delta, sortedInstances.length - 1));
            return newIndex;
        });
    }, [sortedInstances.length]);

    // Attach wheel event listener to canvas wrapper
    useEffect(() => {
        const element = canvasRef.current?.parentElement;
        if (!element) return;

        element.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            element.removeEventListener('wheel', handleWheel);
        };
    }, [handleWheel]);


    if (instances.length === 0) {
        return (
            <div className={`flex items-center justify-center bg-black text-gray-400 ${className}`}>
                <p>No images available for this series</p>
            </div>
        );
    }

    return (
        <div className={`relative bg-black flex items-center justify-center overflow-hidden ${className}`}>

            {/* Canvas for rendering */}
            <div className="w-full h-full flex items-center justify-center">
                <canvas ref={canvasRef} className="max-w-full max-h-full object-contain" />
            </div>

            {/* Loading overlay */}
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                        <p className="text-gray-300 text-sm">Rendering DICOM...</p>
                    </div>
                </div>
            )}

            {/* Error overlay */}
            {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                    <div className="text-center">
                        <p className="text-red-400 mb-2">Error rendering image</p>
                        <p className="text-gray-500 text-sm max-w-md break-all px-4">{error}</p>
                    </div>
                </div>
            )}

            {/* Image index indicator */}
            {!error && sortedInstances.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 px-4 py-2 rounded-lg pointer-events-none">
                    <p className="text-white text-sm font-mono">
                        Image {currentImageIndex + 1} / {sortedInstances.length}
                    </p>
                </div>
            )}

            {/* Scroll hint - only show briefly or handled by UI state? keeping simple for now */}
            {!isLoading && !error && sortedInstances.length > 1 && (
                <div className="absolute top-4 right-4 bg-black/70 px-3 py-1.5 rounded text-xs text-gray-400 pointer-events-none">
                    Scroll to navigate
                </div>
            )}
        </div>
    );
}

export default DicomViewer;

