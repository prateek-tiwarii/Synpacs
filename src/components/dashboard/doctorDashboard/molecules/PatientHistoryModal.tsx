import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { X, ImageIcon, Maximize2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface PatientHistoryModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    images: string[];
    patientName?: string;
}

const PatientHistoryModal = ({ open, onOpenChange, images, patientName }: PatientHistoryModalProps) => {
    const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col p-6 bg-white">
                    <DialogHeader className="pb-4">
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <ImageIcon className="w-5 h-5 text-blue-500" />
                            Patient History Images
                        </DialogTitle>
                        {patientName && (
                            <DialogDescription>
                                History records for <span className="font-semibold text-gray-900">{patientName}</span>
                            </DialogDescription>
                        )}
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto pr-2">
                        {images && images.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 py-2">
                                {images.map((image, index) => (
                                    <div
                                        key={index}
                                        className="relative aspect-square cursor-pointer group rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-400 transition-all"
                                        onClick={() => setEnlargedImage(image)}
                                    >
                                        <img
                                            src={image}
                                            alt={`History ${index + 1}`}
                                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                        />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 flex items-center justify-center transition-colors">
                                            <Maximize2 className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 text-gray-400 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                                <div className="p-4 bg-gray-100 rounded-full mb-4">
                                    <ImageIcon className="w-8 h-8 opacity-40" />
                                </div>
                                <p className="font-medium text-gray-500">No history images found</p>
                                <p className="text-sm">There are no history records available for this case.</p>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end pt-6">
                        <Button variant="outline" onClick={() => onOpenChange(false)} className="px-6">
                            Close
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Enlarged Image Dialog */}
            <Dialog open={!!enlargedImage} onOpenChange={(open) => !open && setEnlargedImage(null)}>
                <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none shadow-2xl flex items-center justify-center">
                    <button
                        onClick={() => setEnlargedImage(null)}
                        className="absolute top-4 right-4 z-[60] p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all backdrop-blur-sm"
                        aria-label="Close enlarged view"
                    >
                        <X className="w-6 h-6" />
                    </button>
                    {enlargedImage && (
                        <div className="relative w-full h-full flex items-center justify-center p-4">
                            <img
                                src={enlargedImage}
                                alt="Enlarged patient history"
                                className="max-w-full max-h-[90vh] object-contain rounded-sm select-none"
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
};

export default PatientHistoryModal;
