/**
 * Single source of truth for IST Date & Time handling
 * Timezone: Asia/Kolkata (IST = UTC+5:30)
 * Requirements:
 * - Attendance dates stored as YYYY-MM-DD strings in IST
 * - Timestamps stored in UTC
 * - Class status computed strictly on the backend using IST server time
 */

const TIMEZONE = 'Asia/Kolkata';

/**
 * Get current date string formatted as YYYY-MM-DD in IST
 * @param {Date} [dateObj=new Date()]
 * @returns {string} YYYY-MM-DD
 */
function getISTDateString(dateObj = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(dateObj);
}

/**
 * Get current day of week in IST (e.g. 'Monday', 'Tuesday')
 * @param {Date} [dateObj=new Date()]
 * @returns {string}
 */
function getISTDayOfWeek(dateObj = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    weekday: 'long'
  });
  return formatter.format(dateObj);
}

/**
 * Get current time in IST formatted as HH:MM (24-hour)
 * @param {Date} [dateObj=new Date()]
 * @returns {string} HH:MM
 */
function getISTTimeString(dateObj = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  return formatter.format(dateObj);
}

/**
 * Format a date nicely for human display in IST (e.g. 'Monday, 2 November 2026')
 * @param {Date} [dateObj=new Date()]
 * @returns {string}
 */
function getISTFormattedDate(dateObj = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  return formatter.format(dateObj);
}

/**
 * Compute the live status dot for a timetable slot
 * Business Rules:
 * - Grey = Upcoming (start time in future)
 * - Amber/Blue = Ongoing (current time between start and end)
 * - Green = Completed (attendance session exists for this slot + date)
 * - Red = Missed (end time passed, no attendance session)
 * 
 * @param {Object} slot - { startTime: 'HH:MM', endTime: 'HH:MM' }
 * @param {boolean} isTaken - True if an AttendanceSession exists for this slot + date
 * @param {string} [currentTimeStr] - 'HH:MM' in IST
 * @param {string} [targetDateStr] - 'YYYY-MM-DD'
 * @param {string} [todayIST] - 'YYYY-MM-DD'
 * @returns {'completed' | 'ongoing' | 'upcoming' | 'missed'}
 */
function computeSlotStatus(slot, isTaken, currentTimeStr = getISTTimeString(), targetDateStr = null, todayIST = null) {
  // If an attendance session already exists, it is strictly completed
  if (isTaken) {
    return 'completed';
  }

  // Handle past or future dates relative to today in IST
  if (targetDateStr && todayIST) {
    if (targetDateStr < todayIST) {
      return 'missed';
    }
    if (targetDateStr > todayIST) {
      return 'upcoming';
    }
  }

  const { startTime, endTime } = slot;

  // Upcoming: Current time is before class starts
  if (currentTimeStr < startTime) {
    return 'upcoming';
  }

  // Ongoing: Current time is between start and end time (strict < endTime prevents back-to-back collision)
  if (currentTimeStr >= startTime && currentTimeStr < endTime) {
    return 'ongoing';
  }

  // Missed: End time has passed and no attendance was submitted
  return 'missed';
}

/**
 * Calculate difference in calendar days between two YYYY-MM-DD dates (date2 - date1)
 * @param {string} dateStr1 - Earlier date 'YYYY-MM-DD'
 * @param {string} dateStr2 - Later date 'YYYY-MM-DD'
 * @returns {number} difference in days or NaN if invalid
 */
function getDaysDifference(dateStr1, dateStr2) {
  const s1 = dateStr1 ? String(dateStr1).trim() : '';
  const s2 = dateStr2 ? String(dateStr2).trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s1) || !/^\d{4}-\d{2}-\d{2}$/.test(s2)) {
    return NaN;
  }
  const d1 = new Date(`${s1}T00:00:00Z`);
  const d2 = new Date(`${s2}T00:00:00Z`);
  const diff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
  return isNaN(diff) ? NaN : diff;
}

/**
 * Get an IST date string offset by N days from a base date
 * @param {number} daysOffset - Positive for future, negative for past
 * @param {Date} [baseDate=new Date()]
 * @returns {string} YYYY-MM-DD
 */
function getISTDateOffset(daysOffset, baseDate = new Date()) {
  const target = new Date(baseDate.getTime() + daysOffset * 24 * 60 * 60 * 1000);
  return getISTDateString(target);
}

module.exports = {
  TIMEZONE,
  getISTDateString,
  getISTDayOfWeek,
  getISTTimeString,
  getISTFormattedDate,
  computeSlotStatus,
  getDaysDifference,
  getISTDateOffset
};

