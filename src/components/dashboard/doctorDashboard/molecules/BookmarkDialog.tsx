import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { apiService } from '@/lib/api';
import type { Patient } from '@/components/patient/PacDetailsModal';
import { Loader2, AlertCircle, Bookmark } from 'lucide-react';

interface BookmarkDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    patient: Patient | null;
    onSuccess?: () => void;
}

const BookmarkDialog = ({
    open,
    onOpenChange,
    patient,
    onSuccess,
}: BookmarkDialogProps) => {
    const [note, setNote] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSaveBookmark = async () => {
        if (!patient?._id) {
            setError('No patient selected');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // Bookmark the case — ignore "already bookmarked" since we may just be adding a note
            try {
                await apiService.bookmarkCase(patient._id);
            } catch (bookmarkErr: any) {
                const msg: string = bookmarkErr?.message || '';
                if (!msg.toLowerCase().includes('already bookmarked')) {
                    throw bookmarkErr;
                }
            }

            // If a note was entered, save it as a bookmark note
            if (note.trim()) {
                await apiService.createCaseNote(patient._id, {
                    note: note.trim(),
                    flag_type: 'bookmark_note',
                });
            }

            setNote('');
            onOpenChange(false);
            onSuccess?.();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to bookmark case');
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = (open: boolean) => {
        if (!isLoading) {
            if (!open) {
                setNote('');
                setError(null);
            }
            onOpenChange(open);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-120 bg-white p-0 gap-0">
                <DialogHeader className="px-4 py-3 border-b border-gray-100">
                    <DialogTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
                        <Bookmark className="w-4 h-4" />
                        Bookmark Case
                        {patient && (
                            <span className="font-normal text-gray-500 ml-2 text-sm">
                                — {patient.name}
                            </span>
                        )}
                    </DialogTitle>
                </DialogHeader>

                <div className="px-4 py-3 space-y-3">
                    <div>
                        <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                            Notes/Comments (Optional)
                        </label>
                        <Textarea
                            placeholder="Add notes or comments about why you're bookmarking this case..."
                            value={note}
                            onChange={(e) => {
                                setNote(e.target.value);
                                if (error) setError(null);
                            }}
                            disabled={isLoading}
                            className="min-h-25 resize-none text-sm border-gray-200 focus:border-gray-300 focus:ring-0"
                        />
                    </div>

                    {error && (
                        <p className="text-xs text-red-600 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {error}
                        </p>
                    )}
                </div>

                <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleClose(false)}
                        disabled={isLoading}
                    >
                        Cancel
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleSaveBookmark}
                        disabled={isLoading}
                        className="bg-gray-900 hover:bg-gray-800 text-white"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                Bookmarking...
                            </>
                        ) : (
                            <>
                                <Bookmark className="w-3.5 h-3.5 mr-1.5" />
                                Save Bookmark
                            </>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default BookmarkDialog;
