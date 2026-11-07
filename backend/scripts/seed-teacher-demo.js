const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../config.env') });

const mongoose = require('mongoose');
const firebaseAdmin = require('../config/firebase-admin');

const School = require('../models/School');
const User = require('../models/User');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const Student = require('../models/Student');
const Schedule = require('../models/Schedule');
const Assignment = require('../models/Assignment');
const Note = require('../models/Note');
const Meeting = require('../models/Meeting');
const AttendanceSession = require('../models/AttendanceSession');
const AttendanceRecord = require('../models/AttendanceRecord');
const TeacherLeave = require('../models/TeacherLeave');
const { getISTDateString, getISTDateOffset } = require('../utils/dateTimeUtils');

async function seedTeacherDemo() {
  try {
    console.log('[Seed] Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[Seed] Connected to MongoDB');

    // Find admin user for createdBy
    const adminUser = await User.findOne({ role: 'admin' });

    // 1. Create or find School
    let school = await School.findOne({ code: 'SPARK01' });
    if (!school) {
      school = await School.create({
        name: 'Spark International Academy',
        code: 'SPARK01',
        address: '100 Innovation Boulevard, Tech City',
        contact: '+91 9876543210',
        status: 'active',
        plan: 'enterprise',
        students: 4,
        teachers: 1,
        createdBy: adminUser ? adminUser._id : new mongoose.Types.ObjectId()
      });
      console.log('[Seed] Created School:', school.name);
    } else {
      console.log('[Seed] Existing School found:', school.name);
    }

    // 2. Create or find Teacher User in MongoDB
    const teacherEmail = 'teacher@spark.edu';
    const teacherPassword = 'teacher123';
    let teacher = await User.findOne({ email: teacherEmail });
    if (!teacher) {
      teacher = new User({
        name: 'Sonia Singh',
        email: teacherEmail,
        password: teacherPassword,
        phone: '+919876543211',
        role: 'teacher',
        schoolId: school._id,
        isActive: true
      });
      await teacher.save();
      console.log('[Seed] Created Teacher in MongoDB:', teacher.email);
    } else {
      teacher.schoolId = school._id;
      teacher.role = 'teacher';
      teacher.isActive = true;
      await teacher.save();
      console.log('[Seed] Updated Teacher in MongoDB:', teacher.email);
    }

    // 3. Sync Teacher to Firebase Authentication and save firebaseUid to MongoDB
    try {
      let fbUser;
      try {
        fbUser = await firebaseAdmin.auth().getUserByEmail(teacherEmail);
        console.log('[Seed] Teacher already exists in Firebase Auth (UID):', fbUser.uid);
      } catch (err) {
        if (err.code === 'auth/user-not-found') {
          fbUser = await firebaseAdmin.auth().createUser({
            email: teacherEmail,
            password: teacherPassword,
            displayName: 'Sonia Singh',
            emailVerified: true
          });
          console.log('[Seed] Created Teacher in Firebase Auth (UID):', fbUser.uid);
        } else {
          throw err;
        }
      }

      if (fbUser && fbUser.uid) {
        teacher.firebaseUid = fbUser.uid;
        teacher.designation = 'Senior Secondary Teacher';
        teacher.subjects = ['Mathematics', 'Science'];
        await teacher.save();
        console.log('[Seed] Synced firebaseUid into MongoDB Teacher:', teacher.firebaseUid);
      }
    } catch (fbErr) {
      console.warn('[Seed] Firebase Auth note:', fbErr.message);
    }

    // 4. Create or find Class
    let demoClass = await Class.findOne({ name: 'Grade 10', section: 'A', schoolId: school._id });
    if (!demoClass) {
      demoClass = await Class.create({
        name: 'Grade 10',
        section: 'A',
        schoolId: school._id,
        teacherId: teacher._id,
        capacity: 40,
        room: 'Room 101',
        academicYear: '2024-2025'
      });
      console.log('[Seed] Created Class:', `${demoClass.name} - ${demoClass.section}`);
    } else {
      demoClass.teacherId = teacher._id;
      demoClass.academicYear = '2024-2025';
      await demoClass.save();
      console.log('[Seed] Found Class:', `${demoClass.name} - ${demoClass.section}`);
    }

    // 5. Create or find Subjects
    let mathSubject = await Subject.findOne({ code: 'MATH10', schoolId: school._id });
    if (!mathSubject) {
      mathSubject = await Subject.create({
        name: 'Mathematics',
        code: 'MATH10',
        schoolId: school._id,
        classId: demoClass._id,
        teacherId: teacher._id,
        type: 'core',
        status: 'active',
        createdBy: teacher._id
      });
      console.log('[Seed] Created Subject:', mathSubject.name);
    }

    let scienceSubject = await Subject.findOne({ code: 'SCI10', schoolId: school._id });
    if (!scienceSubject) {
      scienceSubject = await Subject.create({
        name: 'Science',
        code: 'SCI10',
        schoolId: school._id,
        classId: demoClass._id,
        teacherId: teacher._id,
        type: 'core',
        status: 'active',
        createdBy: teacher._id
      });
      console.log('[Seed] Created Subject:', scienceSubject.name);
    }

    // Update class subjects
    demoClass.subjects = [mathSubject._id, scienceSubject._id];
    await demoClass.save();

    // 6. Create Sample Students
    const sampleStudents = [
      { name: 'Aarav Patel', email: 'aarav@spark.edu', roll: '101', adm: 'ADM-101', gender: 'male', dob: new Date('2008-03-12') },
      { name: 'Diya Sharma', email: 'diya@spark.edu', roll: '102', adm: 'ADM-102', gender: 'female', dob: new Date('2008-07-24') },
      { name: 'Rohan Gupta', email: 'rohan@spark.edu', roll: '103', adm: 'ADM-103', gender: 'male', dob: new Date('2008-01-19') },
      { name: 'Ananya Iyer', email: 'ananya@spark.edu', roll: '104', adm: 'ADM-104', gender: 'female', dob: new Date('2008-11-05') }
    ];

    for (const s of sampleStudents) {
      let student = await Student.findOne({ email: s.email });
      if (!student) {
        student = await Student.create({
          name: s.name,
          email: s.email,
          password: 'student123',
          rollNumber: s.roll,
          admissionNumber: s.adm,
          gender: s.gender,
          dateOfBirth: s.dob,
          schoolId: school._id,
          classId: demoClass._id,
          status: 'active'
        });
        console.log('[Seed] Created Student:', student.name);
      }
    }

    // 7. Create Schedules for all days of the week (so today always has classes!)
    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    for (const day of daysOfWeek) {
      const existing = await Schedule.findOne({
        schoolId: school._id,
        teacherId: teacher._id,
        classId: demoClass._id,
        dayOfWeek: day,
        startTime: '09:00'
      });

      if (!existing) {
        await Schedule.create({
          schoolId: school._id,
          teacherId: teacher._id,
          classId: demoClass._id,
          subjectId: mathSubject._id,
          dayOfWeek: day,
          period: 1,
          startTime: '09:00',
          endTime: '10:00',
          room: 'Room 101',
          academicYear: '2024-2025',
          status: 'active'
        });

        await Schedule.create({
          schoolId: school._id,
          teacherId: teacher._id,
          classId: demoClass._id,
          subjectId: scienceSubject._id,
          dayOfWeek: day,
          period: 2,
          startTime: '10:15',
          endTime: '11:15',
          room: 'Lab 2',
          academicYear: '2024-2025',
          status: 'active'
        });
      }
    }
    console.log('[Seed] Created Daily Schedules for all days of week');

    // 7b. Create an AttendanceSession for today's 09:00 slot (Demonstrates Completed vs Missed dots)
    const todayIST = getISTDateString();
    const firstSlot = await Schedule.findOne({
      teacherId: teacher._id,
      dayOfWeek: new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'long' }).format(new Date()),
      startTime: '09:00'
    });

    const demoStudents = await Student.find({ classId: demoClass._id, status: 'active' });

    if (firstSlot && demoStudents.length > 0) {
      // 7a. Seed today's session (Completed)
      let todaySession = await AttendanceSession.findOne({
        slotId: firstSlot._id,
        date: todayIST
      });

      if (!todaySession) {
        todaySession = await AttendanceSession.create({
          slotId: firstSlot._id,
          classId: demoClass._id,
          subjectId: firstSlot.subjectId,
          teacherId: teacher._id,
          schoolId: school._id,
          date: todayIST,
          submittedAt: new Date(),
          lateMarked: false,
          summary: { present: 3, absent: 1, late: 0, total: demoStudents.length },
          audit: [{
            modifiedBy: teacher._id,
            modifiedByName: teacher.name,
            modifiedAt: new Date(),
            action: 'create',
            changes: 'Initial submission: 3P / 1A / 0L'
          }]
        });

        const todayRecords = demoStudents.map((s, idx) => ({
          sessionId: todaySession._id,
          studentId: s._id,
          status: idx === 3 ? 'A' : 'P',
          remark: idx === 3 ? 'Medical leave note' : ''
        }));
        await AttendanceRecord.insertMany(todayRecords);
        console.log('[Seed] Created sample AttendanceSession for today with AttendanceRecords');
      }

      // 7b. Seed recent session (2 days ago, within 7-day edit window) with audit diff
      const date2DaysAgo = getISTDateOffset(-2);
      let session2DaysAgo = await AttendanceSession.findOne({
        slotId: firstSlot._id,
        date: date2DaysAgo
      });

      if (!session2DaysAgo) {
        session2DaysAgo = await AttendanceSession.create({
          slotId: firstSlot._id,
          classId: demoClass._id,
          subjectId: firstSlot.subjectId,
          teacherId: teacher._id,
          schoolId: school._id,
          date: date2DaysAgo,
          submittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          lateMarked: false,
          summary: { present: 4, absent: 0, late: 0, total: demoStudents.length },
          audit: [
            {
              modifiedBy: teacher._id,
              modifiedByName: teacher.name,
              modifiedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
              action: 'create',
              changes: 'Initial submission: 3P / 1A / 0L'
            },
            {
              modifiedBy: teacher._id,
              modifiedByName: teacher.name,
              modifiedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
              action: 'edit',
              changes: `Updated 1 student(s): ${demoStudents[1]?.name || 'Student'} (Roll ${demoStudents[1]?.rollNumber || '2'}: A->P)`,
              details: [{
                studentId: demoStudents[1]?._id,
                studentName: demoStudents[1]?.name || 'Student',
                rollNumber: String(demoStudents[1]?.rollNumber || '2'),
                oldStatus: 'A',
                newStatus: 'P'
              }]
            }
          ]
        });

        const records2DaysAgo = demoStudents.map((s) => ({
          sessionId: session2DaysAgo._id,
          studentId: s._id,
          status: 'P',
          remark: ''
        }));
        await AttendanceRecord.insertMany(records2DaysAgo);
        console.log('[Seed] Created AttendanceSession for 2 days ago (Editable, with Audit Diff)');
      }

      // 7c. Seed past session (10 days ago, beyond 7-day edit window -> Locked read-only)
      const date10DaysAgo = getISTDateOffset(-10);
      let session10DaysAgo = await AttendanceSession.findOne({
        slotId: firstSlot._id,
        date: date10DaysAgo
      });

      if (!session10DaysAgo) {
        session10DaysAgo = await AttendanceSession.create({
          slotId: firstSlot._id,
          classId: demoClass._id,
          subjectId: firstSlot.subjectId,
          teacherId: teacher._id,
          schoolId: school._id,
          date: date10DaysAgo,
          submittedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
          lateMarked: false,
          summary: { present: 2, absent: 1, late: 1, total: demoStudents.length },
          audit: [{
            modifiedBy: teacher._id,
            modifiedByName: teacher.name,
            modifiedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
            action: 'create',
            changes: 'Initial submission: 2P / 1A / 1L'
          }]
        });

        const records10DaysAgo = demoStudents.map((s, idx) => ({
          sessionId: session10DaysAgo._id,
          studentId: s._id,
          status: idx === 0 ? 'P' : idx === 1 ? 'P' : idx === 2 ? 'L' : 'A',
          remark: idx === 2 ? 'Bus delayed' : ''
        }));
        await AttendanceRecord.insertMany(records10DaysAgo);
        console.log('[Seed] Created AttendanceSession for 10 days ago (Locked read-only > 7 days)');
      }
    }


    // 8. Create Sample Assignments with Submissions across submitted, late, graded, and pending
    let assignment = await Assignment.findOne({ teacherId: teacher._id, title: 'Calculus & Algebra Practice' });
    const due = new Date();
    due.setDate(due.getDate() + 5);

    const sampleSubmissions = [];
    if (demoStudents && demoStudents.length >= 3) {
      // 1. Submitted (on-time, pending teacher grading)
      sampleSubmissions.push({
        studentId: demoStudents[0]._id,
        submittedAt: new Date(Date.now() - 3 * 3600 * 1000),
        attachments: [{
          name: 'Math_Calculus_Rahul.jpg',
          url: 'https://res.cloudinary.com/ejoblc6b/image/upload/v1793633031/sparkology/demo/sample_classroom_1793633032004.jpg',
          type: 'image',
          size: 47964
        }],
        marks: null,
        pointsEarned: 50,
        feedback: '',
        status: 'submitted',
        needsResubmission: false
      });

      // 2. Late submission
      sampleSubmissions.push({
        studentId: demoStudents[1]._id,
        submittedAt: new Date(Date.now() - 1 * 3600 * 1000),
        attachments: [{
          name: 'Algebra_Ch4_Priya.jpg',
          url: 'https://res.cloudinary.com/ejoblc6b/image/upload/v1793633031/sparkology/demo/sample_classroom_1793633032004.jpg',
          type: 'image',
          size: 47964
        }],
        marks: null,
        pointsEarned: 25,
        feedback: '',
        status: 'late',
        needsResubmission: false
      });

      // 3. Graded submission
      sampleSubmissions.push({
        studentId: demoStudents[2]._id,
        submittedAt: new Date(Date.now() - 24 * 3600 * 1000),
        attachments: [{
          name: 'Homework_Amit.jpg',
          url: 'https://res.cloudinary.com/ejoblc6b/image/upload/v1793633031/sparkology/demo/sample_classroom_1793633032004.jpg',
          type: 'image',
          size: 47964
        }],
        marks: 46,
        pointsEarned: 50,
        feedback: 'Excellent work! Clearly explained all integration steps.',
        status: 'graded',
        needsResubmission: false,
        gradedAt: new Date(Date.now() - 12 * 3600 * 1000),
        gradedBy: teacher._id
      });
    }

    if (!assignment) {
      assignment = await Assignment.create({
        title: 'Calculus & Algebra Practice',
        description: 'Complete problems 1 through 20 from Chapter 4 in the textbook.',
        classId: demoClass._id,
        subjectId: mathSubject._id,
        teacherId: teacher._id,
        schoolId: school._id,
        dueDate: due,
        dueTime: '23:59',
        totalMarks: 50,
        points: 50,
        attachments: [{
          name: 'Calculus_Problem_Set.jpg',
          url: 'https://res.cloudinary.com/ejoblc6b/image/upload/v1793633031/sparkology/demo/sample_classroom_1793633032004.jpg',
          type: 'image',
          size: 47964
        }],
        submissions: sampleSubmissions,
        createdBy: teacher._id
      });
      console.log('[Seed] Created Assignment with sample submissions:', assignment.title);
    } else {
      assignment.submissions = sampleSubmissions;
      assignment.totalMarks = 50;
      assignment.points = 50;
      assignment.dueDate = due;
      assignment.dueTime = '23:59';
      assignment.attachments = [{
        name: 'Calculus_Problem_Set.jpg',
        url: 'https://res.cloudinary.com/ejoblc6b/image/upload/v1793633031/sparkology/demo/sample_classroom_1793633032004.jpg',
        type: 'image',
        size: 47964
      }];
      await assignment.save();
      console.log('[Seed] Updated Assignment with sample submissions:', assignment.title);
    }

    // Past Assignment
    let pastAssignment = await Assignment.findOne({ teacherId: teacher._id, title: 'Trigonometry Problem Set' });
    const pastDue = new Date();
    pastDue.setDate(pastDue.getDate() - 3);

    if (!pastAssignment) {
      pastAssignment = await Assignment.create({
        title: 'Trigonometry Problem Set',
        description: 'Solve angle transformation questions from pages 45 to 50.',
        classId: demoClass._id,
        subjectId: mathSubject._id,
        teacherId: teacher._id,
        schoolId: school._id,
        dueDate: pastDue,
        dueTime: '17:00',
        totalMarks: 30,
        points: 30,
        submissions: demoStudents && demoStudents.length > 0 ? [{
          studentId: demoStudents[0]._id,
          submittedAt: new Date(Date.now() - 4 * 24 * 3600 * 1000),
          attachments: [{
            name: 'Trig_Solutions_Rahul.pdf',
            url: 'https://res.cloudinary.com/demo/image/upload/sample.pdf',
            type: 'pdf',
            size: 110000
          }],
          marks: 28,
          pointsEarned: 30,
          feedback: 'Very thorough solutions.',
          status: 'graded',
          needsResubmission: false,
          gradedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000),
          gradedBy: teacher._id
        }] : [],
        createdBy: teacher._id
      });
      console.log('[Seed] Created Past Assignment:', pastAssignment.title);
    }

    // 9. Create Sample Note
    let note = await Note.findOne({ teacherId: teacher._id, title: 'Midterm Formulas & Summary' });
    if (!note) {
      note = await Note.create({
        title: 'Midterm Formulas & Summary',
        content: 'Review quadratic equation roots and trigonometric identities before Friday.',
        classId: demoClass._id,
        subjectId: mathSubject._id,
        teacherId: teacher._id,
        schoolId: school._id,
        createdBy: teacher._id,
        attachments: []
      });
      console.log('[Seed] Created Note:', note.title);
    }

    // 10. Create Sample Meeting
    let meeting = await Meeting.findOne({ teacherId: teacher._id, title: 'Weekly Q&A and Parent Check-in' });
    if (!meeting) {
      const mDate = new Date();
      mDate.setDate(mDate.getDate() + 2);
      meeting = await Meeting.create({
        title: 'Weekly Q&A and Parent Check-in',
        url: 'https://meet.google.com/spark-teacher-demo',
        meetingTime: mDate,
        duration: 45,
        description: 'Open discussion on student progress and questions.',
        teacherId: teacher._id,
        classId: demoClass._id,
        subjectId: mathSubject._id,
        schoolId: school._id,
        status: 'scheduled'
      });
      console.log('[Seed] Created Meeting:', meeting.title);
    }

    // 11. Create Sample Teacher Leaves (Approved, Pending, Rejected)
    const existingLeaves = await TeacherLeave.find({ teacherId: teacher._id });
    if (existingLeaves.length === 0) {
      const nowMs = Date.now();
      const leavesToCreate = [
        {
          teacherId: teacher._id,
          schoolId: school._id,
          fromDate: new Date(nowMs - 14 * 24 * 3600 * 1000),
          toDate: new Date(nowMs - 12 * 24 * 3600 * 1000),
          leaveType: 'casual',
          reason: 'Family wedding ceremony in hometown',
          status: 'approved',
          approvedBy: teacher._id,
          approvedAt: new Date(nowMs - 15 * 24 * 3600 * 1000)
        },
        {
          teacherId: teacher._id,
          schoolId: school._id,
          fromDate: new Date(nowMs + 4 * 24 * 3600 * 1000),
          toDate: new Date(nowMs + 5 * 24 * 3600 * 1000),
          leaveType: 'sick',
          reason: 'Scheduled dental root canal and recovery',
          status: 'pending'
        },
        {
          teacherId: teacher._id,
          schoolId: school._id,
          fromDate: new Date(nowMs - 30 * 24 * 3600 * 1000),
          toDate: new Date(nowMs - 28 * 24 * 3600 * 1000),
          leaveType: 'emergency',
          reason: 'Personal renovation errands',
          status: 'rejected',
          rejectionReason: 'Clashes with mid-term examinations schedule'
        }
      ];
      await TeacherLeave.insertMany(leavesToCreate);
      console.log('[Seed] Created 3 sample Teacher Leaves (Approved, Pending, Rejected)');
    }

    console.log('\n=========================================');
    console.log('SEED COMPLETED SUCCESSFULLY!');
    console.log('Login credentials:');
    console.log('  Email:    teacher@spark.edu');
    console.log('  Password: teacher123');
    console.log('=========================================\n');
    process.exit(0);
  } catch (error) {
    console.error('[Seed Error]:', error);
    process.exit(1);
  }
}

seedTeacherDemo();
