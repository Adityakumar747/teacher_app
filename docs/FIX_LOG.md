# Fix Log & Security Hardening Report

## Overview
This document records the production-readiness audit, security fixes, and regression verifications performed across the backend and mobile services. All fixes have been verified against the Protected Behaviours Suite (`backend/tests/regression/protected.test.js`).

---

### [S-01] Weak & Hardcoded JWT Secret Fallback
- **Severity:** Blocker (Security)
- **Root Cause:** `backend/index.js` allowed starting the server with default development secrets (`your-super-secret-jwt-key...` or shorter than 32 characters) without high-entropy generation or production failure.
- **Files Changed:** `backend/index.js`
- **Fix Description:** Implemented a secure startup validator that detects weak/placeholder secrets. In production, the server fails fast if `JWT_SECRET` is missing or < 32 characters. In development, a cryptographically secure 256-bit uncommitted key is automatically generated.
- **Verification Evidence:** `node backend/tests/regression/protected.test.js` -> P1: Valid login returns 200 with JWT token (PASS).
- **Protected Behaviours:** P1, P2 (PASS)
- **Risk / Side Effects:** Existing active sessions must re-authenticate if secret rotates.

---

### [S-08] Static Upload Security Headers (MIME Sniffing Prevention)
- **Severity:** High (Security)
- **Root Cause:** `/uploads` static file middleware served user-uploaded files without `X-Content-Type-Options: nosniff`, allowing potential MIME-type sniffing attacks.
- **Files Changed:** `backend/index.js`
- **Fix Description:** Added `setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff')` to Express static file serving.
- **Verification Evidence:** `GET /uploads/documents/sample.pdf` -> `X-Content-Type-Options: nosniff` header present.
- **Protected Behaviours:** P10 (PASS)
- **Risk / Side Effects:** None; compliant with OWASP security guidelines.

---

### [N-03 / N-04] Internal Server Path Leakage via Assignment Attachments
- **Severity:** High (Information Disclosure)
- **Root Cause:** `backend/models/Assignment.js` schema stored server filesystem paths in `localPath`, which were exposed directly in API JSON responses for assignments and submissions.
- **Files Changed:** `backend/models/Assignment.js`
- **Fix Description:** Added `toJSON` transform to strip `localPath` from assignments and student submissions before serialization.
- **Verification Evidence:** `GET /api/homework` and `GET /api/homework/:id/submissions` contain no `localPath` property.
- **Protected Behaviours:** P8, P10 (PASS)
- **Risk / Side Effects:** None; client uses public URL.

---

### [S-07 / P10] Zero-Byte and Empty File Upload Rejection
- **Severity:** Medium (Input Validation)
- **Root Cause:** `/api/upload` accepted empty or 0-byte file uploads without validation.
- **Files Changed:** `backend/routes/upload.js`
- **Fix Description:** Added check rejecting missing or 0-byte files with HTTP 400.
- **Verification Evidence:** 0-byte upload returns `400 Bad Request`.
- **Protected Behaviours:** P10 (PASS)
- **Risk / Side Effects:** Prevents corrupted zero-length file records.

---

### [D-16] Unassigned Class Homework Creation Vulnerability
- **Severity:** High (Broken Object Level Authorization - BOLA)
- **Root Cause:** `createAssignment` in `backend/controllers/assignmentController.js` only checked `subject.classId` if present, without verifying the teacher's active teaching schedule for the target class.
- **Files Changed:** `backend/controllers/assignmentController.js`
- **Fix Description:** Added schedule-level verification ensuring `Schedule.exists({ schoolId, teacherId, classId, status: 'active' })` or direct subject match. Returns HTTP 403 Forbidden if teacher does not teach the class.
- **Verification Evidence:** `protected.test.js` -> D-16 assertion returns 403 for unauthorized teacher.
- **Protected Behaviours:** P4, P8 (PASS)
- **Risk / Side Effects:** Prevents accidental or malicious cross-class assignment creation.

---

### [D-09 / M-04] Mock Fallbacks & Hardcoded Literals Cleanup
- **Severity:** Medium (Data Integrity)
- **Root Cause:** Fallbacks in `backend/controllers/teacherController.js` returned mock phone `+91 98765 43210` and `Room 101`. Mobile screens had hardcoded `|| 32` fallback values.
- **Files Changed:**
  - `backend/controllers/teacherController.js`
  - `spark_teacher/spark_teacher/screens/AssignmentsScreen.js`
  - `spark_teacher/spark_teacher/screens/DashboardScreen.js`
  - `spark_teacher/spark_teacher/screens/ProfileScreen.js`
- **Fix Description:** Cleaned mock phone and room to `null`. Removed synthetic `32` literals from mobile counts and replaced hardcoded leave balances with clean state defaults.
- **Verification Evidence:** Real database values rendered; no mock student tallies.
- **Protected Behaviours:** P2, P3 (PASS)
- **Risk / Side Effects:** Accurate empty/loading states displayed when data is pending.

---

### [M-01] Attendance Session Idempotency & Audit Trail
- **Severity:** High (Data Integrity)
- **Root Cause:** Concurrent or repeated submissions could create duplicate sessions or overwrite audit history without recording differential changes.
- **Files Changed:** `backend/controllers/attendanceController.js`
- **Fix Description:** Enforced session upsert with compound index `{ slotId: 1, date: 1 }`. Implemented deep diff comparison recording student status transitions (`P` -> `A`) with timestamp and teacher ID.
- **Verification Evidence:** `node backend/tests/attendance-backdate-audit.test.js` -> 27 PASSED (100%).
- **Protected Behaviours:** P6, P7 (PASS)
- **Risk / Side Effects:** Clean idempotent writes with complete accountability.

---

## Regression Suite Summary
```
Suite                                      Status   Passed   Failed
-------------------------------------------------------------------
Protected Behaviours (P1-P16)              PASS     26       0
Attendance & Backdate Audit                PASS     27       0
Homework & Submissions Lifecycle           PASS     41       0
Profile, Schedule & Leave Management       PASS     37       0
Mobile Expo Web Bundler Export             PASS     1        0
-------------------------------------------------------------------
TOTAL                                      PASS     132      0
```

