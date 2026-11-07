import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np
import os

os.makedirs('w:/sparkology/docs/generated_diagrams', exist_ok=True)

# Set global styles
plt.rcParams['font.sans-serif'] = 'DejaVu Sans'
plt.rcParams['font.size'] = 10
plt.rcParams['axes.edgecolor'] = '#CBD5E1'
plt.rcParams['axes.linewidth'] = 1.0

# -------------------------------------------------------------
# 1. High-Level Teacher Mobile Flow Diagram
# -------------------------------------------------------------
fig, ax = plt.subplots(figsize=(12, 6.5), dpi=300)
ax.set_xlim(0, 12)
ax.set_ylim(0, 7)
ax.axis('off')

# Title
ax.text(0.5, 6.5, "High-Level Teacher Mobile Application Workflow", fontsize=15, fontweight='bold', color='#0F172A')
ax.text(0.5, 6.15, "End-to-End Progression: Auth -> Assigned Classes Discovery -> Attendance Marking -> Realtime Broadcast", fontsize=10, color='#64748B')

steps = [
    {
        "num": "01",
        "title": "Authentication",
        "sub": "Firebase Client SDK\n+ JWT Token Exchange\nLocal Persistence in\nAsyncStorage ('authToken')",
        "color": "#2563EB",
        "bg": "#EFF6FF",
        "border": "#BFDBFE",
        "x": 0.5, "y": 1.5, "w": 2.0, "h": 4.0
    },
    {
        "num": "02",
        "title": "Class Discovery",
        "sub": "Fetch Today's Timetable\nGET /api/schedules\nor /classes-today\nFilter by Day of Week\n& Teacher ObjectId",
        "color": "#0D9488",
        "bg": "#F0FDFA",
        "border": "#99F6E4",
        "x": 2.8, "y": 1.5, "w": 2.0, "h": 4.0
    },
    {
        "num": "03",
        "title": "Student Roster",
        "sub": "GET /api/students\nScoped by classId\nLoads Student Profiles,\nRoll Numbers & Existing\nDaily Attendance Records",
        "color": "#7C3AED",
        "bg": "#F5F3FF",
        "border": "#DDD6FE",
        "x": 5.1, "y": 1.5, "w": 2.0, "h": 4.0
    },
    {
        "num": "04",
        "title": "Interactive Marking",
        "sub": "Present / Absent / Late\nColor-Coded Quick Pills\n'Mark All Present' Shortcut\nReal-time In-Memory\nSummary Calculation",
        "color": "#D97706",
        "bg": "#FFFBEB",
        "border": "#FDE68A",
        "x": 7.4, "y": 1.5, "w": 2.0, "h": 4.0
    },
    {
        "num": "05",
        "title": "Atomic Commit",
        "sub": "POST /api/attendance/bulk\nOptimized bulkWrite\nAtomic Upsert (1 Round-Trip)\nSocket.IO Live Broadcast\nTo Admin Dashboard",
        "color": "#059669",
        "bg": "#ECFDF5",
        "border": "#A7F3D0",
        "x": 9.7, "y": 1.5, "w": 2.0, "h": 4.0
    }
]

for s in steps:
    # Outer Card
    rect = patches.FancyBboxPatch((s['x'], s['y']), s['w'], s['h'],
                                  boxstyle="round,pad=0.1,rounding_size=0.15",
                                  facecolor=s['bg'], edgecolor=s['border'], linewidth=1.5)
    ax.add_patch(rect)
    
    # Step Number Badge
    badge = patches.FancyBboxPatch((s['x'] + 0.15, s['y'] + s['h'] - 0.7), 0.6, 0.5,
                                  boxstyle="round,pad=0.05,rounding_size=0.08",
                                  facecolor=s['color'], edgecolor='none')
    ax.add_patch(badge)
    ax.text(s['x'] + 0.45, s['y'] + s['h'] - 0.45, s['num'], fontsize=11, fontweight='bold', color='white', ha='center', va='center')
    
    # Title
    ax.text(s['x'] + 0.85, s['y'] + s['h'] - 0.45, s['title'], fontsize=10.5, fontweight='bold', color='#1E293B', va='center')
    
    # Body text
    ax.text(s['x'] + 0.15, s['y'] + s['h'] - 1.2, s['sub'], fontsize=8.5, color='#334155', va='top', linespacing=1.4)

# Connecting arrows
for i in range(len(steps) - 1):
    x_start = steps[i]['x'] + steps[i]['w'] + 0.05
    x_end = steps[i+1]['x'] - 0.05
    y_pos = 3.5
    ax.annotate('', xy=(x_end, y_pos), xytext=(x_start, y_pos),
                arrowprops=dict(arrowstyle="->,head_width=0.35,head_length=0.4", color='#64748B', lw=1.8))

# Bottom Notes Box
note_rect = patches.FancyBboxPatch((0.5, 0.3), 11.2, 0.9,
                                  boxstyle="round,pad=0.1,rounding_size=0.1",
                                  facecolor='#F8FAFC', edgecolor='#E2E8F0', linewidth=1.0)
ax.add_patch(note_rect)
ax.text(0.7, 0.85, "Key Architecture Principle:", fontsize=9, fontweight='bold', color='#1E3A8A')
ax.text(0.7, 0.55, "Mobile client maintains local offline tolerance; state persists in AsyncStorage; network failures trigger graceful fallbacks; atomic bulkWrite guarantees zero partial writes.", fontsize=8.2, color='#475569')

plt.tight_layout()
plt.savefig('w:/sparkology/docs/generated_diagrams/diagram_teacher_flow.png', bbox_inches='tight')
plt.close()
print("Created diagram_teacher_flow.png")

# -------------------------------------------------------------
# 2. Token Lifecycle & Bearer Header Flow Diagram
# -------------------------------------------------------------
fig, ax = plt.subplots(figsize=(12, 6.5), dpi=300)
ax.set_xlim(0, 12)
ax.set_ylim(0, 7)
ax.axis('off')

ax.text(0.5, 6.5, "Teacher Authentication Token Lifecycle & Security Gateway Flow", fontsize=15, fontweight='bold', color='#0F172A')
ax.text(0.5, 6.15, "Dual-Token Architecture: Firebase ID Token Exchange -> Backend Signed JWT -> Route Guard Enforcement", fontsize=10, color='#64748B')

# Draw Tiers
tiers = [
    {"name": "Client Layer (Mobile App)", "x": 0.5, "y": 1.2, "w": 3.2, "h": 4.6, "bg": "#F0FDF4", "border": "#BBF7D0", "head_c": "#166534"},
    {"name": "External Auth Tier", "x": 4.1, "y": 3.6, "w": 3.6, "h": 2.2, "bg": "#FFFBEB", "border": "#FDE68A", "head_c": "#92400E"},
    {"name": "Backend API Gateway", "x": 4.1, "y": 1.2, "w": 3.6, "h": 2.1, "bg": "#EFF6FF", "border": "#BFDBFE", "head_c": "#1E40AF"},
    {"name": "Persistence & Multi-Tenancy", "x": 8.1, "y": 1.2, "w": 3.4, "h": 4.6, "bg": "#FAF5FF", "border": "#E9D5FF", "head_c": "#6B21A8"}
]

for t in tiers:
    rect = patches.FancyBboxPatch((t['x'], t['y']), t['w'], t['h'],
                                  boxstyle="round,pad=0.08,rounding_size=0.12",
                                  facecolor=t['bg'], edgecolor=t['border'], linewidth=1.2)
    ax.add_patch(rect)
    ax.text(t['x'] + 0.15, t['y'] + t['h'] - 0.3, t['name'], fontsize=9.5, fontweight='bold', color=t['head_c'])

# Components inside Client Layer
comps_client = [
    {"title": "1. LoginScreen.js", "desc": "Captures credentials", "y": 4.2},
    {"title": "2. AuthContext.js", "desc": "Coordinates ID token exchange", "y": 3.1},
    {"title": "3. AsyncStorage", "desc": "Encrypted 'authToken' storage", "y": 2.0},
    {"title": "4. ApiService Interceptor", "desc": "Injects Authorization: Bearer <JWT>", "y": 1.3}
]
for c in comps_client:
    sub = patches.FancyBboxPatch((0.7, c['y']), 2.8, 0.75, boxstyle="round,pad=0.04,rounding_size=0.06",
                                facecolor='white', edgecolor='#CBD5E1', linewidth=1)
    ax.add_patch(sub)
    ax.text(0.85, c['y'] + 0.48, c['title'], fontsize=8.5, fontweight='bold', color='#1E293B')
    ax.text(0.85, c['y'] + 0.2, c['desc'], fontsize=7.5, color='#64748B')

# Components inside External Auth Tier
sub_fb = patches.FancyBboxPatch((4.3, 3.8), 3.2, 1.4, boxstyle="round,pad=0.04,rounding_size=0.08",
                                facecolor='white', edgecolor='#FCD34D', linewidth=1)
ax.add_patch(sub_fb)
ax.text(4.45, 4.85, "Firebase Authentication SDK", fontsize=9, fontweight='bold', color='#B45309')
ax.text(4.45, 4.5, "• signInWithEmailAndPassword()", fontsize=8, color='#475569')
ax.text(4.45, 4.2, "• Returns userCredential & raw ID Token", fontsize=8, color='#475569')
ax.text(4.45, 3.9, "• firebaseAdmin.verifyIdToken()", fontsize=8, color='#475569')

# Components inside Backend API Gateway
sub_gw = patches.FancyBboxPatch((4.3, 1.4), 3.2, 1.5, boxstyle="round,pad=0.04,rounding_size=0.08",
                                facecolor='white', edgecolor='#93C5FD', linewidth=1)
ax.add_patch(sub_gw)
ax.text(4.45, 2.55, "Express Middleware Pipeline", fontsize=9, fontweight='bold', color='#1D4ED8')
ax.text(4.45, 2.25, "• protect(): Strips Bearer, verifies JWT signature", fontsize=7.8, color='#334155')
ax.text(4.45, 1.95, "• Hydrates req.user, req.schoolId from DB", fontsize=7.8, color='#334155')
ax.text(4.45, 1.65, "• authorize('teacher'): Validates RBAC", fontsize=7.8, color='#334155')

# Components inside Persistence
comps_db = [
    {"title": "MongoDB: users Collection", "desc": "Teachers (role: 'teacher', schoolId)", "y": 4.3},
    {"title": "MongoDB: classes Collection", "desc": "Teacher assigned classrooms", "y": 3.2},
    {"title": "MongoDB: attendance Collection", "desc": "Scoped by { schoolId, classId, date }", "y": 2.1},
    {"title": "MongoDB: teacherattendances", "desc": "Staff check-in / check-out history", "y": 1.3}
]
for c in comps_db:
    sub = patches.FancyBboxPatch((8.3, c['y']), 3.0, 0.75, boxstyle="round,pad=0.04,rounding_size=0.06",
                                facecolor='white', edgecolor='#E2E8F0', linewidth=1)
    ax.add_patch(sub)
    ax.text(8.45, c['y'] + 0.48, c['title'], fontsize=8.5, fontweight='bold', color='#1E293B')
    ax.text(8.45, c['y'] + 0.2, c['desc'], fontsize=7.5, color='#64748B')

# Annotated Flow Arrows
ax.annotate('1. Email/Pass', xy=(4.3, 4.8), xytext=(3.5, 4.8),
            arrowprops=dict(arrowstyle="->", color='#D97706', lw=1.5), fontsize=8, color='#D97706')

ax.annotate('2. ID Token', xy=(3.5, 3.5), xytext=(4.3, 4.1),
            arrowprops=dict(arrowstyle="->", color='#D97706', lw=1.5), fontsize=8, color='#D97706')

ax.annotate('3. POST /firebase-login', xy=(4.3, 2.6), xytext=(3.5, 3.2),
            arrowprops=dict(arrowstyle="->", color='#2563EB', lw=1.5), fontsize=8, color='#2563EB')

ax.annotate('4. Store JWT (7d)', xy=(3.5, 2.4), xytext=(4.3, 2.2),
            arrowprops=dict(arrowstyle="->", color='#059669', lw=1.5), fontsize=8, color='#059669')

ax.annotate('5. Authenticated APIs\n(Bearer <JWT>)', xy=(4.3, 1.7), xytext=(3.5, 1.7),
            arrowprops=dict(arrowstyle="->", color='#4338CA', lw=1.5), fontsize=8, color='#4338CA')

ax.annotate('6. Scoped Queries', xy=(8.3, 2.4), xytext=(7.5, 2.4),
            arrowprops=dict(arrowstyle="->", color='#7C3AED', lw=1.5), fontsize=8, color='#7C3AED')

plt.tight_layout()
plt.savefig('w:/sparkology/docs/generated_diagrams/diagram_token_handling.png', bbox_inches='tight')
plt.close()
print("Created diagram_token_handling.png")

# -------------------------------------------------------------
# 3. Database Schema Entity Relationship (ER) Diagram
# -------------------------------------------------------------
fig, ax = plt.subplots(figsize=(12, 7.5), dpi=300)
ax.set_xlim(0, 12)
ax.set_ylim(0, 8)
ax.axis('off')

ax.text(0.5, 7.5, "Sparkology ERP Database Schema Architecture (Teacher Module)", fontsize=15, fontweight='bold', color='#0F172A')
ax.text(0.5, 7.15, "Entity Relationships, Relational Keys, Compound Indexes & Foreign Key Constraints", fontsize=10, color='#64748B')

schema_boxes = [
    {
        "name": "User (Teachers & Staff)",
        "fields": [
            "_id: ObjectId (PK)",
            "name: String",
            "email: String [Unique, Sparse]",
            "password: String [select: false]",
            "role: 'teacher' | 'school_admin'",
            "schoolId: ObjectId (FK -> School)",
            "phone: String [Unique, Sparse]",
            "avatar: String",
            "isActive: Boolean (default: true)",
            "loginAttempts: Number",
            "lockUntil: Date"
        ],
        "x": 0.5, "y": 3.7, "w": 3.3, "h": 3.2,
        "head_c": "#1E40AF", "border": "#BFDBFE", "bg": "#EFF6FF"
    },
    {
        "name": "Class (Assigned Classrooms)",
        "fields": [
            "_id: ObjectId (PK)",
            "name: String (e.g. 'Class 10')",
            "section: String (e.g. 'A')",
            "teacherId: ObjectId (FK -> User)",
            "schoolId: ObjectId (FK -> School)",
            "capacity: Number",
            "room: String",
            "subjects: [ObjectId] (FK -> Subject)",
            "academicYear: String",
            "status: 'active' | 'archived'"
        ],
        "x": 4.3, "y": 3.7, "w": 3.4, "h": 3.2,
        "head_c": "#166534", "border": "#BBF7D0", "bg": "#F0FDF4"
    },
    {
        "name": "Schedule (Timetable Matrix)",
        "fields": [
            "_id: ObjectId (PK)",
            "schoolId: ObjectId (FK -> School)",
            "teacherId: ObjectId (FK -> User)",
            "classId: ObjectId (FK -> Class)",
            "subjectId: ObjectId (FK -> Subject)",
            "dayOfWeek: String ('Monday'..'Sun')",
            "startTime: String ('09:00 AM')",
            "endTime: String ('10:00 AM')",
            "room: String",
            "status: 'active' | 'inactive'"
        ],
        "x": 8.2, "y": 3.7, "w": 3.3, "h": 3.2,
        "head_c": "#7C3AED", "border": "#DDD6FE", "bg": "#F5F3FF"
    },
    {
        "name": "TeacherAttendance",
        "fields": [
            "_id: ObjectId (PK)",
            "schoolId: ObjectId (FK -> School)",
            "teacherId: ObjectId (FK -> User)",
            "date: Date [Compound Unique Index]",
            "status: 'present'|'absent'|'late'|'half-day'",
            "checkInTime: Date",
            "checkOutTime: Date",
            "remarks: String",
            "markedBy: ObjectId (FK -> Admin)"
        ],
        "x": 0.5, "y": 0.3, "w": 3.3, "h": 3.0,
        "head_c": "#991B1B", "border": "#FECACA", "bg": "#FEF2F2"
    },
    {
        "name": "Attendance (Student Daily)",
        "fields": [
            "_id: ObjectId (PK)",
            "schoolId: ObjectId (FK -> School)",
            "studentId: ObjectId (FK -> Student)",
            "classId: ObjectId (FK -> Class)",
            "subjectId: ObjectId (FK -> Subject)",
            "teacherId: ObjectId (FK -> User)",
            "date: Date [Compound Unique Index]",
            "status: 'present' | 'absent' | 'late'",
            "markedBy: ObjectId (FK -> User)"
        ],
        "x": 4.3, "y": 0.3, "w": 3.4, "h": 3.0,
        "head_c": "#92400E", "border": "#FDE68A", "bg": "#FFFBEB"
    },
    {
        "name": "Student (Enrolled Pupils)",
        "fields": [
            "_id: ObjectId (PK)",
            "name: String",
            "rollNumber: String",
            "admissionNumber: String [Unique]",
            "classId: ObjectId (FK -> Class)",
            "schoolId: ObjectId (FK -> School)",
            "gender: 'male' | 'female'",
            "dateOfBirth: Date",
            "isActive: Boolean"
        ],
        "x": 8.2, "y": 0.3, "w": 3.3, "h": 3.0,
        "head_c": "#0E7490", "border": "#A5F3FC", "bg": "#ECFEFF"
    }
]

for b in schema_boxes:
    # Outer box
    rect = patches.FancyBboxPatch((b['x'], b['y']), b['w'], b['h'],
                                  boxstyle="round,pad=0.08,rounding_size=0.1",
                                  facecolor=b['bg'], edgecolor=b['border'], linewidth=1.3)
    ax.add_patch(rect)
    
    # Header box
    head_rect = patches.FancyBboxPatch((b['x'], b['y'] + b['h'] - 0.45), b['w'], 0.45,
                                       boxstyle="round,pad=0.08,rounding_size=0.05",
                                       facecolor=b['head_c'], edgecolor=b['head_c'])
    ax.add_patch(head_rect)
    ax.text(b['x'] + 0.15, b['y'] + b['h'] - 0.23, b['name'], fontsize=9.2, fontweight='bold', color='white', va='center')
    
    # Render fields
    y_text = b['y'] + b['h'] - 0.68
    for f in b['fields']:
        is_pk = "PK" in f
        is_fk = "FK" in f
        is_idx = "Index" in f or "Unique" in f
        
        f_color = '#1E293B'
        if is_pk:
            f_color = '#B91C1C'
        elif is_fk:
            f_color = '#1D4ED8'
        elif is_idx:
            f_color = '#92400E'
            
        ax.text(b['x'] + 0.15, y_text, f, fontsize=7.2, color=f_color, fontfamily='monospace')
        y_text -= 0.22

# Connectors between tables
# User -> Class (teacherId)
ax.annotate('', xy=(4.3, 5.5), xytext=(3.8, 5.5),
            arrowprops=dict(arrowstyle="<|-|>", color='#2563EB', lw=1.4))
ax.text(4.05, 5.65, "1:N", fontsize=7.5, fontweight='bold', color='#2563EB', ha='center')

# Class -> Schedule (classId)
ax.annotate('', xy=(8.2, 5.5), xytext=(7.7, 5.5),
            arrowprops=dict(arrowstyle="<|-|>", color='#7C3AED', lw=1.4))
ax.text(7.95, 5.65, "1:N", fontsize=7.5, fontweight='bold', color='#7C3AED', ha='center')

# User -> TeacherAttendance
ax.annotate('', xy=(2.0, 3.3), xytext=(2.0, 3.7),
            arrowprops=dict(arrowstyle="<|-|>", color='#DC2626', lw=1.4))
ax.text(2.2, 3.5, "1:N", fontsize=7.5, fontweight='bold', color='#DC2626')

# Class -> Attendance (classId)
ax.annotate('', xy=(6.0, 3.3), xytext=(6.0, 3.7),
            arrowprops=dict(arrowstyle="<|-|>", color='#D97706', lw=1.4))
ax.text(6.2, 3.5, "1:N", fontsize=7.5, fontweight='bold', color='#D97706')

# Student -> Attendance (studentId)
ax.annotate('', xy=(7.7, 1.8), xytext=(8.2, 1.8),
            arrowprops=dict(arrowstyle="<|-|>", color='#0E7490', lw=1.4))
ax.text(7.95, 1.95, "1:N", fontsize=7.5, fontweight='bold', color='#0E7490', ha='center')

plt.tight_layout()
plt.savefig('w:/sparkology/docs/generated_diagrams/diagram_er_schemas.png', bbox_inches='tight')
plt.close()
print("Created diagram_er_schemas.png")

# -------------------------------------------------------------
# 4. Day-by-Day Execution Roadmap Diagram
# -------------------------------------------------------------
fig, ax = plt.subplots(figsize=(12, 6.0), dpi=300)
ax.set_xlim(0, 12)
ax.set_ylim(0, 6.5)
ax.axis('off')

ax.text(0.5, 6.0, "Day-by-Day Technical Probation Execution Roadmap (Aditya - Teacher Module)", fontsize=14, fontweight='bold', color='#0F172A')
ax.text(0.5, 5.65, "Structured 7-Day Sprint: Architectural Alignment -> UI Fixes -> Backend Optimization -> Live Defense", fontsize=9.5, color='#64748B')

days = [
    {
        "day": "Day 1 (Today)",
        "badge": "COMPLETE",
        "title": "System Architecture & Audit",
        "tasks": [
            "• End-to-end code audit (frontend + backend)",
            "• Identify 8 critical bugs & N+1 bottlenecks",
            "• Produce .docx System Architecture spec",
            "• Setup Git repo & Day 1 deliverables handover"
        ],
        "bg": "#EFF6FF", "border": "#BFDBFE", "badge_c": "#1D4ED8", "badge_bg": "#DBEAFE",
        "x": 0.5, "y": 3.0, "w": 3.4, "h": 2.4
    },
    {
        "day": "Day 2",
        "badge": "FRONTEND",
        "title": "UI Bug Fixes & Quick Actions",
        "tasks": [
            "• Remove selectedButton blue override bug",
            "• Color-code P (Green), A (Red), L (Orange) pills",
            "• Build 'Mark All Present' 1-tap shortcut",
            "• Add confirmation modal to prevent misclicks"
        ],
        "bg": "#F0FDF4", "border": "#BBF7D0", "badge_c": "#15803D", "badge_bg": "#DCFCE7",
        "x": 4.3, "y": 3.0, "w": 3.4, "h": 2.4
    },
    {
        "day": "Day 3",
        "badge": "FRONTEND",
        "title": "Live Summary Bar & Polish",
        "tasks": [
            "• Build sticky bottom Attendance Summary Bar",
            "• Realtime Present/Absent/Late percentage",
            "• useMemo() optimization for student roster",
            "• Student name & roll search bar responsiveness"
        ],
        "bg": "#FAF5FF", "border": "#E9D5FF", "badge_c": "#7E22CE", "badge_bg": "#F3E8FF",
        "x": 8.1, "y": 3.0, "w": 3.4, "h": 2.4
    },
    {
        "day": "Day 4",
        "badge": "BACKEND",
        "title": "Atomic bulkWrite Architecture",
        "tasks": [
            "• Eliminate sequential loop (160 DB round-trips)",
            "• Implement Attendance.bulkWrite() upsert: true",
            "• Fix setHours() epoch timestamp bug",
            "• Benchmark sub-50ms latency under 100 students"
        ],
        "bg": "#FFFBEB", "border": "#FDE68A", "badge_c": "#B45309", "badge_bg": "#FEF3C7",
        "x": 0.5, "y": 0.3, "w": 3.4, "h": 2.4
    },
    {
        "day": "Day 5",
        "badge": "BACKEND",
        "title": "Unified Classes-Today API",
        "tasks": [
            "• Build GET /api/teachers/:id/classes-today",
            "• Deprecate duplicate assignment/meeting calls",
            "• Add express-validator request sanitizers",
            "• Emit WebSocket attendance_updated events"
        ],
        "bg": "#ECFEFF", "border": "#A5F3FC", "badge_c": "#0E7490", "badge_bg": "#CFFAFE",
        "x": 4.3, "y": 0.3, "w": 3.4, "h": 2.4
    },
    {
        "day": "Day 6 & 7",
        "badge": "DEFENSE",
        "title": "E2E Testing & Final Defense",
        "tasks": [
            "• Multi-tenant security audit (cross-school leaks)",
            "• End-to-end integration tests & screen recording",
            "• Walkthrough defense presentation rehearsal",
            "• Full documentation & codebase handover"
        ],
        "bg": "#FFF1F2", "border": "#FECDD3", "badge_c": "#BE123C", "badge_bg": "#FFE4E6",
        "x": 8.1, "y": 0.3, "w": 3.4, "h": 2.4
    }
]

for d in days:
    rect = patches.FancyBboxPatch((d['x'], d['y']), d['w'], d['h'],
                                  boxstyle="round,pad=0.08,rounding_size=0.1",
                                  facecolor=d['bg'], edgecolor=d['border'], linewidth=1.2)
    ax.add_patch(rect)
    
    # Day Header
    ax.text(d['x'] + 0.15, d['y'] + d['h'] - 0.28, d['day'], fontsize=10, fontweight='bold', color='#1E293B')
    
    # Badge
    b_rect = patches.FancyBboxPatch((d['x'] + d['w'] - 1.1, d['y'] + d['h'] - 0.35), 0.95, 0.25,
                                    boxstyle="round,pad=0.02,rounding_size=0.04",
                                    facecolor=d['badge_bg'], edgecolor='none')
    ax.add_patch(b_rect)
    ax.text(d['x'] + d['w'] - 0.62, d['y'] + d['h'] - 0.23, d['badge'], fontsize=7.2, fontweight='bold', color=d['badge_c'], ha='center', va='center')
    
    # Title
    ax.text(d['x'] + 0.15, d['y'] + d['h'] - 0.58, d['title'], fontsize=9, fontweight='bold', color='#334155')
    
    # Tasks
    y_task = d['y'] + d['h'] - 0.88
    for t in d['tasks']:
        ax.text(d['x'] + 0.15, y_task, t, fontsize=7.8, color='#475569')
        y_task -= 0.32

plt.tight_layout()
plt.savefig('w:/sparkology/docs/generated_diagrams/diagram_execution_roadmap.png', bbox_inches='tight')
plt.close()
print("Created diagram_execution_roadmap.png")
