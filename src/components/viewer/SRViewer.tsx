import { useEffect, useState } from 'react';
import dicomParser from 'dicom-parser';
import { Loader2, FileText, AlertCircle } from 'lucide-react';
import { getCookie } from '@/lib/cookies';

interface SRInstance {
    instance_uid: string;
    instance_number?: number;
    dicom_url?: string;
}

interface SRViewerProps {
    instances: SRInstance[];
    className?: string;
}

interface TableRow {
    label: string;
    value: string;
    isHeader?: boolean;
}

// DICOM tags
const TAGS = {
    PatientName: 'x00100010',
    PatientID: 'x00100020',
    StudyDate: 'x00080020',
    StudyDescription: 'x00081030',
    SeriesDescription: 'x0008103e',
    InstitutionName: 'x00080080',
    Manufacturer: 'x00080070',
    ManufacturerModel: 'x00081090',
    StationName: 'x00081010',
    ContentDate: 'x00080023',
    ContentTime: 'x00080033',
    CompletionFlag: 'x0040a491',
    VerificationFlag: 'x0040a493',
    ContentSequence: 'x0040a730',
    ConceptNameCodeSequence: 'x0040a043',
    ConceptCodeSequence: 'x0040a168',
    ValueType: 'x0040a040',
    TextValue: 'x0040a160',
    NumericValue: 'x0040a30a',
    MeasuredValueSequence: 'x0040a300',
    CodeMeaning: 'x00080104',
    MeasurementUnitsCodeSequence: 'x004008ea',
};

function extractAllContent(dataSet: dicomParser.DataSet, rows: TableRow[], depth: number = 0): void {
    if (depth > 10) return;

    const contentSeq = dataSet.elements[TAGS.ContentSequence];
    if (!contentSeq?.items) return;

    for (const item of contentSeq.items) {
        if (!item.dataSet) continue;

        const valueType = item.dataSet.string(TAGS.ValueType) || '';

        let name = '';
        const nameSeq = item.dataSet.elements[TAGS.ConceptNameCodeSequence];
        if (nameSeq?.items?.[0]?.dataSet) {
            name = nameSeq.items[0].dataSet.string(TAGS.CodeMeaning) || '';
        }

        if (!name) continue;

        let value = '';

        switch (valueType) {
            case 'TEXT':
                value = item.dataSet.string(TAGS.TextValue) || '';
                break;
            case 'CODE': {
                const codeSeq = item.dataSet.elements[TAGS.ConceptCodeSequence];
                value = codeSeq?.items?.[0]?.dataSet?.string(TAGS.CodeMeaning) || '';
                break;
            }
            case 'NUM': {
                const measuredSeq = item.dataSet.elements[TAGS.MeasuredValueSequence];
                if (measuredSeq?.items?.[0]?.dataSet) {
                    const numVal = measuredSeq.items[0].dataSet.string(TAGS.NumericValue) || '';
                    const unitSeq = measuredSeq.items[0].dataSet.elements[TAGS.MeasurementUnitsCodeSequence];
                    const unit = unitSeq?.items?.[0]?.dataSet?.string(TAGS.CodeMeaning) || '';
                    value = unit ? `${numVal} ${unit}` : numVal;
                }
                break;
            }
            case 'CONTAINER':
                // Add section header
                rows.push({ label: name, value: '', isHeader: true });
                extractAllContent(item.dataSet, rows, depth + 1);
                continue;
        }

        if (value && value.trim()) {
            rows.push({ label: name, value: value.trim() });
        }
    }
}

function formatDate(dateStr?: string): string {
    if (!dateStr || dateStr.length !== 8) return dateStr || '-';
    return `${dateStr.slice(6, 8)}/${dateStr.slice(4, 6)}/${dateStr.slice(0, 4)}`;
}

function formatTime(timeStr?: string): string {
    if (!timeStr || timeStr.length < 6) return timeStr || '-';
    return `${timeStr.slice(0, 2)}:${timeStr.slice(2, 4)}:${timeStr.slice(4, 6)}`;
}

export function SRViewer({ instances, className = '' }: SRViewerProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tableData, setTableData] = useState<TableRow[]>([]);
    const [title, setTitle] = useState('Structured Report');

    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

    useEffect(() => {
        if (instances.length === 0) return;

        let mounted = true;
        const instance = instances[0];

        const loadSRDocument = async () => {
            try {
                setIsLoading(true);
                setError(null);

                const url = `${API_BASE_URL}/api/v1/instances/${instance.instance_uid}/dicom`;
                const response = await fetch(url, {
                    headers: { 'Authorization': `Bearer ${getCookie('jwt')}` },
                });

                if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);

                const arrayBuffer = await response.arrayBuffer();
                if (!mounted) return;

                const byteArray = new Uint8Array(arrayBuffer);
                const dataSet = dicomParser.parseDicom(byteArray);

                const rows: TableRow[] = [];

                // Basic metadata
                const patientName = dataSet.string(TAGS.PatientName)?.replace(/\^/g, ' ').trim();
                const patientID = dataSet.string(TAGS.PatientID);
                const studyDate = dataSet.string(TAGS.StudyDate);
                const institutionName = dataSet.string(TAGS.InstitutionName);
                const manufacturer = dataSet.string(TAGS.Manufacturer);
                const model = dataSet.string(TAGS.ManufacturerModel);
                const seriesDesc = dataSet.string(TAGS.SeriesDescription);
                const contentDate = dataSet.string(TAGS.ContentDate);
                const contentTime = dataSet.string(TAGS.ContentTime);

                const conceptSeq = dataSet.elements[TAGS.ConceptNameCodeSequence];
                const docTitle = conceptSeq?.items?.[0]?.dataSet?.string(TAGS.CodeMeaning);
                if (docTitle) setTitle(docTitle);
                else if (seriesDesc) setTitle(seriesDesc);

                // Metadata section
                rows.push({ label: 'Document Information', value: '', isHeader: true });
                if (patientName) rows.push({ label: 'Patient Name', value: patientName });
                if (patientID) rows.push({ label: 'Patient ID', value: patientID });
                if (institutionName) rows.push({ label: 'Institution', value: institutionName });
                if (studyDate) rows.push({ label: 'Study Date', value: formatDate(studyDate) });
                if (contentDate && contentTime) {
                    rows.push({ label: 'Report Date/Time', value: `${formatDate(contentDate)} ${formatTime(contentTime)}` });
                }

                // Equipment section
                if (manufacturer || model) {
                    rows.push({ label: 'Equipment', value: '', isHeader: true });
                    if (manufacturer) rows.push({ label: 'Manufacturer', value: manufacturer });
                    if (model) rows.push({ label: 'Model', value: model });
                }

                // Structured content
                extractAllContent(dataSet, rows, 0);

                setTableData(rows);

            } catch (err) {
                console.error('Error loading SR:', err);
                if (mounted) setError(err instanceof Error ? err.message : 'Failed to load');
            } finally {
                if (mounted) setIsLoading(false);
            }
        };

        loadSRDocument();
        return () => { mounted = false; };
    }, [instances, API_BASE_URL]);

    if (isLoading) {
        return (
            <div className={`flex items-center justify-center bg-[#0a0a0f] ${className}`}>
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                    <p className="text-gray-500 text-sm">Loading report...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`flex items-center justify-center bg-[#0a0a0f] ${className}`}>
                <div className="text-center">
                    <AlertCircle className="w-10 h-10 text-red-500/80 mx-auto mb-3" />
                    <p className="text-red-400 text-sm">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`overflow-auto bg-[#0a0a0f] ${className}`}>
            <div className="max-w-4xl mx-auto p-8">

                {/* Header */}
                <div className="flex items-center gap-4 mb-8 pb-6 border-b border-gray-800/60">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 flex items-center justify-center border border-blue-500/20">
                        <FileText className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold text-white tracking-tight">{title}</h1>
                        <p className="text-gray-500 text-sm mt-0.5">DICOM Structured Report</p>
                    </div>
                </div>

                {/* Table */}
                {tableData.length > 0 ? (
                    <div className="bg-[#111118] rounded-xl border border-gray-800/60 overflow-hidden">
                        <table className="w-full">
                            <tbody>
                                {tableData.map((row, idx) => (
                                    row.isHeader ? (
                                        <tr key={idx} className="bg-gray-800/30">
                                            <td
                                                colSpan={2}
                                                className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider"
                                            >
                                                {row.label}
                                            </td>
                                        </tr>
                                    ) : (
                                        <tr
                                            key={idx}
                                            className="border-t border-gray-800/40 hover:bg-gray-800/20 transition-colors"
                                        >
                                            <td className="px-5 py-3.5 text-sm text-gray-400 w-[200px] align-top">
                                                {row.label}
                                            </td>
                                            <td className="px-5 py-3.5 text-sm text-gray-100">
                                                {row.value}
                                            </td>
                                        </tr>
                                    )
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="bg-[#111118] rounded-xl border border-gray-800/60 p-12 text-center">
                        <FileText className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                        <p className="text-gray-500">No structured content found</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default SRViewer;
