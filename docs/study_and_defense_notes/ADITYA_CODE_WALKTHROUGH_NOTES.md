# Aditya's Technical Walkthrough & Code Defense Bible
**Purpose:** Comprehensive Page-by-Page & Line-by-Line Study Guide for Day 7 Probation Code Review  
**Candidate:** Aditya | **Evaluation:** Sparkology 1-Week Technical Assessment  
**Rule for Day 7:** *"You will need to explain every single line of code, queries, and logic you submitted. If you cannot explain your own code, you will not clear the probation."*

---

## 1. Module 1: Mobile Class Attendance (`spark_teacher/screens/AttendanceScreen.js`)

### 1.1 State Architecture (Lines 23–38)
* `user`: Extracted from `useAuth()` to identify the logged-in teacher and their assigned school.
* `selectedDate`: Stores current date instance for attendance (defaults to `route?.params?.selectedDate` or `new Date()`).
* `classes`: Array of schedule/class objects for `selectedDate` fetched from backend.
* `currentClassIndex`: Integer index (0 to `classes.length - 1`) tracking the currently active class card.
* `students`: Array of student objects enrolled in `classes[currentClassIndex]`.
* `studentAttendance`: Dictionary mapping `{ [studentId]: 'present' | 'absent' | 'late' }` representing current marking state.
* `isLoading`: Boolean controlling the spinner while fetching schedules or students.
* `isSubmitting`: Boolean disabling the submit button and showing an indicator during bulk save.
* `passedClassId`, `passedSubjectId`: Parameters passed when teacher taps **"Take Attendance"** from a card in `DashboardScreen.js`.

---

### 1.2 Lifecycle Hooks & Data Flow (Lines 46–55)
* **`useEffect(() => { loadClassesForDate(); }, [selectedDate])`**:
  - Triggers automatically whenever `selectedDate` changes (via chevron navigation or date picker).
  - Calls `ApiService.getSchedules({ date: selectedDateStr })`.
  - Normalizes schedule records into uniform class cards. If `passedClassId` was supplied by navigation, it sets `currentClassIndex` to match it.
* **`useEffect(() => { if (classes.length > 0) loadStudentsForClass(); }, [classes, currentClassIndex])`**:
  - Triggers whenever classes array loads or the teacher toggles between classes (Class 1 of N).
  - Fetches enrolled students via `ApiService.getStudentsByClass(classId)`.
  - Chains into `loadExistingAttendance(classId, subjectId)` to populate existing attendance records for that day if previously submitted.

---

### 1.3 Key Methods Explained Line-by-Line

#### `loadClassesForDate()` (Lines 56–105)
```javascript
const selectedDateStr = selectedDate.toISOString().split('T')[0];
const response = await ApiService.getSchedules({ date: selectedDateStr });
```
* **Why `toISOString().split('T')[0]`?** Converts local JS Date object to ISO format `YYYY-MM-DD` so backend can query standard date strings without timezone shifts.
* **Why normalize className?** Some classes in MongoDB have `.section` (e.g. "Grade 10" and "A"), while others only have `.name`. The mapping line `schedule.classId?.name && schedule.classId?.section ? ...` prevents `undefined` rendering bugs.

#### `loadExistingAttendance()` (Lines 136–151)
```javascript
const response = await ApiService.getAttendanceForClass(classId, subjectId, selectedDateStr);
if (response.success) {
  const attendanceMap = {};
  response.data.forEach(record => {
    attendanceMap[record.studentId._id] = record.status;
  });
  setStudentAttendance(attendanceMap);
}
```
* **Why an attendance map?** Converting the array of MongoDB documents into a key-value hash table `[studentId]: status` allows $O(1)$ constant-time lookup and updates when rendering each student list item.

#### `handleAttendanceChange(studentId, status)` (Lines 162–167)
```javascript
setStudentAttendance(prev => ({
  ...prev,
  [studentId]: status,
}));
```
* **Concept:** Immutable React state update using previous state snapshot (`prev`). Replaces or inserts the student's status without mutating state directly.

#### `submitAttendance()` (Lines 201–233)
```javascript
const attendanceRecords = students.map(student => ({
  studentId: student.id,
  classId: currentClass.classId,
  subjectId: currentClass.subjectId,
  date: selectedDateStr,
  status: studentAttendance[student.id] || 'absent',
  remarks: ''
}));
const response = await ApiService.markBulkAttendance(attendanceRecords);
```
* **Logic:** Iterates over all enrolled students in the class. If a student was not explicitly tapped, defaults to `'absent'`.
* Sends array payload `{ attendanceRecords }` to backend endpoint `POST /api/attendance/bulk`.

---

### 1.4 Days 2–3 Features to Explain on Day 7

1. **Quick-Action Buttons (Present / Absent / Late):**
   - Each student row displays 3 dedicated action pills.
   - Present: Emerald Green (`#34C759`), Absent: Crimson Red (`#FF3B30`), Late: Amber (`#FF9500`).
   - Active state fills the button background with solid color and changes icon to white. Inactive state keeps white background with colored border.
2. **"Mark All Present" Button with Modal Confirmation:**
   - Positioned in the section header above the student list.
   - When tapped, triggers `Alert.alert` or custom Modal: *"Mark all [N] students as Present?"*.
   - On confirmation, iterates through `students` and populates `studentAttendance` with `'present'` for all IDs in one batch state update.
3. **Live Attendance Summary Bar:**
   - Pinned at the bottom of the screen above safe area insets.
   - Dynamically counts Present, Absent, and Late using `useMemo`:
     ```javascript
     const summary = useMemo(() => {
       const counts = { present: 0, absent: 0, late: 0 };
       students.forEach(s => {
         const st = studentAttendance[s.id] || 'absent';
         if (counts[st] !== undefined) counts[st]++;
       });
       return counts;
     }, [studentAttendance, students]);
     ```
   - Displays count badges with live updates whenever any button is tapped.

---

## 2. Module 2: Authentication & Token Lifecycle

### 2.1 `spark_teacher/context/AuthContext.js`
* **Lines 30–69 (`onAuthStateChanged`):**
  - Subscribes to Firebase Client auth state.
  - When user logs in, Firebase returns `firebaseUser`.
  - Line 42: `const idToken = await firebaseUser.getIdToken();` retrieves the raw JWT minted by Firebase.
  - Line 45: `ApiService.firebaseLogin(idToken)` sends token to our backend for server-side verification.
  - Line 49: `AsyncStorage.setItem('authToken', response.data.token)` stores the local backend JWT.
  - Line 63: On logout, `AsyncStorage.removeItem('authToken')` destroys the token.
* **Lines 99–149 (`login(email, password)`):**
  - Client-side validation -> `signInWithEmailAndPassword(auth, email, password)` -> exchange with backend -> updates `user` and `isAuthenticated` state.

### 2.2 `spark_teacher/services/api.js`
* **Lines 11–39 (`request(endpoint, options)`):**
  - Line 13: `const token = await AsyncStorage.getItem('authToken');`
  - Line 18: `...(token && { Authorization: `Bearer ${token}` })`
  - Injects Authorization Bearer header into every HTTP request.
  - Handles network failures gracefully with descriptive offline errors.

### 2.3 `backend/middleware/auth.js`
* **Lines 7–134 (`protect`):**
  - Line 12: Checks if `req.headers.authorization` starts with `'Bearer '`.
  - Line 26: `const decoded = jwt.verify(token, process.env.JWT_SECRET);`
  - Lines 36–72: Extracts `decoded.id` and `decoded.role`. If `role === 'teacher'`, queries `User.findById(decoded.id).select('-password')`.
  - Line 98: Verifies `user.isActive === true`.
  - Line 106: Verifies `user.isLocked !== true` (locks after 5 failed login attempts).
  - Line 120: Attaches `req.user = user` to the request object and calls `next()`.
* **Lines 137–172 (`authorize(...roles)`):**
  - Validates that `req.user.role` matches one of the allowed roles (e.g. `'teacher'`). If unauthorized, returns HTTP 403 Forbidden.

---

## 3. Module 3: Backend Bulk Attendance Optimization (`backend/controllers/attendanceController.js`)

### 3.1 Why the Original Code was Inefficient (Lines 136–196)
```javascript
// ORIGINAL UNOPTIMIZED IMPLEMENTATION
for (const record of attendanceRecords) {
  const classData = await Class.findOne({ _id: classId, schoolId });      // DB Query 1
  const subject = await Subject.findOne({ _id: subjectId, schoolId });     // DB Query 2
  const student = await Student.findOne({ _id: studentId, classId });      // DB Query 3
  const existing = await Attendance.findOne({ schoolId, studentId, ... }); // DB Query 4
  if (existing) await existing.save();                                     // DB Query 5
  else await Attendance.create(...);
}
```
* **Problem:** Sequential $O(N)$ execution blocking the Node.js event loop with network I/O. For 40 students = $40 \times 4 = 160$ sequential queries.
* Takes 3–5 seconds to complete. If connection drops midway, data is left in a partially marked corrupted state.

---

### 3.2 The Optimized Day 4–5 `bulkWrite` Solution
```javascript
// OPTIMIZED BATCH IMPLEMENTATION
const markBulkAttendance = async (req, res) => {
  const { attendanceRecords } = req.body;
  const schoolId = req.user.schoolId;
  const teacherId = req.user._id;

  if (!Array.isArray(attendanceRecords) || attendanceRecords.length === 0) {
    return res.status(400).json({ success: false, error: 'Records required' });
  }

  const { classId, subjectId, date } = attendanceRecords[0];

  // 1. Single validation for Class & Subject
  const [classExists, subjectExists] = await Promise.all([
    Class.findOne({ _id: classId, schoolId }),
    Subject.findOne({ _id: subjectId, schoolId })
  ]);

  if (!classExists || !subjectExists) {
    return res.status(404).json({ success: false, error: 'Class or Subject not found' });
  }

  // 2. Build bulkWrite operations (Atomic Upsert)
  const attendanceDate = new Date(date);
  const startOfDay = new Date(attendanceDate.setHours(0, 0, 0, 0));

  const operations = attendanceRecords.map(record => ({
    updateOne: {
      filter: {
        schoolId,
        studentId: record.studentId,
        classId: record.classId,
        subjectId: record.subjectId,
        date: startOfDay,
      },
      update: {
        $set: {
          status: record.status,
          remarks: record.remarks || '',
          teacherId,
          markedBy: teacherId,
          markedAt: new Date(),
          academicYear: '2024-2025',
          isActive: true
        }
      },
      upsert: true // Creates new document if doesn't exist; updates if it does!
    }
  }));

  // 3. Execute all operations in 1 database round-trip!
  const bulkResult = await Attendance.bulkWrite(operations, { ordered: false });

  // 4. Emit WebSocket event for real-time dashboard update
  if (global.io) {
    global.io.to(`school_${schoolId}`).emit('attendance_updated', {
      type: 'bulk_attendance_marked',
      classId,
      subjectId,
      date: startOfDay,
      teacherId,
      matchedCount: bulkResult.matchedCount,
      upsertedCount: bulkResult.upsertedCount
    });
  }

  return res.status(200).json({
    success: true,
    message: `Attendance saved: ${bulkResult.upsertedCount} inserted, ${bulkResult.modifiedCount} updated.`,
    data: bulkResult
  });
};
```

---

## 4. Module 4: New Endpoint — `GET /api/teachers/:id/classes-today`

### 4.1 Route Definition (`backend/routes/teachers.js`)
```javascript
// Place BEFORE /:id to prevent route shadowing!
router.get('/:id/classes-today', authorize('teacher', 'school_admin'), getTeacherClassesToday);
```

### 4.2 Controller Logic (`backend/controllers/teacherController.js`)
```javascript
const getTeacherClassesToday = async (req, res) => {
  try {
    const teacherId = req.params.id;
    const schoolId = req.user.schoolId;

    // Security Check: Teachers can only view their own schedule
    if (req.user.role === 'teacher' && req.user._id.toString() !== teacherId) {
      return res.status(403).json({ success: false, error: 'Unauthorized to view other teachers schedule' });
    }

    // Determine current day of week (e.g., 'Monday')
    const today = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDayOfWeek = days[today.getDay()];

    const Schedule = require('../models/Schedule');

    const schedules = await Schedule.find({
      schoolId,
      teacherId,
      dayOfWeek: currentDayOfWeek,
      status: 'active'
    })
    .populate('classId', 'name section room capacity')
    .populate('subjectId', 'name code')
    .sort({ startTime: 1 });

    const classesToday = schedules.map(s => ({
      scheduleId: s._id,
      classId: s.classId?._id,
      className: `${s.classId?.name} ${s.classId?.section}`,
      subjectId: s.subjectId?._id,
      subjectName: s.subjectId?.name,
      subjectCode: s.subjectId?.code,
      room: s.room || s.classId?.room || 'TBD',
      startTime: s.startTime,
      endTime: s.endTime,
      dayOfWeek: s.dayOfWeek
    }));

    res.status(200).json({
      success: true,
      day: currentDayOfWeek,
      count: classesToday.length,
      data: classesToday
    });
  } catch (error) {
    console.error('Error fetching classes today:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};
```

---

## 5. Potential Day 7 Interview Questions & Exact Answers

#### Q1: "Why did you use `bulkWrite` with `updateOne` and `upsert: true` instead of `insertMany`?"
* **Answer:** "`insertMany` fails with duplicate key error `E11000` if attendance for a student was already submitted earlier in the morning and a teacher is now updating an absent student to present. `bulkWrite` with `updateOne` and `upsert: true` handles both creation (insert) and updates (edit) idempotently in a single atomic database operation."

#### Q2: "How does the mobile app prevent unauthorized requests if a user's token is stolen or revoked?"
* **Answer:** "Every request passes through `backend/middleware/auth.js`. The token is cryptographically verified using `jwt.verify` against `JWT_SECRET`. Furthermore, the middleware checks `user.isActive` and `user.isLocked` in MongoDB in real time. If the admin deactivates the teacher account, even a valid unexpired token is rejected with HTTP 401."

#### Q3: "What prevents attendance from being marked twice for the same student on the same day?"
* **Answer:** "At the database level, `backend/models/Attendance.js` defines a compound unique index:
`attendanceSchema.index({ schoolId: 1, studentId: 1, date: 1, subjectId: 1 }, { unique: true });`.
At the application level, the `bulkWrite` query filters on `schoolId`, `studentId`, `subjectId`, and `date (start of day)`, ensuring existing records are overwritten rather than duplicated."

#### Q4: "Why did you identify `/assignments/teacher/classes` and `/meetings/teacher/classes` as architectural code smells?"
* **Answer:** "Because class listing is a core domain capability belonging to the Class/Teacher module, not a sub-resource of Assignments or Meetings. Having two separate controllers duplicate the logic of grouping classes and subjects creates maintenance drift and inconsistent behaviour. Creating `GET /api/teachers/:id/classes-today` provides a clean RESTful resource separation."
