export type TemplateModality = 'CT' | 'MR' | 'USG' | 'ECHO' | 'NM' | 'CR' | 'DX';

export interface ReportTemplate {
  id: string;
  name: string;
  content: string;
  modality: TemplateModality;
  source: 'system' | 'user';
  created_at?: number;
}

const USER_TEMPLATE_STORAGE_KEY = 'syncpacs_report_user_templates_v1';

const SYSTEM_TEMPLATES: ReportTemplate[] = [
  {
    id: 'sys-ct-head',
    name: 'CT Head Without Contrast',
    modality: 'CT',
    source: 'system',
    content:
      'CT HEAD WITHOUT CONTRAST\n\nINVESTIGATION:\nNCCT Head\n\nTECHNIQUE:\nNon-contrast CT head performed.\n\nFINDINGS:\n\nIMPRESSION:\n\nADVICE:',
  },
  {
    id: 'sys-ct-chest',
    name: 'CT Chest',
    modality: 'CT',
    source: 'system',
    content:
      'CT CHEST\n\nINVESTIGATION:\nCT Chest\n\nTECHNIQUE:\nAxial sections obtained with reconstructions.\n\nFINDINGS:\n\nIMPRESSION:\n\nADVICE:',
  },
  {
    id: 'sys-ct-abdomen',
    name: 'CT Abdomen and Pelvis',
    modality: 'CT',
    source: 'system',
    content:
      'CT ABDOMEN AND PELVIS\n\nINVESTIGATION:\nCT Abdomen and Pelvis\n\nTECHNIQUE:\n\nFINDINGS:\n\nIMPRESSION:\n\nADVICE:',
  },
  {
    id: 'sys-mr-brain',
    name: 'MRI Brain',
    modality: 'MR',
    source: 'system',
    content:
      'MRI BRAIN\n\nINVESTIGATION:\nMRI Brain\n\nTECHNIQUE:\n\nFINDINGS:\n\nIMPRESSION:\n\nADVICE:',
  },
  {
    id: 'sys-mr-spine',
    name: 'MRI Spine',
    modality: 'MR',
    source: 'system',
    content:
      'MRI SPINE\n\nINVESTIGATION:\nMRI Spine\n\nTECHNIQUE:\n\nFINDINGS:\n\nIMPRESSION:\n\nADVICE:',
  },
  {
    id: 'sys-usg-abdomen',
    name: 'USG Abdomen',
    modality: 'USG',
    source: 'system',
    content:
      'USG ABDOMEN\n\nINVESTIGATION:\nUltrasound Abdomen\n\nFINDINGS:\n\nIMPRESSION:\n\nADVICE:',
  },
  {
    id: 'sys-echo-basic',
    name: '2D ECHO Basic',
    modality: 'ECHO',
    source: 'system',
    content:
      '2D ECHOCARDIOGRAPHY\n\nSTUDY:\n2D Echo\n\nFINDINGS:\n\nIMPRESSION:\n\nADVICE:',
  },
  {
    id: 'sys-nm-thyroid',
    name: 'NM Thyroid Scan',
    modality: 'NM',
    source: 'system',
    content:
      'NUCLEAR MEDICINE THYROID SCAN\n\nTECHNIQUE:\n\nFINDINGS:\n\nIMPRESSION:',
  },
  {
    id: 'sys-cr-chest',
    name: 'CR Chest PA',
    modality: 'CR',
    source: 'system',
    content:
      'CHEST CR (PA VIEW)\n\nFINDINGS:\n\nIMPRESSION:\n\nADVICE:',
  },
  {
    id: 'sys-dx-abdomen',
    name: 'DX Abdomen AP',
    modality: 'DX',
    source: 'system',
    content:
      'ABDOMEN X-RAY (AP VIEW)\n\nFINDINGS:\n\nIMPRESSION:\n\nADVICE:',
  },
];

const isTemplateModality = (value: unknown): value is TemplateModality => {
  return (
    value === 'CT' ||
    value === 'MR' ||
    value === 'USG' ||
    value === 'ECHO' ||
    value === 'NM' ||
    value === 'CR' ||
    value === 'DX'
  );
};

const sanitizeTemplate = (entry: unknown): ReportTemplate | null => {
  if (!entry || typeof entry !== 'object') return null;
  const value = entry as Record<string, unknown>;
  if (typeof value.id !== 'string' || !value.id.trim()) return null;
  if (typeof value.name !== 'string' || !value.name.trim()) return null;
  if (typeof value.content !== 'string') return null;
  if (!isTemplateModality(value.modality)) return null;
  if (value.source !== 'user') return null;

  return {
    id: value.id,
    name: value.name,
    content: value.content,
    modality: value.modality,
    source: 'user',
    created_at:
      typeof value.created_at === 'number' && Number.isFinite(value.created_at)
        ? value.created_at
        : Date.now(),
  };
};

export const getSystemReportTemplates = (): ReportTemplate[] => {
  return SYSTEM_TEMPLATES;
};

export const getUserReportTemplates = (): ReportTemplate[] => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(USER_TEMPLATE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(sanitizeTemplate)
      .filter((template): template is ReportTemplate => template !== null);
  } catch {
    return [];
  }
};

export const getAllReportTemplates = (): ReportTemplate[] => {
  return [...getSystemReportTemplates(), ...getUserReportTemplates()];
};

export const setUserReportTemplates = (templates: ReportTemplate[]) => {
  if (typeof window === 'undefined') return;
  const userTemplates = templates.filter((template) => template.source === 'user');
  window.localStorage.setItem(USER_TEMPLATE_STORAGE_KEY, JSON.stringify(userTemplates));
};

export const saveUserReportTemplate = (template: {
  name: string;
  content: string;
  modality: TemplateModality;
}): ReportTemplate => {
  const nextTemplate: ReportTemplate = {
    id: `user-${Date.now()}`,
    name: template.name.trim(),
    content: template.content,
    modality: template.modality,
    source: 'user',
    created_at: Date.now(),
  };

  const templates = getUserReportTemplates();
  templates.push(nextTemplate);
  setUserReportTemplates(templates);
  return nextTemplate;
};

export const removeUserReportTemplate = (templateId: string) => {
  const templates = getUserReportTemplates().filter((template) => template.id !== templateId);
  setUserReportTemplates(templates);
};

export const TEMPLATE_MODALITY_OPTIONS: TemplateModality[] = [
  'CT',
  'MR',
  'USG',
  'ECHO',
  'NM',
  'CR',
  'DX',
];
