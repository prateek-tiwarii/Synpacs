export const REPORT_WINDOW_TARGET = "syncpacs_report_window";
export const REPORT_WINDOW_FEATURES =
  "popup=yes,width=1200,height=800,left=100,top=80,resizable=yes,scrollbars=yes";
export const OPENED_REPORT_CASES_STORAGE_KEY =
  "syncpacs_opened_report_cases_v1";
export const REPORT_WINDOW_LEADER_STORAGE_KEY =
  "syncpacs_report_window_leader_v1";
export const REPORT_WINDOW_NAVIGATE_STORAGE_KEY =
  "syncpacs_report_window_navigate_v1";
export const REPORT_WINDOW_SESSION_ID_KEY =
  "syncpacs_report_window_session_id_v1";
export const REPORT_WINDOW_LEADER_STALE_MS = 6000;

const MAX_TRACKED_REPORT_CASES = 30;
let reportWindowRef: Window | null = null;

export interface OpenedReportCase {
  caseId: string;
  caseUid?: string;
  patientName?: string;
  patientId?: string;
  patientSex?: string;
  accessionNumber?: string;
  description?: string;
  modality?: string;
  lastOpenedAt: number;
}

export interface ReportCaseMetadata {
  caseId: string;
  caseUid?: string;
  patientName?: string;
  patientId?: string;
  patientSex?: string;
  accessionNumber?: string;
  description?: string;
  modality?: string;
}

export interface ReportWindowLeaderState {
  windowId: string;
  heartbeatAt: number;
}

export interface ReportWindowNavigateCommand {
  caseId: string;
  issuedAt: number;
  sourceWindowId?: string;
}

const isBrowser = typeof window !== "undefined";

const sanitizeText = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const parseReportWindowLeaderState = (
  value: unknown,
): ReportWindowLeaderState | null => {
  if (!value || typeof value !== "object") return null;
  const entry = value as Record<string, unknown>;
  const windowId = sanitizeText(entry.windowId);
  if (!windowId) return null;

  const heartbeatAt =
    typeof entry.heartbeatAt === "number"
      ? entry.heartbeatAt
      : Number(entry.heartbeatAt);
  if (!Number.isFinite(heartbeatAt)) return null;

  return {
    windowId,
    heartbeatAt,
  };
};

const parseReportWindowNavigateCommand = (
  value: unknown,
): ReportWindowNavigateCommand | null => {
  if (!value || typeof value !== "object") return null;
  const entry = value as Record<string, unknown>;
  const caseId = sanitizeText(entry.caseId);
  if (!caseId) return null;

  const issuedAt =
    typeof entry.issuedAt === "number"
      ? entry.issuedAt
      : Number(entry.issuedAt);
  if (!Number.isFinite(issuedAt)) return null;

  return {
    caseId,
    issuedAt,
    sourceWindowId: sanitizeText(entry.sourceWindowId),
  };
};

const toOpenedReportCase = (value: unknown): OpenedReportCase | null => {
  if (!value || typeof value !== "object") return null;
  const entry = value as Record<string, unknown>;
  const caseId = sanitizeText(entry.caseId);
  if (!caseId) return null;

  const parsedLastOpenedAt =
    typeof entry.lastOpenedAt === "number"
      ? entry.lastOpenedAt
      : Number(entry.lastOpenedAt);

  return {
    caseId,
    caseUid: sanitizeText(entry.caseUid),
    patientName: sanitizeText(entry.patientName),
    patientId: sanitizeText(entry.patientId),
    patientSex: sanitizeText(entry.patientSex),
    accessionNumber: sanitizeText(entry.accessionNumber),
    description: sanitizeText(entry.description),
    modality: sanitizeText(entry.modality),
    lastOpenedAt: Number.isFinite(parsedLastOpenedAt)
      ? parsedLastOpenedAt
      : Date.now(),
  };
};

const readOpenedReportCases = (): OpenedReportCase[] => {
  if (!isBrowser) return [];

  try {
    const raw = window.localStorage.getItem(OPENED_REPORT_CASES_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map(toOpenedReportCase)
      .filter((item): item is OpenedReportCase => item !== null)
      .slice(0, MAX_TRACKED_REPORT_CASES);
  } catch {
    return [];
  }
};

const writeOpenedReportCases = (entries: OpenedReportCase[]) => {
  if (!isBrowser) return;

  try {
    window.localStorage.setItem(
      OPENED_REPORT_CASES_STORAGE_KEY,
      JSON.stringify(entries.slice(0, MAX_TRACKED_REPORT_CASES)),
    );
  } catch {
    // Ignore write failures (private mode/storage limits).
  }
};

const readReportWindowLeaderState = (): ReportWindowLeaderState | null => {
  if (!isBrowser) return null;

  try {
    const raw = window.localStorage.getItem(REPORT_WINDOW_LEADER_STORAGE_KEY);
    if (!raw) return null;
    return parseReportWindowLeaderState(JSON.parse(raw));
  } catch {
    return null;
  }
};

const writeReportWindowLeaderState = (leaderState: ReportWindowLeaderState) => {
  if (!isBrowser) return;

  try {
    window.localStorage.setItem(
      REPORT_WINDOW_LEADER_STORAGE_KEY,
      JSON.stringify(leaderState),
    );
  } catch {
    // Ignore write failures.
  }
};

const isLeaderStateStale = (leaderState: ReportWindowLeaderState) => {
  return Date.now() - leaderState.heartbeatAt > REPORT_WINDOW_LEADER_STALE_MS;
};

export const getOrCreateReportWindowSessionId = (): string => {
  if (!isBrowser) return "";

  try {
    const existingId = sanitizeText(
      window.sessionStorage.getItem(REPORT_WINDOW_SESSION_ID_KEY),
    );
    if (existingId) return existingId;
  } catch {
    // Ignore read failures.
  }

  const nextId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  try {
    window.sessionStorage.setItem(REPORT_WINDOW_SESSION_ID_KEY, nextId);
  } catch {
    // Ignore write failures.
  }

  return nextId;
};

export const tryClaimReportWindowLeadership = (windowId: string): boolean => {
  const normalizedWindowId = sanitizeText(windowId);
  if (!normalizedWindowId || !isBrowser) return false;

  const currentLeader = readReportWindowLeaderState();
  if (
    !currentLeader ||
    currentLeader.windowId === normalizedWindowId ||
    isLeaderStateStale(currentLeader)
  ) {
    writeReportWindowLeaderState({
      windowId: normalizedWindowId,
      heartbeatAt: Date.now(),
    });
    return true;
  }

  return false;
};

export const heartbeatReportWindowLeadership = (windowId: string): boolean => {
  const normalizedWindowId = sanitizeText(windowId);
  if (!normalizedWindowId || !isBrowser) return false;

  const currentLeader = readReportWindowLeaderState();
  if (!currentLeader || currentLeader.windowId !== normalizedWindowId) {
    return false;
  }

  writeReportWindowLeaderState({
    windowId: normalizedWindowId,
    heartbeatAt: Date.now(),
  });
  return true;
};

export const releaseReportWindowLeadership = (windowId: string) => {
  const normalizedWindowId = sanitizeText(windowId);
  if (!normalizedWindowId || !isBrowser) return;

  const currentLeader = readReportWindowLeaderState();
  if (!currentLeader || currentLeader.windowId !== normalizedWindowId) return;

  try {
    window.localStorage.removeItem(REPORT_WINDOW_LEADER_STORAGE_KEY);
  } catch {
    // Ignore remove failures.
  }
};

export const emitReportWindowNavigateCommand = (
  caseId: string,
  sourceWindowId?: string,
) => {
  const normalizedCaseId = sanitizeText(caseId);
  if (!normalizedCaseId || !isBrowser) return;

  const command: ReportWindowNavigateCommand = {
    caseId: normalizedCaseId,
    issuedAt: Date.now(),
    sourceWindowId: sanitizeText(sourceWindowId),
  };

  try {
    window.localStorage.setItem(
      REPORT_WINDOW_NAVIGATE_STORAGE_KEY,
      JSON.stringify(command),
    );
  } catch {
    // Ignore write failures.
  }
};

export const parseReportWindowNavigateStorageValue = (
  rawValue: string | null,
): ReportWindowNavigateCommand | null => {
  if (!rawValue) return null;

  try {
    return parseReportWindowNavigateCommand(JSON.parse(rawValue));
  } catch {
    return null;
  }
};

export const getOpenedReportCases = (): OpenedReportCase[] => {
  return readOpenedReportCases();
};

export const upsertOpenedReportCase = (
  metadata: ReportCaseMetadata,
): OpenedReportCase[] => {
  const caseId = sanitizeText(metadata.caseId);
  if (!caseId) return readOpenedReportCases();

  const currentEntries = readOpenedReportCases();
  const existingIndex = currentEntries.findIndex((entry) => entry.caseId === caseId);
  const now = Date.now();

  let nextEntries = [...currentEntries];

  if (existingIndex >= 0) {
    const existingEntry = currentEntries[existingIndex];
    // Update existing entry - prefer new data over old data
    const newPatientName = sanitizeText(metadata.patientName);
    const newPatientId = sanitizeText(metadata.patientId);
    const newPatientSex = sanitizeText(metadata.patientSex);
    const newCaseUid = sanitizeText(metadata.caseUid);
    const newAccessionNumber = sanitizeText(metadata.accessionNumber);
    const newDescription = sanitizeText(metadata.description);
    const newModality = sanitizeText(metadata.modality);
    
    nextEntries[existingIndex] = {
      ...existingEntry,
      caseId,
      // Always update with new data if provided (not undefined)
      caseUid: newCaseUid !== undefined ? newCaseUid : existingEntry.caseUid,
      patientName: newPatientName !== undefined ? newPatientName : existingEntry.patientName,
      patientId: newPatientId !== undefined ? newPatientId : existingEntry.patientId,
      patientSex: newPatientSex !== undefined ? newPatientSex : existingEntry.patientSex,
      accessionNumber: newAccessionNumber !== undefined ? newAccessionNumber : existingEntry.accessionNumber,
      description: newDescription !== undefined ? newDescription : existingEntry.description,
      modality: newModality !== undefined ? newModality : existingEntry.modality,
      // Keep existing order by preserving original timestamp.
      lastOpenedAt: existingEntry.lastOpenedAt,
    };
  } else {
    nextEntries.push({
      caseId,
      caseUid: sanitizeText(metadata.caseUid),
      patientName: sanitizeText(metadata.patientName),
      patientId: sanitizeText(metadata.patientId),
      patientSex: sanitizeText(metadata.patientSex),
      accessionNumber: sanitizeText(metadata.accessionNumber),
      description: sanitizeText(metadata.description),
      modality: sanitizeText(metadata.modality),
      lastOpenedAt: now,
    });
  }

  if (nextEntries.length > MAX_TRACKED_REPORT_CASES) {
    nextEntries = nextEntries.slice(nextEntries.length - MAX_TRACKED_REPORT_CASES);
  }

  writeOpenedReportCases(nextEntries);
  return nextEntries;
};

export const removeOpenedReportCase = (caseId: string): OpenedReportCase[] => {
  const normalizedCaseId = sanitizeText(caseId);
  if (!normalizedCaseId) return readOpenedReportCases();

  const currentEntries = readOpenedReportCases();
  const nextEntries = currentEntries.filter((entry) => entry.caseId !== normalizedCaseId);

  writeOpenedReportCases(nextEntries);
  return nextEntries;
};

export const openReportInSingleWindow = (
  caseId: string,
  metadata?: Omit<ReportCaseMetadata, "caseId">,
): Window | null => {
  const normalizedCaseId = sanitizeText(caseId);
  if (!normalizedCaseId || !isBrowser) return null;

  upsertOpenedReportCase({
    caseId: normalizedCaseId,
    ...metadata,
  });
  emitReportWindowNavigateCommand(normalizedCaseId);

  const reportUrl = new URL(
    `/case/${normalizedCaseId}/report`,
    window.location.origin,
  ).toString();

  const existingReportWindow =
    reportWindowRef && !reportWindowRef.closed ? reportWindowRef : null;

  if (existingReportWindow) {
    if (existingReportWindow.location.href !== reportUrl) {
      existingReportWindow.location.href = reportUrl;
    }
    existingReportWindow.focus();
    return existingReportWindow;
  }

  // Create/reuse a globally named popup window so every source window
  // (dashboard, viewer popups, etc.) targets the same report window.
  const newReportWindow = window.open(
    "about:blank",
    REPORT_WINDOW_TARGET,
    REPORT_WINDOW_FEATURES,
  );

  if (!newReportWindow) return null;

  reportWindowRef = newReportWindow;

  try {
    newReportWindow.name = REPORT_WINDOW_TARGET;
  } catch {
    // Ignore name assignment failures.
  }

  newReportWindow.location.href = reportUrl;
  newReportWindow.focus();
  return newReportWindow;
};
