# Architectural & Design Decisions

## 1. Default Attendance Status: "All Present"
- **Decision:** Keep the initial attendance roster defaulted to "Present" (`P`).
- **Rationale:**
  - Real-world classroom roll-call efficiency: Over 95% of students in typical school classes are present on any given day.
  - Tapping to mark every student individually would require 30 to 40 taps per period. Defaulting to Present allows the teacher to take attendance via "exception marking", only tapping the 1–3 absent students.
  - Submitting attendance is explicit: The teacher still reviews the roster and taps "Save Attendance", which saves an immutable audit session with the submitter's ID.

## 2. 7-Day Attendance Edit Window & Late Marking Flag
- **Decision:** Allow attendance marking/editing up to 7 days in the past, flagging submissions after the class day with `lateMarked: true`. Queries older than 7 days are read-only (`isLocked: true`, `canEdit: false`).
- **Rationale:**
  - Addresses school reality where teachers occasionally need to correct roll calls or submit attendance following a substitute period or network outage.
  - Prevents historical record tampering by locking sessions older than 7 days.
  - Full audit trail diff logs any changes made to an existing session, including previous and new status per student.

## 3. Strict Broken Object Level Authorization (BOLA)
- **Decision:** All resource endpoints (`/api/teachers/:id/classes-today`, `/api/attendance/slot/:id`, `/api/homework`, `/api/leaves`) enforce strict tenant and ownership checks.
- **Rationale:**
  - Teachers may only query or modify slots, classes, and homework for which they are the assigned instructor (verified via `Schedule` and `Subject`).
  - Cross-teacher access attempts immediately return HTTP 403 Forbidden.

## 4. Rate Limiting Strategy
- **Decision:** Multi-tiered rate limiters:
  - Auth routes (`/api/auth/login`, `/api/auth/firebase-login`, `/api/auth/forgot-password`): 30 requests per 15 minutes to mitigate brute-force attacks.
  - General API: 2,000 requests per 15 minutes to support intensive mobile synchronization, real-time polling, and classroom roll calls.
  - Upload routes and static assets bypass the general limiter to prevent throttling during large media submissions.

## 5. Mobile Data Isolation & Fallback Policy
- **Decision:** Strip server filesystem paths (`localPath`) from all JSON serializations.
- **Rationale:**
  - Prevents internal filesystem structure disclosure (OWASP A01/A05).
  - All clients access resources via public signed URLs or web-accessible upload routes.

