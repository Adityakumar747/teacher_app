const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const Assignment = require('../models/Assignment');
const { generateToken } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB Atlas');

  const teacher = await User.findOne({ email: 'teacher@spark.edu' });
  const token = generateToken(teacher);

  const cls = await Class.findOne({ schoolId: teacher.schoolId, name: 'Grade 10' });
  const sub = await Subject.findOne({ schoolId: teacher.schoolId, teacherId: teacher._id });

  // 1. Test POST /api/upload/sign
  console.log('\n--- TEST 1: POST /api/upload/sign ---');
  const signRes = await fetch('http://localhost:5000/api/upload/sign', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ fileType: 'png', folder: 'sparkology/homework' })
  });
  const signData = await signRes.json();
  console.log('Sign status:', signRes.status, 'isConfigured:', signData.data?.isConfigured, 'apiKey:', signData.data?.apiKey);

  // 2. Test POST /api/homework JSON payload
  console.log('\n--- TEST 2: POST /api/homework (JSON) ---');
  let jsonAssignmentId = null;
  const jsonPayload = {
    title: 'Verification Homework JSON Only',
    description: 'Verifying homework creation without attachments',
    classId: cls._id.toString(),
    subjectId: sub._id.toString(),
    dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
    dueTime: '23:59',
    totalMarks: 50,
    points: 50,
    attachments: []
  };
  const jsonRes = await fetch('http://localhost:5000/api/homework', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(jsonPayload)
  });
  const jsonData = await jsonRes.json();
  console.log('JSON create status:', jsonRes.status, 'ID:', jsonData.data?._id);
  if (jsonData.data?._id) jsonAssignmentId = jsonData.data._id;

  // 3. Test POST /api/homework Multipart with Image (Local Fallback)
  console.log('\n--- TEST 3: POST /api/homework (Multipart with PNG image) ---');
  let multipartAssignmentId = null;
  const dummyFile = path.join(__dirname, 'test_sample.png');
  fs.writeFileSync(dummyFile, Buffer.from('89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000A49444154789C63000100000500010D0A2D0000000049454E44AE426082', 'hex'));

  const form = new FormData();
  form.append('title', 'Verification Homework With Attached Image');
  form.append('description', 'Teacher attached whiteboard photo');
  form.append('classId', cls._id.toString());
  form.append('subjectId', sub._id.toString());
  form.append('dueDate', new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0]);
  form.append('dueTime', '23:59');
  form.append('totalMarks', '50');
  form.append('points', '50');
  form.append('files', fs.createReadStream(dummyFile));

  const multiRes = await new Promise((resolve, reject) => {
    form.submit({
      host: 'localhost',
      port: 5000,
      path: '/api/homework',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }, (err, res) => {
      if (err) return reject(err);
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });
  });

  console.log('Multipart create status:', multiRes.statusCode);
  const multiJson = JSON.parse(multiRes.body);
  console.log('Multipart response:', {
    success: multiJson.success,
    id: multiJson.data?._id,
    attachments: multiJson.data?.attachments
  });
  if (multiJson.data?._id) multipartAssignmentId = multiJson.data._id;

  // Cleanup dummy file
  if (fs.existsSync(dummyFile)) fs.unlinkSync(dummyFile);

  // 4. Test GET /api/homework list
  console.log('\n--- TEST 4: GET /api/homework list ---');
  const listRes = await fetch(`http://localhost:5000/api/homework?classId=${cls._id.toString()}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const listData = await listRes.json();
  console.log('List count:', listData.data?.length, 'Found newly created?', listData.data?.some(a => a._id === jsonAssignmentId));

  // 5. Test Auth 401 without token
  console.log('\n--- TEST 5: Security check (no token) ---');
  const noTokenRes = await fetch('http://localhost:5000/api/homework');
  console.log('No token response status:', noTokenRes.status);

  // 6. Test POST /api/auth/logout
  console.log('\n--- TEST 6: POST /api/auth/logout ---');
  const logoutRes = await fetch('http://localhost:5000/api/auth/logout', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const logoutData = await logoutRes.json();
  console.log('Logout response status:', logoutRes.status, logoutData);

  // Cleanup created test records
  if (jsonAssignmentId) await Assignment.findByIdAndDelete(jsonAssignmentId);
  if (multipartAssignmentId) await Assignment.findByIdAndDelete(multipartAssignmentId);
  console.log('\n✅ Cleaned up test records');

  process.exit(0);
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
