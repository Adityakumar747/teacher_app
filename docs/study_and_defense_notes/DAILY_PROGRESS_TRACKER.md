# Sparkology — Daily Progress Tracker (Google Sheet Structure)
**Employee/Intern:** Aditya  
**Role:** Teacher Mobile App & Backend Technical Intern  
**Probation Week:** 1-Week Technical Assessment  
**Manager / Team Lead:** Technical Supervisor  
**Submission Deadline:** Every evening before 7:00 PM IST  

---

## Google Sheet Setup Instructions

1. Open [Google Sheets](https://sheets.new) to create a new spreadsheet.
2. Title the sheet: `[Probation Tracker] Aditya - Teacher App & Backend`.
3. Set Sharing Settings: **"Anyone with the link can view"** (or give "Commenter/Editor" permissions to your supervisor's email).
4. Copy the table below directly into **Sheet 1** (named `Daily Progress Log`).
5. A secondary sheet (named `Metrics & Summary`) can be added for automated progress tracking.

---

## 1. Daily Progress Log (Primary Sheet Data)

| Date | Day # | Module / Area | Planned Tasks | Completed Tasks & Key Accomplishments | Files Touched / Modified | Planned Hours | Actual Hours | Status | Blockers & Mitigation | Pull Request / Commit Reference |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **2026-11-01** | **Day 1** | Setup & System Architecture | • Set up local MongoDB instance<br/>• Configure backend `config.env`<br/>• Launch Expo Teacher App locally<br/>• Deep code audit of all routes & screens<br/>• Draft System Architecture Document<br/>• Create Daily Tracker Google Sheet | • Successfully configured local MongoDB on port 27017<br/>• Verified backend server startup & route registration<br/>• Audited 57 backend routes & 14 mobile screens<br/>• Identified redundant endpoints (`/assignments/teacher/classes` vs `/meetings/teacher/classes`)<br/>• Prepared and shared Architecture Doc & Progress Tracker | `backend/config.env`<br/>`spark_teacher/config/api.js`<br/>`docs/DAY1_SYSTEM_ARCHITECTURE.md`<br/>`docs/DAILY_PROGRESS_TRACKER.md` | 6.0 | 6.5 | **COMPLETED** | None. Local MongoDB and Expo tooling configured smoothly. | `commit: initial-setup-arch-docs` |
| **2026-11-02** | **Day 2** | Frontend: Quick Actions & Mass Mark | • Design quick-action button row for each student in Class Attendance screen<br/>• Add color-coded states (Present = Green, Absent = Red, Late = Orange)<br/>• Implement "Mark All Present" button in header<br/>• Build confirmation modal popup before applying mass marking | • Enhanced student list items with responsive quick-action touchables<br/>• Added confirmation dialogue to prevent accidental mass marking<br/>• Implemented optimistic local state update for instant UI feedback | `spark_teacher/screens/AttendanceScreen.js` | 6.0 | TBD | **PLANNED** | Pending review of haptic/visual feedback on low-end Android devices. | Pending |
| **2026-11-03** | **Day 3** | Frontend: Live Summary Bar & Polish | • Implement fixed bottom Live Summary Bar<br/>• Display dynamic count of Present, Absent, and Late students<br/>• Add smooth transitions and active indicators<br/>• Optimize flatlist rendering performance with memoization | • Built sticky bottom summary bar styled with iOS/Android safe area insets<br/>• Live calculation of attendance stats using `useMemo`<br/>• Polished student search filter and empty states | `spark_teacher/screens/AttendanceScreen.js`<br/>`spark_teacher/services/api.js` | 6.0 | TBD | **PLANNED** | Keyboard avoiding behavior when searching students. | Pending |
| **2026-11-04** | **Day 4** | Backend: Bulk Attendance Optimization | • Audit existing `POST /api/attendance/bulk`<br/>• Eliminate the 4-query sequential loop per student<br/>• Refactor controller to use `Attendance.bulkWrite()` with upsert operations<br/>• Ensure atomicity and batch error reporting | • Replaced N-query loop with single bulk atomic operation<br/>• Reduced DB round-trips from 160 to 1 for a 40-student classroom<br/>• Preserved real-time WebSocket broadcast to `school_<schoolId>` room | `backend/routes/attendance.js`<br/>`backend/controllers/attendanceController.js` | 6.0 | TBD | **PLANNED** | Handling partial failures when a subset of student IDs is invalid. | Pending |
| **2026-11-05** | **Day 5** | Backend: Classes Today Endpoint & Validation | • Create `GET /api/teachers/:id/classes-today`<br/>• Query teacher's active schedule for current day of week<br/>• Add strict express-validator rules (MongoID, date format, role check)<br/>• Standardize response format | • Built dedicated lightweight classes-today endpoint<br/>• Added teacher authorization ensuring teachers only query their own classes<br/>• Added unit validation tests | `backend/routes/teachers.js`<br/>`backend/controllers/teacherController.js` | 6.0 | TBD | **PLANNED** | Holiday and weekend schedule edge-case handling. | Pending |
| **2026-11-06** | **Day 6** | Integration & End-to-End Testing | • Connect mobile Attendance screen with the new `POST /bulk` and `classes-today` endpoints<br/>• Conduct end-to-end testing across physical Android/iOS devices<br/>• Build Postman automated test collection covering edge cases | • End-to-end integration verified: taking attendance on phone reflects immediately in MongoDB Compass<br/>• Postman test suite passing for valid payloads, invalid tokens, duplicate requests, and network timeouts | `spark_teacher/services/api.js`<br/>`spark_teacher/screens/AttendanceScreen.js`<br/>`postman/Sparkology_Attendance.json` | 6.0 | TBD | **PLANNED** | Network latency simulation on physical devices. | Pending |
| **2026-11-07** | **Day 7** | Code Review & Final Demo | • Review every line of written code to prepare for line-by-line defense<br/>• Prepare live mobile demo script<br/>• Execute live code walkthrough with Engineering Leads | • Successful live walkthrough of mobile app and backend queries<br/>• Defended query optimization (`bulkWrite` vs sequential loop)<br/>• Final code submission & probation review | All touched files across frontend & backend | 4.0 | TBD | **PLANNED** | None. Ready for technical defense. | Final PR |

---

## 2. Google Sheet Column Validation Rules & Formatting Guide

To make the Google Sheet look clean and professional:

1. **Status Column Dropdown (Data Validation):**
   - Click Column `I` (Status) -> Data -> Data validation -> Add rule -> Dropdown:
     - `COMPLETED` (Color: Green / `#D4EDDA`)
     - `IN PROGRESS` (Color: Blue / `#CCE5FF`)
     - `PLANNED` (Color: Gray / `#E2E3E5`)
     - `BLOCKED` (Color: Red / `#F8D7DA`)

2. **Hours Summary Formulas:**
   - In cell `G10`: `=SUM(G2:G8)` *(Total Planned Hours = 40.0)*
   - In cell `H10`: `=SUM(H2:H8)` *(Total Actual Hours)*
   - Variance in cell `I10`: `=H10-G10`

3. **Daily Routine:**
   - **9:30 AM:** Review day's planned deliverables.
   - **6:30 PM:** Update "Completed Tasks", "Actual Hours", and "Blockers".
   - **6:55 PM:** Verify updates and email / ping the link to the supervisor.
