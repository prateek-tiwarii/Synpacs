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
import type { Patient } from '@/components/patient/PatientDetailsModal';
import { Loader2, AlertCircle, AlertTriangle, Info } from 'lucide-react';

interface MessageDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    patient: Patient | null;
    onSuccess?: () => void;
}

type FlagType = 'error' | 'warning' | 'info';

const MessageDialog = ({
    open,
    onOpenChange,
    patient,
    onSuccess,
}: MessageDialogProps) => {
    const [message, setMessage] = useState('');
    const [messageFlag, setMessageFlag] = useState<FlagType>('info');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSendMessage = async () => {
        if (!message.trim()) {
            setError('Please enter a note');
            return;
        }

        if (!patient?._id) {
            setError('No patient selected');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            await apiService.createPatientNote(patient._id, {
                note: message,
                flag_type: messageFlag,
            });

            setMessage('');
            setMessageFlag('info');
            onOpenChange(false);
            onSuccess?.();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add note');
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = (open: boolean) => {
        if (!isLoading) {
            if (!open) {
                setMessage('');
                setMessageFlag('info');
                setError(null);
            }
            onOpenChange(open);
        }
    };

    const flags: { type: FlagType; label: string; icon: React.ReactNode; activeClass: string }[] = [
        { 
            type: 'error', 
            label: 'Urgent', 
            icon: <AlertCircle className="w-3.5 h-3.5" />,
            activeClass: 'bg-red-500 text-white border-red-500'
        },
        { 
            type: 'warning', 
            label: 'Warning', 
            icon: <AlertTriangle className="w-3.5 h-3.5" />,
            activeClass: 'bg-amber-500 text-white border-amber-500'
        },
        { 
            type: 'info', 
            label: 'Info', 
            icon: <Info className="w-3.5 h-3.5" />,
            activeClass: 'bg-blue-500 text-white border-blue-500'
        },
    ];

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[480px] bg-white p-0 gap-0">
                <DialogHeader className="px-4 py-3 border-b border-gray-100">
                    <DialogTitle className="text-base font-semibold text-gray-900">
                        Add Note
                        {patient && (
                            <span className="font-normal text-gray-500 ml-2 text-sm">
                                — {patient.name}
                            </span>
                        )}
                    </DialogTitle>
                </DialogHeader>

                <div className="px-4 py-3 space-y-3">
                    <Textarea
                        placeholder="Enter clinical notes..."
                        value={message}
                        onChange={(e) => {
                            setMessage(e.target.value);
                            if (error) setError(null);
                        }}
                        disabled={isLoading}
                        className="min-h-[100px] resize-none text-sm border-gray-200 focus:border-gray-300 focus:ring-0"
                    />

                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 mr-1">Priority:</span>
                        {flags.map((flag) => (
                            <button
                                key={flag.type}
                                onClick={() => setMessageFlag(flag.type)}
                                disabled={isLoading}
                                className={`
                                    inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border transition-all
                                    ${messageFlag === flag.type
                                        ? flag.activeClass
                                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                                    }
                                    ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                                `}
                            >
                                {flag.icon}
                                {flag.label}
                            </button>
                        ))}
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
                        onClick={handleSendMessage}
                        disabled={isLoading || !message.trim()}
                        className="bg-gray-900 hover:bg-gray-800 text-white"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                Adding...
                            </>
                        ) : (
                            'Add Note'
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default MessageDialog;
