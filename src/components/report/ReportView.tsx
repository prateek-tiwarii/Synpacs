import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    ChevronLeft,
    ChevronRight,
    FilePlus2,
    Loader2,
    Search,
    X,
} from 'lucide-react';
import { ReportEditor } from './ReportEditor';
import type { ReportEditorRef } from './ReportEditor';
import { useReportContext } from '@/components/ReportLayout';
import { apiService } from '@/lib/api';
import {
    getOpenedReportCases,
    removeOpenedReportCase,
    upsertOpenedReportCase,
    OPENED_REPORT_CASES_STORAGE_KEY,
    type OpenedReportCase,
} from '@/lib/reportWindow';
import { PatientDetailsSection } from './PatientDetailsSection';
import {
    getAllReportTemplates,
    TEMPLATE_MODALITY_OPTIONS,
    type TemplateModality,
    type ReportTemplate,
} from '@/lib/reportTemplates';
import toast from 'react-hot-toast';

type ReportStatus = 'unreported' | 'drafted' | 'signed_off';

interface PatientInfo {
    patientName: string;
    patientId: string;
    age: string;
    sex: string;
    referredBy: string;
    studyDate: string;
    studyDescription: string;
}

interface SignatureBlock {
    doctor_name: string;
    degree?: string;
    registration_number?: string;
    signature_url?: string;
    signed_at?: string;
}

interface AddendumEntry {
    text: string;
    added_at?: string;
}

interface StudyReport {
    localId: string;
    reportId: string | null;
    label: string;
    status: ReportStatus;
    editorState: Record<string, any> | null;
    contentHtml: string;
    contentPlainText: string;
    signatureBlock: SignatureBlock | null;
    addendums: AddendumEntry[];
}

interface ServerReport {
    _id?: string;
    content?: Record<string, any>;
    content_html?: string;
    content_plain_text?: string;
    title?: string;
    reporting_status?: string;
    signature_block?: SignatureBlock;
    addendums?: Array<{ text?: string; added_at?: string }>;
}

const toReportStatus = (status: string | undefined): ReportStatus => {
    if (status === 'signed_off') return 'signed_off';
    if (status === 'drafted') return 'drafted';
    return 'unreported';
};

const toPlainText = (value: string): string => {
    if (!value) return '';
    const maybeHtml = /<\/?[a-z][\s\S]*>/i.test(value);
    if (!maybeHtml || typeof document === 'undefined') return value;
    const temp = document.createElement('div');
    temp.innerHTML = value;
    return (temp.textContent || '').trim();
};

const extractPlainTextFromEditorState = (content: any): string => {
    const texts: string[] = [];

    const traverse = (node: any) => {
        if (!node) return;
        if (typeof node.text === 'string') {
            texts.push(node.text);
        }
        if (Array.isArray(node.children)) {
            node.children.forEach(traverse);
        }
    };

    if (content?.root) {
        traverse(content.root);
    }

    return texts.join(' ').trim();
};

const parseDicomDateTime = (dateStr?: string, timeStr?: string): string => {
    if (!dateStr) return 'N/A';
    if (/^\d{8}$/.test(dateStr)) {
        const year = dateStr.slice(0, 4);
        const month = dateStr.slice(4, 6);
        const day = dateStr.slice(6, 8);
        if (timeStr && /^\d{6}/.test(timeStr)) {
            const hh = timeStr.slice(0, 2);
            const mm = timeStr.slice(2, 4);
            return `${day}-${month}-${year} ${hh}:${mm}`;
        }
        return `${day}-${month}-${year}`;
    }

    try {
        const date = new Date(dateStr);
        if (Number.isNaN(date.getTime())) return dateStr;
        return date.toLocaleDateString('en-GB').replace(/\//g, '-');
    } catch {
        return dateStr;
    }
};

const calculateAge = (dob?: string): string => {
    if (!dob) return 'N/A';
    let birthDate: Date;

    if (/^\d{8}$/.test(dob)) {
        const year = Number(dob.slice(0, 4));
        const month = Number(dob.slice(4, 6)) - 1;
        const day = Number(dob.slice(6, 8));
        birthDate = new Date(year, month, day);
    } else {
        birthDate = new Date(dob);
    }

    if (Number.isNaN(birthDate.getTime())) return 'N/A';
    const now = new Date();
    let age = now.getFullYear() - birthDate.getFullYear();
    const monthDiff = now.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
        age -= 1;
    }
    return `${age}Y`;
};

const buildDraftReport = (index: number): StudyReport => ({
    localId: `local-${Date.now()}-${index}`,
    reportId: null,
    label: `Report ${index + 1}`,
    status: 'unreported',
    editorState: null,
    contentHtml: '',
    contentPlainText: '',
    signatureBlock: null,
    addendums: [],
});

export function ReportView() {
    const { caseData, reportData } = useReportContext();
    const { id: activeCaseId } = useParams();
    const navigate = useNavigate();
    const editorRef = useRef<ReportEditorRef>(null);

    const [openedCases, setOpenedCases] = useState<OpenedReportCase[]>(() => getOpenedReportCases());
    const [studyReports, setStudyReports] = useState<StudyReport[]>([buildDraftReport(0)]);
    const [activeReportIndex, setActiveReportIndex] = useState(0);
    const [isLoadingReports, setIsLoadingReports] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false);
    const [templateSearch, setTemplateSearch] = useState('');
    const [selectedModalities, setSelectedModalities] = useState<TemplateModality[]>([...TEMPLATE_MODALITY_OPTIONS]);
    const [templateStorageVersion, setTemplateStorageVersion] = useState(0);
    const [currentContent, setCurrentContent] = useState('');
    const [isAddendumMode, setIsAddendumMode] = useState(false);
    const [addendumText, setAddendumText] = useState('');

    const studyReportsRef = useRef(studyReports);
    const activeReportIndexRef = useRef(activeReportIndex);
    const isSavingRef = useRef(isSaving);
    const activeCaseIdRef = useRef(activeCaseId);

    useEffect(() => {
        studyReportsRef.current = studyReports;
    }, [studyReports]);

    useEffect(() => {
        activeReportIndexRef.current = activeReportIndex;
    }, [activeReportIndex]);

    useEffect(() => {
        activeCaseIdRef.current = activeCaseId;
    }, [activeCaseId]);

    useEffect(() => {
        isSavingRef.current = isSaving;
    }, [isSaving]);

    useEffect(() => {
        const handleStorage = (event: StorageEvent) => {
            if (!event.key || event.key === OPENED_REPORT_CASES_STORAGE_KEY) {
                setOpenedCases(getOpenedReportCases());
            }
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    // Sync opened cases from storage when current case data loads (same-window updates
    // don't fire storage events, so we must refresh after ReportLayout upserts metadata)
    useEffect(() => {
        if (activeCaseId && caseData?._id === activeCaseId) {
            setOpenedCases(getOpenedReportCases());
        }
    }, [activeCaseId, caseData?._id]);

    // Fill metadata for any tab that was added without it (e.g. via openReportInSingleWindow(caseId) from dashboard)
    const fetchingMetadataForRef = useRef<Set<string>>(new Set());
    useEffect(() => {
        const cases = getOpenedReportCases();
        const needMetadata = cases.filter((c) => !c.patientName || !c.patientId);
        if (needMetadata.length === 0) return;

        const run = async () => {
            for (const opened of needMetadata) {
                if (fetchingMetadataForRef.current.has(opened.caseId)) continue;
                fetchingMetadataForRef.current.add(opened.caseId);
                try {
                    const res = (await apiService.getCaseById(opened.caseId)) as { success?: boolean; data?: { patient?: { name?: string; patient_id?: string; sex?: string }; case_uid?: string; accession_number?: string; description?: string; body_part?: string; modality?: string } };
                    const data = res?.data;
                    if (data) {
                        const patientName = data.patient?.name;
                        const patientId = data.patient?.patient_id;
                        const patientSex = data.patient?.sex;
                        upsertOpenedReportCase({
                            caseId: opened.caseId,
                            caseUid: data.case_uid,
                            patientName,
                            patientId,
                            patientSex,
                            accessionNumber: data.accession_number,
                            description: data.description || data.body_part,
                            modality: data.modality,
                        });
                        setOpenedCases(getOpenedReportCases());
                    }
                } finally {
                    fetchingMetadataForRef.current.delete(opened.caseId);
                }
            }
        };
        run();
    }, [openedCases]);

    useEffect(() => {
        const handleTemplateStorage = (event: StorageEvent) => {
            if (event.key === 'syncpacs_report_user_templates_v1') {
                setTemplateStorageVersion((prev) => prev + 1);
            }
        };
        window.addEventListener('storage', handleTemplateStorage);
        return () => window.removeEventListener('storage', handleTemplateStorage);
    }, []);

    const allTemplates = useMemo(() => getAllReportTemplates(), [templateStorageVersion]);
    const deferredTemplateSearch = useDeferredValue(templateSearch);

    const filteredTemplates = useMemo(() => {
        const query = deferredTemplateSearch.trim().toLowerCase();
        return allTemplates.filter((template) => {
            const matchesModality = selectedModalities.includes(template.modality);
            const matchesSearch = !query || template.name.toLowerCase().includes(query);
            return matchesModality && matchesSearch;
        });
    }, [allTemplates, deferredTemplateSearch, selectedModalities]);

    useEffect(() => {
        const fetchCaseReports = async () => {
            if (!caseData?._id) return;

            setIsLoadingReports(true);
            try {
                const response: any = await apiService.getReportsByCaseAll(caseData._id);
                const reports = Array.isArray(response?.data) ? (response.data as ServerReport[]) : [];

                const mapped = reports.map((report, index) => ({
                    localId: report._id || `server-${index}`,
                    reportId: report._id || null,
                    label: report.title?.trim() || `Report ${index + 1}`,
                    status: toReportStatus(report.reporting_status),
                    editorState: report.content || null,
                    contentHtml: report.content_html || '',
                    contentPlainText:
                        report.content_plain_text ||
                        extractPlainTextFromEditorState(report.content) ||
                        '',
                    signatureBlock: report.signature_block || null,
                    addendums: (report.addendums || [])
                        .map((entry) => ({
                            text: entry.text || '',
                            added_at: entry.added_at,
                        }))
                        .filter((entry) => entry.text.trim().length > 0),
                }));

                if (mapped.length > 0) {
                    setStudyReports(mapped);
                    setActiveReportIndex(0);
                } else if (reportData) {
                    setStudyReports([
                        {
                            localId: reportData._id,
                            reportId: reportData._id,
                            label: reportData.title || 'Report 1',
                            status: toReportStatus((reportData as any).reporting_status),
                            editorState: reportData.content || null,
                            contentHtml: reportData.content_html || '',
                            contentPlainText:
                                reportData.content_plain_text ||
                                extractPlainTextFromEditorState(reportData.content),
                            signatureBlock: (reportData as any).signature_block || null,
                            addendums: (((reportData as any).addendums || []) as Array<{ text?: string; added_at?: string }>)
                                .map((entry) => ({
                                    text: entry.text || '',
                                    added_at: entry.added_at,
                                }))
                                .filter((entry) => entry.text.trim().length > 0),
                        },
                    ]);
                    setActiveReportIndex(0);
                } else {
                    setStudyReports([buildDraftReport(0)]);
                    setActiveReportIndex(0);
                }
            } catch {
                if (reportData) {
                    setStudyReports([
                        {
                            localId: reportData._id,
                            reportId: reportData._id,
                            label: reportData.title || 'Report 1',
                            status: toReportStatus((reportData as any).reporting_status),
                            editorState: reportData.content || null,
                            contentHtml: reportData.content_html || '',
                            contentPlainText:
                                reportData.content_plain_text ||
                                extractPlainTextFromEditorState(reportData.content),
                            signatureBlock: (reportData as any).signature_block || null,
                            addendums: [],
                        },
                    ]);
                    setActiveReportIndex(0);
                } else {
                    setStudyReports([buildDraftReport(0)]);
                    setActiveReportIndex(0);
                }
            } finally {
                setIsLoadingReports(false);
            }
        };

        fetchCaseReports();
    }, [caseData?._id, reportData]);

    const prevActiveReportIndexRef = useRef(activeReportIndex);
    useEffect(() => {
        if (isSavingRef.current) return;
        const activeReport = studyReports[activeReportIndex];
        if (!activeReport || !editorRef.current) return;

        const reportPlain = (activeReport.contentPlainText || '').trim();
        const switchedReport = prevActiveReportIndexRef.current !== activeReportIndex;
        prevActiveReportIndexRef.current = activeReportIndex;

        if (!switchedReport) {
            const currentPlain = (extractPlainTextFromEditorState(editorRef.current.getEditorState()) || '').trim();
            if (currentPlain === reportPlain) {
                setCurrentContent(activeReport.contentPlainText || '');
                return;
            }
        }

        if (activeReport.editorState) {
            try {
                editorRef.current.setEditorState(activeReport.editorState);
            } catch {
                editorRef.current.setContent(activeReport.contentPlainText || '');
            }
        } else {
            editorRef.current.setContent(activeReport.contentPlainText || '');
        }

        setCurrentContent(activeReport.contentPlainText || '');
        setIsAddendumMode(false);
        setAddendumText('');
    }, [activeReportIndex, studyReports]);

    useEffect(() => {
        const intervalId = window.setInterval(async () => {
            if (isSavingRef.current || isAddendumMode) return;
            await saveCurrentReportAsDraft(true);
        }, 8000);

        return () => window.clearInterval(intervalId);
    }, [isAddendumMode, activeReportIndex, studyReports, caseData]);

    const activeReport = studyReports[activeReportIndex];
    const isReported = activeReport?.status === 'signed_off';
    const isEditorReadOnly = Boolean(isReported && !isAddendumMode);

    const patientInfo: PatientInfo = useMemo(() => ({
        patientName: caseData?.patient?.name || 'N/A',
        patientId: caseData?.patient?.patient_id || 'N/A',
        age: calculateAge(caseData?.patient?.dob || caseData?.patient?.date_of_birth),
        sex: caseData?.patient?.sex || 'N/A',
        referredBy: caseData?.assigned_to?.full_name || 'N/A',
        studyDate: parseDicomDateTime(caseData?.case_date, caseData?.case_time),
        studyDescription: caseData?.description || caseData?.body_part || 'N/A',
    }), [caseData]);

    const getEditorSnapshot = () => {
        if (!editorRef.current) return null;
        const editorState = editorRef.current.getEditorState();
        const contentHtml = editorRef.current.getHtml();
        const contentPlainText = extractPlainTextFromEditorState(editorState);
        return {
            editorState,
            contentHtml,
            contentPlainText,
        };
    };

    const saveCurrentReportAsDraft = async (silent: boolean) => {
        if (!caseData || !activeReport) return null;
        if (activeReport.status === 'signed_off' || isAddendumMode) return null;

        const snapshot = getEditorSnapshot();
        if (!snapshot) return null;

        if (!activeReport.reportId && !snapshot.contentPlainText.trim()) {
            return null;
        }

        const caseIdForSave = caseData._id;
        isSavingRef.current = true;
        setIsSaving(true);

        try {
            const assignedToId =
                typeof caseData.assigned_to === 'string'
                    ? caseData.assigned_to
                    : caseData.assigned_to?._id;

            let reportId = activeReport.reportId;
            if (!reportId) {
                const createResponse: any = await apiService.createReport({
                    case_id: caseData._id,
                    patient_id: caseData.patient_id,
                    assigned_to: assignedToId,
                    hospital_id: caseData.hospital_id,
                    content: snapshot.editorState,
                    content_html: snapshot.contentHtml,
                    content_plain_text: snapshot.contentPlainText,
                    title: activeReport.label,
                });
                reportId = createResponse?.data?._id || null;
            } else {
                await apiService.updateReport(reportId, {
                    content: snapshot.editorState,
                    content_html: snapshot.contentHtml,
                    content_plain_text: snapshot.contentPlainText,
                    title: activeReport.label,
                    reporting_status: 'drafted',
                });
            }

            if (activeCaseIdRef.current === caseIdForSave) {
                const freshSnapshot = getEditorSnapshot();
                const contentToStore = freshSnapshot ?? snapshot;
                setStudyReports((prev) =>
                    prev.map((report, index) =>
                        index === activeReportIndexRef.current
                            ? {
                                ...report,
                                reportId,
                                status: 'drafted',
                                editorState: contentToStore.editorState,
                                contentHtml: contentToStore.contentHtml,
                                contentPlainText: contentToStore.contentPlainText,
                            }
                            : report
                    )
                );
            }

            if (!silent) {
                toast.success('Draft saved');
            }
            return reportId;
        } catch (error: any) {
            if (!silent) {
                toast.error(error?.message || 'Failed to save draft');
            }
            return null;
        } finally {
            isSavingRef.current = false;
            setIsSaving(false);
        }
    };

    const advanceAfterCompletion = async () => {
        const reports = studyReportsRef.current;
        const currentIndex = activeReportIndexRef.current;

        const nextReportIndex = reports.findIndex((_, index) => index > currentIndex);
        if (nextReportIndex !== -1) {
            setActiveReportIndex(nextReportIndex);
            return;
        }

        if (!activeCaseId) return;
        const remainingCases = removeOpenedReportCase(activeCaseId);
        setOpenedCases(remainingCases);
        if (remainingCases.length > 0) {
            navigate(`/case/${remainingCases[0].caseId}/report`);
        } else {
            window.close();
        }
    };

    const handleSaveDraftClick = async () => {
        setIsSaving(true);
        try {
            const saved = await saveCurrentReportAsDraft(true);
            if (!saved) {
                toast.error('Nothing to save');
                return;
            }
            await advanceAfterCompletion();
        } finally {
            setIsSaving(false);
        }
    };

    const handleSignOffClick = async () => {
        if (!activeReport || !caseData) return;

        setIsSaving(true);
        try {
            if (isAddendumMode) {
                if (!activeReport.reportId) {
                    toast.error('Cannot add addendum without an existing report');
                    return;
                }
                if (!addendumText.trim()) {
                    toast.error('Addendum text is required');
                    return;
                }

                const addendumResponse: any = await apiService.addAddendum(activeReport.reportId, {
                    addendum_text: addendumText.trim(),
                });

                const updated: ServerReport = addendumResponse?.data || {};
                setStudyReports((prev) =>
                    prev.map((report, index) =>
                        index === activeReportIndexRef.current
                            ? {
                                ...report,
                                status: 'signed_off',
                                contentHtml: updated.content_html || report.contentHtml,
                                contentPlainText: updated.content_plain_text || report.contentPlainText,
                                editorState: updated.content || report.editorState,
                                signatureBlock: updated.signature_block || report.signatureBlock,
                                addendums: (updated.addendums || report.addendums || []).map((entry: any) => ({
                                    text: entry.text || '',
                                    added_at: entry.added_at,
                                })),
                            }
                            : report
                    )
                );
                setIsAddendumMode(false);
                setAddendumText('');
                toast.success('Addendum signed off');
                await advanceAfterCompletion();
                return;
            }

            let reportId = activeReport.reportId;
            if (!reportId) {
                reportId = await saveCurrentReportAsDraft(true);
            } else {
                await saveCurrentReportAsDraft(true);
            }

            if (!reportId) {
                toast.error('Please add report content before sign off');
                return;
            }

            const signOffResponse: any = await apiService.signOffReport(reportId);
            const updated: ServerReport = signOffResponse?.data || {};

            setStudyReports((prev) =>
                prev.map((report, index) =>
                    index === activeReportIndexRef.current
                        ? {
                            ...report,
                            reportId,
                            status: 'signed_off',
                            contentHtml: updated.content_html || report.contentHtml,
                            contentPlainText: updated.content_plain_text || report.contentPlainText,
                            editorState: updated.content || report.editorState,
                            signatureBlock: updated.signature_block || report.signatureBlock,
                            addendums: (updated.addendums || report.addendums || []).map((entry: any) => ({
                                text: entry.text || '',
                                added_at: entry.added_at,
                            })),
                        }
                        : report
                )
            );

            toast.success('Report signed off');
            await advanceAfterCompletion();
        } catch (error: any) {
            toast.error(error?.message || 'Failed to sign off');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSwitchReport = async (nextIndex: number) => {
        if (nextIndex === activeReportIndex) return;
        await saveCurrentReportAsDraft(true);
        setActiveReportIndex(nextIndex);
    };

    const handleTemplateApply = async (template: ReportTemplate) => {
        const hasExistingContent = (editorRef.current?.getContent() || '').trim().length > 0;
        if (hasExistingContent) {
            const shouldProceed = window.confirm(
                'This will overwrite current report content. Do you want to continue?'
            );
            if (!shouldProceed) return;
        }

        await saveCurrentReportAsDraft(true);
        editorRef.current?.setContent(template.content);
        setCurrentContent(template.content);
        toast.success('Template loaded');
    };

    const handleLoadPreviousReport = async (content: string, mode: 'replace' | 'append') => {
        await saveCurrentReportAsDraft(true);

        const incoming = toPlainText(content);
        const existing = editorRef.current?.getContent() || '';
        const nextValue = mode === 'append'
            ? `${existing}\n\n--- Previous Report ---\n${incoming}`
            : incoming;

        editorRef.current?.setContent(nextValue);
        setCurrentContent(nextValue);
        toast.success(mode === 'append' ? 'Previous report appended' : 'Previous report loaded');
    };

    const handleCaseTabClick = async (caseId: string) => {
        if (!caseId || caseId === activeCaseId) return;
        await saveCurrentReportAsDraft(true);
        navigate(`/case/${caseId}/report`);
    };

    const toggleModality = (modality: TemplateModality) => {
        setSelectedModalities((prev) => {
            if (prev.includes(modality)) {
                const next = prev.filter((item) => item !== modality);
                return next.length > 0 ? next : prev;
            }
            return [...prev, modality];
        });
    };

    const toggleLeftPanel = async () => {
        await saveCurrentReportAsDraft(true);
        setIsLeftPanelCollapsed((prev) => !prev);
    };

    const handleAddReport = async () => {
        await saveCurrentReportAsDraft(true);
        setStudyReports((prev) => [...prev, buildDraftReport(prev.length)]);
        setActiveReportIndex(studyReportsRef.current.length);
    };

    const handleAddendumMode = () => {
        if (!activeReport || activeReport.status !== 'signed_off') return;
        setIsAddendumMode(true);
        setAddendumText('');
    };

    return (
        <div className="flex h-full bg-gray-900">
            <div
                className={`${isLeftPanelCollapsed ? 'w-14' : 'w-[360px]'} border-r border-gray-700 bg-gray-800 flex flex-col transition-all`}
            >
                <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
                    {!isLeftPanelCollapsed && <h3 className="text-sm font-semibold text-gray-100">Case Workspace</h3>}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-gray-300 hover:text-white hover:bg-gray-700"
                        onClick={toggleLeftPanel}
                    >
                        {isLeftPanelCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                    </Button>
                </div>

                {isLeftPanelCollapsed ? (
                    <div className="flex-1 flex flex-col items-center gap-3 py-4">
                        <Badge className="bg-gray-700 text-gray-200 text-[10px] px-2 py-0.5">PT</Badge>
                        <Badge className="bg-gray-700 text-gray-200 text-[10px] px-2 py-0.5">TP</Badge>
                        <Badge className="bg-gray-700 text-gray-200 text-[10px] px-2 py-0.5">HX</Badge>
                        <Badge className="bg-gray-700 text-gray-200 text-[10px] px-2 py-0.5">RP</Badge>
                    </div>
                ) : (
                    <ScrollArea className="flex-1 p-3">
                        <PatientDetailsSection
                            patientName={patientInfo.patientName}
                            patientId={patientInfo.patientId}
                            patientLookupId={caseData?.patient_id}
                            age={patientInfo.age}
                            sex={patientInfo.sex}
                            referredBy={patientInfo.referredBy}
                            studyDate={patientInfo.studyDate}
                            studyDescription={patientInfo.studyDescription}
                            modality={caseData?.modality || 'N/A'}
                            onLoadReport={handleLoadPreviousReport}
                        />

                        <div className="mb-4 border border-gray-700 rounded-lg bg-gray-900/60">
                            <div className="px-3 py-2 border-b border-gray-700">
                                <h4 className="text-sm font-semibold text-gray-100">Templates</h4>
                            </div>
                            <div className="p-3 space-y-3">
                                <div className="relative">
                                    <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
                                    <Input
                                        value={templateSearch}
                                        onChange={(e) => setTemplateSearch(e.target.value)}
                                        placeholder="Search templates..."
                                        className="pl-8 h-8 text-xs bg-gray-800 border-gray-600 text-gray-100"
                                    />
                                </div>

                                <div className="flex flex-wrap gap-1.5">
                                    {TEMPLATE_MODALITY_OPTIONS.map((modality) => {
                                        const active = selectedModalities.includes(modality);
                                        return (
                                            <button
                                                key={modality}
                                                onClick={() => toggleModality(modality)}
                                                className={`px-2 py-1 rounded text-[10px] border transition-colors ${active
                                                    ? 'bg-blue-600 border-blue-500 text-white'
                                                    : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'
                                                    }`}
                                            >
                                                {modality}
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="max-h-48 overflow-y-auto space-y-1">
                                    {filteredTemplates.map((template) => (
                                        <button
                                            key={template.id}
                                            onClick={() => handleTemplateApply(template)}
                                            className="w-full text-left px-2 py-1.5 rounded text-xs bg-gray-800 text-gray-200 border border-gray-700 hover:bg-gray-700"
                                        >
                                            <p className="font-medium truncate">{template.name}</p>
                                            <p className="text-[10px] text-gray-400 mt-0.5">{template.modality} • {template.source === 'system' ? 'System' : 'User'}</p>
                                        </button>
                                    ))}
                                    {filteredTemplates.length === 0 && (
                                        <p className="text-xs text-gray-500 py-2 text-center">No templates found</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="mb-4 border border-gray-700 rounded-lg bg-gray-900/60">
                            <div className="px-3 py-2 border-b border-gray-700">
                                <h4 className="text-sm font-semibold text-gray-100">Clinical History</h4>
                            </div>
                            <div className="p-3">
                                {Array.isArray((caseData as any)?.patient_history) && (caseData as any).patient_history.length > 0 ? (
                                    <div className="space-y-1.5">
                                        {(caseData as any).patient_history.map((item: string, index: number) => (
                                            <a
                                                key={`${item}-${index}`}
                                                href={item}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="block text-xs text-blue-300 hover:text-blue-200 underline truncate"
                                            >
                                                History Document {index + 1}
                                            </a>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-500">No clinical history provided by center.</p>
                                )}
                            </div>
                        </div>

                        <Button
                            onClick={handleAddReport}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs"
                        >
                            <FilePlus2 size={14} className="mr-1.5" />
                            Add Report
                        </Button>
                    </ScrollArea>
                )}
            </div>

            <div className="flex-1 flex flex-col min-w-0">
                {openedCases.length > 0 && (
                    <div className="bg-gray-900 border-b border-gray-700 flex items-end overflow-x-auto">
                        <div className="flex items-end h-10 px-2 gap-1">
                            {openedCases.map((openedCase) => {
                                const isActiveCase = openedCase.caseId === activeCaseId;
                                const patientName = isActiveCase
                                    ? caseData?.patient?.name || openedCase.patientName || 'Unknown Patient'
                                    : openedCase.patientName || 'Unknown Patient';
                                const patientId = isActiveCase
                                    ? caseData?.patient?.patient_id || openedCase.patientId || 'N/A'
                                    : openedCase.patientId || 'N/A';
                                const sex = isActiveCase
                                    ? caseData?.patient?.sex || openedCase.patientSex || 'U'
                                    : openedCase.patientSex || 'U';
                                const studyDescription = isActiveCase
                                    ? caseData?.description || caseData?.body_part || openedCase.description || 'Study'
                                    : openedCase.description || 'Study';

                                return (
                                    <div
                                        key={openedCase.caseId}
                                        onClick={() => handleCaseTabClick(openedCase.caseId)}
                                        className={`group relative flex items-center gap-2 px-3 py-2 min-w-[300px] max-w-[520px] rounded-t-md cursor-pointer ${isActiveCase
                                            ? 'bg-gray-800 text-white border-t-2 border-blue-500'
                                            : 'bg-gray-800/50 text-gray-300 hover:bg-gray-800/80'
                                            }`}
                                    >
                                        <p className="text-xs font-medium truncate">
                                            {patientName} | {patientId} / {sex} | {studyDescription}
                                        </p>
                                        <button
                                            className={`ml-auto p-0.5 rounded hover:bg-gray-700 ${isActiveCase ? 'opacity-60 hover:opacity-100' : 'opacity-0 group-hover:opacity-60 hover:opacity-100'}`}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                const updatedCases = removeOpenedReportCase(openedCase.caseId);
                                                setOpenedCases(updatedCases);
                                                if (updatedCases.length === 0) {
                                                    window.close();
                                                } else if (isActiveCase) {
                                                    navigate(`/case/${updatedCases[0].caseId}/report`);
                                                }
                                            }}
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="px-4 py-2 border-b border-gray-700 bg-gray-900 flex items-center gap-2 overflow-x-auto">
                    {studyReports.map((report, index) => {
                        const isActive = index === activeReportIndex;
                        return (
                            <button
                                key={report.localId}
                                onClick={() => handleSwitchReport(index)}
                                className={`px-3 py-1.5 rounded text-xs border whitespace-nowrap ${isActive
                                    ? 'bg-blue-600 border-blue-500 text-white'
                                    : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
                                    }`}
                            >
                                {report.label}
                                <span className="ml-2 text-[10px] opacity-80">
                                    {report.status === 'signed_off' ? 'Signed' : report.status === 'drafted' ? 'Draft' : 'New'}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className="flex-1 min-h-0 bg-gray-800">
                    <div className="h-full p-4">
                        {isLoadingReports ? (
                            <div className="h-full flex items-center justify-center">
                                <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                            </div>
                        ) : (
                            <div className="h-full bg-gray-900 rounded-lg border border-gray-700 overflow-hidden flex flex-col">
                                <ReportEditor
                                    ref={editorRef}
                                    readOnly={isEditorReadOnly}
                                    onChange={setCurrentContent}
                                    placeholder={
                                        isEditorReadOnly
                                            ? 'Reported case. Click Add Addendum to make changes.'
                                            : 'Start typing your report...'
                                    }
                                />

                                {activeReport?.signatureBlock && (
                                    <div className="px-4 py-3 border-t border-gray-700 bg-gray-900/80 text-xs text-gray-300">
                                        <p className="font-medium text-gray-100">{activeReport.signatureBlock.doctor_name}</p>
                                        {activeReport.signatureBlock.degree && (
                                            <p>{activeReport.signatureBlock.degree}</p>
                                        )}
                                        {activeReport.signatureBlock.registration_number && (
                                            <p>Reg No: {activeReport.signatureBlock.registration_number}</p>
                                        )}
                                    </div>
                                )}

                                {activeReport?.addendums.length > 0 && (
                                    <div className="px-4 py-3 border-t border-gray-700 bg-gray-900/70">
                                        <p className="text-xs font-semibold text-gray-100 mb-2">Addendums</p>
                                        <div className="space-y-2 max-h-24 overflow-y-auto">
                                            {activeReport.addendums.map((addendum, index) => (
                                                <div key={`${addendum.added_at || index}`} className="text-xs text-gray-300">
                                                    <p className="text-[10px] text-gray-500">
                                                        {addendum.added_at ? new Date(addendum.added_at).toLocaleString() : 'Addendum'}
                                                    </p>
                                                    <p className="whitespace-pre-wrap">{addendum.text}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {isAddendumMode && (
                                    <div className="px-4 py-3 border-t border-gray-700 bg-blue-900/20">
                                        <p className="text-xs font-semibold text-blue-200 mb-2">Addendum Mode</p>
                                        <Textarea
                                            value={addendumText}
                                            onChange={(event) => setAddendumText(event.target.value)}
                                            placeholder="Write addendum notes here..."
                                            className="min-h-24 text-xs bg-gray-900 border-gray-600 text-gray-100"
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="border-t border-gray-600 bg-gray-800 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                        <div className="text-xs text-gray-400">
                            Words: {currentContent.split(/\s+/).filter(Boolean).length}
                        </div>
                        <div className="flex items-center gap-3">
                            {isSaving && (
                                <span className="text-xs text-gray-400 flex items-center gap-1.5">
                                    <Loader2 size={12} className="animate-spin shrink-0" />
                                    Saving...
                                </span>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleSaveDraftClick}
                                disabled={isSaving || isReported || isAddendumMode}
                                className="h-9 min-w-[88px] px-4 text-sm font-medium bg-gray-700/80 border-gray-500 text-white hover:bg-gray-600 hover:border-gray-400 disabled:opacity-50 disabled:bg-gray-800 disabled:border-gray-600"
                            >
                                {isSaving ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : null}
                                Draft
                            </Button>
                            <Button
                                variant={isAddendumMode ? 'default' : 'outline'}
                                size="sm"
                                onClick={handleAddendumMode}
                                disabled={isSaving || (!isReported && !isAddendumMode)}
                                className={`h-9 min-w-[120px] px-4 text-sm font-medium ${isAddendumMode
                                    ? 'bg-amber-600 hover:bg-amber-500 text-white border-0'
                                    : 'bg-gray-700/80 border-gray-500 text-white hover:bg-gray-600 hover:border-gray-400 disabled:opacity-50 disabled:bg-gray-800 disabled:border-gray-600'
                                    }`}
                            >
                                Add Addendum
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleSignOffClick}
                                disabled={isSaving || (isReported && !isAddendumMode)}
                                className="h-9 min-w-[88px] px-4 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white border-0 disabled:opacity-50"
                            >
                                {isSaving ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : null}
                                Sign Off
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
