# Physical Device Quality Assurance Checklist

Perform this manual verification checklist on a real Android and iOS handset prior to production app store deployment.

---

### 1. Camera & Media Permissions
- [ ] **First Launch Prompt:** Verify system permission dialog appears on first attempt to attach a photo or take a document picture.
- [ ] **Camera Capture:** Take photo directly from camera for assignment attachment. Verify image attaches cleanly without crashing.
- [ ] **Photo Library Access:** Pick existing JPEG/PNG file from gallery. Verify preview displays properly.
- [ ] **Permission Denied Fallback:** Deny camera permission in system settings. Verify the app shows a user-friendly alert with settings shortcut rather than crashing.

---

### 2. Navigation & Native Back Button Handling
- [ ] **Hardware Back Button (Android):**
  - Press hardware back on `AttendanceScreen` -> smoothly navigates back to `ScheduleHub` or `Dashboard`.
  - Press hardware back on root `Dashboard` -> exits app or displays double-back exit confirmation.
- [ ] **Modal Dismissal:** Swipe down or tap backdrop on homework creation modal -> properly closes without leaving orphaned form state.
- [ ] **Tab Bar Persistence:** Verify bottom navigation tabs remain responsive across all nested transitions.

---

### 3. Keyboard & Screen Responsiveness
- [ ] **KeyboardAvoidingView:** Open Leave Application or Homework Creation form. Tap description input field at bottom of screen.
  - Verify keyboard does not obscure the submit button or input field.
  - Verify tapping outside dismisses keyboard.
- [ ] **Small Screen Layout (360 x 640 dp):**
  - Verify no text truncation on attendance status chips (Present, Absent, Late).
  - Verify period timeline badges do not overlap class names.
- [ ] **Accessibility / Font Scaling (130% - 200%):**
  - Enable large fonts in device settings (Display -> Font Size: Largest).
  - Verify text wraps cleanly and buttons remain pressable without layout clipping.

---

### 4. Network Resiliency & Offline States
- [ ] **Offline Handling:** Enable Airplane Mode while taking attendance.
  - Verify clear offline toast notification appears.
  - Verify app displays retry button rather than infinite spinner.
- [ ] **Reconnection:** Disable Airplane Mode. Tap retry; verify pending operations sync successfully.

---

### 5. Authentication & Session Persistence
- [ ] **Token Expiration / Logout:**
  - Tap Logout in Profile Screen. Verify token is cleared and navigation redirects to Login Screen.
  - Restart app after logout -> verify app stays on Login Screen.
- [ ] **Persistent Session:**
  - Login with valid credentials. Force-close the app from recent apps.
  - Re-open app -> verify automatic restoration of teacher session without requiring re-login.

---

### 6. External Device Handlers
- [ ] **Dialer / SMS Links:** Tap phone icon on student profile (if available) -> opens system dialer with number pre-filled.

