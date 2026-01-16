import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Download, FileArchive, Folder, Loader2, XCircle } from 'lucide-react';

interface DownloadModalProps {
  open: boolean;
  onClose: () => void;
  caseId: string;
  caseName?: string;
}

type DownloadStep = 'preparing' | 'downloading' | 'complete' | 'error';

const DownloadModal = ({ open, onClose, caseId, caseName = 'Study' }: DownloadModalProps) => {
  const [currentStep, setCurrentStep] = useState<DownloadStep>('preparing');
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  const startDownload = async () => {
    try {
      // Step 1: Preparing
      setCurrentStep('preparing');
      setProgress(10);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 2: Downloading
      setCurrentStep('downloading');
      
      // Simulate progressive download
      for (let i = 20; i <= 90; i += 10) {
        setProgress(i);
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // TODO: Replace with actual API call using caseId
      // const response = await apiService.downloadCaseFiles(caseId);
      console.log('Downloading case:', caseId); // Using caseId
      
      // Step 3: Complete
      setProgress(100);
      setCurrentStep('complete');

    } catch (error: any) {
      setCurrentStep('error');
      setErrorMessage(error.message || 'Failed to download files');
    }
  };

  const handleClose = () => {
    if (currentStep !== 'downloading') {
      setCurrentStep('preparing');
      setProgress(0);
      setErrorMessage('');
      onClose();
    }
  };

  const getStepIcon = (step: DownloadStep) => {
    switch (step) {
      case 'preparing':
        return <Folder className="w-8 h-8 text-blue-500 animate-pulse" />;
      case 'downloading':
        return <Download className="w-8 h-8 text-blue-500 animate-bounce" />;
      case 'complete':
        return <CheckCircle2 className="w-8 h-8 text-green-500" />;
      case 'error':
        return <XCircle className="w-8 h-8 text-red-500" />;
    }
  };

  const getStepTitle = (step: DownloadStep) => {
    switch (step) {
      case 'preparing':
        return 'Preparing Download';
      case 'downloading':
        return 'Downloading Files';
      case 'complete':
        return 'Download Complete';
      case 'error':
        return 'Download Failed';
    }
  };

  const getStepDescription = (step: DownloadStep) => {
    switch (step) {
      case 'preparing':
        return 'Gathering DICOM images and metadata...';
      case 'downloading':
        return 'Creating ZIP archive with Mediff format...';
      case 'complete':
        return 'Your files have been downloaded successfully!';
      case 'error':
        return errorMessage || 'An error occurred during download';
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileArchive className="w-5 h-5 text-blue-600" />
            Download {caseName}
          </DialogTitle>
        </DialogHeader>

        <div className="py-6">
          {/* Step Indicator */}
          <div className="flex flex-col items-center gap-4 mb-6">
            {getStepIcon(currentStep)}
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900">
                {getStepTitle(currentStep)}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {getStepDescription(currentStep)}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          {(currentStep === 'preparing' || currentStep === 'downloading') && (
            <div className="mb-6">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-gray-500 text-center mt-2">{progress}%</p>
            </div>
          )}

          {/* Workflow Steps */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Download Workflow:</h4>
            
            <div className={`flex items-start gap-3 ${currentStep === 'preparing' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                currentStep === 'preparing' ? 'bg-blue-100 text-blue-600' : 
                progress > 10 ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'
              }`}>
                {progress > 10 ? '✓' : '1'}
              </div>
              <div>
                <p className="text-sm font-medium">Prepare Files</p>
                <p className="text-xs text-gray-500">Collect DICOM images and metadata</p>
              </div>
            </div>

            <div className={`flex items-start gap-3 ${currentStep === 'downloading' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                currentStep === 'downloading' ? 'bg-blue-100 text-blue-600' : 
                currentStep === 'complete' ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'
              }`}>
                {currentStep === 'complete' ? '✓' : currentStep === 'downloading' ? <Loader2 className="w-3 h-3 animate-spin" /> : '2'}
              </div>
              <div>
                <p className="text-sm font-medium">Create Archive</p>
                <p className="text-xs text-gray-500">Package as Mediff-compatible ZIP</p>
              </div>
            </div>

            <div className={`flex items-start gap-3 ${currentStep === 'complete' ? 'text-green-600' : 'text-gray-400'}`}>
              <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                currentStep === 'complete' ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'
              }`}>
                {currentStep === 'complete' ? '✓' : '3'}
              </div>
              <div>
                <p className="text-sm font-medium">Save to Device</p>
                <p className="text-xs text-gray-500">Download ZIP to your computer</p>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {currentStep === 'error' && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{errorMessage}</p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2">
          {currentStep === 'preparing' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={startDownload} className="bg-blue-600 hover:bg-blue-700">
                <Download className="w-4 h-4 mr-2" />
                Start Download
              </Button>
            </>
          )}

          {currentStep === 'downloading' && (
            <Button disabled className="bg-blue-600">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Downloading...
            </Button>
          )}

          {currentStep === 'complete' && (
            <Button onClick={handleClose} className="bg-green-600 hover:bg-green-700">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Done
            </Button>
          )}

          {currentStep === 'error' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
              <Button onClick={startDownload} className="bg-blue-600 hover:bg-blue-700">
                Retry
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DownloadModal;
