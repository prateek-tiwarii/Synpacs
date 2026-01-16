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

type FlagType = 'urgent' | 'routine';

const BookmarkDialog = ({
    open,
    onOpenChange,
    patient,
    onSuccess,
}: BookmarkDialogProps) => {
    const [note, setNote] = useState('');
    const [noteFlag, setNoteFlag] = useState<FlagType>('routine');
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
            // Save the bookmark
            await apiService.bookmarkCase(patient._id);

            // If there's a note, add it as well
            if (note.trim()) {
                await apiService.createCaseNote(patient._id, {
                    note: note,
                    flag_type: noteFlag,
                });
            }

            setNote('');
            setNoteFlag('routine');
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
                setNoteFlag('routine');
                setError(null);
            }
            onOpenChange(open);
        }
    };

    const flags: { type: FlagType; label: string; activeClass: string }[] = [
        {
            type: 'urgent',
            label: 'Urgent',
            activeClass: 'bg-red-600 text-white border-red-600'
        },
        {
            type: 'routine',
            label: 'Routine',
            activeClass: 'bg-gray-600 text-white border-gray-600'
        },
    ];

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
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 mr-1">Category:</span>
                        {flags.map((flag) => (
                            <button
                                key={flag.type}
                                onClick={() => setNoteFlag(flag.type)}
                                disabled={isLoading}
                                className={`
                                    inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border transition-all
                                    ${noteFlag === flag.type
                                        ? flag.activeClass
                                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                                    }
                                    ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                                `}
                            >
                                {flag.label}
                            </button>
                        ))}
                    </div>

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
