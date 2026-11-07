const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = path.resolve('C:/Users/adity/.gemini/antigravity/brain/c9847f11-21d2-475e-8ded-2f9dbd028275');
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PROFILE_DIR = path.join(ARTIFACT_DIR, 'chrome_login_error_profile');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
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
        }
      };
    });
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

  async captureScreenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const fullPath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(fullPath, buffer);
    console.log(`📸 Screenshot saved: ${filename}`);
    return fullPath;
  }
}

async function testLoginErrors() {
  console.log('====================================================');
  console.log('   VERIFYING LOGIN VALIDATION & ERROR MESSAGES      ');
  console.log('====================================================');

  if (!fs.existsSync(PROFILE_DIR)) {
    fs.mkdirSync(PROFILE_DIR, { recursive: true });
  }

  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    '--disable-gpu',
    '--remote-debugging-port=9223',
    `--user-data-dir=${PROFILE_DIR}`,
    '--window-size=430,932',
    'http://localhost:8081'
  ]);

  let cdp = null;

  try {
    let connected = false;
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      try {
        const pages = await getJson('http://localhost:9223/json');
        const targetPage = pages.find(p => p.type === 'page' && p.url.includes('localhost:8081'));
        if (targetPage && targetPage.webSocketDebuggerUrl) {
          cdp = new CDPClient(targetPage.webSocketDebuggerUrl);
          await cdp.connect();
          connected = true;
          break;
        }
      } catch (e) {}
    }

    if (!connected) throw new Error('Could not connect to Chrome CDP on port 9223');
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    console.log('Waiting for Login screen to load...');
    await sleep(3500);

    // 1. Clear session if any
    await cdp.eval(`
      (() => {
        localStorage.clear();
        sessionStorage.clear();
      })()
    `);
    await cdp.send('Page.reload');
    await sleep(2500);

    // TEST 1: EMPTY EMAIL & PASSWORD SUBMISSION
    console.log('\n--- TEST 1: Empty Fields Submission ---');
    await cdp.eval(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('[tabindex="0"], button, div'));
        const signInBtn = buttons.find(b => b.innerText && b.innerText.trim() === 'Sign In');
        if (signInBtn) signInBtn.click();
      })()
    `);
    await sleep(1000);

    const emptyEmailText = await cdp.eval(`
      document.body.innerText
    `);
    const hasEmptyEmailErr = emptyEmailText.includes('Please enter your email address');
    console.log(`[${hasEmptyEmailErr ? '✅ PASS' : '❌ FAIL'}] Empty email validation: "${hasEmptyEmailErr ? 'Please enter your email address' : 'Not shown'}"`);
    await cdp.captureScreenshot('ui_08_error_empty_email.png');

    // TEST 2: INCORRECT PASSWORD SUBMISSION
    console.log('\n--- TEST 2: Incorrect Password Submission ---');
    await cdp.eval(`
      (() => {
        const inputs = Array.from(document.querySelectorAll('input'));
        const emailInput = inputs.find(i => i.placeholder && i.placeholder.toLowerCase().includes('email')) || inputs[0];
        const passInput = inputs.find(i => i.placeholder && i.placeholder.toLowerCase().includes('pass')) || inputs[1];

        if (emailInput) {
          emailInput.focus();
          const proto = window.HTMLInputElement.prototype;
          const desc = Object.getOwnPropertyDescriptor(proto, 'value');
          desc.set.call(emailInput, 'teacher@spark.edu');
          emailInput.dispatchEvent(new Event('input', { bubbles: true }));
          emailInput.dispatchEvent(new Event('change', { bubbles: true }));
        }

        if (passInput) {
          passInput.focus();
          const proto = window.HTMLInputElement.prototype;
          const desc = Object.getOwnPropertyDescriptor(proto, 'value');
          desc.set.call(passInput, 'completely_wrong_pass_123');
          passInput.dispatchEvent(new Event('input', { bubbles: true }));
          passInput.dispatchEvent(new Event('change', { bubbles: true }));
        }

        const buttons = Array.from(document.querySelectorAll('[tabindex="0"], button, div'));
        const signInBtn = buttons.find(b => b.innerText && b.innerText.trim() === 'Sign In');
        if (signInBtn) signInBtn.click();
      })()
    `);

    console.log('Submitted wrong password. Waiting for error response...');
    let incorrectPassErrFound = false;
    let errorTextSeen = '';
    for (let w = 0; w < 10; w++) {
      await sleep(1000);
      const text = await cdp.eval(`document.body.innerText`);
      if (
        text.includes('Incorrect email or password') ||
        text.includes('Invalid') ||
        text.includes('check your credentials')
      ) {
        incorrectPassErrFound = true;
        errorTextSeen = text.slice(text.indexOf('Incorrect email or password'), text.indexOf('Incorrect email or password') + 45);
        break;
      }
    }

    console.log(`[${incorrectPassErrFound ? '✅ PASS' : '❌ FAIL'}] Incorrect password error banner: "${errorTextSeen || 'Not shown'}"`);
    await cdp.captureScreenshot('ui_09_error_incorrect_password.png');

    // TEST 3: VALID LOGIN AFTER ERROR
    console.log('\n--- TEST 3: Recovery with Valid Credentials ---');
    await cdp.eval(`
      (() => {
        const inputs = Array.from(document.querySelectorAll('input'));
        const passInput = inputs.find(i => i.placeholder && i.placeholder.toLowerCase().includes('pass')) || inputs[1];

        if (passInput) {
          passInput.focus();
          const proto = window.HTMLInputElement.prototype;
          const desc = Object.getOwnPropertyDescriptor(proto, 'value');
          desc.set.call(passInput, 'teacher123');
          passInput.dispatchEvent(new Event('input', { bubbles: true }));
          passInput.dispatchEvent(new Event('change', { bubbles: true }));
        }

        const buttons = Array.from(document.querySelectorAll('[tabindex="0"], button, div'));
        const signInBtn = buttons.find(b => b.innerText && b.innerText.trim() === 'Sign In');
        if (signInBtn) signInBtn.click();
      })()
    `);

    let validLoginSuccess = false;
    for (let w = 0; w < 10; w++) {
      await sleep(1000);
      const text = await cdp.eval(`document.body.innerText`);
      if (text.includes("Sonia Singh") || text.includes("Today's schedule")) {
        validLoginSuccess = true;
        break;
      }
    }
    console.log(`[${validLoginSuccess ? '✅ PASS' : '❌ FAIL'}] Valid login after error: Navigated to Dashboard`);
    await cdp.captureScreenshot('ui_10_dashboard_after_login.png');

  } catch (err) {
    console.error('Test error:', err);
  } finally {
    try {
      chromeProcess.kill();
    } catch {}
  }
}

testLoginErrors().catch(console.error);

