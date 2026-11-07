const http = require('http');

async function makeRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({
        statusCode: res.statusCode,
        headers: res.headers,
        body: data
      }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function run() {
  console.log('=== VERIFYING SECURITY FIXES ===\n');

  // Test 1: CORS Whitelist Security
  console.log('--- Test 1: CORS Whitelist ---');
  // 1a: Evil origin preflight
  const evilPreflight = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/health',
    method: 'OPTIONS',
    headers: {
      'Origin': 'http://evil-attacker.com',
      'Access-Control-Request-Method': 'POST'
    }
  });
  console.log('1a. Evil origin OPTIONS status:', evilPreflight.statusCode, '(Expected: 403)');
  const evilCorsHeader = evilPreflight.headers['access-control-allow-origin'];
  console.log('1a. Evil origin Allow-Origin header:', evilCorsHeader || 'NONE (PASSED)');

  // 1b: Whitelisted origin (localhost:8081)
  const goodPreflight = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/health',
    method: 'OPTIONS',
    headers: {
      'Origin': 'http://localhost:8081',
      'Access-Control-Request-Method': 'GET'
    }
  });
  console.log('1b. Good origin OPTIONS status:', goodPreflight.statusCode, '(Expected: 200)');
  console.log('1b. Good origin Allow-Origin header:', goodPreflight.headers['access-control-allow-origin'], '(Expected: http://localhost:8081)');
  console.log('1b. Good origin Allow-Credentials header:', goodPreflight.headers['access-control-allow-credentials'], '(Expected: true)');

  // Test 2: NoSQL Query Sanitization
  console.log('\n--- Test 2: NoSQL Parameter Sanitization ---');
  const noSqlReq = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/classes?classId[$ne]=null',
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  });
  console.log('2. NoSQL injection query status:', noSqlReq.statusCode, '(Expected: 401 or handled, NOT 500)');
  console.log('2. NoSQL query response snippet:', noSqlReq.body.slice(0, 100));

  // Test 3: Large JSON Body Limit (10MB limit enforcement)
  console.log('\n--- Test 3: JSON Body Limit (10MB) ---');
  const largeBody = JSON.stringify({ data: 'A'.repeat(11 * 1024 * 1024) }); // 11MB
  const largeReq = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(largeBody)
    }
  }, largeBody);
  console.log('3. 11MB payload status:', largeReq.statusCode, '(Expected: 413 Payload Too Large)');

  // Test 4: Rate Limiting on Login
  console.log('\n--- Test 4: Rate Limiting on /api/auth/login ---');
  let hit429 = false;
  let attempts = 0;
  for (let i = 1; i <= 35; i++) {
    const loginRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, JSON.stringify({ email: 'test@spark.edu', password: 'wrong' }));
    
    attempts = i;
    if (loginRes.statusCode === 429) {
      hit429 = true;
      console.log(`4. Rate limiter triggered at attempt #${i}! Status: 429 Too Many Requests`);
      console.log('4. Rate limiter response:', loginRes.body);
      break;
    }
  }
  if (!hit429) {
    console.log(`4. Rate limiter did not trigger after ${attempts} attempts`);
  }

  console.log('\n=== ALL SECURITY TESTS COMPLETED ===');
}

run().catch(console.error);

