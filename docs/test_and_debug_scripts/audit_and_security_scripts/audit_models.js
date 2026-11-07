const fs = require('fs');
const path = require('path');

const modelsDir = path.join(__dirname, '../models');
const controllersDir = path.join(__dirname, '../controllers');
const routesDir = path.join(__dirname, '../routes');
const servicesDir = path.join(__dirname, '../services');
const scriptsDir = path.join(__dirname, '../scripts');

const modelFiles = fs.readdirSync(modelsDir).filter(f => f.endsWith('.js'));

// Read all code in controllers, routes, services, scripts
function readAllCode(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir);
  let contents = [];
  for (const f of files) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isFile() && f.endsWith('.js')) {
      contents.push({ name: f, code: fs.readFileSync(full, 'utf8') });
    }
  }
  return contents;
}

const allControllers = readAllCode(controllersDir);
const allRoutes = readAllCode(routesDir);
const allServices = readAllCode(servicesDir);
const allScripts = readAllCode(scriptsDir);

const allSources = [...allControllers, ...allRoutes, ...allServices, ...allScripts];

const auditResults = [];

for (const modelFile of modelFiles) {
  const modelName = modelFile.replace('.js', '');
  const modelContent = fs.readFileSync(path.join(modelsDir, modelFile), 'utf8');

  // Check references across project
  const referencingFiles = allSources.filter(s => {
    return s.code.includes(`models/${modelName}`) || 
           s.code.includes(`models/${modelFile}`) || 
           s.code.includes(`'${modelName}'`) ||
           s.code.includes(`"${modelName}"`);
  }).map(s => s.name);

  // Check schema timestamps & indexes
  const hasTimestamps = modelContent.includes('timestamps: true');
  const indexMatches = (modelContent.match(/\.index\(/g) || []).length;
  
  // Extract top-level schema fields
  const fieldMatches = [];
  const schemaRegex = /([a-zA-Z0-9_]+)\s*:\s*\{/g;
  let m;
  while ((m = schemaRegex.exec(modelContent)) !== null) {
    if (!['timestamps', 'toJSON', 'toObject', 'params', 'query', 'transformation'].includes(m[1])) {
      if (!fieldMatches.includes(m[1])) fieldMatches.push(m[1]);
    }
  }

  // Determine teacher relevance
  const teacherModels = [
    'User', 'School', 'Class', 'Subject', 'Student', 'Parent', 
    'Schedule', 'AttendanceSession', 'AttendanceRecord', 'Attendance', 
    'Assignment', 'TeacherLeave', 'TeacherAttendance', 'Notification', 
    'Message', 'Note', 'ImportantDate'
  ];

  const feeModels = [
    'FeeCategory', 'FeeCollection', 'FeeReceipt', 'FeeStructure', 
    'DormitoryFeeCollection', 'TransportFeeCollection', 'StudentPaymentPlan'
  ];

  let verdict = 'KEEP';
  let category = 'Teacher Core';
  let reasoning = '';

  if (teacherModels.includes(modelName)) {
    verdict = 'KEEP';
    category = 'Teacher Core';
    reasoning = 'Required for Teacher App workflows (attendance, schedule, classes, students, profile, leave, homework)';
  } else if (feeModels.includes(modelName)) {
    verdict = 'DELETE';
    category = 'Fee Module';
    reasoning = 'Fee management belongs exclusively to admin/accountant portal; teacher module has zero fee responsibilities';
  } else if (referencingFiles.length === 0) {
    verdict = 'DELETE';
    category = 'Dead Code';
    reasoning = 'Zero references in any controller, route, service, or script';
  } else {
    verdict = 'KEEP (Non-Teacher)';
    category = 'Other ERP Module';
    reasoning = `Used by ${referencingFiles.slice(0, 3).join(', ')} in school/student portal; leave untouched or isolate`;
  }

  auditResults.push({
    model: modelName,
    category,
    fieldCount: fieldMatches.length,
    fieldsSample: fieldMatches.slice(0, 6).join(', '),
    hasTimestamps,
    indexCount: indexMatches,
    usedBy: referencingFiles.slice(0, 4).join(', ') || 'NONE',
    verdict,
    reasoning
  });
}

console.log(JSON.stringify(auditResults, null, 2));

