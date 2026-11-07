const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../.env') });

const mongoose = require('mongoose');
const School = require('../models/School');
const User = require('../models/User');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const Student = require('../models/Student');
const Schedule = require('../models/Schedule');
const Assignment = require('../models/Assignment');
const AttendanceSession = require('../models/AttendanceSession');
const AttendanceRecord = require('../models/AttendanceRecord');
const Attendance = require('../models/Attendance');
const TeacherLeave = require('../models/TeacherLeave');
const { getISTDateString, getISTDateOffset } = require('../utils/dateTimeUtils');

async function seedRichTeacherDemo() {
  try {
    console.log('[RichSeed] Connecting to MongoDB Atlas...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[RichSeed] Connected to MongoDB Atlas');

    // 0. Ensure an Admin user exists for required audit fields (createdBy)
    let admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      admin = new User({
        name: 'System Administrator',
        email: 'admin@spark.edu',
        password: 'admin123',
        role: 'admin',
        isActive: true
      });
      await admin.save();
      console.log('[RichSeed] Created Admin for audit reference:', admin.email);
    }

    // 1. Get or Create School
    let school = await School.findOne({ code: 'SPARK01' });
    if (!school) {
      school = await School.create({
        name: 'Spark International Academy',
        code: 'SPARK01',
        address: '100 Innovation Boulevard, Tech City',
        contact: '+91 9876543210',
        status: 'active',
        plan: 'enterprise',
        students: 40,
        teachers: 10,
        createdBy: admin._id,
      });
      console.log('[RichSeed] Created School:', school.name);
    } else {
      console.log('[RichSeed] Existing School found:', school.name);
    }

    // 2. Ensure Teacher User Sonia Singh
    const teacherEmail = 'teacher@spark.edu';
    let teacher = await User.findOne({ email: teacherEmail });
    if (!teacher) {
      teacher = new User({
        name: 'Sonia Singh',
        email: teacherEmail,
        password: 'teacher123',
        phone: '+919876543211',
        role: 'teacher',
        schoolId: school._id,
        isActive: true,
        designation: 'Senior Mathematics Teacher',
        subjects: ['Mathematics', 'Advanced Calculus', 'Geometry'],
      });
      await teacher.save();
      console.log('[RichSeed] Created Teacher:', teacher.name);
    } else {
      teacher.name = 'Sonia Singh';
      teacher.schoolId = school._id;
      teacher.role = 'teacher';
      teacher.isActive = true;
      teacher.designation = 'Senior Mathematics Teacher';
      teacher.subjects = ['Mathematics', 'Advanced Calculus', 'Geometry'];
      await teacher.save();
      console.log('[RichSeed] Updated Teacher:', teacher.name);
    }

    // 3. Create 3 Classes for Teacher Sonia Singh
    // Class 1: Grade 10 - A (Class Teacher: Sonia Singh)
    let class10A = await Class.findOne({ name: 'Grade 10', section: 'A', schoolId: school._id });
    if (!class10A) {
      class10A = await Class.create({
        name: 'Grade 10',
        section: 'A',
        schoolId: school._id,
        teacherId: teacher._id,
        capacity: 40,
        room: 'Room 101',
        academicYear: '2024-2025',
        createdBy: teacher._id,
      });
    } else {
      class10A.teacherId = teacher._id;
      class10A.room = 'Room 101';
      await class10A.save();
    }

    // Class 2: Grade 9 - B
    let class9B = await Class.findOne({ name: 'Grade 9', section: 'B', schoolId: school._id });
    if (!class9B) {
      class9B = await Class.create({
        name: 'Grade 9',
        section: 'B',
        schoolId: school._id,
        capacity: 35,
        room: 'Room 105',
        academicYear: '2024-2025',
        createdBy: teacher._id,
      });
    }

    // Class 3: Grade 11 - A
    let class11A = await Class.findOne({ name: 'Grade 11', section: 'A', schoolId: school._id });
    if (!class11A) {
      class11A = await Class.create({
        name: 'Grade 11',
        section: 'A',
        schoolId: school._id,
        capacity: 30,
        room: 'Room 203',
        academicYear: '2024-2025',
        createdBy: teacher._id,
      });
    }

    console.log('[RichSeed] Verified Classes: Grade 10-A, Grade 9-B, Grade 11-A');

    // 4. Create Subjects
    let math10 = await Subject.findOne({ code: 'MATH10', schoolId: school._id });
    if (!math10) {
      math10 = await Subject.create({
        name: 'Mathematics',
        code: 'MATH10',
        schoolId: school._id,
        classId: class10A._id,
        teacherId: teacher._id,
        type: 'core',
        status: 'active',
        createdBy: teacher._id,
      });
    }

    let math09 = await Subject.findOne({ code: 'MATH09', schoolId: school._id });
    if (!math09) {
      math09 = await Subject.create({
        name: 'Geometry & Algebra',
        code: 'MATH09',
        schoolId: school._id,
        classId: class9B._id,
        teacherId: teacher._id,
        type: 'core',
        status: 'active',
        createdBy: teacher._id,
      });
    }

    let calc11 = await Subject.findOne({ code: 'CALC11', schoolId: school._id });
    if (!calc11) {
      calc11 = await Subject.create({
        name: 'Advanced Calculus',
        code: 'CALC11',
        schoolId: school._id,
        classId: class11A._id,
        teacherId: teacher._id,
        type: 'core',
        status: 'active',
        createdBy: teacher._id,
      });
    }

    let science10 = await Subject.findOne({ code: 'SCI10', schoolId: school._id });
    if (!science10) {
      science10 = await Subject.create({
        name: 'Science',
        code: 'SCI10',
        schoolId: school._id,
        classId: class10A._id,
        teacherId: teacher._id,
        type: 'core',
        status: 'active',
        createdBy: teacher._id,
      });
    }

    class10A.subjects = [math10._id, science10._id];
    await class10A.save();

    class9B.subjects = [math09._id];
    await class9B.save();

    class11A.subjects = [calc11._id];
    await class11A.save();

    console.log('[RichSeed] Subjects mapped to classes');

    // 5. Seed Realistic Students for Grade 10-A (15 students)
    const grade10StudentsData = [
      { name: 'Aarav Patel', roll: '101', email: 'aarav.patel@spark.edu', phone: '+91 98200 11001', gender: 'male' },
      { name: 'Diya Sharma', roll: '102', email: 'diya.sharma@spark.edu', phone: '+91 98200 11002', gender: 'female' },
      { name: 'Rohan Gupta', roll: '103', email: 'rohan.gupta@spark.edu', phone: '+91 98200 11003', gender: 'male' }, // Will set <80% attendance
      { name: 'Ananya Iyer', roll: '104', email: 'ananya.iyer@spark.edu', phone: '+91 98200 11004', gender: 'female' },
      { name: 'Vihaan Verma', roll: '105', email: 'vihaan.verma@spark.edu', phone: '+91 98200 11005', gender: 'male' },
      { name: 'Ishaan Joshi', roll: '106', email: 'ishaan.joshi@spark.edu', phone: '+91 98200 11006', gender: 'male' },
      { name: 'Priya Nair', roll: '107', email: 'priya.nair@spark.edu', phone: '+91 98200 11007', gender: 'female' },
      { name: 'Kabir Mehta', roll: '108', email: 'kabir.mehta@spark.edu', phone: '+91 98200 11008', gender: 'male' }, // Will set <80% attendance
      { name: 'Sneha Rao', roll: '109', email: 'sneha.rao@spark.edu', phone: '+91 98200 11009', gender: 'female' },
      { name: 'Aditya Kulkarni', roll: '110', email: 'aditya.k@spark.edu', phone: '+91 98200 11010', gender: 'male' },
      { name: 'Tanvi Chawla', roll: '111', email: 'tanvi.c@spark.edu', phone: '+91 98200 11011', gender: 'female' },
      { name: 'Devansh Bansal', roll: '112', email: 'devansh.b@spark.edu', phone: '+91 98200 11012', gender: 'male' },
      { name: 'Meera Deshmukh', roll: '113', email: 'meera.d@spark.edu', phone: '+91 98200 11013', gender: 'female' },
      { name: 'Aryan Singhania', roll: '114', email: 'aryan.s@spark.edu', phone: '+91 98200 11014', gender: 'male' },
      { name: 'Riya Pillai', roll: '115', email: 'riya.p@spark.edu', phone: '+91 98200 11015', gender: 'female' },
    ];

    const seededStudents10A = [];
    for (const s of grade10StudentsData) {
      let st = await Student.findOne({ email: s.email });
      if (!st) {
        st = await Student.create({
          name: s.name,
          email: s.email,
          password: 'student123',
          rollNumber: s.roll,
          admissionNumber: `ADM-${s.roll}`,
          gender: s.gender,
          dateOfBirth: new Date('2008-05-15'),
          schoolId: school._id,
          classId: class10A._id,
          status: 'active',
          parentContact: s.phone,
          parentPhone: s.phone,
          parentName: `Parent of ${s.name}`,
        });
      } else {
        st.classId = class10A._id;
        st.rollNumber = s.roll;
        st.parentContact = s.phone;
        st.parentPhone = s.phone;
        st.parentName = `Parent of ${s.name}`;
        await st.save();
      }
      seededStudents10A.push(st);
    }

    // Seed Students for Grade 9-B (8 students)
    const grade9StudentsData = [
      { name: 'Ayush Saxena', roll: '201', email: 'ayush.s@spark.edu', phone: '+91 98200 22001', gender: 'male' },
      { name: 'Kavya Reddy', roll: '202', email: 'kavya.r@spark.edu', phone: '+91 98200 22002', gender: 'female' },
      { name: 'Samar Khan', roll: '203', email: 'samar.k@spark.edu', phone: '+91 98200 22003', gender: 'male' },
      { name: 'Anvi Trivedi', roll: '204', email: 'anvi.t@spark.edu', phone: '+91 98200 22004', gender: 'female' },
      { name: 'Dhruv Kapoor', roll: '205', email: 'dhruv.k@spark.edu', phone: '+91 98200 22005', gender: 'male' },
      { name: 'Isha Sen', roll: '206', email: 'isha.s@spark.edu', phone: '+91 98200 22006', gender: 'female' },
      { name: 'Manav Bhatt', roll: '207', email: 'manav.b@spark.edu', phone: '+91 98200 22007', gender: 'male' },
      { name: 'Shruti Hegde', roll: '208', email: 'shruti.h@spark.edu', phone: '+91 98200 22008', gender: 'female' },
    ];

    for (const s of grade9StudentsData) {
      let st = await Student.findOne({ email: s.email });
      if (!st) {
        await Student.create({
          name: s.name,
          email: s.email,
          password: 'student123',
          rollNumber: s.roll,
          admissionNumber: `ADM-${s.roll}`,
          gender: s.gender,
          dateOfBirth: new Date('2009-08-20'),
          schoolId: school._id,
          classId: class9B._id,
          status: 'active',
          parentContact: s.phone,
          parentPhone: s.phone,
          parentName: `Parent of ${s.name}`,
        });
      }
    }

    console.log(`[RichSeed] Seeded ${grade10StudentsData.length} students in 10-A, ${grade9StudentsData.length} in 9-B`);

    // 6. Realistic Daily Schedules (All 7 days of the week, 4 distinct periods per day)
    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    // Clean existing schedules for teacher to avoid duplicates
    await Schedule.deleteMany({ teacherId: teacher._id, schoolId: school._id });

    for (const day of daysOfWeek) {
      // Period 1: 09:00 - 10:00 -> Grade 10-A (Mathematics)
      await Schedule.create({
        schoolId: school._id,
        teacherId: teacher._id,
        classId: class10A._id,
        subjectId: math10._id,
        dayOfWeek: day,
        period: 1,
        startTime: '09:00',
        endTime: '10:00',
        room: 'Room 101',
        academicYear: '2024-2025',
        status: 'active',
        createdBy: teacher._id,
      });

      // Period 2: 10:15 - 11:15 -> Grade 9-B (Geometry & Algebra)
      await Schedule.create({
        schoolId: school._id,
        teacherId: teacher._id,
        classId: class9B._id,
        subjectId: math09._id,
        dayOfWeek: day,
        period: 2,
        startTime: '10:15',
        endTime: '11:15',
        room: 'Room 105',
        academicYear: '2024-2025',
        status: 'active',
        createdBy: teacher._id,
      });

      // Period 3: 12:00 - 13:00 -> Grade 10-A (Problem Solving Lab)
      await Schedule.create({
        schoolId: school._id,
        teacherId: teacher._id,
        classId: class10A._id,
        subjectId: math10._id,
        dayOfWeek: day,
        period: 3,
        startTime: '12:00',
        endTime: '13:00',
        room: 'Room 101',
        academicYear: '2024-2025',
        status: 'active',
        createdBy: teacher._id,
      });

      // Period 4: 14:00 - 15:00 -> Grade 11-A (Advanced Calculus)
      await Schedule.create({
        schoolId: school._id,
        teacherId: teacher._id,
        classId: class11A._id,
        subjectId: calc11._id,
        dayOfWeek: day,
        period: 4,
        startTime: '14:00',
        endTime: '15:00',
        room: 'Room 203',
        academicYear: '2024-2025',
        status: 'active',
        createdBy: teacher._id,
      });
    }

    console.log('[RichSeed] Created 4 Periods per day across entire weekly timetable');

    // 7. Seed Past Attendance for realistic stats on Students Screen
    // Create attendance records for the past 10 days for Grade 10-A
    const slotPeriod1 = await Schedule.findOne({
      teacherId: teacher._id,
      startTime: '09:00',
      dayOfWeek: new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'long' }).format(new Date()),
    });

    if (slotPeriod1) {
      for (let offset = -7; offset <= -1; offset++) {
        const pastDateStr = getISTDateOffset(offset);
        let pastSession = await AttendanceSession.findOne({ slotId: slotPeriod1._id, date: pastDateStr });
        if (!pastSession) {
          let pCount = 0;
          let aCount = 0;

          const recs = seededStudents10A.map((st) => {
            // Rohan Gupta (roll 103) & Kabir Mehta (roll 108) have frequent absences to show <80% tag
            let status = 'P';
            if (st.rollNumber === '103' && (offset === -1 || offset === -3 || offset === -5 || offset === -6)) {
              status = 'A';
              aCount++;
            } else if (st.rollNumber === '108' && (offset === -2 || offset === -4 || offset === -7)) {
              status = 'A';
              aCount++;
            } else if (st.rollNumber === '105' && offset === -4) {
              status = 'A';
              aCount++;
            } else {
              pCount++;
            }
            return {
              studentId: st._id,
              status,
              remark: status === 'A' ? 'Absent without note' : '',
            };
          });

          pastSession = await AttendanceSession.create({
            slotId: slotPeriod1._id,
            classId: class10A._id,
            subjectId: math10._id,
            teacherId: teacher._id,
            schoolId: school._id,
            date: pastDateStr,
            submittedAt: new Date(Date.now() + offset * 86400000),
            lateMarked: false,
            summary: { present: pCount, absent: aCount, late: 0, total: seededStudents10A.length },
          });

          const attRecords = recs.map((r) => ({
            sessionId: pastSession._id,
            studentId: r.studentId,
            status: r.status,
            remark: r.remark,
          }));
          await AttendanceRecord.insertMany(attRecords);

          // Legacy collection sync
          const legacyDate = new Date(`${pastDateStr}T09:00:00+05:30`);
          const legacyOps = recs.map((r) => ({
            updateOne: {
              filter: {
                studentId: r.studentId,
                classId: class10A._id,
                subjectId: math10._id,
                date: {
                  $gte: new Date(`${pastDateStr}T00:00:00+05:30`),
                  $lte: new Date(`${pastDateStr}T23:59:59+05:30`),
                },
              },
              update: {
                $set: {
                  schoolId: school._id,
                  teacherId: teacher._id,
                  date: legacyDate,
                  status: r.status === 'P' ? 'present' : 'absent',
                  remarks: r.remark,
                  markedBy: teacher._id,
                  markedAt: new Date(Date.now() + offset * 86400000),
                  isActive: true,
                  academicYear: '2024-2025',
                },
              },
              upsert: true,
            },
          }));
          await Attendance.bulkWrite(legacyOps);
        }
      }
      console.log('[RichSeed] Populated past 7 days attendance history with realistic student attendance %');
    }

    // 8. Seed Rich Homework & Submissions
    await Assignment.deleteMany({ teacherId: teacher._id, schoolId: school._id });

    const activeDueDate = new Date();
    activeDueDate.setDate(activeDueDate.getDate() + 3);

    // Assignment 1: Calculus & Algebra Practice
    const subList1 = [
      {
        studentId: seededStudents10A[0]._id, // Aarav Patel
        submittedAt: new Date(Date.now() - 4 * 3600 * 1000),
        attachments: [{
          name: 'Aarav_Calculus_Solutions.pdf',
          url: 'https://res.cloudinary.com/ejoblc6b/image/upload/v1793633031/sparkology/demo/sample_classroom_1793633032004.jpg',
          type: 'image',
          size: 52400,
        }],
        marks: null,
        pointsEarned: 50,
        feedback: '',
        status: 'submitted',
        needsResubmission: false,
      },
      {
        studentId: seededStudents10A[1]._id, // Diya Sharma
        submittedAt: new Date(Date.now() - 6 * 3600 * 1000),
        attachments: [{
          name: 'Diya_Homework_Ch4.jpg',
          url: 'https://res.cloudinary.com/ejoblc6b/image/upload/v1793633031/sparkology/demo/sample_classroom_1793633032004.jpg',
          type: 'image',
          size: 48000,
        }],
        marks: 48,
        pointsEarned: 50,
        feedback: 'Outstanding proofs and step-by-step working! Full credit.',
        status: 'graded',
        needsResubmission: false,
        gradedAt: new Date(Date.now() - 2 * 3600 * 1000),
        gradedBy: teacher._id,
      },
      {
        studentId: seededStudents10A[2]._id, // Rohan Gupta
        submittedAt: new Date(Date.now() - 1 * 3600 * 1000),
        attachments: [{
          name: 'Rohan_Late_Submission.jpg',
          url: 'https://res.cloudinary.com/ejoblc6b/image/upload/v1793633031/sparkology/demo/sample_classroom_1793633032004.jpg',
          type: 'image',
          size: 41200,
        }],
        marks: null,
        pointsEarned: 30,
        feedback: '',
        status: 'late',
        needsResubmission: false,
      },
      {
        studentId: seededStudents10A[3]._id, // Ananya Iyer
        submittedAt: new Date(Date.now() - 8 * 3600 * 1000),
        attachments: [{
          name: 'Ananya_Assignment4.pdf',
          url: 'https://res.cloudinary.com/ejoblc6b/image/upload/v1793633031/sparkology/demo/sample_classroom_1793633032004.jpg',
          type: 'image',
          size: 61000,
        }],
        marks: null,
        pointsEarned: 50,
        feedback: '',
        status: 'submitted',
        needsResubmission: false,
      },
      {
        studentId: seededStudents10A[4]._id, // Vihaan Verma
        submittedAt: new Date(Date.now() - 12 * 3600 * 1000),
        attachments: [{
          name: 'Vihaan_HW4.jpg',
          url: 'https://res.cloudinary.com/ejoblc6b/image/upload/v1793633031/sparkology/demo/sample_classroom_1793633032004.jpg',
          type: 'image',
          size: 39500,
        }],
        marks: 44,
        pointsEarned: 50,
        feedback: 'Good attempt. Check Q7 differentiation formula again.',
        status: 'graded',
        needsResubmission: false,
        gradedAt: new Date(Date.now() - 4 * 3600 * 1000),
        gradedBy: teacher._id,
      },
    ];

    await Assignment.create({
      title: 'Calculus & Algebra Practice · Ex 4.2',
      description: 'Solve questions 1 through 15 on polynomial differentiation and algebraic simplification. Show all intermediate calculation steps.',
      classId: class10A._id,
      subjectId: math10._id,
      teacherId: teacher._id,
      schoolId: school._id,
      dueDate: activeDueDate,
      dueTime: '23:59',
      totalMarks: 50,
      points: 50,
      attachments: [{
        name: 'Calculus_Ex4.2_Questions.pdf',
        url: 'https://res.cloudinary.com/ejoblc6b/image/upload/v1793633031/sparkology/demo/sample_classroom_1793633032004.jpg',
        type: 'image',
        size: 78000,
      }],
      submissions: subList1,
      createdBy: teacher._id,
    });

    // Assignment 2: Geometry Constructions & Theorems (Grade 9-B)
    const geomDueDate = new Date();
    geomDueDate.setDate(geomDueDate.getDate() + 5);

    await Assignment.create({
      title: 'Geometric Proofs & Angle Bisectors',
      description: 'Draw accurate diagrams for theorems 3.1 to 3.4 using ruler and compass. State given, to prove, and proof clearly.',
      classId: class9B._id,
      subjectId: math09._id,
      teacherId: teacher._id,
      schoolId: school._id,
      dueDate: geomDueDate,
      dueTime: '23:59',
      totalMarks: 30,
      points: 30,
      attachments: [{
        name: 'Geometry_Theorems_Guide.pdf',
        url: 'https://res.cloudinary.com/ejoblc6b/image/upload/v1793633031/sparkology/demo/sample_classroom_1793633032004.jpg',
        type: 'image',
        size: 64000,
      }],
      submissions: [],
      createdBy: teacher._id,
    });

    // Assignment 3: Past Assignment (Due 3 days ago)
    const pastDueDate = new Date();
    pastDueDate.setDate(pastDueDate.getDate() - 3);

    await Assignment.create({
      title: 'Trigonometry Baseline Assessment',
      description: 'Trigonometric identities review test from chapter 2.',
      classId: class10A._id,
      subjectId: math10._id,
      teacherId: teacher._id,
      schoolId: school._id,
      dueDate: pastDueDate,
      dueTime: '23:59',
      totalMarks: 25,
      points: 25,
      submissions: [
        {
          studentId: seededStudents10A[0]._id,
          submittedAt: new Date(Date.now() - 4 * 86400000),
          attachments: [],
          marks: 24,
          pointsEarned: 25,
          feedback: 'Excellent work!',
          status: 'graded',
          needsResubmission: false,
          gradedAt: new Date(Date.now() - 3 * 86400000),
          gradedBy: teacher._id,
        },
      ],
      createdBy: teacher._id,
    });

    console.log('[RichSeed] Created 3 assignments (Active & Past) with realistic submissions');

    // 9. Seed Teacher Leaves
    await TeacherLeave.deleteMany({ teacherId: teacher._id });
    await TeacherLeave.create({
      teacherId: teacher._id,
      schoolId: school._id,
      leaveType: 'casual',
      fromDate: new Date(Date.now() - 15 * 86400000),
      toDate: new Date(Date.now() - 15 * 86400000),
      days: 1,
      reason: 'Personal family event',
      status: 'approved',
      approvedBy: teacher._id,
      approvedAt: new Date(Date.now() - 16 * 86400000),
    });

    await TeacherLeave.create({
      teacherId: teacher._id,
      schoolId: school._id,
      leaveType: 'sick',
      fromDate: new Date(Date.now() - 30 * 86400000),
      toDate: new Date(Date.now() - 29 * 86400000),
      days: 2,
      reason: 'Viral fever rest',
      status: 'approved',
      approvedBy: teacher._id,
      approvedAt: new Date(Date.now() - 31 * 86400000),
    });

    console.log('[RichSeed] Populated teacher leave records (Casual & Medical)');

    console.log('\n======================================================');
    console.log('✅ RICH SEED COMPLETE FOR SONIA SINGH (teacher@spark.edu)');
    console.log('Classes: Grade 10-A (15 students), Grade 9-B (8 students), Grade 11-A');
    console.log('Timetable: 4 Periods / Day (09:00, 10:15, 12:00, 14:00)');
    console.log('Assignments: Active & Past with Submissions ready for review & grading');
    console.log('Attendance History: Past 7 days populated with realistic percentages');
    console.log('======================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('[RichSeed] Error seeding data:', err);
    process.exit(1);
  }
}

seedRichTeacherDemo();
