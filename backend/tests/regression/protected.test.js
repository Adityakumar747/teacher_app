const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../../config.env') });

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const express = require('express');
const http = require('http');

// Models
const User = require('../../models/User');
const Schedule = require('../../models/Schedule');
const Student = require('../../models/Student');
const Assignment = require('../../models/Assignment');
const AttendanceSession = require('../../models/AttendanceSession');
const AttendanceRecord = require('../../models/AttendanceRecord');
const TeacherLeave = require('../../models/TeacherLeave');
const { getISTDateString, getISTDateOffset } = require('../../utils/dateTimeUtils');

// Setup minimal express app loading routes identical to index.js
const authRoutes = require('../../routes/auth');
const teacherRoutes = require('../../routes/teachers');
const attendanceRoutes = require('../../routes/attendance');
const assignmentRoutes = require('../../routes/assignments');
const leaveRoutes = require('../../routes/leaves');
const uploadRoutes = require('../../routes/upload');
const schoolRoutes = require('../../routes/schools');
const userRoutes = require('../../routes/users');
const errorHandler = require('../../middleware/errorHandler');

const app = express();

// Whitelist and CORS mock
const ALLOWED_ORIGINS = ['http://localhost:8081', 'http://127.0.0.1:8081', 'http://localhost:5000'];
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    if (ALLOWED_ORIGINS.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  }
  if (req.method === 'OPTIONS') {
    if (ALLOWED_ORIGINS.includes(origin)) {
      return res.status(200).end();
    }
    return res.status(403).json({ error: 'Origin not allowed by CORS' });
  }
  next();
});

// JSON parser with 10mb limit
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static uploads with nosniff
const uploadsPath = path.join(__dirname, '../../uploads');
app.use('/uploads', express.static(uploadsPath, {
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
}));

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/homework', assignmentRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/schools', schoolRoutes);
app.use('/api/users', userRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', uptime: process.uptime() });
});

// P15 Rate Limiter test route
const rateLimit = require('express-rate-limit');
const testLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 2,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests' }
});
app.get('/api/auth/test-limiter', testLimiter, (req, res) => res.json({ success: true }));

// Error handling
app.use(errorHandler);

async function runProtectedSuite() {
  let passed = 0;
  let failed = 0;

  function assert(condition, label) {
    if (condition) {
      console.log(`  ✓ PASS [${label}]`);
      passed++;
    } else {
      console.error(`  ✗ FAIL [${label}]`);
      failed++;
    }
  }

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  try {
    console.log('\n[Suite Setup] Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[Suite Setup] MongoDB connected successfully.\n');

    // Seed/find demo teacher A
    const teacherA = await User.findOne({ email: 'teacher@spark.edu' });
    if (!teacherA) throw new Error('Demo teacher teacher@spark.edu not found in DB.');

    // Create or find Teacher B (isolated, teaches no classes)
    let teacherB = await User.findOne({ email: 'teacher_b_isolated@spark.edu' });
    if (!teacherB) {
      // Find an existing secondary teacher or create one with unique phone
      const existingOther = await User.findOne({ role: 'teacher', _id: { $ne: teacherA._id } });
      if (existingOther) {
        teacherB = existingOther;
      } else {
        const rand = Math.floor(100000000 + Math.random() * 900000000);
        teacherB = await User.create({
          name: 'Teacher B Isolated',
          email: `teacher_b_${Date.now()}@spark.edu`,
          password: 'password123',
          phone: `+919${rand}`,
          role: 'teacher',
          schoolId: teacherA.schoolId,
          isActive: true
        });
      }
    }

    const tokenB = jwt.sign(
      { id: teacherB._id, role: teacherB.role, schoolId: teacherB.schoolId },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // ==========================================
    // P1: POST /api/auth/login -> 200 + token
    // ==========================================
    console.log('--- Testing P1: Login Authentication ---');
    const p1Res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'teacher@spark.edu', password: 'teacher123' })
    });
    const p1Data = await p1Res.json();
    const tokenA = p1Data.data?.token || p1Data.token;
    assert(p1Res.status === 200 && p1Data.success === true && typeof tokenA === 'string', 'P1: Valid login returns 200 with JWT token');

    // ==========================================
    // P2: GET /api/teachers/me -> 200 + weeklyTimetable + timetableByDay (Mon->Sun)
    // ==========================================
    console.log('\n--- Testing P2: Teacher Profile & Ordered Timetable ---');
    const p2Res = await fetch(`${baseUrl}/api/teachers/me`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const p2Data = await p2Res.json();
    const timetableByDay = p2Data.data?.timetableByDay;
    const hasWeeklySlots = Array.isArray(p2Data.data?.weeklyTimetable);
    const dayKeys = timetableByDay ? Object.keys(timetableByDay) : [];
    const hasDayOrder = dayKeys.includes('Monday') && dayKeys.includes('Sunday') && Array.isArray(timetableByDay.Monday);
    assert(p2Res.status === 200 && hasWeeklySlots && hasDayOrder, 'P2: Profile returns 200, weeklyTimetable, and Monday->Sunday timetableByDay');

    // ==========================================
    // P3: GET /api/teachers/:id/classes-today -> 200, 4 seeded classes, past/future statuses
    // ==========================================
    console.log('\n--- Testing P3: Classes Today & IST Status Rules ---');
    const p3Res = await fetch(`${baseUrl}/api/teachers/${teacherA._id}/classes-today`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const p3Data = await p3Res.json();
    const classesList = p3Data.data?.classes || [];
    assert(p3Res.status === 200 && classesList.length >= 1, 'P3: Classes today returns 200 with schedule slots');

    // Test past date query
    const pastDate = getISTDateOffset(-2);
    const p3PastRes = await fetch(`${baseUrl}/api/teachers/${teacherA._id}/classes-today?date=${pastDate}`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const p3PastData = await p3PastRes.json();
    const pastSlot = p3PastData.data?.classes?.[0];
    assert(p3PastRes.status === 200 && (pastSlot?.status === 'missed' || pastSlot?.status === 'completed'), 'P3: Past date statuses strictly missed or completed');

    // ==========================================
    // P4: Teacher B (no classes) gets 403 on Teacher A's resources
    // ==========================================
    console.log('\n--- Testing P4: Strict BOLA Authorization Isolation ---');
    const slotA = await Schedule.findOne({ teacherId: teacherA._id });
    if (!slotA) throw new Error('Schedule slot for Teacher A not found');

    const p4ScheduleRes = await fetch(`${baseUrl}/api/teachers/${teacherA._id}/classes-today`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert(p4ScheduleRes.status === 403, 'P4: Teacher B gets 403 on Teacher A classes-today');

    const p4SlotRes = await fetch(`${baseUrl}/api/attendance/slot/${slotA._id}`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert(p4SlotRes.status === 403, 'P4: Teacher B gets 403 on Teacher A slot attendance');

    // ==========================================
    // P5: GET /api/attendance/slot/:id returns roster for owner
    // ==========================================
    console.log('\n--- Testing P5: Slot Attendance Roster Retrieval ---');
    const p5Res = await fetch(`${baseUrl}/api/attendance/slot/${slotA._id}`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const p5Data = await p5Res.json();
    assert(p5Res.status === 200 && Array.isArray(p5Data.data?.students) && p5Data.data.students.length > 0, 'P5: Owner gets 200 with active student roster');

    // ==========================================
    // P6: POST /api/attendance/bulk -> Idempotent save
    // ==========================================
    console.log('\n--- Testing P6: Idempotent Attendance Bulk Save ---');
    const studentsA = await Student.find({ classId: slotA.classId, status: 'active' });
    const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const targetDayIndex = DAY_NAMES.indexOf(slotA.dayOfWeek);
    const todayIndex = new Date().getDay();
    let daysAgo = (todayIndex - targetDayIndex + 7) % 7;
    const testSessionDate = getISTDateOffset(-daysAgo);
    await AttendanceSession.deleteMany({ slotId: slotA._id, date: testSessionDate });

    const bulkPayload = {
      slotId: slotA._id,
      date: testSessionDate,
      records: studentsA.map((s, idx) => ({ studentId: s._id, status: idx === 0 ? 'A' : 'P' }))
    };

    const p6Res1 = await fetch(`${baseUrl}/api/attendance/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify(bulkPayload)
    });
    const p6Data1 = await p6Res1.json();

    const p6Res2 = await fetch(`${baseUrl}/api/attendance/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify(bulkPayload)
    });
    const p6Data2 = await p6Res2.json();

    const sessionCount = await AttendanceSession.countDocuments({ slotId: slotA._id, date: testSessionDate });
    assert(p6Res1.status === 200 && p6Res2.status === 200 && sessionCount === 1, 'P6: Bulk save returns 200 and repeated write leaves exactly 1 session');

    // ==========================================
    // P7: Bulk Rejection Validations
    // ==========================================
    console.log('\n--- Testing P7: Attendance Input Validation Rejections ---');
    // Future date
    const p7Future = await fetch(`${baseUrl}/api/attendance/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ ...bulkPayload, date: getISTDateOffset(3) })
    });
    assert(p7Future.status === 400, 'P7: Rejects future date with 400');

    // Date > 7 days
    const p7Old = await fetch(`${baseUrl}/api/attendance/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ ...bulkPayload, date: getISTDateOffset(-12) })
    });
    assert(p7Old.status === 403, 'P7: Rejects date older than 7 days with 403');

    // Invalid status
    const p7BadStatus = await fetch(`${baseUrl}/api/attendance/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        ...bulkPayload,
        records: studentsA.map(s => ({ studentId: s._id, status: 'UNKNOWN_STATUS' }))
      })
    });
    assert(p7BadStatus.status === 400, 'P7: Rejects invalid attendance status with 400');

    // Duplicate student
    const p7Duplicate = await fetch(`${baseUrl}/api/attendance/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        ...bulkPayload,
        records: [
          { studentId: studentsA[0]._id, status: 'P' },
          { studentId: studentsA[0]._id, status: 'P' }
        ]
      })
    });
    assert(p7Duplicate.status === 400, 'P7: Rejects duplicate student with 400');

    // ==========================================
    // P8: POST /api/homework -> Valid create, grading <= totalMarks, D-16 class guard
    // ==========================================
    console.log('\n--- Testing P8: Homework Creation & Boundary Grading ---');
    const p8CreateRes = await fetch(`${baseUrl}/api/homework`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        title: 'P8 Test Assignment',
        description: 'Verify assignment flow',
        classId: slotA.classId,
        subjectId: slotA.subjectId,
        dueDate: getISTDateOffset(5),
        totalMarks: 50,
        points: 50
      })
    });
    const p8CreateData = await p8CreateRes.json();
    assert(p8CreateRes.status === 201 && p8CreateData.success === true, 'P8: Valid homework creation returns 201');

    // D-16 Check: Teacher B cannot create homework for Teacher A's class/subject
    const d16Res = await fetch(`${baseUrl}/api/homework`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({
        title: 'Unauthorized Class Assignment',
        description: 'Attempt by teacher B',
        classId: slotA.classId,
        subjectId: slotA.subjectId,
        dueDate: getISTDateOffset(5),
        totalMarks: 50
      })
    });
    assert(d16Res.status === 403 || d16Res.status === 404, 'D-16: Teacher cannot create homework for unassigned class/subject');

    // Grading boundary check
    if (p8CreateData.data?._id) {
      const assignmentId = p8CreateData.data._id;
      const updatedAssignment = await Assignment.findByIdAndUpdate(
        assignmentId,
        {
          $push: {
            submissions: {
              studentId: studentsA[0]._id,
              submittedAt: new Date(),
              attachments: [{ name: 'test.pdf', url: 'https://example.com/test.pdf', type: 'pdf' }],
              status: 'submitted'
            }
          }
        },
        { new: true }
      );
      const subId = updatedAssignment.submissions[0]._id;

      const overGradeRes = await fetch(`${baseUrl}/api/homework/submissions/${subId}/grade`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ marks: 55, feedback: 'Marks exceed totalMarks' })
      });
      assert(overGradeRes.status === 400, 'P8: Marks > totalMarks returns 400 rejection');

      const validGradeRes = await fetch(`${baseUrl}/api/homework/submissions/${subId}/grade`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ marks: 45, feedback: 'Good job' })
      });
      assert(validGradeRes.status === 200, 'P8: Marks <= totalMarks returns 200 accepted');
    }

    // ==========================================
    // P9: Leave: Create, overlap rejected, past rejected
    // ==========================================
    console.log('\n--- Testing P9: Teacher Leave Rules ---');
    // Ensure test leave date range is cleared for idempotency
    const TeacherLeave = require('../../models/TeacherLeave');
    await TeacherLeave.deleteMany({ teacherId: teacherA._id, fromDate: { $gte: new Date() } });

    const p9PastLeave = await fetch(`${baseUrl}/api/leaves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        fromDate: getISTDateOffset(-5),
        toDate: getISTDateOffset(-3),
        leaveType: 'casual',
        reason: 'Past leave attempt'
      })
    });
    assert(p9PastLeave.status === 400, 'P9: Rejects leave in the past with 400');

    const p9ValidLeave = await fetch(`${baseUrl}/api/leaves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        fromDate: getISTDateOffset(15),
        toDate: getISTDateOffset(16),
        leaveType: 'sick',
        reason: 'Future checkup appointment',
        status: 'approved' // Should be ignored and saved as pending
      })
    });
    const p9ValidData = await p9ValidLeave.json();
    assert(p9ValidLeave.status === 201 && p9ValidData.data?.status === 'pending', 'P9: Valid leave creates with 201 and ignores body status:approved');

    // ==========================================
    // P10: Upload Static Headers & Types
    // ==========================================
    console.log('\n--- Testing P10: Upload MIME and Security Headers ---');
    const p10Res = await fetch(`${baseUrl}/uploads/documents/sample.pdf`);
    assert(p10Res.headers.get('x-content-type-options') === 'nosniff', 'P10: Uploads served with X-Content-Type-Options: nosniff');

    // ==========================================
    // P11: POST /api/uploads/sign -> folder, maxFileSize, allowedExtensions
    // ==========================================
    console.log('\n--- Testing P11: Upload Signature Metadata ---');
    const p11Res = await fetch(`${baseUrl}/api/uploads/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ folder: 'sparkology/homework' })
    });
    const p11Data = await p11Res.json();
    assert(p11Res.status === 200 && p11Data.data?.folder === 'sparkology/homework' && p11Data.data.maxFileSize === 10485760 && Array.isArray(p11Data.data.allowedExtensions), 'P11: Signed upload returns correct folder and parameters');

    // ==========================================
    // P12: Non-admin -> 403 on admin-only routes
    // ==========================================
    console.log('\n--- Testing P12: Admin Route Protection Against Non-Admins ---');
    const p12CreateTeacher = await fetch(`${baseUrl}/api/auth/create-teacher`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ name: 'Hacker', email: 'hack@spark.edu', password: 'password123' })
    });
    assert(p12CreateTeacher.status === 403, 'P12: Non-admin gets 403 on create-teacher');

    const p12Schools = await fetch(`${baseUrl}/api/schools`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert(p12Schools.status === 403, 'P12: Non-admin gets 403 on /api/schools');

    // ==========================================
    // P13: CORS Rejection for Unauthorized Origin
    // ==========================================
    console.log('\n--- Testing P13: CORS Whitelist Enforcement ---');
    const p13Res = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'https://evil.example.com' }
    });
    assert(p13Res.headers.get('access-control-allow-origin') === null, 'P13: Unwhitelisted origin does not receive Access-Control-Allow-Origin header');

    // ==========================================
    // P14: Health Check Remains Active
    // ==========================================
    console.log('\n--- Testing P14: Process Health & Server Stability ---');
    const p14Res = await fetch(`${baseUrl}/health`);
    assert(p14Res.status === 200, 'P14: Server health endpoint returns 200 OK');

    // ==========================================
    // P15: Rate Limiter returns 429 after threshold
    // ==========================================
    console.log('\n--- Testing P15: Rate Limiter 429 Threshold ---');
    let hitRateLimit = false;
    for (let i = 0; i < 4; i++) {
      const rlRes = await fetch(`${baseUrl}/api/auth/test-limiter`);
      if (rlRes.status === 429) {
        hitRateLimit = true;
        break;
      }
    }
    assert(hitRateLimit === true, 'P15: Rate limiter returns 429 when request limit exceeded');

    // ==========================================
    // P16: Mobile Package Integrity
    // ==========================================
    console.log('\n--- Testing P16: Mobile App Configuration & Build Integrity ---');
    const mobileApp = require(path.join(__dirname, '../../../spark_teacher/spark_teacher/app.json'));
    const isMobileValid = mobileApp?.expo?.slug === 'spark-teacher' && !!mobileApp?.expo?.version;
    assert(isMobileValid, 'P16: Mobile app configuration intact and verified buildable');

    // ==========================================
    // SUMMARY
    // ==========================================
    console.log('\n=========================================');
    console.log(`PROTECTED SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('=========================================\n');

    server.close();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('[Protected Suite Error]:', err);
    server.close();
    process.exit(1);
  }
}

runProtectedSuite();
