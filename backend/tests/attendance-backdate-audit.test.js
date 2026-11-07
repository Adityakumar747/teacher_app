const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../config.env') });

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const express = require('express');
const http = require('http');

// Models
const User = require('../models/User');
const Class = require('../models/Class');
const Schedule = require('../models/Schedule');
const Student = require('../models/Student');
const AttendanceSession = require('../models/AttendanceSession');
const AttendanceRecord = require('../models/AttendanceRecord');
const { getISTDateString, getISTDateOffset } = require('../utils/dateTimeUtils');

// Setup minimal express app with attendance routes
const attendanceRoutes = require('../routes/attendance');
const app = express();
app.use(express.json());
app.use('/api/attendance', attendanceRoutes);

// Error handler
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ success: false, error: err.message });
});

async function runTests() {
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

  // Start HTTP server on dynamic port
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  try {
    console.log('[Test Setup] Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[Test Setup] Connected.');

    // 1. Fetch teacher user and generate auth token
    const teacher = await User.findOne({ email: 'teacher@spark.edu' });
    if (!teacher) throw new Error('Teacher not found. Run seed script first.');

    const token = jwt.sign(
      { id: teacher._id, role: teacher.role, schoolId: teacher.schoolId },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // 2. Fetch another teacher or create temporary teacher to test authorization (403)
    let otherTeacher = await User.findOne({ email: 'other_teacher@spark.edu' });
    if (!otherTeacher) {
      otherTeacher = await User.create({
        name: 'Other Teacher',
        email: 'other_teacher@spark.edu',
        password: 'password123',
        phone: '+919876543299',
        role: 'teacher',
        schoolId: teacher.schoolId,
        isActive: true
      });
    }

    const otherToken = jwt.sign(
      { id: otherTeacher._id, role: otherTeacher.role, schoolId: otherTeacher.schoolId },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // 3. Find demo slot and students
    const slot = await Schedule.findOne({ teacherId: teacher._id });
    if (!slot) throw new Error('Schedule slot not found.');

    const students = await Student.find({ classId: slot.classId, status: 'active' });
    if (students.length === 0) throw new Error('Class students not found.');

    console.log('\n--- 1. Future Date Blocked Rule ---');
    const futureDate = getISTDateOffset(2);
    const futureRes = await fetch(`${baseUrl}/api/attendance/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        slotId: slot._id,
        date: futureDate,
        records: students.map(s => ({ studentId: s._id, status: 'P' }))
      })
    });
    const futureBody = await futureRes.json();

    assert(futureRes.status === 400, 'Future date submission returns 400 status');
    assert(futureBody.success === false, 'Future date submission returns success: false');
    assert(/future/i.test(futureBody.error), 'Future date error message clearly states future dates blocked');

    console.log('\n--- 2. Past Date > 7 Days (Edit Window Closed) Rule ---');
    const oldDate = getISTDateOffset(-10); // 10 days ago (> 7 days)
    const oldDateRes = await fetch(`${baseUrl}/api/attendance/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        slotId: slot._id,
        date: oldDate,
        records: students.map(s => ({ studentId: s._id, status: 'P' }))
      })
    });
    const oldDateBody = await oldDateRes.json();

    assert(oldDateRes.status === 403, 'Session older than 7 days returns 403 Forbidden');
    assert(oldDateBody.success === false, 'Locked session returns success: false');
    assert(/edit window closed/i.test(oldDateBody.error), 'Error message explains edit window closed');

    console.log('\n--- 3. Slot Attendance API Returns isLocked for > 7 Days ---');
    const slotOldRes = await fetch(`${baseUrl}/api/attendance/slot/${slot._id}?date=${oldDate}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const slotOldBody = await slotOldRes.json();

    assert(slotOldRes.status === 200, 'GET /api/attendance/slot returns 200');
    assert(slotOldBody.data.isLocked === true, 'Session > 7 days has isLocked: true');
    assert(slotOldBody.data.canEdit === false, 'Session > 7 days has canEdit: false');
    assert(typeof slotOldBody.data.lockReason === 'string', 'lockReason string explains read-only condition');

    console.log('\n--- 4. Past Date Within 7 Days: Late Marked Flag Rule ---');
    // Calculate the most recent past date matching slot.dayOfWeek within 7 days
    const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const targetDayIndex = DAY_NAMES.indexOf(slot.dayOfWeek);
    const todayIndex = new Date().getDay();
    let daysAgo = (todayIndex - targetDayIndex + 7) % 7;
    if (daysAgo === 0) daysAgo = 7;
    const pastAllowedDate = getISTDateOffset(-daysAgo);
    // Clear any existing session for this test date
    await AttendanceSession.deleteMany({ slotId: slot._id, date: pastAllowedDate });

    const pastSubmitRes = await fetch(`${baseUrl}/api/attendance/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        slotId: slot._id,
        date: pastAllowedDate,
        records: students.map((s, idx) => ({ studentId: s._id, status: idx === 0 ? 'A' : 'P' }))
      })
    });
    const pastSubmitBody = await pastSubmitRes.json();

    assert(pastSubmitRes.status === 200, 'First-time past date within 7 days succeeds with 200');
    assert(pastSubmitBody.data.lateMarked === true, 'First-time past date submission is flagged lateMarked: true');

    console.log('\n--- 5. Edit Existing Session Within 7 Days: Audit Trail Diff ---');
    // Change first student from 'A' to 'P'
    const editRes = await fetch(`${baseUrl}/api/attendance/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        slotId: slot._id,
        date: pastAllowedDate,
        records: students.map(s => ({ studentId: s._id, status: 'P' }))
      })
    });
    const editBody = await editRes.json();

    assert(editRes.status === 200, 'Edit submission returns 200');
    assert(editBody.data.isEdit === true, 'Response flags isEdit: true');
    assert(editBody.data.changesCount === 1, 'Changes count accurately detects 1 student changed');

    // Verify audit entry in database
    const updatedSession = await AttendanceSession.findById(editBody.data.sessionId);
    assert(updatedSession.audit.length >= 2, 'Session has at least 2 audit entries (create + edit)');
    const latestAudit = updatedSession.audit[updatedSession.audit.length - 1];
    assert(latestAudit.action === 'edit', 'Latest audit entry has action: edit');
    assert(latestAudit.details.length === 1, 'Audit detail captured 1 modified student');
    assert(latestAudit.details[0].oldStatus === 'A' && latestAudit.details[0].newStatus === 'P', 'Audit detail captured exact transition: A -> P');

    console.log('\n--- 6. Teacher Authorization Restriction (Own Slots Only) ---');
    // Other teacher tries to mark attendance for this slot
    const unauthMarkRes = await fetch(`${baseUrl}/api/attendance/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${otherToken}`
      },
      body: JSON.stringify({
        slotId: slot._id,
        date: getISTDateString(),
        records: students.map(s => ({ studentId: s._id, status: 'P' }))
      })
    });

    assert(unauthMarkRes.status === 403, 'Unauthorized teacher cannot mark attendance (403)');

    const unauthViewRes = await fetch(`${baseUrl}/api/attendance/slot/${slot._id}`, {
      headers: { Authorization: `Bearer ${otherToken}` }
    });

    assert(unauthViewRes.status === 403, 'Unauthorized teacher cannot view slot attendance (403)');

    console.log('\n--- 7. Attendance History API (GET /api/attendance/history) ---');
    // Ensure at least one historic session (> 7 days) exists to assert history lock calculation
    const oldHistoryDate = getISTDateOffset(-14);
    await AttendanceSession.findOneAndUpdate(
      { slotId: slot._id, date: oldHistoryDate },
      {
        slotId: slot._id,
        date: oldHistoryDate,
        teacherId: teacher._id,
        classId: slot.classId,
        subjectId: slot.subjectId,
        schoolId: teacher.schoolId,
        submittedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        summary: { present: 10, absent: 0, late: 0, total: 10 }
      },
      { upsert: true, new: true }
    );

    const historyRes = await fetch(`${baseUrl}/api/attendance/history?limit=50`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const historyBody = await historyRes.json();

    assert(historyRes.status === 200, 'GET /api/attendance/history returns 200');
    assert(Array.isArray(historyBody.data?.sessions), 'history returns sessions array');
    assert(historyBody.data?.pagination?.total > 0, 'pagination metadata is present');

    const historySessions = historyBody.data.sessions;
    const hasLockedSession = historySessions.some(s => s.isLocked === true);
    const hasEditableSession = historySessions.some(s => s.isLocked === false && s.canEdit === true);

    assert(hasLockedSession, 'History accurately flags older sessions as isLocked: true');
    assert(hasEditableSession, 'History accurately flags recent sessions as canEdit: true');

    // Check that other teacher sees 0 sessions from first teacher
    const otherHistoryRes = await fetch(`${baseUrl}/api/attendance/history`, {
      headers: { Authorization: `Bearer ${otherToken}` }
    });
    const otherHistoryBody = await otherHistoryRes.json();

    assert(otherHistoryBody.data.sessions.length === 0, 'Other teacher sees 0 sessions (strict isolation)');

    console.log('\n=========================================');
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('=========================================\n');

    server.close();
    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('[Test Error]:', error);
    server.close();
    process.exit(1);
  }
}

runTests();
