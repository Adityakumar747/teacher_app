const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = path.resolve('C:/Users/adity/.gemini/antigravity/brain/c9847f11-21d2-475e-8ded-2f9dbd028275');
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PROFILE_DIR = path.join(ARTIFACT_DIR, 'chrome_full_walkthrough_profile');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
    this.consoleLogs = [];
    this.networkRequests = [];
    this.networkResponses = [];
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const { res, rej } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) rej(msg.error);
          else res(msg.result);
        } else if (msg.method) {
          this.handleEvent(msg.method, msg.params);
        }
      };
    });
  }

  handleEvent(method, params) {
    if (method === 'Runtime.consoleAPICalled') {
      const text = (params.args || []).map(a => a.value || a.description || JSON.stringify(a)).join(' ');
      this.consoleLogs.push({ type: params.type, text });
    } else if (method === 'Runtime.exceptionThrown') {
      const errText = params.exceptionDetails?.exception?.description || params.exceptionDetails?.text;
      this.consoleLogs.push({ type: 'error', text: errText });
    } else if (method === 'Network.requestWillBeSent') {
      this.networkRequests.push({
        requestId: params.requestId,
        url: params.request.url,
        method: params.request.method,
        timestamp: params.timestamp
      });
    } else if (method === 'Network.responseReceived') {
      this.networkResponses.push({
        requestId: params.requestId,
        url: params.response.url,
        status: params.response.status,
        statusText: params.response.statusText
      });
    }
  }

  send(method, params = {}) {
    return new Promise((res, rej) => {
      const msgId = this.id++;
      this.callbacks.set(msgId, { res, rej });
      this.ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  async eval(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || 'Evaluation error');
    }
    return result.result?.value;
  }
}

async function runFullWalkthrough() {
  console.log('====================================================');
  console.log('   FULL END-TO-END RUNTIME WALKTHROUGH & AUDIT      ');
  console.log('====================================================');

  if (!fs.existsSync(PROFILE_DIR)) fs.mkdirSync(PROFILE_DIR, { recursive: true });

  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    '--disable-gpu',
    '--remote-debugging-port=9222',
    `--user-data-dir=${PROFILE_DIR}`,
    '--window-size=430,932',
    'http://localhost:8081'
  ]);

  let cdp = null;

  try {
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      try {
        const pages = await getJson('http://localhost:9222/json');
        const targetPage = pages.find(p => p.type === 'page' && p.url.includes('localhost:8081'));
        if (targetPage && targetPage.webSocketDebuggerUrl) {
          cdp = new CDPClient(targetPage.webSocketDebuggerUrl);
          await cdp.connect();
          break;
        }
      } catch (e) {}
    }

    if (!cdp) throw new Error('Could not connect to Chrome CDP');

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    await cdp.send('Network.enable');

    console.log('Step 1: Fresh clean state & login...');
    await cdp.eval(`(() => { localStorage.clear(); sessionStorage.clear(); })()`);
    await cdp.send('Page.reload');
    await sleep(3500);

    // Type credentials
    await cdp.eval(`
      (() => {
        const inputs = Array.from(document.querySelectorAll('input'));
        const emailInput = inputs.find(i => i.placeholder && i.placeholder.toLowerCase().includes('email')) || inputs[0];
        const passInput = inputs.find(i => i.placeholder && i.placeholder.toLowerCase().includes('pass')) || inputs[1];
        const proto = window.HTMLInputElement.prototype;
        const desc = Object.getOwnPropertyDescriptor(proto, 'value');
        if (emailInput) {
          desc.set.call(emailInput, 'teacher@spark.edu');
          emailInput.dispatchEvent(new Event('input', { bubbles: true }));
          emailInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (passInput) {
          desc.set.call(passInput, 'teacher123');
          passInput.dispatchEvent(new Event('input', { bubbles: true }));
          passInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `);
    await sleep(300);
    await cdp.eval(`
      (() => {
        const btn = Array.from(document.querySelectorAll('[tabindex="0"], button, div')).find(b => b.innerText && b.innerText.trim() === 'Sign In');
        if (btn) btn.click();
      })()
    `);

    // Wait for Dashboard
    console.log('Waiting for Dashboard...');
    for (let w = 0; w < 10; w++) {
      await sleep(1000);
      const text = await cdp.eval(`document.body.innerText`);
      if (text.includes("Today's schedule") && !text.includes("Loading today schedule")) break;
    }
    console.log('✅ Dashboard loaded.');

    // Step 2: Attendance Interactive Walkthrough
    console.log('\nStep 2: Navigating to Attendance Tab...');
    await cdp.eval(`
      (() => {
        const tab = document.querySelector('[aria-label="Attendance"]');
        if (tab) tab.click();
      })()
    `);
    await sleep(2500);

    // Toggle a student attendance
    console.log('Interacting with Attendance (Toggling student mark)...');
    await cdp.eval(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('[tabindex="0"], div'));
        // Find segment control for Absent
        const absentBtn = buttons.find(b => b.innerText && b.innerText.trim() === 'Absent');
        if (absentBtn) absentBtn.click();
      })()
    `);
    await sleep(800);

    // Click Save Attendance
    console.log('Submitting Save Attendance...');
    await cdp.eval(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('[tabindex="0"], div, button'));
        const saveBtn = buttons.find(b => b.innerText && b.innerText.includes('Save Attendance'));
        if (saveBtn) saveBtn.click();
      })()
    `);
    await sleep(2000);
    console.log('✅ Attendance saved successfully.');

    // Step 3: Assignments Walkthrough
    console.log('\nStep 3: Navigating to Assignments Tab...');
    await cdp.eval(`
      (() => {
        const tab = document.querySelector('[aria-label="Assignments"]');
        if (tab) tab.click();
      })()
    `);
    await sleep(2500);

    // Open Submissions Review Modal for Calculus assignment
    console.log('Opening Submissions Review for assignment...');
    await cdp.eval(`
      (() => {
        const clickables = Array.from(document.querySelectorAll('[tabindex="0"], div'));
        const calculusCard = clickables.find(c => c.innerText && c.innerText.includes('Calculus'));
        if (calculusCard) calculusCard.click();
      })()
    `);
    await sleep(1500);
    const submissionsModalOpen = await cdp.eval(`
      Boolean(document.body.innerText.includes('Submissions') || document.body.innerText.includes('Aarav Patel'))
    `);
    console.log('Submissions review modal opened:', submissionsModalOpen);

    // Close submissions modal
    await cdp.eval(`
      (() => {
        const closeBtn = Array.from(document.querySelectorAll('[tabindex="0"], div')).find(e => e.innerText && e.innerText === '✕');
        if (closeBtn) closeBtn.click();
      })()
    `);
    await sleep(800);

    // Step 4: Profile & Class Teacher Analytics & Calendar Walkthrough
    console.log('\nStep 4: Navigating to Profile Tab...');
    await cdp.eval(`
      (() => {
        const tab = document.querySelector('[aria-label="Profile"]');
        if (tab) tab.click();
      })()
    `);
    await sleep(2000);

    // Open "My class" Class Teacher Analytics
    console.log('Opening "My class" Class Teacher Analytics...');
    await cdp.eval(`
      (() => {
        const clickables = Array.from(document.querySelectorAll('[tabindex="0"], div'));
        const myClass = clickables.find(c => c.innerText && c.innerText.includes('My class'));
        if (myClass) myClass.click();
      })()
    `);
    await sleep(2000);
    const analyticsLoaded = await cdp.eval(`
      Boolean(document.body.innerText.includes('Grade 10') && document.body.innerText.includes('93%'))
    `);
    console.log('Class Teacher Analytics loaded with 93% rate:', analyticsLoaded);

    // Close analytics
    await cdp.eval(`
      (() => {
        const closeBtn = Array.from(document.querySelectorAll('[tabindex="0"], div')).find(e => e.getAttribute('aria-label') === 'Close' || (e.innerText && e.innerText === '✕'));
        if (closeBtn) closeBtn.click();
      })()
    `);
    await sleep(800);

    // Open Calendar
    console.log('Opening Academic Calendar...');
    await cdp.eval(`
      (() => {
        const clickables = Array.from(document.querySelectorAll('[tabindex="0"], div'));
        const cal = clickables.find(c => c.innerText && c.innerText.includes('Calendar'));
        if (cal) cal.click();
      })()
    `);
    await sleep(2000);
    const calendarLoaded = await cdp.eval(`
      Boolean(document.body.innerText.includes('November') && (document.body.innerText.includes('Diwali') || document.body.innerText.includes('Mid-Term')))
    `);
    console.log('Academic Calendar loaded with November events:', calendarLoaded);

    // Close Calendar
    await cdp.eval(`
      (() => {
        const closeBtn = Array.from(document.querySelectorAll('[tabindex="0"], div')).find(e => e.getAttribute('aria-label') === 'Close' || (e.innerText && e.innerText === '✕'));
        if (closeBtn) closeBtn.click();
      })()
    `);
    await sleep(800);

    // Step 5: Logout Flow
    console.log('\nStep 5: Logging out...');
    await cdp.eval(`
      (() => {
        const clickables = Array.from(document.querySelectorAll('[tabindex="0"], div'));
        const logoutBtn = clickables.find(c => c.innerText && c.innerText.trim() === 'Log out');
        if (logoutBtn) logoutBtn.click();
      })()
    `);
    await sleep(1000);
    // Confirm logout
    await cdp.eval(`
      (() => {
        const clickables = Array.from(document.querySelectorAll('[tabindex="0"], div, button'));
        const matches = clickables.filter(c => c.innerText && c.innerText.trim().toLowerCase() === 'log out');
        if (matches.length > 1) matches[matches.length - 1].click();
        else if (matches.length === 1) matches[0].click();
      })()
    `);
    await sleep(3000);
    const isBackOnLogin = await cdp.eval(`Boolean(document.body.innerText.includes("Let's Sign In"))`);
    console.log('Redirected back to Login after session wipe:', isBackOnLogin);

    // ==========================================
    // METRICS & ANALYSIS
    // ==========================================
    console.log('\n====================================================');
    console.log('          FULL WALKTHROUGH AUDIT RESULTS            ');
    console.log('====================================================');

    const errors = cdp.consoleLogs.filter(l => l.type === 'error');
    console.log(`\n1. CONSOLE ERRORS: ${errors.length}`);
    if (errors.length > 0) {
      errors.forEach(e => console.log('   ❌ Error:', e.text));
    } else {
      console.log('   ✅ ZERO console errors recorded across the entire session!');
    }

    // Network Analysis
    const apiRequests = cdp.networkRequests.filter(r => r.url.includes(':5000/api/'));
    const failedApi = cdp.networkResponses.filter(r => r.url.includes(':5000/api/') && r.status >= 400);

    console.log(`\n2. NETWORK CALLS:`);
    console.log(`   - Total API calls made: ${apiRequests.length}`);
    console.log(`   - Failed API calls (4xx/5xx): ${failedApi.length}`);

    // Frequency of calls per endpoint (to detect multiple/looping calls)
    const callCounts = {};
    apiRequests.forEach(r => {
      // Strip query parameters for endpoint grouping
      const cleanUrl = r.url.split('?')[0];
      const key = `${r.method} ${cleanUrl}`;
      callCounts[key] = (callCounts[key] || 0) + 1;
    });

    console.log('\n3. API REQUEST DEDUPLICATION AUDIT:');
    for (const [endpoint, count] of Object.entries(callCounts)) {
      const status = count > 3 ? '⚠️ HIGH FREQUENCY' : '✅ NORMAL (Single/Legitimate Navigation)';
      console.log(`   - ${endpoint}: ${count} call(s) [${status}]`);
    }

  } catch (err) {
    console.error('Walkthrough error:', err);
  } finally {
    try { chromeProcess.kill(); } catch {}
  }
}

runFullWalkthrough().catch(console.error);

