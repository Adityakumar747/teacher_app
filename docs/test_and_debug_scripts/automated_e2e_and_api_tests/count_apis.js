const fs = require('fs');
const path = require('path');

const routeFiles = [
  { module: 'Authentication', file: 'routes/auth.js', prefix: '/api/auth' },
  { module: 'Teacher & Schedule', file: 'routes/teachers.js', prefix: '/api/teachers' },
  { module: 'Attendance Management', file: 'routes/attendance.js', prefix: '/api/attendance' },
  { module: 'Assignments & Homework', file: 'routes/assignments.js', prefix: '/api/assignments' },
  { module: 'Academic Calendar', file: 'routes/importantDates.js', prefix: '/api/calendar' },
  { module: 'Teacher Leaves', file: 'routes/leaves.js', prefix: '/api/leaves' },
  { module: 'Classes & Sections', file: 'routes/classes.js', prefix: '/api/classes' },
  { module: 'Students Directory', file: 'routes/students.js', prefix: '/api/students' },
  { module: 'Subjects & Curriculum', file: 'routes/subjects.js', prefix: '/api/subjects' },
  { module: 'Syllabus Tracker', file: 'routes/syllabus.js', prefix: '/api/syllabus' },
  { module: 'Messages & Notifications', file: 'routes/messages.js', prefix: '/api/messages' }
];

const inventory = [];

routeFiles.forEach(r => {
  const fullPath = path.join(__dirname, '..', r.file);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    // Match router.get('/path', ...) or router.post('/path', ...)
    const regex = /router\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const method = match[1].toUpperCase();
      const subPath = match[2];
      const fullUrl = r.prefix + (subPath === '/' ? '' : subPath);
      inventory.push({
        module: r.module,
        method,
        path: fullUrl
      });
    }
  }
});

console.log('==============================================');
console.log(`TOTAL TEACHER MODULE BACKEND APIS: ${inventory.length}`);
console.log('==============================================');

// Group by module
const byModule = {};
inventory.forEach(api => {
  if (!byModule[api.module]) byModule[api.module] = [];
  byModule[api.module].push(`${api.method} ${api.path}`);
});

for (const [mod, apis] of Object.entries(byModule)) {
  console.log(`\n### ${mod} (${apis.length} endpoints):`);
  apis.forEach(a => console.log(`  - ${a}`));
}

