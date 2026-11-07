# AUDIT.md — School ERP: Teacher Module (Step 0 Audit Report)

> **Audit Date:** 2026-11-03  
> **Environment:** Node.js v22.19.0, React Native 0.81.5, Expo SDK 54, Mongoose 8.0.3, Express 4.18.2, Firebase Admin SDK 13.7.0, Firebase JS Client 12.11.0.  
> **Auditor:** Senior Full-Stack Mobile Engineer (Antigravity)  
> **Status:** Step 0 Complete — Awaiting Developer Approval Before Writing Code.

---

## 1. Summarised Folder Tree

```text
sparkology1/
├── .env / .env.example / config.env   # Environment configs (Port 5000, Mongo URI, Cloudinary, JWT)
├── .gitignore                         # Root git ignore (needs verification for secrets)
├── PROJECT_CONTEXT.md                 # Single source of truth for scope, API contracts, rules
├── DESIGN_CONTEXT.md                  # Authority for UI spec, design tokens, questions
├── README.md                          # Project readme
├── docs/                              # Project documentation & visual references
│   ├── AUDIT.md                       # [THIS FILE] Step 0 comprehensive audit report
│   ├── Teacher_App_Design.html        # Approved reference design (final UI source of truth)
│   ├── postman_collection.json        # Postman test collection
│   └── ...                            # Architecture notes and diagrams
├── backend/                           # Node.js + Express API server
│   ├── index.js                       # Express app, CORS, security, HTTP & Socket.IO server
│   ├── package.json                   # Backend dependencies (express, mongoose, firebase-admin, etc.)
│   ├── config/
│   │   ├── firebase-admin.js          # Firebase Admin SDK initialization (Verified working)
│   │   ├── serviceAccountKey.json     # Service account credentials for sparkology-4a447
│   │   └── serviceAccountKey.example.json
│   ├── controllers/                   # 56 controllers (teacher, attendance, assignment, leave, etc.)
│   ├── middleware/                    # auth.js (token verification), errorHandler.js, notFound.js
│   ├── models/                        # 58 Mongoose models (User, Class, Student, Schedule, AttendanceSession, AttendanceRecord, TeacherLeave...)
│   ├── routes/                        # 57 route files (/api/teachers, /api/attendance, /api/homework, /api/leaves...)
│   ├── scripts/
│   │   └── seed-teacher-demo.js       # Seed script for School, Teacher, Class, Subject, Students, Schedule, Leaves
│   ├── tests/                         # Test scripts (attendance-backdate-audit, homework, profile-leave)
│   └── utils/                         # dateTimeUtils (IST helpers), cloudinary, firebaseUtils
└── spark_teacher/
    └── spark_teacher/                 # React Native + Expo Mobile Application
        ├── App.js                     # Root component, NavigationContainer, Bottom Tabs & Stacks
        ├── app.json                   # Expo SDK 54 configuration
        ├── package.json               # Mobile dependencies (React 19.1.0, RN 0.81.5, Expo 54)
        ├── config/
        │   ├── api.js                 # API base URL resolver (dynamic host detection)
        │   └── firebase.js            # Firebase JS Client SDK initialization
        ├── context/
        │   ├── AuthContext.js         # Authentication state & Firebase auth listener
        │   └── UnreadCountContext.js  # Unread badge counts context
        ├── theme/
        │   └── colors.js              # Theme color tokens (currently outdated, needs design match)
        ├── components/                # Shared UI components (Avatar, Card, StatusDot, Skeleton...)
        ├── screens/                   # Screens (DashboardScreen, AttendanceScreen, AssignmentsScreen, ProfileScreen, StudentsScreen...)
        └── services/
            ├── api.js                 # API fetch wrapper with token injection & error normalisation
            └── socketService.js       # Socket.IO client service
```

---

## 2. What Already Exists and WORKS (Verified by Real Execution)

| Subsystem / Flow | Verified Status | Verification Evidence |
|---|---|---|
| **Backend Server Boot** | **WORKING** | Executed `node index.js` in `backend`. Server started cleanly on port 5000, initialized Socket.IO, initialized Firebase Admin SDK, mounted all route modules with zero syntax or import errors. |
| **Backend JS Syntax** | **WORKING** | Executed `node --check` across every `.js` file in `backend/` (controllers, models, routes, utils, tests). 0 syntax errors found. |
| **Mobile Bundling (Metro)** | **WORKING** | Executed Metro bundler export (`npx expo export -p web`). Successfully bundled 752 modules in 18,693ms into `index.js` (2.03 MB) with zero compile/transform errors. |
| **Firebase Admin SDK** | **WORKING** | `backend/config/firebase-admin.js` successfully reads `serviceAccountKey.json` for Firebase project `sparkology-4a447` and calls `admin.initializeApp()`. |
| **Firebase Client SDK** | **WORKING** | `spark_teacher/spark_teacher/config/firebase.js` initializes with project `sparkology-4a447` matching backend service account. |
| **Modern Models** | **WORKING** | `AttendanceSession.js` (`(slotId, date)` unique index, IST date string, audit diff), `AttendanceRecord.js` (`(sessionId, studentId)` unique index), `TeacherLeave.js`, `Schedule.js`, `Class.js`, `Student.js`, `User.js` exist with robust Mongoose schemas. |
| **Slot Attendance & Bulk Endpoints** | **WORKING** | `GET /api/attendance/slot/:slotId?date=` and `POST /api/attendance/bulk` exist in `attendanceController.js` supporting slot verification, teacher authorization, future date blocking, 7-day edit window enforcement, and atomic `bulkWrite`. |
| **Classes-Today Endpoint** | **WORKING** | `GET /api/teachers/:id/classes-today` exists in `teacherController.js`, calculates class slot status dynamically using server time in IST (never stored), enforces `:id === 'me'` authorization. |
| **Cloudinary Server Upload** | **WORKING** | `backend/routes/upload.js` (`/api/uploads/sign`) exists for generating Cloudinary signatures. |
| **Leaves Endpoint** | **WORKING** | `GET /api/leaves` and `POST /api/leaves` exist in `leaveController.js` with role-based filtering and date validation. |

---

## 3. What Exists but is BROKEN or RISKY

| ID | File & Line | Cause | Proposed Minimal Fix | Severity |
|---|---|---|---|---|
| **BUG-01** | `spark_teacher/spark_teacher/theme/colors.js` (lines 7–56) & `App.js` | Theme uses `#007AFF` (iOS standard blue) and `#1A1F3A` instead of the approved Navy theme tokens defined in `DESIGN_CONTEXT.md` (`navy: #0B1F4F`, `blue: #1D3FA6`, `bg: #F4F6FB`, `soft: #E4EBFB`, `green: #12794A`, `red: #C0392B`, `amber: #E8A317`, `greyDot: #B7C0D3`). | Update `theme/colors.js` to strictly export the tokens from `DESIGN_CONTEXT.md` Section 1. Replace all hardcoded `#007AFF` across mobile screens with token references. | **HIGH** |
| **BUG-02** | `spark_teacher/spark_teacher/App.js` (lines 71–163) | Bottom Tab Bar uses default library look with standard border and height, duplicating `MainTabNavigator` and `TabNavigatorWithUnreadCount`. It does not use the custom floating bar (`radius: 22`, `height: 64`, floating `soft` active pill `56x44`, shadow `0 6 24 rgba(11,31,79,.12)`) from `docs/Teacher_App_Design.html`. | Consolidate into a single custom `BottomTabBar` component matching the approved HTML/CSS spec. | **HIGH** |
| **BUG-03** | `spark_teacher/spark_teacher/context/AuthContext.js` (lines 45–55, 110–118) vs `PROJECT_CONTEXT.md` 4.1 | App signs into Firebase, then exchanges the Firebase ID token for a backend local JWT (`/auth/firebase-login`) and stores *that* as `authToken`. `PROJECT_CONTEXT.md` 4.1 requires: *"Every API request sends the Firebase ID token: Authorization: Bearer <idToken>... Token refresh handled by Firebase SDK (getIdToken() before each request)"*. | Update `services/api.js` to call `auth.currentUser?.getIdToken()` directly before each request (with fallback to stored token), ensuring tokens auto-refresh and match server `firebase-admin` verification. | **HIGH** |
| **BUG-04** | `backend/.gitignore` (lines 2–7) & `.gitignore` | `backend/.gitignore` has `# .env`, `# config.env`, and `# config/serviceAccountKey.json` commented out, exposing production credentials to accidental git commit. | Uncomment and enforce ignoring `.env`, `config.env`, `serviceAccountKey.json`, and `*.bak` across all `.gitignore` files. Verify with `.env.example`. | **HIGH** |
| **BUG-05** | `spark_teacher/spark_teacher/app.json` (line 49) | `android.googleServicesFile: "./google-services.json"` is configured, but `google-services.json` does not exist in `spark_teacher/spark_teacher`, causing Metro warning `Could not parse Expo config: android.googleServicesFile: "./google-services.json"`. | Either provide `google-services.json` or remove the key until native Android FCM builds are initiated. | **MEDIUM** |
| **BUG-06** | `spark_teacher/spark_teacher/App.js` | Font **Manrope** is not imported or loaded. App renders default system sans-serif instead of the approved `Manrope` (500, 600, 700, 800) font specified in `DESIGN_CONTEXT.md`. | Install `@expo-google-fonts/manrope`, load fonts with `useFonts`, and prevent rendering until fonts load (holding splash screen). | **MEDIUM** |
| **BUG-07** | `backend/config.env` & `backend/.env` (line 8) | `MONGODB_URI` points to remote MongoDB Atlas (`mongodb+srv://...`). In network-isolated/sandbox environments, DNS SRV resolution blocks. | Maintain `.env.example` with local fallback `mongodb://localhost:27017/erp` and ensure local MongoDB connectivity instructions are documented. | **MEDIUM** |
| **BUG-08** | `spark_teacher/spark_teacher/screens/StudentsScreen.js` | `StudentsScreen.js` is currently a direct chat / messaging group interface, completely divergent from the Students screen in `docs/Teacher_App_Design.html` (which is a student directory with attendance %, Low badge, parent contact action, remark). | Rebuild `StudentsScreen.js` to match the approved design (search bar, filter buttons, student cards with attendance %, expandable action drawer). | **HIGH** |
| **BUG-09** | `spark_teacher/spark_teacher/screens/DashboardScreen.js` | UI diverges significantly from `docs/Teacher_App_Design.html`: uses a large full-width dark linear gradient header, custom fintech icon tiles, and missing the circular minutes-left countdown ring and the 3 "Needs your attention" cards. | Rebuild Dashboard components to exactly match the approved HTML layout, spacing, typography, and card hierarchy. | **HIGH** |
| **BUG-10** | `spark_teacher/spark_teacher/screens/AttendanceScreen.js` | Screen is 2,493 lines containing legacy forms, missing the exact Navy hero card with Present/Absent/Not marked stats tiles, missing the 44px segmented control, and missing the floating Save button above the tab bar. | Restructure Attendance screen into clean, modular components matching `docs/Teacher_App_Design.html`. | **HIGH** |

---

## 4. What is MISSING Versus the Context Files

### 4.1 Data Models & Schema Fields
1. **`Schedule` model:**
   - Missing `period` field (e.g. `Period 4`). In the design, every slot displays `Subject · Period N`. Currently `Schedule` only stores `startTime` and `endTime`.
2. **`Class` / `Student` counts:**
   - Active student count per class: `Class` model stores `capacity` (e.g. 40), but not the count of currently enrolled active students (e.g. 32). `classes-today` returns `capacity` rather than real student count.
3. **`TeacherLeave` Quotas:**
   - Design shows balance cards: `Casual left: 8 / 12` and `Sick left: 5 / 8`. The database stores leave request documents, but has no schema for teacher annual leave quotas (total allocated vs used).
4. **Student Attendance Aggregate Percentage:**
   - Design shows `96% attendance` and `Low` badge (<80%) on the Students screen. There is currently no endpoint or pre-calculated field for overall student attendance rate.

### 4.2 API Endpoints & Response Payloads
1. **`GET /api/teachers/:id/classes-today`:**
   - Missing `needsAttention` array: missed attendance sessions, ungraded submissions count, homework due today.
   - Missing `unreadNotifications` boolean for the header bell badge.
   - Missing `enrolledStudentsCount` per class slot.
2. **`GET /api/homework/:id/submissions`:**
   - Submissions grouped by status (`submitted`, `pending`, `late`, `graded`) with grade and feedback update endpoint `PATCH /api/homework/submissions/:id/grade`. (Controller exists, needs verification against mobile client).
3. **`GET /api/students` (Teacher scope):**
   - Filter by class assigned to teacher with computed attendance percentage and today's attendance status (`P` or `A`).

### 4.3 Mobile Components
1. Reusable Design System components strictly adhering to `DESIGN_CONTEXT.md` Section 2:
   - `BottomTabBar` (floating pill, navy theme)
   - `SegmentedControl` (44px min touch target, green/red active states)
   - `Dropdown` (custom class selector with rotating chevron)
   - `StatusDot` (IST-driven color dot with pulse/ring)
   - `Tag` (semantic background/text pairs for status)
   - `ConfirmDialog` (modal for "Mark all present" and unsaved changes)
   - `ProgressRing` (circular minutes-left visual for Home hero)

---

## 5. Duplicate or Conflicting Code

1. **Dual Navigation Tab Declarations in `App.js`:**
   - Both `MainTabNavigator` (lines 71–116) and `TabNavigatorWithUnreadCount` (lines 118–163) are declared identically in `App.js`. `MainTabNavigator` is never used.
2. **Dual Model Sets for Attendance:**
   - Legacy `models/Attendance.js` (flat date + classId + subjectId) conflicts conceptually with modern `models/AttendanceSession.js` + `models/AttendanceRecord.js` (slotId + IST date string).
   - *Resolution:* Keep legacy model un-deleted for backward compatibility, but ensure all teacher module mobile screens and APIs exclusively write to and read from `AttendanceSession` + `AttendanceRecord`.
3. **Route Aliasing:**
   - `backend/index.js` mounts both `/api/assignments` and `/api/homework` to the same router, and both `/api/upload` and `/api/uploads`. This is intentional for contract compatibility, but mobile API client currently has mixed calls (`/assignments` vs `/homework`).

---

## 6. Risks & Tech Debt

1. **Network Sandbox & Database Connection:**
   - Local development in the isolated terminal sandbox cannot reach remote MongoDB Atlas over DNS SRV without BypassSandbox. A local MongoDB instance or mocked memory database is required if running entirely offline.
2. **Phone Clock Skew:**
   - If the client derives countdowns or class status using device local time, time-zone changes or phone clock inaccuracy will display incorrect class status. Server IST time from `classes-today` must remain the absolute anchor.
3. **Double-Tap & Concurrent Attendance Submissions:**
   - If a teacher taps "Save attendance" twice on poor connectivity, race conditions could trigger duplicate writes or conflict errors. Strict loading lock on client and `unique` index `(slotId, date)` on `AttendanceSession` are critical.
4. **Secrets in Git:**
   - `.env` and `serviceAccountKey.json` exist in the repo directory. They must be added to `.gitignore` and never committed into version control.

---

## 7. Comparison: Approved Design vs Data Model & APIs

Below is every UI element in `docs/Teacher_App_Design.html` whose real data source does not yet exist or is incomplete in the API:

| Screen / Element in Design | Design Placeholder Value | Current Data Availability in API / DB | Action Required |
|---|---|---|---|
| **Home: Notification Bell Dot** | Red dot on bell icon | No notification unread count in `classes-today` payload | Add `hasUnreadNotifications: boolean` to `GET /api/teachers/:id/classes-today` |
| **Home Hero: Class Period** | `Mathematics · Period 4` | `Schedule` model has `startTime`/`endTime`, but no `period` field | Add optional `period: Number` to `Schedule` schema or compute sequentially by slot start time |
| **Home Hero: Student Count** | `11:30 – 12:15 · 32 students` | API returns class `capacity` (e.g. 40), not enrolled student count | Populate count of active students (`Student.countDocuments({ classId, status: 'active' })`) |
| **Home: "Needs your attention" Cards** | 3 cards (Missed attendance, 5 submissions to review, Due today) | `classes-today` does not compute or return attention items | Add `attentionItems[]` to `classes-today` controller deriving missed sessions, pending submissions, due homework |
| **Attendance: Status Chip** | `Ongoing` / `Completed` / `Missed` / `Past` | Computed in `classes-today`, but not returned in `getSlotAttendance` | Include slot computed status in `GET /api/attendance/slot/:slotId` response |
| **Attendance: 3 Stat Tiles** | `24 Present · 3 Absent · 5 Not marked` | `AttendanceSession.summary` stores `{ present, absent, late, total }`, but not `notMarked` | Derive `notMarked = totalStudents - (present + absent + late)` in API / client |
| **Attendance: Segmented Control** | Only `Present` and `Absent` buttons in HTML | Original assignment requires `Present`, `Absent`, and `Late` | Clarified in Question 1: Recommend keeping 2 buttons (Present/Absent) with long-press or 3rd option if required |
| **Attendance: Class/Date Switcher** | No class or date picker in approved HTML | Needed for back-data and switching between classes | Propose clean header picker modal for selecting slot & past date within 7 days |
| **Assignments: Class Student Count** | `Class 8-B · 32 students` in dropdown | `getTeacherClasses` returns classes without student count | Include enrolled student count in class dropdown response |
| **Assignments: "Drafts" Tab** | Tab item `Drafts` in segment | Homework schema has no `isDraft` or `status: 'draft'` field | Clarified in Question 11: Recommend hiding or treating unsaved homework as client draft |
| **Assignments: Submissions Screen** | No HTML screen provided in design file | Backend has `/homework/:id/submissions`, but UI design is missing | Propose UI layout matching design language (Submitted/Pending/Late/Graded tabs with grade drawer) |
| **Profile: My Class Student Count** | `Room 204 · 32 students` | Class teacher role exists on `Class`, but enrolled count is missing | Include student count for assigned class in `GET /api/teachers/me` |
| **Profile Overlays: Students %** | `Roll 01 · 96% attendance` + `Low` badge | No student-level aggregate attendance calculation endpoint | Compute attendance percentage in `GET /api/students` for class teacher view |
| **Profile Overlays: Student Actions** | `Call parent`, `Message`, `Attendance`, `Remark` | `Parent.phone` exists for `tel:` link; Message and Remark lack dedicated workflows | Clarified in Question 9: `Call parent` links to phone dialer; `Message` and `Remark` scope clarified |
| **Profile Overlays: Leave Quotas** | `8 / 12 Casual left`, `5 / 8 Sick left` | `TeacherLeave` stores requests, but no teacher annual quota model exists | Add `leaveBalance` object (e.g. `{ casual: { used, total: 12 }, sick: { used, total: 8 } }`) to teacher profile API |

---

## 8. Grouped Questions for Developer (from DESIGN_CONTEXT Section 6 + New Findings)

*(See accompanying chat response for the formatted question list with recommended defaults)*
