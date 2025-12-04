import { Download, FileText, FileImage, File, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import type { Patient, PatientDocument } from '@/components/patient/PatientDetailsModal';

interface DocumentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    patient: Patient | null;
}

const DocumentDialog = ({ open, onOpenChange, patient }: DocumentDialogProps) => {
    const documents = patient?.docs || [];

    const getFileIcon = (title: string) => {
        const extension = title.split('.').pop()?.toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(extension || '')) {
            return <FileImage className="w-5 h-5 text-green-500" />;
        }
        if (extension === 'pdf') {
            return <FileText className="w-5 h-5 text-red-500" />;
        }
        return <File className="w-5 h-5 text-blue-500" />;
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const handleDownload = (doc: PatientDocument) => {
        const url = doc.signed_url || doc.file_url;
        if (url) {
            window.open(url, '_blank');
        }
    };

    const handleView = (doc: PatientDocument) => {
        const url = doc.signed_url || doc.file_url;
        if (url) {
            window.open(url, '_blank');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[650px] bg-white">
                <DialogHeader>
                    <DialogTitle className="text-xl font-semibold">Patient Documents</DialogTitle>
                    {patient && (
                        <DialogDescription>
                            Documents for {patient.name} ({patient.pac_patinet_id})
                        </DialogDescription>
                    )}
                </DialogHeader>
                <div className="py-4">
                    {documents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                            <FileText className="w-12 h-12 mb-3 text-gray-300" />
                            <p className="text-sm font-medium">No documents available</p>
                            <p className="text-xs text-gray-400 mt-1">
                                Documents uploaded for this patient will appear here
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {documents.map((doc) => (
                                <div
                                    key={doc._id}
                                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors"
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        {getFileIcon(doc.title)}
                                        <div className="flex flex-col min-w-0">
                                            <span className="font-medium text-sm text-gray-900 truncate">
                                                {doc.title}
                                            </span>
                                            {doc.description && (
                                                <span className="text-xs text-gray-500 truncate">
                                                    {doc.description}
                                                </span>
                                            )}
                                            <span className="text-xs text-gray-400 mt-0.5">
                                                {formatDate(doc.createdAt)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 ml-3">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleView(doc)}
                                            title="View document"
                                        >
                                            <ExternalLink className="w-4 h-4 text-gray-600" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDownload(doc)}
                                            title="Download document"
                                        >
                                            <Download className="w-4 h-4 text-gray-600" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default DocumentDialog;
