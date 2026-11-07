const fs = require('fs');
const path = require('path');

const apiFile = path.join(__dirname, '../../spark_teacher/spark_teacher/services/api.js');
const apiCode = fs.readFileSync(apiFile, 'utf8');

const lines = apiCode.split('\n');
const methods = [];
let currentMethod = '';

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const m = line.match(/async\s+([a-zA-Z0-9_]+)\s*\(/);
  if (m) {
    currentMethod = m[1];
  }
  const reqMatch = line.match(/this\.request\(\s*[`'"]([^`'"]+)[`'"]/);
  if (reqMatch) {
    let rawPath = reqMatch[1];
    // Check next few lines for method
    let httpMethod = 'GET';
    for (let j = i; j < Math.min(i + 8, lines.length); j++) {
      const verbMatch = lines[j].match(/method:\s*['"](POST|PUT|PATCH|DELETE|GET)['"]/);
      if (verbMatch) {
        httpMethod = verbMatch[1];
        break;
      }
    }
    methods.push({ apiMethod: currentMethod, path: rawPath, httpMethod });
  }
}

console.log(JSON.stringify(methods, null, 2));

