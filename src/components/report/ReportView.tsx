import { useState, useRef, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
    Printer,
    Save,
    Send,
    FileCheck,
    Eye,
    Download,
    ChevronDown,
    ChevronRight,
    FileText,
    FolderOpen,
    Search,
    Upload,
    Clock,
    History,
    Loader2,
} from 'lucide-react';
import { ReportEditor } from './ReportEditor';
import type { ReportEditorRef } from './ReportEditor';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useReportContext } from '@/components/ReportLayout';
import { apiService } from '@/lib/api';
import toast from 'react-hot-toast';

interface PatientInfo {
    patientName: string;
    patientId: string;
    age: string;
    sex: string;
    accessionNo: string;
    scanDateTime: string;
    reportDateTime: string;
    serviceName: string;
    referredBy: string;
}

interface Template {
    id: string;
    name: string;
    content: string;
}

interface TemplateCategory {
    id: string;
    name: string;
    templates: Template[];
}

// Sample template data
const TEMPLATE_CATEGORIES: TemplateCategory[] = [
    {
        id: 'ct-scans',
        name: 'CT Scans',
        templates: [
            { id: 'ct-head', name: 'CT Head Without Contrast', content: 'CT HEAD WITHOUT CONTRAST\n\nINVESTIGATION:\nNCCT _____ HEAD\n\nTECHNIQUE:\nNoncontrast MDCT scan of the _____ head was studied. This was followed by multiplanar reconstructions.\n\nCLINICAL INDICATIONS:\n\nPRIOR IMAGING:\n\nFINDINGS:\nThe study shows normal cortical outline, trabecular pattern and attenuation of medullary contents.\n\nIMPRESSION:\nCT imaging reveals no significant abnormality.\n\nADVICE:\nClinical / lab parameter correlation.' },
            { id: 'ct-chest', name: 'CT Chest', content: 'CT CHEST\n\nINVESTIGATION:\nCT Chest with/without contrast\n\nTECHNIQUE:\nAxial sections of the chest were obtained.\n\nFINDINGS:\n\nIMPRESSION:\n\nADVICE:' },
            { id: 'ct-abdomen', name: 'CT Abdomen/Pelvis', content: 'CT ABDOMEN AND PELVIS\n\nINVESTIGATION:\nCT Abdomen and Pelvis\n\nTECHNIQUE:\n\nFINDINGS:\n\nIMPRESSION:\n\nADVICE:' },
            { id: 'ncct-thigh', name: 'NCCT Thigh', content: 'CT Report\n\nINVESTIGATION:\nNCCT _____ THIGH\n\nTECHNIQUE:\nNoncontrast MDCT scan of the _____ thigh was studied. This was followed by multiplanar reconstructions.\n\nCLINICAL INDICATIONS:\n\nPRIOR IMAGING:\n\nFINDINGS:\nThe study shows normal cortical outline, trabecular pattern and attenuation of medullary contents in femur.\n\nVisualized hip joint appears normal.\n\nVisualized knee joint grossly appears normal.\n\nNo fracture is seen.\n\nMuscles and soft tissues show normal attenuation.\n\nIMPRESSION:\nCT imaging reveals no significant abnormality.\n\nOn comparison with the previous imaging, dated _____, the present study shows....\n\nADVICE:\nClinical / lab parameter correlation.' },
        ],
    },
    {
        id: 'mri',
        name: 'MRI',
        templates: [
            { id: 'mri-brain', name: 'MRI Brain', content: 'MRI BRAIN\n\nINVESTIGATION:\nMRI Brain with/without contrast\n\nTECHNIQUE:\n\nFINDINGS:\n\nIMPRESSION:\n\nADVICE:' },
            { id: 'mri-spine', name: 'MRI Spine', content: 'MRI SPINE\n\nINVESTIGATION:\nMRI Spine\n\nTECHNIQUE:\n\nFINDINGS:\n\nIMPRESSION:\n\nADVICE:' },
            { id: 'mri-knee', name: 'MRI Knee', content: 'MRI KNEE\n\nINVESTIGATION:\nMRI Knee\n\nTECHNIQUE:\n\nFINDINGS:\n\nIMPRESSION:\n\nADVICE:' },
        ],
    },
    {
        id: 'xray',
        name: 'X-Ray',
        templates: [
            { id: 'xray-chest', name: 'Chest X-Ray', content: 'CHEST X-RAY\n\nINVESTIGATION:\nChest X-Ray PA View\n\nFINDINGS:\n\nIMPRESSION:\n\nADVICE:' },
            { id: 'xray-abdomen', name: 'Abdominal X-Ray', content: 'ABDOMINAL X-RAY\n\nINVESTIGATION:\nAbdominal X-Ray\n\nFINDINGS:\n\nIMPRESSION:\n\nADVICE:' },
        ],
    },
    {
        id: 'ultrasound',
        name: 'Ultrasound',
        templates: [
            { id: 'usg-abdomen', name: 'USG Abdomen', content: 'USG ABDOMEN\n\nINVESTIGATION:\nUltrasound Abdomen\n\nFINDINGS:\n\nIMPRESSION:\n\nADVICE:' },
            { id: 'usg-pelvis', name: 'USG Pelvis', content: 'USG PELVIS\n\nINVESTIGATION:\nUltrasound Pelvis\n\nFINDINGS:\n\nIMPRESSION:\n\nADVICE:' },
        ],
    },
];

// Sample recent templates - would come from localStorage/API in production
const RECENT_TEMPLATES = [
    { id: 'ct-head', name: 'CT Head Without Contrast' },
    { id: 'mri-brain', name: 'MRI Brain' },
];

// Sample report history - would come from API in production
const REPORT_HISTORY = [
    { id: 'h1', name: 'CT Abdomen Report', date: '2026-01-05', patientName: 'John Doe' },
    { id: 'h2', name: 'MRI Spine Report', date: '2026-01-04', patientName: 'Jane Smith' },
    { id: 'h3', name: 'Chest X-Ray Report', date: '2026-01-03', patientName: 'Mike Johnson' },
];

export function ReportView() {
    const { caseData } = useReportContext();
    const editorRef = useRef<ReportEditorRef>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
    const [currentContent, setCurrentContent] = useState('');
    const [isDraft, setIsDraft] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['ct-scans']));
    const [activeSection, setActiveSection] = useState<'templates' | 'recent' | 'history'>('templates');
    const [isSaving, setIsSaving] = useState(false);
    const [savedReportId, setSavedReportId] = useState<string | null>(null);

    // Helper function to format date
    const formatDateTime = (dateStr: string, timeStr?: string) => {
        if (!dateStr) return 'N/A';
        try {
            const date = new Date(dateStr);
            const formattedDate = date.toLocaleDateString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            }).replace(/\//g, '-');
            if (timeStr) {
                return `${formattedDate} ${timeStr}`;
            }
            return formattedDate;
        } catch {
            return dateStr;
        }
    };

    // Helper function to calculate age from DOB
    const calculateAge = (dob: string) => {
        if (!dob) return 'N/A';
        try {
            const birthDate = new Date(dob);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            return `${age}Y`;
        } catch {
            return 'N/A';
        }
    };

    // Dynamic patient info from context
    const patientInfo: PatientInfo = useMemo(() => ({
        patientName: caseData?.patient?.name || 'N/A',
        patientId: caseData?.patient?.patient_id || 'N/A',
        age: calculateAge(caseData?.patient?.date_of_birth || ''),
        sex: caseData?.patient?.sex || 'N/A',
        accessionNo: caseData?.accession_number || 'N/A',
        scanDateTime: formatDateTime(caseData?.study_date || '', caseData?.study_time),
        reportDateTime: formatDateTime(new Date().toISOString()),
        serviceName: caseData?.description || caseData?.body_part || 'N/A',
        referredBy: caseData?.assigned_to?.full_name || 'N/A',
    }), [caseData]);

    const toggleCategory = (categoryId: string) => {
        const newExpanded = new Set(expandedCategories);
        if (newExpanded.has(categoryId)) {
            newExpanded.delete(categoryId);
        } else {
            newExpanded.add(categoryId);
        }
        setExpandedCategories(newExpanded);
    };

    const filteredCategories = TEMPLATE_CATEGORIES.map(category => ({
        ...category,
        templates: category.templates.filter(
            template => template.name.toLowerCase().includes(searchQuery.toLowerCase())
        ),
    })).filter(category => category.templates.length > 0);

    const handleTemplateSelect = useCallback((template: Template) => {
        setSelectedTemplateId(template.id);
        editorRef.current?.setContent(template.content);
        setIsDraft(true);
    }, []);

    const handleContentChange = useCallback((content: string) => {
        setCurrentContent(content);
        setIsDraft(true);
    }, []);

    const handleSaveDraft = useCallback(async () => {
        if (!caseData) {
            toast.error('Case data not available');
            return;
        }

        setIsSaving(true);
        try {
            const editorState = editorRef.current?.getEditorState();
            const html = editorRef.current?.getHtml();

            if (!editorState) {
                toast.error('No content to save');
                setIsSaving(false);
                return;
            }

            // Extract plain text from content
            const plainText = extractPlainText(editorState);

            // Helper to check if template_id is a valid ObjectId (24 hex chars)
            const isValidObjectId = (id: string | null) => {
                return id && /^[0-9a-fA-F]{24}$/.test(id);
            };

            const reportData: any = {
                case_id: caseData._id,
                study_uid: caseData.study_uid,
                patient_id: caseData.patient_id,
                assigned_to: caseData.assigned_to?._id || caseData.assigned_to,
                hospital_id: caseData.hospital_id,
                content: editorState,
                content_html: html || '',
                content_plain_text: plainText,
                title: patientInfo.serviceName || 'Medical Report',
                impression: '',
            };

            // Only include template_id if it's a valid ObjectId
            if (selectedTemplateId && isValidObjectId(selectedTemplateId)) {
                reportData.template_id = selectedTemplateId;
            }

            let response: any;
            if (savedReportId) {
                // Update existing report
                response = await apiService.updateReport(savedReportId, {
                    content: reportData.content,
                    content_html: reportData.content_html,
                    content_plain_text: reportData.content_plain_text,
                    is_draft: true,
                });
            } else {
                // Create new report
                response = await apiService.createReport(reportData);
                if (response.success && response.data?._id) {
                    setSavedReportId(response.data._id);
                }
            }

            if (response.success) {
                setIsDraft(false);
                toast.success('Draft saved successfully');
            } else {
                toast.error(response.message || 'Failed to save draft');
            }
        } catch (error: any) {
            console.error('Error saving draft:', error);
            toast.error(error.message || 'Failed to save draft');
        } finally {
            setIsSaving(false);
        }
    }, [caseData, patientInfo.serviceName, selectedTemplateId, savedReportId]);

    // Helper function to extract plain text from Lexical state
    const extractPlainText = (content: any): string => {
        const texts: string[] = [];
        
        function traverse(node: any) {
            if (node.text) {
                texts.push(node.text);
            }
            if (node.children) {
                node.children.forEach(traverse);
            }
        }
        
        if (content?.root) {
            traverse(content.root);
        }
        return texts.join(' ');
    };

    const handlePrint = useCallback(() => {
        const html = editorRef.current?.getHtml();
        if (html) {
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Report</title>
                        <style>
                            body { font-family: 'Times New Roman', serif; padding: 40px; }
                            @media print { body { padding: 20px; } }
                        </style>
                    </head>
                    <body>${html}</body>
                    </html>
                `);
                printWindow.document.close();
                printWindow.print();
            }
        }
    }, [patientInfo.patientName]);

    const handleSignOff = useCallback(async () => {
        if (!caseData) {
            toast.error('Case data not available');
            return;
        }

        if (!savedReportId) {
            toast.error('Please save the draft before signing off');
            return;
        }

        setIsSaving(true);
        try {
            const editorState = editorRef.current?.getEditorState();
            const html = editorRef.current?.getHtml();

            if (!editorState) {
                toast.error('No content to sign off');
                return;
            }

            const plainText = extractPlainText(editorState);

            const response: any = await apiService.updateReport(savedReportId, {
                content: editorState,
                content_html: html || '',
                content_plain_text: plainText,
                is_draft: false,
                is_signed_off: true,
            });

            if (response.success) {
                setIsDraft(false);
                toast.success('Report signed off successfully');
            } else {
                toast.error(response.message || 'Failed to sign off report');
            }
        } catch (error: any) {
            console.error('Error signing off report:', error);
            toast.error(error.message || 'Failed to sign off report');
        } finally {
            setIsSaving(false);
        }
    }, [caseData, savedReportId]);

    const handleUploadTemplate = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target?.result as string;
                editorRef.current?.setContent(content);
                setSelectedTemplateId(`uploaded-${Date.now()}`);
                setIsDraft(true);
            };
            reader.readAsText(file);
        }
    }, []);

    return (
        <div className="flex h-full bg-slate-100 dark:bg-slate-900">
            {/* Hidden file input for upload */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleUploadTemplate}
                accept=".txt,.doc,.docx,.rtf"
                className="hidden"
            />

            {/* Template Sidebar with Upload, Recent, History */}
            <div className="w-56 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col shadow-sm">
                {/* Sidebar Header with Upload */}
                <div className="p-2 border-b border-slate-200 dark:border-slate-700 bg-linear-to-r from-cyan-600 to-teal-600">
                    <div className="flex items-center justify-between mb-1.5">
                        <h3 className="text-xs font-semibold text-white">Templates</h3>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 px-2 text-[10px] text-white hover:bg-white/20 hover:text-white"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Upload size={12} className="mr-1" />
                            Upload
                        </Button>
                    </div>
                    <div className="relative">
                        <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                        <Input
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-6 h-7 text-xs bg-white/90 border-0"
                        />
                    </div>
                </div>

                {/* Section Tabs: All | Recent | History */}
                <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                    <button
                        onClick={() => setActiveSection('templates')}
                        className={`flex-1 py-1.5 text-[10px] font-medium flex items-center justify-center gap-0.5 ${activeSection === 'templates' ? 'text-cyan-600 border-b-2 border-cyan-600 bg-white dark:bg-slate-700' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                    >
                        <FileText size={10} />
                        All
                    </button>
                    <button
                        onClick={() => setActiveSection('recent')}
                        className={`flex-1 py-1.5 text-[10px] font-medium flex items-center justify-center gap-0.5 ${activeSection === 'recent' ? 'text-cyan-600 border-b-2 border-cyan-600 bg-white dark:bg-slate-700' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                    >
                        <Clock size={10} />
                        Recent
                    </button>
                    <button
                        onClick={() => setActiveSection('history')}
                        className={`flex-1 py-1.5 text-[10px] font-medium flex items-center justify-center gap-0.5 ${activeSection === 'history' ? 'text-cyan-600 border-b-2 border-cyan-600 bg-white dark:bg-slate-700' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                    >
                        <History size={10} />
                        History
                    </button>
                </div>

                {/* Content based on active section */}
                <ScrollArea className="flex-1">
                    {/* All Templates */}
                    {activeSection === 'templates' && (
                        <>
                            {filteredCategories.map((category) => (
                                <div key={category.id} className="border-b border-slate-100 dark:border-slate-700">
                                    <button
                                        onClick={() => toggleCategory(category.id)}
                                        className="w-full flex items-center gap-1.5 px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left"
                                    >
                                        {expandedCategories.has(category.id) ? (
                                            <ChevronDown size={12} className="text-slate-400" />
                                        ) : (
                                            <ChevronRight size={12} className="text-slate-400" />
                                        )}
                                        <FolderOpen size={12} className="text-cyan-600" />
                                        <span className="text-xs font-medium flex-1 text-slate-700 dark:text-slate-200">{category.name}</span>
                                        <Badge variant="secondary" className="h-4 text-[10px] px-1">{category.templates.length}</Badge>
                                    </button>
                                    
                                    {expandedCategories.has(category.id) && (
                                        <div className="pb-1">
                                            {category.templates.map((template) => (
                                                <button
                                                    key={template.id}
                                                    onClick={() => handleTemplateSelect(template)}
                                                    className={`w-full flex items-center gap-1.5 px-3 py-1 text-left text-xs transition-colors ml-2 mr-1 rounded ${
                                                        selectedTemplateId === template.id
                                                            ? 'bg-cyan-600 text-white'
                                                            : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                                                    }`}
                                                >
                                                    <FileText size={10} />
                                                    <span className="truncate">{template.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </>
                    )}

                    {/* Recent Templates */}
                    {activeSection === 'recent' && (
                        <div className="p-2">
                            <p className="text-[10px] text-slate-400 px-1 mb-1">Recently used</p>
                            {RECENT_TEMPLATES.map((template) => {
                                const fullTemplate = TEMPLATE_CATEGORIES
                                    .flatMap(c => c.templates)
                                    .find(t => t.id === template.id);
                                return (
                                    <button
                                        key={template.id}
                                        onClick={() => fullTemplate && handleTemplateSelect(fullTemplate)}
                                        className="w-full flex items-center gap-1.5 px-2 py-1.5 text-left text-xs transition-colors rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                                    >
                                        <Clock size={10} className="text-slate-400" />
                                        <span className="truncate">{template.name}</span>
                                    </button>
                                );
                            })}
                            {RECENT_TEMPLATES.length === 0 && (
                                <p className="text-xs text-slate-400 text-center py-4">No recent templates</p>
                            )}
                        </div>
                    )}

                    {/* Report History */}
                    {activeSection === 'history' && (
                        <div className="p-2">
                            <p className="text-[10px] text-slate-400 px-1 mb-1">Previous reports</p>
                            {REPORT_HISTORY.map((report) => (
                                <div
                                    key={report.id}
                                    className="flex flex-col gap-0.5 px-2 py-1.5 text-xs transition-colors rounded hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                                >
                                    <div className="flex items-center gap-1.5">
                                        <History size={10} className="text-slate-400 shrink-0" />
                                        <span className="truncate font-medium text-slate-700 dark:text-slate-200">{report.name}</span>
                                    </div>
                                    <div className="pl-4 text-[10px] text-slate-400">
                                        {report.patientName} • {report.date}
                                    </div>
                                </div>
                            ))}
                            {REPORT_HISTORY.length === 0 && (
                                <p className="text-xs text-slate-400 text-center py-4">No report history</p>
                            )}
                        </div>
                    )}
                </ScrollArea>

                {/* Selected Template Indicator */}
                {selectedTemplateId && (
                    <div className="p-2 border-t border-slate-200 dark:border-slate-700 bg-cyan-50 dark:bg-cyan-900/20">
                        <p className="text-[10px] text-cyan-700 dark:text-cyan-300 font-medium">Loaded:</p>
                        <p className="text-xs text-cyan-800 dark:text-cyan-200 truncate">
                            {TEMPLATE_CATEGORIES.flatMap(c => c.templates).find(t => t.id === selectedTemplateId)?.name || 'Uploaded Template'}
                        </p>
                    </div>
                )}
            </div>

            {/* Main Editor Area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Compact Patient Info + Actions Bar */}
                <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="flex items-stretch">
                        {/* Patient Info - Left */}
                        <div className="flex-1 flex items-center px-3 py-2 gap-6 border-r border-slate-200 dark:border-slate-700">
                            <div className="flex items-center gap-4">
                                <div>
                                    <span className="text-[10px] text-slate-400 uppercase">Patient</span>
                                    <p className="text-sm font-semibold text-cyan-700 dark:text-cyan-400">{patientInfo.patientName}</p>
                                </div>
                                <div className="h-8 w-px bg-slate-200 dark:bg-slate-600" />
                                <div className="grid grid-cols-3 gap-x-6 gap-y-0.5 text-xs">
                                    <div><span className="text-slate-400">ID:</span> <span className="text-slate-700 dark:text-slate-200">{patientInfo.patientId}</span></div>
                                    <div><span className="text-slate-400">Age/Sex:</span> <span className="text-slate-700 dark:text-slate-200">{patientInfo.age} / {patientInfo.sex}</span></div>
                                    <div><span className="text-slate-400">Acc:</span> <span className="text-slate-700 dark:text-slate-200">{patientInfo.accessionNo}</span></div>
                                    <div><span className="text-slate-400">Service:</span> <span className="text-slate-700 dark:text-slate-200">{patientInfo.serviceName}</span></div>
                                    <div><span className="text-slate-400">Scan:</span> <span className="text-slate-700 dark:text-slate-200">{patientInfo.scanDateTime}</span></div>
                                    <div><span className="text-slate-400">Ref:</span> <span className="text-cyan-600">{patientInfo.referredBy}</span></div>
                                </div>
                            </div>
                        </div>

                        {/* Actions - Right */}
                        <div className="flex items-center gap-1 px-2">
                            <Button variant="ghost" size="sm" onClick={handlePrint} disabled={isSaving} className="h-7 px-2 text-xs text-slate-600 hover:text-slate-800 hover:bg-slate-100">
                                <Printer size={14} />
                            </Button>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={handleSaveDraft} 
                                disabled={isSaving}
                                className="h-7 px-2 text-xs text-slate-600 hover:text-slate-800 hover:bg-slate-100"
                            >
                                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            </Button>
                            <Button variant="ghost" size="sm" disabled={isSaving} className="h-7 px-2 text-xs text-slate-600 hover:text-slate-800 hover:bg-slate-100">
                                <Download size={14} />
                            </Button>
                            <div className="h-6 w-px bg-slate-300 mx-1" />
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={handleSaveDraft}
                                disabled={isSaving}
                                className="h-7 px-2 text-xs border-slate-300 text-slate-700 hover:bg-slate-100"
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 size={14} className="mr-1 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <FileCheck size={14} className="mr-1" />
                                        Draft
                                    </>
                                )}
                            </Button>
                            <Button variant="outline" size="sm" className="h-7 px-2 text-xs border-slate-300 text-slate-700 hover:bg-slate-100">
                                <Eye size={14} className="mr-1" />
                                Reviewed
                            </Button>
                            <Button 
                                size="sm" 
                                onClick={handleSignOff} 
                                disabled={isSaving || !savedReportId}
                                className="h-7 px-3 text-xs text-white bg-linear-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 size={14} className="mr-1 animate-spin" />
                                        Signing...
                                    </>
                                ) : (
                                    <>
                                        <Send size={14} className="mr-1" />
                                        Sign Off
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Editor - Maximum Space */}
                <div className="flex-1 min-h-0 bg-slate-200 dark:bg-slate-900">
                    <ReportEditor
                        ref={editorRef}
                        onChange={handleContentChange}
                        placeholder="Select a template or start typing your report..."
                    />
                </div>

                {/* Minimal Footer */}
                <div className="flex items-center justify-between px-3 py-1 bg-slate-100 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 text-[10px] text-slate-500">
                    <div className="flex items-center gap-3">
                        <span>Page 1/1</span>
                        <span>Words: {currentContent.split(/\s+/).filter(Boolean).length}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Badge variant={isDraft ? 'secondary' : 'default'} className="h-4 text-[10px]">
                            {isDraft ? 'Draft' : 'Saved'}
                        </Badge>
                    </div>
                </div>
            </div>
        </div>
    );
}
