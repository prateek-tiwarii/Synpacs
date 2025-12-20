import { useParams } from "react-router-dom";

const DicomViewer = () => {
    const { id } = useParams();

    return (
        <div className="flex flex-col h-screen bg-gray-900">
            {/* Header */}
            <div className="bg-gray-800 border-b border-gray-700 p-4">
                <h1 className="text-xl font-semibold text-white">DICOM Viewer - Patient ID: {id}</h1>
            </div>

            {/* Viewer Area */}
            <div className="flex-1 flex items-center justify-center p-4">
                <div className="text-gray-400">
                    DICOM viewer will be implemented here
                </div>
            </div>
        </div>
    );
};

export default DicomViewer;
