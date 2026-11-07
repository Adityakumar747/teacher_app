import docx
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls
import os

doc = Document()

# Set standard 1-inch margins
for s in doc.sections:
    s.top_margin = Inches(1.0)
    s.bottom_margin = Inches(1.0)
    s.left_margin = Inches(1.0)
    s.right_margin = Inches(1.0)

# Color Palette
COLOR_NAVY = RGBColor(30, 58, 138)      # #1E3A8A
COLOR_DARK = RGBColor(15, 23, 42)       # #0F172A
COLOR_MUTED = RGBColor(100, 116, 139)   # #64748B
COLOR_BLUE = RGBColor(37, 99, 235)      # #2563EB
COLOR_GREEN = RGBColor(5, 150, 105)     # #059669
COLOR_RED = RGBColor(220, 38, 38)       # #DC2626

def set_cell_background(cell, hex_color):
    tcPr = cell._element.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{hex_color}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=140, right=140):
    tcPr = cell._element.get_or_add_tcPr()
    tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}><w:top w:w="{top}" w:type="dxa"/><w:bottom w:w="{bottom}" w:type="dxa"/><w:left w:w="{left}" w:type="dxa"/><w:right w:w="{right}" w:type="dxa"/></w:tcMar>')
    tcPr.append(tcMar)

def add_heading_1(text):
    h = doc.add_paragraph()
    h.paragraph_format.space_before = Pt(18)
    h.paragraph_format.space_after = Pt(6)
    h.paragraph_format.keep_with_next = True
    run = h.add_run(text)
    run.font.size = Pt(14.5)
    run.font.bold = True
    run.font.color.rgb = COLOR_NAVY
    return h

def add_heading_2(text):
    h = doc.add_paragraph()
    h.paragraph_format.space_before = Pt(12)
    h.paragraph_format.space_after = Pt(4)
    h.paragraph_format.keep_with_next = True
    run = h.add_run(text)
    run.font.size = Pt(11.5)
    run.font.bold = True
    run.font.color.rgb = COLOR_BLUE
    return h

def add_paragraph(text, bold_prefix="", italic=False):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(5)
    p.paragraph_format.line_spacing = 1.15
    if bold_prefix:
        r_b = p.add_run(bold_prefix)
        r_b.font.size = Pt(9.5)
        r_b.font.bold = True
        r_b.font.color.rgb = COLOR_DARK
    r = p.add_run(text)
    r.font.size = Pt(9.5)
    r.font.italic = italic
    r.font.color.rgb = COLOR_DARK
    return p

def add_bullet(text, bold_prefix=""):
    p = doc.add_paragraph(style='List Bullet')
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.line_spacing = 1.15
    if bold_prefix:
        r_b = p.add_run(bold_prefix)
        r_b.font.size = Pt(9.5)
        r_b.font.bold = True
        r_b.font.color.rgb = COLOR_DARK
    r = p.add_run(text)
    r.font.size = Pt(9.5)
    r.font.color.rgb = COLOR_DARK
    return p

def add_callout(text, bold_title="Key Technical Takeaway:"):
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    c = tbl.cell(0, 0)
    set_cell_background(c, "F8FAFC")
    set_cell_margins(c, 100, 100, 150, 150)
    p = c.paragraphs[0]
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.15
    rb = p.add_run(f"{bold_title} ")
    rb.font.size = Pt(9.0)
    rb.font.bold = True
    rb.font.color.rgb = COLOR_NAVY
    r = p.add_run(text)
    r.font.size = Pt(9.0)
    r.font.color.rgb = COLOR_DARK
    doc.add_paragraph().paragraph_format.space_after = Pt(4)

def add_image_box(image_path, caption_text, width_in_inches=6.2):
    if os.path.exists(image_path):
        p_img = doc.add_paragraph()
        p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_img.paragraph_format.space_before = Pt(6)
        p_img.paragraph_format.space_after = Pt(3)
        run = p_img.add_run()
        run.add_picture(image_path, width=Inches(width_in_inches))
        
        p_cap = doc.add_paragraph()
        p_cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_cap.paragraph_format.space_before = Pt(0)
        p_cap.paragraph_format.space_after = Pt(10)
        r_cap = p_cap.add_run(f"Figure: {caption_text}")
        r_cap.font.size = Pt(8.5)
        r_cap.font.italic = True
        r_cap.font.color.rgb = COLOR_MUTED
    else:
        add_paragraph(f"[Image Missing at: {image_path}]", bold_prefix="Warning: ")

# ==============================================================================
# DOCUMENT HEADER & METADATA TABLE
# ==============================================================================
p_tag = doc.add_paragraph()
p_tag.paragraph_format.space_before = Pt(0)
p_tag.paragraph_format.space_after = Pt(2)
run_tag = p_tag.add_run("SPARKOLOGY ERP — DAY 1 TECHNICAL PROBATION DELIVERABLE")
run_tag.font.size = Pt(9.5)
run_tag.font.bold = True
run_tag.font.color.rgb = COLOR_BLUE

p_title = doc.add_paragraph()
p_title.paragraph_format.space_before = Pt(2)
p_title.paragraph_format.space_after = Pt(4)
run_title = p_title.add_run("System Architecture, Mobile Data Flow & Forensic Code Audit Specification")
run_title.font.size = Pt(20)
run_title.font.bold = True
run_title.font.color.rgb = COLOR_NAVY

p_sub = doc.add_paragraph()
p_sub.paragraph_format.space_before = Pt(0)
p_sub.paragraph_format.space_after = Pt(12)
run_sub = p_sub.add_run("Teacher Mobile Application (React Native / Expo) & Node.js/Express Backend Architecture")
run_sub.font.size = Pt(10.5)
run_sub.font.color.rgb = COLOR_MUTED

tbl_meta = doc.add_table(rows=2, cols=4)
tbl_meta.alignment = WD_TABLE_ALIGNMENT.CENTER
meta_items = [
    ("Candidate / Role", "Aditya (Teacher Mobile & Backend Intern)"),
    ("Deliverable", "Required Deliverable 2: System Architecture (.docx)"),
    ("Submission Date", "November 1, 2026 (Day 1 of Probation)"),
    ("GitHub Repository", "Adityakumar747/sparkology_assigenment")
]
for idx, (label, val) in enumerate(meta_items):
    row = idx // 2
    col = (idx % 2) * 2
    c_lbl = tbl_meta.cell(row, col)
    c_lbl.text = label
    set_cell_background(c_lbl, "F1F5F9")
    set_cell_margins(c_lbl, 60, 60, 100, 100)
    c_lbl.paragraphs[0].runs[0].font.size = Pt(8.5)
    c_lbl.paragraphs[0].runs[0].font.bold = True
    c_lbl.paragraphs[0].runs[0].font.color.rgb = COLOR_MUTED

    c_val = tbl_meta.cell(row, col + 1)
    c_val.text = val
    set_cell_background(c_val, "FFFFFF")
    set_cell_margins(c_val, 60, 60, 100, 100)
    c_val.paragraphs[0].runs[0].font.size = Pt(8.5)
    c_val.paragraphs[0].runs[0].font.bold = True
    c_val.paragraphs[0].runs[0].font.color.rgb = COLOR_DARK

doc.add_paragraph().paragraph_format.space_after = Pt(10)

# ==============================================================================
# SECTION 1: WHOLE STRUCTURE SYSTEM TOPOLOGY & GITDIAGRAM
# ==============================================================================
add_heading_1("1. Whole-Structure System Topology & Architecture Diagram")

add_paragraph(
    "The Sparkology ERP system is architected as a decoupled, multi-tenant educational management platform. "
    "The primary touchpoint for teachers is a cross-platform mobile client built on React Native and Expo, which "
    "communicates with a scalable Node.js / Express REST API and a real-time Socket.IO bi-directional WebSocket cluster. "
    "Data persistence is managed via MongoDB using Mongoose Object-Document Mapping (ODM), enforced with strict school-level "
    "multi-tenant tenant isolation keys."
)

# Embed User Uploaded Diagram
add_image_box(
    "w:/sparkology/docs/architecture_diagram_gitdiagram.png",
    "Complete Sparkology System Architecture & Module Interconnection Topology (GitDiagram)",
    width_in_inches=6.0
)

add_paragraph(
    "As mapped in the architectural topology above, the system is organized across distinct operational tiers:",
    bold_prefix="Architectural Tiers Breakdown: "
)

add_bullet("Employed teachers and staff interacting with the mobile client interface on Android, iOS, or Web preview.", bold_prefix="1. Actor Tier (Teacher): ")
add_bullet("React Native (0.81.5) + Expo (~54.0.31) bundle comprising App.js (root router & stack/tab navigation), socketService.js (event dispatchers & room listeners), and api.js (centralized HTTP fetch client with bearer interceptor).", bold_prefix="2. Teacher Mobile Application: ")
add_bullet("Decoupled authentication boundary integrating Firebase Authentication (client ID tokens) with Express auth middleware (authController.js, middleware/auth.js) for JWT validation and role-based access control.", bold_prefix="3. Identity & Access Management: ")
add_bullet("Teacher-facing screens including AttendanceScreen.js, DashboardScreen.js, MeetingsScreen.js, and AssignmentsScreen.js, driving classroom pedagogy, document dispatch, and student engagement.", bold_prefix="4. Classroom Workflows: ")
add_bullet("Enterprise core managing student records (Student.js), class rosters (Class.js), transport routes (routeController.js), fee generation, course catalogs, and reviews.", bold_prefix="5. School Management Tier: ")
add_bullet("Express API gateway (index.js, port 5000), Socket.IO server (socketHandler.js), Cloudinary asset storage for avatars/materials, and local/Atlas MongoDB persistence.", bold_prefix="6. Backend Platform: ")

add_callout(
    "The client communicates exclusively with the backend via JSON over HTTPS and WebSockets over WSS. "
    "Direct client-to-database communication is completely barred. Every request is authenticated, sanitized, and scoped by schoolId.",
    bold_title="Zero Direct Database Access:"
)

# ==============================================================================
# SECTION 2: HIGH-LEVEL MOBILE FLOW FOR TEACHERS
# ==============================================================================
add_heading_1("2. High-Level Mobile Flow for Teachers")

add_paragraph(
    "The teacher's mobile journey is engineered for rapid execution in real-world school environments where network connectivity "
    "may fluctuate. The flow transitions smoothly from secure authentication to timetable discovery, roster inspection, interactive "
    "marking, and atomic bulk commit."
)

# Embed Generated Teacher Flow Diagram
add_image_box(
    "w:/sparkology/docs/generated_diagrams/diagram_teacher_flow.png",
    "High-Level Teacher Mobile Operational Flow (Authentication -> Discovery -> Roster -> Marking -> Commit)",
    width_in_inches=6.2
)

add_heading_2("2.1 Step 1: Authentication & Identity Hydration")
add_paragraph(
    "When the teacher launches the app, App.js invokes AuthContext.js to inspect local AsyncStorage for an existing valid authToken. "
    "If unauthenticated, the user is presented with the LoginScreen.js. Upon entering their email and password, the client authenticates "
    "against Firebase Auth to obtain a signed Firebase ID Token. This token is immediately exchanged with the backend via POST /api/auth/firebase-login, "
    "which verifies the signature against Firebase Admin SDK, locates the teacher in MongoDB, and signs a 7-day backend JWT. "
    "The token and teacher profile are saved to AsyncStorage, unlocking the MainTabNavigator."
)

add_heading_2("2.2 Step 2: Assigned Classes & Daily Timetable Discovery")
add_paragraph(
    "Once authenticated, the teacher lands on the DashboardScreen.js. The app automatically determines the current day of the week (e.g. 'Monday') "
    "and calls GET /api/schedules?date=YYYY-MM-DD. The backend filters schedules where teacherId matches the logged-in user and dayOfWeek equals today. "
    "The mobile client renders horizontal cards representing each class period (e.g. 'Class 10-A: Mathematics at 09:00 AM in Room 204'). "
    "Tapping 'Take Attendance' deep-links directly into AttendanceScreen.js with the selected classId pre-loaded."
)

add_heading_2("2.3 Step 3: Class Roster & Historical Attendance Lookup")
add_paragraph(
    "AttendanceScreen.js initiates two parallel requests: GET /api/students?classId=<id> to retrieve enrolled students and "
    "GET /api/attendance?classId=<id>&date=<today> to check if attendance has already been recorded for this period. "
    "Students are displayed in a clean, scrollable list showing full name, roll number, and avatar. If records already exist, the UI "
    "hydrates with existing states; otherwise, it primes the roster for quick action."
)

add_heading_2("2.4 Step 4: Interactive Marking & Live Summary")
add_paragraph(
    "For each student row, teachers have access to quick-action pills: Present (Green), Absent (Red), and Late (Orange). "
    "A single-tap 'Mark All Present' action allows teachers to mark the entire classroom present in under 1 second, then selectively toggle "
    "the few absent or late students. An in-memory state manager tracks live counters (e.g. 28 Present, 2 Absent, 1 Late) without triggering "
    "redundant network requests."
)

add_heading_2("2.5 Step 5: Atomic Submission & Real-time Admin Dispatch")
add_paragraph(
    "When the teacher presses 'Submit Attendance', the mobile client packages the 30-40 student records into a single payload and dispatches "
    "POST /api/attendance/bulk. Upon successful commit, the backend emits a WebSocket event (attendance_updated) into the school's admin room, "
    "instantly updating the principal's dashboard without requiring page refreshes."
)

# Optional UI Screenshots
if os.path.exists("w:/sparkology/docs/generated_diagrams/ui_teacher_dashboard.png"):
    add_image_box(
        "w:/sparkology/docs/generated_diagrams/ui_teacher_dashboard.png",
        "Live Mobile App Screen: Teacher Dashboard with Daily Schedule & Attendance Shortcuts",
        width_in_inches=5.2
    )

# ==============================================================================
# SECTION 3: TEACHER AUTH TOKEN HANDLING IN API REQUESTS
# ==============================================================================
add_heading_1("3. How Teacher Auth Tokens are Handled in API Requests")

add_paragraph(
    "Security in Sparkology ERP relies on a dual-token architecture that combines Firebase Authentication for external identity verification "
    "with cryptographically signed JSON Web Tokens (JWT) for stateless, multi-tenant API authorization."
)

# Embed Token Diagram
add_image_box(
    "w:/sparkology/docs/generated_diagrams/diagram_token_handling.png",
    "Detailed Auth Token Lifecycle: Firebase ID Token Exchange, Bearer Injection & Middleware Route Guards",
    width_in_inches=6.2
)

add_heading_2("3.1 Dual-Token Exchange Protocol")
add_paragraph(
    "1. Firebase Authentication: The teacher signs in through Firebase Auth Client SDK on the device, producing a short-lived Firebase ID Token.\n"
    "2. Server Exchange: The ID token is transmitted in the body of POST /api/auth/firebase-login to the Express API.\n"
    "3. Admin Verification: backend/config/firebase-admin.js executes verifyIdToken(idToken) to cryptographically confirm the user's Google UID and email.\n"
    "4. Local JWT Minting: Upon finding the corresponding User record in MongoDB, generateToken() signs a backend JWT payload containing { id: user._id, role: user.role, schoolId: user.schoolId } using JWT_SECRET with an expiration of 7 days.\n"
    "5. Secure Client Storage: The mobile app stores this backend JWT in AsyncStorage under the key 'authToken'."
)

add_heading_2("3.2 Outgoing Request Interception (ApiService.js)")
add_paragraph(
    "All outgoing HTTP requests from the mobile app are channeled through a singleton ApiService class (spark_teacher/services/api.js). "
    "Before any request is dispatched over the wire, ApiService executes an asynchronous token injection routine:"
)

# Code Snippet in Word Table
tbl_code = doc.add_table(rows=1, cols=1)
tbl_code.alignment = WD_TABLE_ALIGNMENT.CENTER
c_code = tbl_code.cell(0, 0)
set_cell_background(c_code, "F8FAFC")
set_cell_margins(c_code, 80, 80, 120, 120)
p_c = c_code.paragraphs[0]
p_c.paragraph_format.line_spacing = 1.05
code_text = (
    "// ApiService.js Bearer Token Injection\n"
    "async request(endpoint, options = {}) {\n"
    "  const url = `${this.baseURL}${endpoint}`;\n"
    "  const token = await AsyncStorage.getItem('authToken');\n"
    "  const config = {\n"
    "    headers: {\n"
    "      'Content-Type': 'application/json',\n"
    "      ...(token && { Authorization: `Bearer ${token}` }),\n"
    "      ...options.headers,\n"
    "    },\n"
    "    ...options,\n"
    "  };\n"
    "  return fetch(url, config);\n"
    "}"
)
r_code = p_c.add_run(code_text)
r_code.font.size = Pt(8.0)
r_code.font.name = "Consolas"
r_code.font.color.rgb = COLOR_DARK
doc.add_paragraph().paragraph_format.space_after = Pt(4)

add_heading_2("3.3 Backend Middleware Gateway (middleware/auth.js)")
add_paragraph(
    "When the request reaches the Express API gateway, it passes through three sequential security layers:\n"
    "• protect() Middleware: Inspects req.headers.authorization for the 'Bearer ' prefix, strips the token, and calls jwt.verify(token, process.env.JWT_SECRET). "
    "If valid, it queries MongoDB to verify the user account is active (isActive: true, isLocked: false) and attaches the full user document to req.user.\n"
    "• authorize('teacher') Middleware: Inspects req.user.role to verify Role-Based Access Control (RBAC). Requests from unauthorized roles are rejected with HTTP 403 Forbidden.\n"
    "• Multi-Tenant Isolation Enforcement: All downstream database queries explicitly filter by { schoolId: req.user.schoolId }, preventing cross-school data tampering."
)

# ==============================================================================
# SECTION 4: DATABASE SCHEMAS RELATED TO MODULE
# ==============================================================================
add_heading_1("4. Database Schemas Related to Module")

add_paragraph(
    "The teacher's operational domain interacts with six foundational collections in MongoDB. "
    "All models adhere to Mongoose strict schemas with timestamp tracking, sparse indexes for unique fields, and compound indexes "
    "for fast multi-tenant querying."
)

# Embed ER Diagram
add_image_box(
    "w:/sparkology/docs/generated_diagrams/diagram_er_schemas.png",
    "Entity Relationship Diagram: Users (Teachers), Classes, TeacherAttendance, Attendance, Schedules & Students",
    width_in_inches=6.2
)

# Schema Tables Helper
def create_schema_table(headers, rows_data):
    tbl = doc.add_table(rows=len(rows_data) + 1, cols=len(headers))
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    # Header
    for c_idx, h_text in enumerate(headers):
        cell = tbl.cell(0, c_idx)
        cell.text = h_text
        set_cell_background(cell, "1E3A8A")
        set_cell_margins(cell, 60, 60, 80, 80)
        p = cell.paragraphs[0]
        p.runs[0].font.size = Pt(8.5)
        p.runs[0].font.bold = True
        p.runs[0].font.color.rgb = RGBColor(255, 255, 255)
    # Rows
    for r_idx, r_data in enumerate(rows_data):
        bg = "FFFFFF" if r_idx % 2 == 0 else "F8FAFC"
        for c_idx, val in enumerate(r_data):
            cell = tbl.cell(r_idx + 1, c_idx)
            cell.text = val
            set_cell_background(cell, bg)
            set_cell_margins(cell, 50, 50, 80, 80)
            p = cell.paragraphs[0]
            p.runs[0].font.size = Pt(8.0)
            p.runs[0].font.color.rgb = COLOR_DARK
            if c_idx == 0:
                p.runs[0].font.bold = True
    doc.add_paragraph().paragraph_format.space_after = Pt(6)

add_heading_2("4.1 Teachers / Users Collection (models/User.js)")
add_paragraph("Stores system credentials, personal information, school affiliation, and role assignment for all teaching staff.")
user_rows = [
    ("_id", "ObjectId", "Primary Key, auto-generated MongoDB identifier"),
    ("name", "String", "Full legal name of the teacher (required, trimmed)"),
    ("email", "String", "Unique email identifier; sparse index enables multi-tenant uniqueness"),
    ("password", "String", "Bcrypt hashed password (salt rounds: 10); select: false on queries"),
    ("role", "String", "Role enum: 'teacher', 'admin', 'school_admin' (default: 'teacher')"),
    ("schoolId", "ObjectId", "Foreign Key -> School collection; scopes all operations"),
    ("phone", "String", "Contact phone number; sparse unique index"),
    ("avatar", "String", "Cloudinary asset URL for profile picture"),
    ("isActive", "Boolean", "Account status flag; checked on every protect() request (default: true)"),
    ("loginAttempts", "Number", "Consecutive failed login counter; locks account if >= 5"),
    ("lockUntil", "Date", "Timestamp until which the user account remains locked")
]
create_schema_table(["Field Name", "Type", "Constraints & Description"], user_rows)

add_heading_2("4.2 Classes Collection (models/Class.js)")
add_paragraph("Defines standard academic cohorts, room allocations, enrolled student limits, and assigned class teachers.")
class_rows = [
    ("_id", "ObjectId", "Primary Key identifier"),
    ("name", "String", "Class name (e.g. 'Class 10', 'Grade 9')"),
    ("section", "String", "Section letter (e.g. 'A', 'B', 'C')"),
    ("teacherId", "ObjectId", "Foreign Key -> User (Class Teacher responsible for overall cohort)"),
    ("schoolId", "ObjectId", "Foreign Key -> School (Multi-tenant partition key)"),
    ("capacity", "Number", "Maximum student seating limit (default: 40)"),
    ("room", "String", "Classroom number or physical wing location (e.g. 'Room 204')"),
    ("subjects", "Array[ObjectId]", "Array of Foreign Keys referencing Subject curriculum models"),
    ("academicYear", "String", "Current operating academic term (e.g. '2026-2027')"),
    ("status", "String", "Cohort status: 'active', 'archived', 'graduated'")
]
create_schema_table(["Field Name", "Type", "Constraints & Description"], class_rows)

add_heading_2("4.3 TeacherAttendance Collection (models/TeacherAttendance.js)")
add_paragraph("Maintains daily clock-in / clock-out records for faculty members, marked by school administration.")
teach_att_rows = [
    ("_id", "ObjectId", "Primary Key identifier"),
    ("schoolId", "ObjectId", "Foreign Key -> School (Part of compound unique index)"),
    ("teacherId", "ObjectId", "Foreign Key -> User (Part of compound unique index)"),
    ("date", "Date", "Midnight date timestamp (Part of compound unique index)"),
    ("status", "String", "Staff status enum: 'present', 'absent', 'late', 'half-day'"),
    ("checkInTime", "Date", "Biometric or administrative check-in timestamp"),
    ("checkOutTime", "Date", "Biometric or administrative check-out timestamp"),
    ("remarks", "String", "Administrative leave notes or reason for tardiness"),
    ("markedBy", "ObjectId", "Foreign Key -> User (School administrator who recorded entry)")
]
create_schema_table(["Field Name", "Type", "Constraints & Description"], teach_att_rows)

add_heading_2("4.4 Student Attendance Collection (models/Attendance.js)")
add_paragraph("Captures individual student session attendance marked by teachers during scheduled class periods.")
att_rows = [
    ("_id", "ObjectId", "Primary Key identifier"),
    ("schoolId", "ObjectId", "Foreign Key -> School (Compound unique index)"),
    ("studentId", "ObjectId", "Foreign Key -> Student (Compound unique index)"),
    ("classId", "ObjectId", "Foreign Key -> Class identifier"),
    ("subjectId", "ObjectId", "Foreign Key -> Subject (Compound unique index; distinguishes periods)"),
    ("teacherId", "ObjectId", "Foreign Key -> User (Teacher who conducted the class)"),
    ("date", "Date", "Midnight normalized Date object (Compound unique index)"),
    ("status", "String", "Student status: 'present', 'absent', 'late', 'excused'"),
    ("remarks", "String", "Teacher observations (e.g. 'Doctor appointment')"),
    ("markedBy", "ObjectId", "Foreign Key -> User (Audit field for accountability)")
]
create_schema_table(["Field Name", "Type", "Constraints & Description"], att_rows)

# ==============================================================================
# SECTION 5: FORENSIC CODE AUDIT — BUGS & BOTTLENECKS
# ==============================================================================
add_heading_1("5. Forensic Code Audit: Identified Bugs & Performance Bottlenecks")

add_paragraph(
    "A thorough forensic audit of the mobile app and backend revealed 8 structural defects, ranging from critical database "
    "concurrency bottlenecks to UI state bugs. The remediation of these defects forms the core engineering roadmap for this assessment."
)

audit_rows = [
    ("1", "CRITICAL", "attendanceController.js:136", "Sequential N+1 DB Queries: Bulk attendance runs a sequential for loop executing 4 queries per student. For 40 students = 160 DB round-trips (3500ms latency).", "Replace with atomic Attendance.bulkWrite() with updateOne({ upsert: true }). Latency drops to < 50ms."),
    ("2", "HIGH", "AttendanceScreen.js:891", "UI Button Color Bug: selectedButton class sets backgroundColor: '#007AFF' for all active buttons, making Present, Absent, and Late all appear generic blue.", "Isolate selected styling to respective theme colors: Emerald (#34C759), Crimson (#FF3B30), and Amber (#FF9500)."),
    ("3", "MEDIUM", "assignments.js & meetings.js", "Duplicate Route Logic: Separate routes /api/assignments/teacher/classes and /api/meetings/teacher/classes perform identical class aggregation.", "Standardize under single REST endpoint: GET /api/teachers/:id/classes-today."),
    ("4", "CRITICAL", "attendanceController.js:59", "Epoch Timestamp Type Mismatch: setHours(0,0,0,0) returns an integer number in ms, NOT a Date object, causing query failures or UTC timezone shifts.", "Wrap with new Date(new Date(date).setHours(0,0,0,0))."),
    ("5", "HIGH", "routes/classes.js:22", "RBAC Authorization Flaw: GET /api/classes is locked to authorize('school_admin'), preventing teachers from directly discovering their cohorts.", "Provide teacher scope or dedicated teacher-accessible class listing endpoint."),
    ("6", "MEDIUM", "AttendanceScreen.js:60", "Network Overfetching: Calling generic GET /api/schedules transfers heavy unneeded metadata (semester, createdBy, notes) on cellular connections.", "Route to lightweight classes-today endpoint returning only classId, subject, room, and timings (~1.5 KB)."),
    ("7", "HIGH", "models/Attendance.js:72", "E11000 Duplicate Key Crash: Concurrent or re-submitted attendance throws unhandled duplicate key error on compound index.", "Use idempotent upserts with upsert: true in bulkWrite."),
    ("8", "LOW", "ComplaintsScreen.js:1", "Dead UI Screen: Complaint creation form is fully rendered but has zero backend API wiring.", "Connect to complaint ticket endpoint or disable navigation button until Phase 2.")
]
create_schema_table(["#", "Severity", "Location", "Identified Problem", "Proposed Engineering Fix"], audit_rows)

# ==============================================================================
# SECTION 6: DAY-BY-DAY EXECUTION PLAN
# ==============================================================================
add_heading_1("6. Day-by-Day Execution Plan for this Week")

add_paragraph(
    "To ensure high engineering velocity and zero regression, the technical deliverables are structured into a 7-day milestone sprint. "
    "Each day targets a distinct architectural tier with verifiable test criteria."
)

# Embed Execution Roadmap
add_image_box(
    "w:/sparkology/docs/generated_diagrams/diagram_execution_roadmap.png",
    "7-Day Technical Probation Sprint Roadmap & Deliverable Milestones",
    width_in_inches=6.2
)

plan_rows = [
    ("Day 1 (Today)", "System Architecture & Audit", "Complete end-to-end code audit; create Day 1 Architecture Word Document; setup Git repo without docs folder; verify live Expo preview."),
    ("Day 2", "Frontend Bug Fixes & Quick Actions", "Fix AttendanceScreen button color-override bug; implement Emerald/Crimson/Amber pills; build 'Mark All Present' 1-tap shortcut with confirmation modal."),
    ("Day 3", "Frontend Live Summary & Polish", "Build sticky bottom Live Summary Bar (P/A/L counts & percentages); implement useMemo() for student list; polish search bar filtering responsiveness."),
    ("Day 4", "Backend Bulk Rewrite (High Perf)", "Replace sequential for loop in attendanceController.js with Attendance.bulkWrite(); implement atomic upsert: true; benchmark < 50ms latency for 100 students."),
    ("Day 5", "Unified Classes-Today API", "Implement GET /api/teachers/:id/classes-today; deprecate duplicate assignments/meetings class routes; add express-validator sanitizers; wire Socket.IO events."),
    ("Day 6", "End-to-End Integration & Security Audit", "Conduct cross-school multi-tenant penetration tests; verify token expiration handling; execute full mobile-to-backend integration test suites."),
    ("Day 7", "Defense Rehearsal & Final Handover", "Rehearse live code walkthrough defense; record demonstration video; finalize Google Sheet daily progress tracker; deliver production package.")
]
create_schema_table(["Timeline", "Focus Area", "Verifiable Engineering Deliverables"], plan_rows)

# Footer Note
add_callout(
    "All architecture, code changes, and execution steps follow strict industrial standard guidelines: "
    "multi-tenant data safety, stateless token authentication, sub-50ms database operations, and clean mobile responsiveness.",
    bold_title="Engineering Commitment:"
)

output_path = "w:/sparkology/docs/Sparkology_Day1_System_Architecture_Aditya.docx"
doc.save(output_path)
print(f"Successfully generated full architecture docx at: {output_path}")
