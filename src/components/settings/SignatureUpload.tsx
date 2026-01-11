import React, { useState, useCallback, useRef } from 'react';
import Cropper from 'react-easy-crop';
import type { Area, Point } from 'react-easy-crop';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
    Upload,
    RotateCw,
    Save,
    Loader2,
    PenTool,
    Check,
    ImageIcon
} from 'lucide-react';

interface SignatureUploadProps {
    onSave: (file: File) => Promise<void>;
    existingSignature?: string;
}

// Helper to create image from file
const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
        const image = new Image();
        image.addEventListener('load', () => resolve(image));
        image.addEventListener('error', (error) => reject(error));
        image.crossOrigin = 'anonymous';
        image.src = url;
    });

// Get cropped image as canvas
async function getCroppedImg(
    imageSrc: string,
    pixelCrop: Area,
    rotation = 0,
    removeBackground = false
): Promise<Blob | null> {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) return null;

    const rotRad = (rotation * Math.PI) / 180;

    // Calculate bounding box of the rotated image
    const sin = Math.abs(Math.sin(rotRad));
    const cos = Math.abs(Math.cos(rotRad));
    const newWidth = image.width * cos + image.height * sin;
    const newHeight = image.width * sin + image.height * cos;

    // Set canvas size to accommodate rotated image
    canvas.width = newWidth;
    canvas.height = newHeight;

    // Draw rotated image
    ctx.translate(newWidth / 2, newHeight / 2);
    ctx.rotate(rotRad);
    ctx.translate(-image.width / 2, -image.height / 2);
    ctx.drawImage(image, 0, 0);

    // Get the cropped portion
    const croppedCanvas = document.createElement('canvas');
    const croppedCtx = croppedCanvas.getContext('2d');

    if (!croppedCtx) return null;

    croppedCanvas.width = pixelCrop.width;
    croppedCanvas.height = pixelCrop.height;

    // Calculate crop position offset due to rotation
    const offsetX = (newWidth - image.width) / 2;
    const offsetY = (newHeight - image.height) / 2;

    croppedCtx.drawImage(
        canvas,
        pixelCrop.x + offsetX,
        pixelCrop.y + offsetY,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
    );

    // Remove background if enabled
    if (removeBackground) {
        const imageData = croppedCtx.getImageData(0, 0, pixelCrop.width, pixelCrop.height);
        const data = imageData.data;

        // Threshold for considering a pixel as "white" or light background
        const threshold = 230;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // If pixel is close to white, make it transparent
            if (r > threshold && g > threshold && b > threshold) {
                data[i + 3] = 0; // Set alpha to 0
            }
        }

        croppedCtx.putImageData(imageData, 0, 0);
    }

    return new Promise((resolve) => {
        croppedCanvas.toBlob(
            (blob) => resolve(blob),
            'image/png',
            1
        );
    });
}

const SignatureUpload: React.FC<SignatureUploadProps> = ({ onSave, existingSignature }) => {
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(existingSignature || null);
    const [isSaving, setIsSaving] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.addEventListener('load', () => {
                setImageSrc(reader.result as string);
                setIsEditorOpen(true);
                // Reset editor state
                setCrop({ x: 0, y: 0 });
                setZoom(1);
                setRotation(0);
            });
            reader.readAsDataURL(file);
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.addEventListener('load', () => {
                setImageSrc(reader.result as string);
                setIsEditorOpen(true);
                setCrop({ x: 0, y: 0 });
                setZoom(1);
                setRotation(0);
            });
            reader.readAsDataURL(file);
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    };

    const handleApplyCrop = async () => {
        if (!imageSrc || !croppedAreaPixels) return;

        setIsProcessing(true);
        try {
            const croppedBlob = await getCroppedImg(
                imageSrc,
                croppedAreaPixels,
                rotation,
            );

            if (croppedBlob) {
                const url = URL.createObjectURL(croppedBlob);
                setPreviewUrl(url);
                setIsEditorOpen(false);
            }
        } catch (error) {
            console.error('Error processing image:', error);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSave = async () => {
        if (!previewUrl) return;

        setIsSaving(true);
        try {
            // Convert preview URL back to file
            const response = await fetch(previewUrl);
            const blob = await response.blob();
            const file = new File([blob], 'signature.png', { type: 'image/png' });

            await onSave(file);
        } catch (error) {
            console.error('Error saving signature:', error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card className="border-none shadow-md">
            <CardHeader className="border-b bg-white rounded-t-lg">
                <CardTitle className="flex items-center gap-2">
                    <PenTool className="w-5 h-5" />
                    Digital Signature
                </CardTitle>
                <CardDescription>
                    Upload and customize your signature for medical reports
                </CardDescription>
            </CardHeader>
            <CardContent className="p-6 bg-white rounded-b-lg space-y-6">
                {/* Upload Area */}
                <div>
                    <Label className="text-sm font-medium mb-3 block">Signature Image</Label>
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors"
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                        <Upload className="w-10 h-10 mx-auto text-gray-400 mb-3" />
                        <p className="text-sm text-gray-600 font-medium">
                            Click to upload or drag and drop
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                            PNG, JPG or GIF (recommended: signature on white background)
                        </p>
                    </div>
                </div>

                {/* Preview Section */}
                {previewUrl && (
                    <div className="space-y-4">

                        <div className="border rounded-lg p-4 bg-gray-50">
                            <div className="bg-white rounded border p-4 flex items-center justify-center" style={{ minHeight: '100px' }}>
                                <img
                                    src={previewUrl}
                                    alt="Signature Preview"
                                    className="max-h-24 max-w-full object-contain"
                                    style={{
                                        background: 'repeating-conic-gradient(#f0f0f0 0% 25%, transparent 0% 50%) 50% / 16px 16px'
                                    }}
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-2 text-center">
                                Checkered pattern indicates transparent areas
                            </p>
                        </div>

                        <div className="flex gap-3 justify-end pt-2">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    if (imageSrc) {
                                        setIsEditorOpen(true);
                                    } else {
                                        fileInputRef.current?.click();
                                    }
                                }}
                                className="bg-white"
                            >
                                <ImageIcon className="w-4 h-4 mr-2" />
                                Edit
                            </Button>
                            <Button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="bg-black! text-white! hover:bg-gray-800!"
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4 mr-2" />
                                        Save Signature
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Editor Dialog */}
                <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
                    <DialogContent className="max-w-2xl [&>button]:bg-white! [&>button]:text-gray-600! [&>button]:hover:bg-gray-100!">
                        <DialogHeader>
                            <DialogTitle>Edit Signature</DialogTitle>
                            <DialogDescription>
                                Crop, rotate, and adjust your signature before saving
                            </DialogDescription>
                        </DialogHeader>

                        {imageSrc && (
                            <div className="space-y-6">
                                {/* Cropper */}
                                <div className="relative h-64 bg-gray-100 rounded-lg overflow-hidden">
                                    <Cropper
                                        image={imageSrc}
                                        crop={crop}
                                        zoom={zoom}
                                        rotation={rotation}
                                        aspect={3 / 1}
                                        onCropChange={setCrop}
                                        onCropComplete={onCropComplete}
                                        onZoomChange={setZoom}
                                        cropShape="rect"
                                        showGrid={true}
                                    />
                                </div>

                                {/* Controls */}
                                <div className="space-y-4">
                                    {/* Zoom */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-sm">Zoom</Label>
                                            <span className="text-xs text-gray-500">{zoom.toFixed(1)}x</span>
                                        </div>
                                        <Slider
                                            value={[zoom]}
                                            min={1}
                                            max={3}
                                            step={0.1}
                                            onValueChange={(value) => setZoom(value[0])}
                                            className="w-full"
                                        />
                                    </div>

                                    {/* Rotation */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-sm flex items-center gap-2">
                                                <RotateCw className="w-4 h-4" />
                                                Rotation
                                            </Label>
                                            <span className="text-xs text-gray-500">{rotation}°</span>
                                        </div>
                                        <Slider
                                            value={[rotation]}
                                            min={0}
                                            max={360}
                                            step={1}
                                            onValueChange={(value) => setRotation(value[0])}
                                            className="w-full"
                                        />
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-3 justify-end pt-2 border-t">
                                    <Button
                                        variant="outline"
                                        onClick={() => setIsEditorOpen(false)}
                                        className="bg-white!"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleApplyCrop}
                                        disabled={isProcessing}
                                        className="bg-black! text-white! hover:bg-gray-800!"
                                    >
                                        {isProcessing ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Processing...
                                            </>
                                        ) : (
                                            <>
                                                <Check className="w-4 h-4 mr-2" />
                                                Apply
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
};

export default SignatureUpload;
