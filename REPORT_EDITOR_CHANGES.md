# Report Editor Changes - Implementation Summary

## Frontend Changes Completed ✅

### 1. **Removed Patient Info Header**

- ✅ Removed the detailed patient information section from beside the Draft/Sign Off buttons
- ✅ Simplified header to show only: Report Title, Status Badge, and Action Buttons
- ✅ Cleaner, more focused interface

### 2. **Added Patient Details Section**

- ✅ Created new `PatientDetailsSection.tsx` component
- ✅ Always visible above the report editor
- ✅ Displays in a professional table format:
  - Patient Name
  - Age / Sex
  - Patient ID
  - Referring Consultant
  - Study Date
  - Study Description
  - Modality

### 3. **Previous Studies Section**

- ✅ Automatically fetches previous studies for the same patient
- ✅ Displays studies sorted by date (latest first)
- ✅ Shows Study Date, Modality, and Study Name for each entry
- ✅ Two action buttons per study:
  - **Open PDF**: Downloads/opens the report PDF
  - **Load**: Loads report content with options

### 4. **Load Previous Report Modal**

- ✅ Modal with two clear options:
  - **Replace Current Content**: Completely overwrites existing text (red button with warning)
  - **Append to Current Report**: Keeps existing text and adds previous report below (blue button)
- ✅ Visual indicators to show consequences of each action
- ✅ Requires user confirmation before proceeding

### 5. **Report Loading Functionality**

- ✅ `handleLoadPreviousReport` function that:
  - Replaces editor content entirely, OR
  - Appends previous report with separator ("--- Previous Report ---")
- ✅ Toast notifications for user feedback
- ✅ Automatically marks report as draft after loading

### 6. **UI Improvements**

- ✅ Centered content layout (max-width container)
- ✅ Better spacing and readability
- ✅ Patient details and editor in cohesive design
- ✅ Loading states for previous studies

---

## Backend Changes Required ⚠️

### 1. **New API Endpoint: Get Reports by Patient ID**

**Endpoint:** `GET /api/v1/reports/patient/:patientId`

**Purpose:** Fetch all reports for a specific patient to display in Previous Studies section

**Request:**

```javascript
GET /api/v1/reports/patient/PAT12345
Authorization: Bearer <token>
```

**Expected Response:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "report123",
      "study_date": "2026-03-10T10:30:00Z",
      "modality": "CT",
      "study_name": "CT Chest with Contrast",
      "content_html": "<p>Report content...</p>",
      "content_plain_text": "Report content...",
      "is_signed_off": true,
      "created_at": "2026-03-10T10:30:00Z"
    },
    {
      "_id": "report124",
      "study_date": "2026-02-15T09:00:00Z",
      "modality": "MRI",
      "study_name": "MRI Brain",
      "content_html": "<p>Report content...</p>",
      "content_plain_text": "Report content...",
      "is_signed_off": true,
      "created_at": "2026-02-15T09:00:00Z"
    }
  ]
}
```

**Implementation Notes:**

- Query reports by `patient_id` field
- Sort by `study_date` or `created_at` descending (latest first)
- Include `content_html` and `content_plain_text` for loading into editor
- Optional: Only return signed-off reports (exclude drafts)
- Optional: Exclude current report from results

### 2. **Existing Endpoint to Verify**

**Endpoint:** `GET /api/v1/reports/:reportId/download`

**Purpose:** Download report as PDF

**Verify:**

- Returns PDF file or PDF generation data
- Properly handles authentication
- Works for all report types

---

## How It Works (User Flow)

### Scenario 1: Creating/Editing a New Report

1. User opens a case for reporting
2. **Patient Details Section** appears at top showing all patient info
3. **Previous Studies Section** shows any prior reports for this patient
4. User can reference previous studies while typing new report
5. User can click "Load" on previous report to:
   - Replace current draft with old report as template
   - Append old report for comparison

### Scenario 2: Loading Previous Report

1. User sees list of previous studies
2. Clicks "Load" button on a previous study
3. **Modal appears** with two options:
   - Replace Current Content (overwrites everything)
   - Append to Current Report (adds below current text)
4. User selects an option
5. Content loads into editor
6. Report automatically marked as draft
7. User continues editing

### Scenario 3: Viewing Signed-Off Report

1. User opens a signed-off report
2. Patient details section shows all information
3. Previous studies section shows history
4. Editor shows the report content
5. Status badge shows "Signed Off"
6. User can download PDF
7. User CANNOT edit (unless backend allows re-opening)

---

## Files Modified

### New Files Created:

- `src/components/report/PatientDetailsSection.tsx` - Patient details and previous studies component

### Modified Files:

- `src/components/report/ReportView.tsx` - Integrated patient details section, removed header
- `src/lib/api.ts` - Added `getReportsByPatient()` method
- `src/lib/reportWindow.ts` - Added `patientSex` field to interfaces
- `src/components/ReportLayout.tsx` - Updated to include sex in metadata

---

## Testing Checklist

### Frontend (Already Working):

- [x] Patient details section displays correctly
- [x] Previous studies section renders
- [x] Load modal appears with both options
- [x] Replace functionality works
- [x] Append functionality works
- [x] Report marked as draft after loading
- [x] Toast notifications appear

### Backend (Requires Implementation):

- [ ] Endpoint `/api/v1/reports/patient/:patientId` returns patient's reports
- [ ] Reports sorted by date (latest first)
- [ ] Content fields included in response
- [ ] PDF download works for all reports
- [ ] Proper error handling for missing patient

### Integration Testing:

- [ ] Load previous report - Replace mode
- [ ] Load previous report - Append mode
- [ ] Download PDF from previous studies
- [ ] Multiple previous studies display correctly
- [ ] No previous studies shows appropriate message
- [ ] Patient with 10+ previous reports (pagination?)

---

## Optional Enhancements (Future)

1. **Pagination for Previous Studies**
   - If patient has many reports (>10), implement pagination

2. **Report Comparison View**
   - Side-by-side view of current and previous report

3. **Smart Template Suggestions**
   - Suggest previous reports based on modality/study type

4. **Diff View**
   - Show differences between current and previous report

5. **Quick Copy**
   - Copy specific sections from previous reports

6. **Search in Previous Reports**
   - Filter previous studies by date range, modality, keywords

---

## Notes

- Patient details section is **always visible** (not just for signed-off reports)
- This provides doctors with context while writing reports
- Previous studies help with consistency and comparison
- Modal ensures users don't accidentally overwrite content
- All changes are frontend-focused; minimal backend updates needed
