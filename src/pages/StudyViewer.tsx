import { useParams } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { useViewerContext } from '@/components/ViewerLayout';
import { getCookie } from '@/lib/cookies';
import DicomViewer from '@/components/viewer/DicomViewer';
import { Loader2 } from 'lucide-react';

// Instance interface matching the ACTUAL API response
interface Instance {
    instance_uid: string;
    imageId: string;
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

interface InstancesResponse {
    seriesId: string;
    count: number;
    instances: Instance[];
}

const StudyViewer = () => {
    useParams(); // Keep hook call for routing context
    const { caseData, selectedSeries } = useViewerContext();
    const [instances, setInstances] = useState<Instance[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

    const fetchInstances = useCallback(async () => {
        if (!selectedSeries?._id) {
            setInstances([]);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/series/${selectedSeries._id}/instances`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getCookie('jwt')}`,
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch instances: ${response.statusText}`);
            }

            const data: InstancesResponse = await response.json();
            console.log('Fetched instances:', data);

            if (Array.isArray(data.instances)) {
                setInstances(data.instances);
            } else {
                console.warn('Unexpected response format:', data);
                setInstances([]);
            }
        } catch (err) {
            console.error('Error fetching instances:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch instances');
            setInstances([]);
        } finally {
            setIsLoading(false);
        }
    }, [selectedSeries?._id, API_BASE_URL]);

    useEffect(() => {
        fetchInstances();
    }, [fetchInstances]);

    console.log('instances', instances);



    if (isLoading) {
        return (
            <div
                className="flex-1 flex items-center justify-center bg-black"
            >
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                    <p className="text-gray-400 text-sm">Loading series images...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div
                className="flex-1 flex items-center justify-center bg-black"
            >
                <div className="text-center">
                    <p className="text-red-400 mb-2">Error loading images</p>
                    <p className="text-gray-500 text-sm">{error}</p>
                    <button
                        onClick={fetchInstances}
                        className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (!selectedSeries) {
        return (
            <div
                className="flex-1 flex items-center justify-center bg-black"
            >
                <p className="text-gray-400">Select a series from the sidebar to view images</p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-black h-full">
            {/* Series info header */}
            <div className="flex items-center justify-between px-4 py-2 bg-gray-900/50 border-b border-gray-800">
                <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-400">
                        Series {selectedSeries.series_number}: {selectedSeries.description || 'No description'}
                    </span>
                    <span className="text-xs text-gray-500">
                        {selectedSeries.modality} • {instances.length} images
                    </span>
                </div>
                {caseData && (
                    <span className="text-xs text-gray-500">
                        {caseData.patient?.name} • {caseData.accession_number}
                    </span>
                )}
            </div>

            {/* DICOM Viewer */}
            <DicomViewer
                instances={instances || []}
                className="flex-1"
            />
        </div>
    );
};

export default StudyViewer;
