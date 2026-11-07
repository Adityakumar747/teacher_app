const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../config.env') });

const mongoose = require('mongoose');
const express = require('express');
const http = require('http');

// Routes
const authRoutes = require('../routes/auth');
const teacherRoutes = require('../routes/teachers');
const attendanceRoutes = require('../routes/attendance');
const assignmentRoutes = require('../routes/assignments');
const leaveRoutes = require('../routes/leaves');
const uploadRoutes = require('../routes/upload');
const schoolRoutes = require('../routes/schools');
const userRoutes = require('../routes/users');
const calendarRoutes = require('../routes/importantDates');
const errorHandler = require('../middleware/errorHandler');

// Models
const User = require('../models/User');
const Schedule = require('../models/Schedule');
const Student = require('../models/Student');
const Assignment = require('../models/Assignment');
const TeacherLeave = require('../models/TeacherLeave');
const AttendanceSession = require('../models/AttendanceSession');
const { getISTDateString, getISTDateOffset } = require('../utils/dateTimeUtils');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
if (calendarRoutes) {
  app.use('/api/calendar', calendarRoutes);
}

app.use(errorHandler);

async function runPostmanCollectionSuite() {
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  try {
    console.log('\n========================================================');
    console.log(' POSTMAN COLLECTION AUTOMATED TEST RUNNER');
    console.log(' Collection: Sparkology Teacher & Attendance API (v2.1)');
    console.log(` Target Server: ${baseUrl}`);
    console.log('========================================================\n');

    await mongoose.connect(process.env.MONGODB_URI);
    const teacher = await User.findOne({ email: 'teacher@spark.edu' });
    if (!teacher) throw new Error('teacher@spark.edu not found. Run seed script first.');

    let authToken = '';
    let currentSlotId = '';
    let currentClassId = '';
    let currentSubjectId = '';
    let currentStudentId = '';

    // ==========================================
    // 1. AUTH FOLDER
    // ==========================================
    console.log('\n▶ Folder: Auth');
    
    // Request: Teacher Login (JWT Dual Token)
    console.log('  → [POST] /api/auth/login');
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'teacher@spark.edu', password: 'teacher123' })
    });
    const loginData = await loginRes.json();
    assert(loginRes.status === 200, 'Status code is 200 OK');
    assert(loginData.success === true, 'Login response returns success: true');
    authToken = loginData.data?.token || loginData.token;
    assert(typeof authToken === 'string' && authToken.length > 20, 'JWT token is generated and stored');
    assert(loginData.data?.user?.role === 'teacher', 'User profile has teacher role');

    // Request: Get Current Profile
    console.log('  → [GET] /api/teachers/me');
    const profRes = await fetch(`${baseUrl}/api/teachers/me`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const profData = await profRes.json();
    assert(profRes.status === 200, 'Status code is 200 OK');
    assert(profData.success === true, 'Profile returns teacher personal details');
    const profEmail = profData.data?.teacher?.email || profData.data?.email;
    assert(profEmail === 'teacher@spark.edu', 'Profile email matches authenticated user');

    // ==========================================
    // 2. DASHBOARD FOLDER
    // ==========================================
    console.log('\n▶ Folder: Dashboard');

    // Request: Get Classes Today (IST server time)
    console.log('  → [GET] /api/teachers/me/classes-today');
    const todayRes = await fetch(`${baseUrl}/api/teachers/me/classes-today`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const todayData = await todayRes.json();
    assert(todayRes.status === 200, 'Status code is 200 OK');
    assert(todayData.success === true, 'Returns classes list and today IST summary');
    assert(Array.isArray(todayData.data?.classes), 'Classes property is an array');

    const firstClass = todayData.data?.classes?.[0];
    if (firstClass) {
      currentSlotId = firstClass.id || firstClass._id;
      currentClassId = firstClass.class?.id || firstClass.class?._id || firstClass.classId;
      currentSubjectId = firstClass.subject?.id || firstClass.subject?._id || firstClass.subjectId;
    }

    if (!currentSlotId) {
      const dbSlot = await Schedule.findOne({ teacherId: teacher._id });
      if (dbSlot) {
        currentSlotId = dbSlot._id.toString();
        currentClassId = dbSlot.classId.toString();
        currentSubjectId = dbSlot.subjectId.toString();
      }
    }

    // ==========================================
    // 3. ATTENDANCE & AUDIT FOLDER
    // ==========================================
    console.log('\n▶ Folder: Attendance & Audit');

    // Request: Get Slot Attendance (Today)
    console.log(`  → [GET] /api/attendance/slot/${currentSlotId}`);
    const slotRes = await fetch(`${baseUrl}/api/attendance/slot/${currentSlotId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const slotData = await slotRes.json();
    assert(slotRes.status === 200, 'Status code is 200 OK');
    assert(slotData.success === true, 'Returns active student roster for the slot');
    assert(Array.isArray(slotData.data?.students) && slotData.data.students.length > 0, 'Students array populated');
    currentStudentId = slotData.data.students[0]?._id || slotData.data.students[0]?.id;

    // Request: Get Slot Attendance (Past Date > 7 Days)
    const oldDate = getISTDateOffset(-14);
    console.log(`  → [GET] /api/attendance/slot/${currentSlotId}?date=${oldDate}`);
    const oldSlotRes = await fetch(`${baseUrl}/api/attendance/slot/${currentSlotId}?date=${oldDate}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const oldSlotData = await oldSlotRes.json();
    assert(oldSlotRes.status === 200, 'Status code is 200 OK');
    assert(oldSlotData.data?.isLocked === true, 'Past date older than 7 days is marked locked');
    assert(oldSlotData.data?.canEdit === false, 'canEdit is false for locked session');

    // Request: Submit Bulk Attendance (Idempotent)
    console.log('  → [POST] /api/attendance/bulk');
    const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const slotDoc = await Schedule.findById(currentSlotId);
    const targetDayIndex = DAY_NAMES.indexOf(slotDoc.dayOfWeek);
    const todayIndex = new Date().getDay();
    let daysAgo = (todayIndex - targetDayIndex + 7) % 7;
    const testDate = getISTDateOffset(-daysAgo);
    await AttendanceSession.deleteMany({ slotId: currentSlotId, date: testDate });

    const bulkPayload = {
      slotId: currentSlotId,
      date: testDate,
      records: slotData.data.students.map((s, idx) => ({
        studentId: s._id || s.id,
        status: idx === 0 ? 'A' : 'P',
        remark: idx === 0 ? 'Sick' : ''
      }))
    };

    const bulkRes = await fetch(`${baseUrl}/api/attendance/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify(bulkPayload)
    });
    const bulkData = await bulkRes.json();
    assert(bulkRes.status === 200, 'Status code is 200 OK');
    assert(bulkData.success === true, 'Attendance saved successfully with counts');
    assert(bulkData.data?.summary != null, 'Summary contains attendance breakdown');

    // Request: Edit Past Attendance (Within 7 Days -> Audit Diff)
    console.log('  → [POST] /api/attendance/bulk (Edit Existing Session)');
    const editPayload = {
      ...bulkPayload,
      records: bulkPayload.records.map((r, idx) => (idx === 0 ? { ...r, status: 'P', remark: 'Late arrival' } : r))
    };
    const editRes = await fetch(`${baseUrl}/api/attendance/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify(editPayload)
    });
    const editData = await editRes.json();
    assert(editRes.status === 200, 'Status code is 200 OK');
    assert(editData.data?.isEdit === true, 'Audit diff detected and recorded for edit');

    // Request: Submit Attendance Future Date (Blocked)
    console.log('  → [POST] /api/attendance/bulk (Future Date Block Check)');
    const futureRes = await fetch(`${baseUrl}/api/attendance/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ ...bulkPayload, date: getISTDateOffset(3) })
    });
    const futureData = await futureRes.json();
    assert(futureRes.status === 400, 'Status code is 400 Bad Request');
    assert(futureData.success === false, 'Future date is blocked');
    assert(/future/i.test(futureData.error), 'Error message explains future dates are blocked');

    // Request: Get Attendance History
    console.log('  → [GET] /api/attendance/history');
    const histRes = await fetch(`${baseUrl}/api/attendance/history?limit=10`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const histData = await histRes.json();
    assert(histRes.status === 200, 'Status code is 200 OK');
    const sessionsList = histData.data?.sessions || histData.data?.history;
    assert(Array.isArray(sessionsList), 'History sessions array returned');
    assert(typeof histData.data?.pagination === 'object', 'Pagination object returned');

    // ==========================================
    // 4. UPLOADS FOLDER
    // ==========================================
    console.log('\n▶ Folder: Uploads');

    // Request: Get Upload Signature
    console.log('  → [POST] /api/uploads/sign');
    const signRes = await fetch(`${baseUrl}/api/uploads/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ folder: 'sparkology/homework' })
    });
    const signData = await signRes.json();
    assert(signRes.status === 200, 'Status code is 200 OK');
    assert(signData.data?.folder === 'sparkology/homework', 'Upload folder matches sparkology/homework');
    assert(signData.data?.maxFileSize === 10485760, 'Enforces 10MB file limit');

    // ==========================================
    // 5. HOMEWORK FOLDER
    // ==========================================
    console.log('\n▶ Folder: Homework');

    // Request: Get Teacher Classes
    console.log('  → [GET] /api/assignments/teacher/classes');
    const tchClsRes = await fetch(`${baseUrl}/api/assignments/teacher/classes`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const tchClsData = await tchClsRes.json();
    assert(tchClsRes.status === 200, 'Status code is 200 OK');
    assert(Array.isArray(tchClsData.data), 'Returns array of assigned classes');

    // Request: List Own Homework
    console.log('  → [GET] /api/homework');
    const hwListRes = await fetch(`${baseUrl}/api/homework?page=1&limit=10`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const hwListData = await hwListRes.json();
    assert(hwListRes.status === 200, 'Status code is 200 OK');
    assert(Array.isArray(hwListData.data), 'Returns homework assignments array');

    // Request: Create Homework
    console.log('  → [POST] /api/homework');
    const hwCreateRes = await fetch(`${baseUrl}/api/homework`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        title: 'Postman Integration Assignment',
        description: 'Verification of assignment creation and grading flow',
        classId: currentClassId,
        subjectId: currentSubjectId,
        dueDate: getISTDateOffset(5),
        totalMarks: 50,
        points: 50
      })
    });
    const hwCreateData = await hwCreateRes.json();
    assert(hwCreateRes.status === 201, 'Status code is 201 Created');
    assert(hwCreateData.success === true, 'Homework created successfully');
    const createdHwId = hwCreateData.data?._id;

    // Request: Get Homework Submissions
    console.log(`  → [GET] /api/homework/${createdHwId}/submissions`);
    // Seed a submission
    const targetHw = await Assignment.findByIdAndUpdate(
      createdHwId,
      {
        $push: {
          submissions: {
            studentId: currentStudentId,
            submittedAt: new Date(),
            attachments: [{ name: 'solution.pdf', url: 'https://example.com/solution.pdf', type: 'pdf' }],
            status: 'submitted'
          }
        }
      },
      { new: true }
    );
    const subRes = await fetch(`${baseUrl}/api/homework/${createdHwId}/submissions`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const subData = await subRes.json();
    assert(subRes.status === 200, 'Status code is 200 OK');
    assert(subData.data?.groups?.submitted?.length >= 1, 'Submissions grouped with submitted array');

    const createdSubId = targetHw.submissions[0]._id;

    // Request: Grade Student Submission
    console.log(`  → [PATCH] /api/homework/submissions/${createdSubId}/grade`);
    const gradeRes = await fetch(`${baseUrl}/api/homework/submissions/${createdSubId}/grade`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ marks: 48, feedback: 'Excellent analytical work' })
    });
    const gradeData = await gradeRes.json();
    assert(gradeRes.status === 200, 'Status code is 200 OK');
    assert(gradeData.data?.status === 'graded', 'Submission status updated to graded');
    assert(gradeData.data?.marks === 48, 'Recorded marks match 48');

    // Request: Ask Student to Resubmit
    console.log(`  → [PATCH] /api/homework/submissions/${createdSubId}/grade (Resubmit)`);
    const resubRes = await fetch(`${baseUrl}/api/homework/submissions/${createdSubId}/grade`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ needsResubmission: true, feedback: 'Please recalculate equation 2' })
    });
    const resubData = await resubRes.json();
    assert(resubRes.status === 200, 'Status code is 200 OK');
    assert(resubData.data?.status === 'resubmit_requested', 'Submission status transitions to resubmit_requested');

    // ==========================================
    // 6. PROFILE & LEAVES FOLDER
    // ==========================================
    console.log('\n▶ Folder: Profile & Leaves');

    // Request: Get Teacher Profile & Timetable
    console.log('  → [GET] /api/teachers/me (Timetable verification)');
    const ttRes = await fetch(`${baseUrl}/api/teachers/me`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const ttData = await ttRes.json();
    assert(ttRes.status === 200, 'Status code is 200 OK');
    assert(ttData.data?.timetableByDay?.Monday != null, 'Returns Monday schedule slots');

    // Request: List Teacher Leaves
    console.log('  → [GET] /api/leaves');
    const leavesRes = await fetch(`${baseUrl}/api/leaves`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const leavesData = await leavesRes.json();
    assert(leavesRes.status === 200, 'Status code is 200 OK');
    assert(Array.isArray(leavesData.data), 'Returns teacher leaves array');

    // Request: Apply for Leave
    console.log('  → [POST] /api/leaves');
    await TeacherLeave.deleteMany({ teacherId: teacher._id, reason: 'Postman Integration Leave Test' });
    const applyRes = await fetch(`${baseUrl}/api/leaves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        fromDate: getISTDateOffset(20),
        toDate: getISTDateOffset(21),
        leaveType: 'casual',
        reason: 'Postman Integration Leave Test'
      })
    });
    const applyData = await applyRes.json();
    assert(applyRes.status === 201, 'Status code is 201 Created');
    assert(applyData.data?.status === 'pending', 'Initial leave status is pending');

    // Request: Get My Class Students Roster
    console.log('  → [GET] /api/teachers/my-class/students');
    const myClsRes = await fetch(`${baseUrl}/api/teachers/my-class/students`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const myClsData = await myClsRes.json();
    assert(myClsRes.status === 200, 'Status code is 200 OK');
    assert(Array.isArray(myClsData.data?.students), 'Returns student roster array with attendance %');

    // ==========================================
    // 7. CLASS TEACHER ANALYTICS FOLDER
    // ==========================================
    console.log('\n▶ Folder: Class Teacher Analytics');

    console.log('  → [GET] /api/teachers/my-class/analytics');
    const analyticsRes = await fetch(`${baseUrl}/api/teachers/my-class/analytics`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const analyticsData = await analyticsRes.json();
    assert(analyticsRes.status === 200, 'Status code is 200 OK');
    assert(analyticsData.success === true, 'Analytics summary returned successfully');

    // ==========================================
    // SUMMARY
    // ==========================================
    console.log('\n========================================================');
    console.log(` POSTMAN COLLECTION TEST RUN FINISHED`);
    console.log(` Total Assertions: ${passed + failed}`);
    console.log(` Passed:           ${passed}`);
    console.log(` Failed:           ${failed}`);
    console.log(' Result:           ' + (failed === 0 ? 'ALL POSTMAN TESTS PASSED (100%)' : 'SOME TESTS FAILED'));
    console.log('========================================================\n');

    server.close();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('\n[Postman Test Runner Error]:', err);
    server.close();
    process.exit(1);
  }
}

runPostmanCollectionSuite();
