import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TouchableWithoutFeedback,
  Alert,
  BackHandler,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ApiService from '../services/api';
import { colors, typography, spacing, radius, shadows } from '../theme/colors';
import Avatar from '../components/Avatar';
import SegmentedControl from '../components/SegmentedControl';
import ConfirmDialog from '../components/ConfirmDialog';
import SuccessToast from '../components/SuccessToast';

/**
 * Attendance Screen (Classes Hub -> Class Attendance Roster)
 * Architecture:
 * - Screen 1 (Default): Today's Classes List Hub with real-time status badges (Marked, Ongoing, Missed, Upcoming)
 * - Screen 2: Tap any class card to open its student roster, mark Present/Absent, and Save
 * - Deep link support: If navigated from Dashboard with slotId, directly opens Screen 2 with Back button to Hub
 * - Zero hardcoded values
 */
export default function AttendanceScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();

  // Helper to get true IST date string (YYYY-MM-DD)
  const getISTToday = () => {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  };

  const todayISTStr = useMemo(() => getISTToday(), []);

  // Selected Slot & Date State (strictly IST-aligned)
  // If route params provided from Dashboard hero/timeline, start on Screen 2 for that slot
  const [selectedSlotId, setSelectedSlotId] = useState(route?.params?.slotId || null);
  const [selectedDate, setSelectedDate] = useState(route?.params?.selectedDate || todayISTStr);

  // Available slots for the teacher on selected date
  const [teacherSlots, setTeacherSlots] = useState([]);
  const [isSlotsLoading, setIsSlotsLoading] = useState(true);

  // Slot attendance details (Screen 2)
  const [slotData, setSlotData] = useState(null);
  const [students, setStudents] = useState([]);
  const [marks, setMarks] = useState({});
  const [initialMarks, setInitialMarks] = useState({});

  // Loading & Submitting lock
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockReason, setLockReason] = useState(null);

  // Modals
  const [showMarkAllDialog, setShowMarkAllDialog] = useState(false);
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  // Calendar month view date state inside date picker modal
  const [calendarViewDate, setCalendarViewDate] = useState(() => {
    try {
      const [y, m] = (route?.params?.selectedDate || todayISTStr).split('-').map(Number);
      return new Date(y, m - 1, 1);
    } catch {
      return new Date();
    }
  });

  const handleOpenDatePicker = () => {
    try {
      const [y, m] = selectedDate.split('-').map(Number);
      setCalendarViewDate(new Date(y, m - 1, 1));
    } catch {
      setCalendarViewDate(new Date());
    }
    setShowDatePickerModal(true);
  };

  const handlePrevMonth = () => {
    setCalendarViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const calendarMonthData = useMemo(() => {
    const year = calendarViewDate.getFullYear();
    const month = calendarViewDate.getMonth();
    const monthName = calendarViewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const cells = [];
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push({ key: `blank-${i}`, isBlank: true });
    }
    for (let d = 1; d <= totalDays; d++) {
      const mm = String(month + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      const dateStr = `${year}-${mm}-${dd}`;
      const isToday = dateStr === todayISTStr;
      const isSelected = dateStr === selectedDate;
      const isFuture = dateStr > todayISTStr;
      cells.push({
        key: dateStr,
        dayNum: d,
        dateStr,
        isToday,
        isSelected,
        isFuture,
      });
    }
    return { monthName, cells, year, month };
  }, [calendarViewDate, todayISTStr, selectedDate]);

  // Success Feedback Animation State
  const [toastInfo, setToastInfo] = useState({
    visible: false,
    title: '',
    subtitle: '',
    variant: 'success',
  });
  const [saveSuccessFeedback, setSaveSuccessFeedback] = useState(false);

  // Listen to bottom tab press: Always return to Classes Hub when Attendance tab icon is tapped
  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress', () => {
      setSelectedSlotId(null);
    });
    return unsubscribe;
  }, [navigation]);

  // Listen to incoming route param changes (e.g. user taps another slot from Home tab)
  useEffect(() => {
    if (route?.params?.slotId) {
      setSelectedSlotId(route.params.slotId);
      if (route.params.selectedDate) {
        setSelectedDate(route.params.selectedDate);
      }
      navigation.setParams({ slotId: undefined });
    }
  }, [route?.params?.slotId, route?.params?.selectedDate, navigation]);

  // Compute 7 days past window dates relative to IST
  const availablePastDates = useMemo(() => {
    const list = [];
    const baseISTStr = getISTToday();
    const [y, m, d] = baseISTStr.split('-').map(Number);
    for (let i = 0; i <= 7; i++) {
      const dt = new Date(y, m - 1, d - i);
      const yyyy = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const dd = String(dt.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const label =
        i === 0
          ? 'Today'
          : i === 1
          ? 'Yesterday'
          : dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
      list.push({ dateStr, label });
    }
    return list;
  }, []);

  // 1. Fetch teacher's slots for selected date (Hub view)
  const fetchTeacherSlots = useCallback(async () => {
    try {
      setIsSlotsLoading(true);
      const res = await ApiService.getClassesToday('me', selectedDate);
      if (res && res.success && Array.isArray(res.data?.classes)) {
        setTeacherSlots(res.data.classes);
      }
    } catch (err) {
      console.warn('Error fetching slots:', err.message);
    } finally {
      setIsSlotsLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchTeacherSlots();
  }, [fetchTeacherSlots]);

  // 2. Load Slot Attendance & Students from Backend (Screen 2)
  const loadSlotAttendance = useCallback(async () => {
    if (!selectedSlotId) return;
    try {
      setIsLoading(true);
      setError(null);

      const res = await ApiService.getSlotAttendance(selectedSlotId, selectedDate);
      if (res && res.success && res.data) {
        const d = res.data;
        setSlotData(d.slot);
        setIsSubmitted(d.isSubmitted);
        setIsLocked(d.isLocked || false);
        setLockReason(d.lockReason || null);

        const studentList = d.students || [];
        setStudents(studentList);

        const marksMap = {};
        studentList.forEach((s) => {
          marksMap[s.id] = s.status || 'P'; // Default all Present on initial mark
        });

        setMarks(marksMap);
        setInitialMarks({ ...marksMap });
      } else {
        setError(res?.error || 'Failed to load attendance slot data');
      }
    } catch (err) {
      console.error('loadSlotAttendance error:', err);
      setError(err.message || 'Cannot load attendance. Please check connection.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedSlotId, selectedDate]);

  useEffect(() => {
    if (selectedSlotId) {
      loadSlotAttendance();
    }
  }, [selectedSlotId, loadSlotAttendance]);

  // Check for unsaved modifications in Screen 2
  const hasUnsavedChanges = useMemo(() => {
    const keys = Object.keys(marks);
    if (keys.length === 0) return false;
    for (const id of keys) {
      if (marks[id] !== initialMarks[id]) return true;
    }
    return false;
  }, [marks, initialMarks]);

  // Back Navigation handler
  const handleBackToClasses = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowUnsavedDialog(true);
    } else {
      setSelectedSlotId(null);
      fetchTeacherSlots();
    }
  }, [hasUnsavedChanges, fetchTeacherSlots]);

  // Handle hardware / gesture back
  useEffect(() => {
    const onBackPress = () => {
      if (selectedSlotId) {
        handleBackToClasses();
        return true;
      }
      return false;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [selectedSlotId, handleBackToClasses]);

  // Toggle student status (Present <-> Absent)
  const handleStudentStatusChange = (studentId, nextStatus) => {
    if (isLocked) {
      Alert.alert('Session Locked', lockReason || 'This past session is locked for modifications.');
      return;
    }
    setMarks((prev) => ({
      ...prev,
      [studentId]: nextStatus,
    }));
  };

  // Mark all present
  const applyMarkAllPresent = () => {
    setShowMarkAllDialog(false);
    if (isLocked) return;
    const updated = {};
    students.forEach((s) => {
      updated[s.id] = 'P';
    });
    setMarks(updated);
  };

  // Live Summary Calculations (Screen 2)
  const presentCount = useMemo(() => {
    return Object.values(marks).filter((s) => s === 'P' || s === 'present').length;
  }, [marks]);

  const absentCount = useMemo(() => {
    return Object.values(marks).filter((s) => s === 'A' || s === 'absent').length;
  }, [marks]);

  // Hub Summary Calculations (Screen 1)
  const totalClassesCount = teacherSlots.length;
  const completedClassesCount = teacherSlots.filter((s) => s.isCompleted).length;
  const pendingClassesCount = Math.max(0, totalClassesCount - completedClassesCount);

  // Submit Bulk Attendance
  const handleSaveAttendance = async () => {
    if (isSubmitting || isLocked || !selectedSlotId) return;

    if (students.length === 0) {
      Alert.alert('No Students', 'There are no active students in this class to record.');
      return;
    }

    try {
      setIsSubmitting(true);

      const records = students.map((s) => ({
        studentId: s.id,
        status: marks[s.id] || 'P',
        remark: '',
      }));

      const payload = {
        slotId: selectedSlotId,
        date: selectedDate,
        records,
      };

      const res = await ApiService.markBulkAttendance(payload);

      if (res && res.success) {
        setInitialMarks({ ...marks });
        setIsSubmitted(true);
        fetchTeacherSlots();
        setSelectedSlotId(null); // Option 1: Instant 0s return to All Classes Hub!
        setSaveSuccessFeedback(false);

        setToastInfo({
          visible: true,
          title: 'Attendance Saved!',
          subtitle: `${presentCount} Present · ${absentCount} Absent recorded for ${headerClassText}`,
          variant: 'success',
        });
      } else {
        Alert.alert('Save Failed', res?.error || 'Could not save attendance. Please retry.');
      }
    } catch (err) {
      console.error('handleSaveAttendance error:', err);
      Alert.alert('Network Error', err.message || 'Failed to save attendance. Your changes are preserved.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Header slot description
  const headerClassText = slotData?.class?.name || 'Class';
  const headerSubjectPeriod = `${slotData?.subject?.name || 'Mathematics'} · Period ${
    slotData?.period || 1
  } · ${slotData?.time || ''}`;

  // Formatted date pill label
  const formattedDatePill = useMemo(() => {
    if (selectedDate === todayISTStr) return 'Today';
    try {
      const d = new Date(`${selectedDate}T12:00:00+05:30`);
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    } catch {
      return selectedDate;
    }
  }, [selectedDate, todayISTStr]);

  return (
    <View style={[styles.screenContainer, { paddingTop: insets.top }]}>
      {/* ========================================================================= */}
      {/* SCREEN 1: TODAY'S CLASSES LIST HUB (When no slot is selected)            */}
      {/* ========================================================================= */}
      {!selectedSlotId ? (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Row: Title & Date Selector Pill */}
          <View style={styles.hubTitleRow}>
            <Text style={styles.screenHeading}>Attendance</Text>

            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.pickerPill}
              onPress={handleOpenDatePicker}
              accessibilityRole="button"
              accessibilityLabel="Select date"
            >
              <Feather name="calendar" size={13} color={colors.navy} />
              <Text style={styles.pickerPillText}>{formattedDatePill}</Text>
              <Feather name="chevron-down" size={14} color={colors.navy} />
            </TouchableOpacity>
          </View>

          {/* Hub Summary Card (Navy) */}
          <View style={styles.hubHeroCard}>
            <View style={styles.hubHeroTopRow}>
              <View>
                <Text style={styles.hubHeroTitle}>Attendance Hub</Text>
                <Text style={styles.hubHeroSubtitle}>
                  {formattedDatePill === 'Today' ? "Today's Schedule" : `Schedule for ${formattedDatePill}`}
                </Text>
              </View>
              <View style={styles.hubHeroBadge}>
                <Text style={styles.hubHeroBadgeText}>
                  {completedClassesCount === totalClassesCount && totalClassesCount > 0
                    ? 'All Marked ✓'
                    : `${completedClassesCount}/${totalClassesCount} Marked`}
                </Text>
              </View>
            </View>

            {/* Stat Counters Tally */}
            <View style={styles.hubStatRow}>
              <View style={styles.hubStatBox}>
                <Text style={styles.hubStatNum}>{totalClassesCount}</Text>
                <Text style={styles.hubStatLabel}>Total Classes</Text>
              </View>
              <View style={styles.hubStatBox}>
                <Text style={[styles.hubStatNum, { color: '#7FE0A8' }]}>{completedClassesCount}</Text>
                <Text style={styles.hubStatLabel}>Marked</Text>
              </View>
              <View style={styles.hubStatBox}>
                <Text
                  style={[
                    styles.hubStatNum,
                    { color: pendingClassesCount > 0 ? '#FFC043' : '#FFFFFF' },
                  ]}
                >
                  {pendingClassesCount}
                </Text>
                <Text style={styles.hubStatLabel}>Pending</Text>
              </View>
            </View>
          </View>

          {/* Section Heading */}
          <View style={styles.hubSectionHeader}>
            <Text style={styles.hubSectionTitle}>Assigned Classes ({totalClassesCount})</Text>
            <Text style={styles.hubSectionHint}>Tap any class to mark</Text>
          </View>

          {/* Loading Indicator */}
          {isSlotsLoading && (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={colors.blue} />
              <Text style={styles.loadingText}>Loading assigned classes...</Text>
            </View>
          )}

          {/* Empty State */}
          {!isSlotsLoading && teacherSlots.length === 0 && (
            <View style={styles.emptyCard}>
              <Feather name="calendar" size={36} color={colors.greyDot} />
              <Text style={styles.emptyTitle}>No Classes Scheduled</Text>
              <Text style={styles.emptySubtitle}>
                No teaching periods scheduled for {formattedDatePill}. Enjoy your free day!
              </Text>
            </View>
          )}

          {/* Classes Cards List */}
          {!isSlotsLoading &&
            teacherSlots.map((slot) => {
              const isMarked = slot.isCompleted;
              const isOngoing = slot.status === 'ongoing';
              const isMissed = slot.status === 'missed';
              const sid = slot.slotId || slot.id;

              return (
                <TouchableOpacity
                  key={sid}
                  activeOpacity={0.82}
                  style={[
                    styles.classCard,
                    isOngoing && styles.classCardOngoing,
                    isMissed && styles.classCardMissed,
                  ]}
                  onPress={() => setSelectedSlotId(sid)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${slot.class?.name || 'Class'}`}
                >
                  {/* Card Header: Period, Time & Status Pill */}
                  <View style={styles.classCardHeader}>
                    <View style={styles.classCardPeriodBadge}>
                      <Text style={styles.classCardPeriodText}>Period {slot.period || 1}</Text>
                      <Text style={styles.classCardTimeText}>
                        {slot.startTime} – {slot.endTime}
                      </Text>
                    </View>

                    {isMarked ? (
                      <View style={styles.statusPillMarked}>
                        <Feather name="check" size={12} color="#12794A" />
                        <Text style={styles.statusPillMarkedText}>Marked</Text>
                      </View>
                    ) : isOngoing ? (
                      <View style={styles.statusPillOngoing}>
                        <View style={styles.ongoingPulseDot} />
                        <Text style={styles.statusPillOngoingText}>Ongoing · Mark Now</Text>
                      </View>
                    ) : isMissed ? (
                      <View style={styles.statusPillMissed}>
                        <Feather name="alert-circle" size={12} color="#E5484D" />
                        <Text style={styles.statusPillMissedText}>Pending</Text>
                      </View>
                    ) : (
                      <View style={styles.statusPillUpcoming}>
                        <Text style={styles.statusPillUpcomingText}>Upcoming</Text>
                      </View>
                    )}
                  </View>

                  {/* Card Body: Class Name, Section, Subject */}
                  <View style={styles.classCardBody}>
                    <Text style={styles.classCardTitle}>
                      {slot.class?.name || 'Class'}
                      {slot.room ? ` · ${slot.room}` : ''}
                    </Text>
                    <Text style={styles.classCardSubject}>
                      {slot.subject?.name || 'Subject'}
                    </Text>
                  </View>

                  {/* Card Footer: Metadata & Action CTA */}
                  <View style={styles.classCardFooter}>
                    <View style={styles.classCardMeta}>
                      <Feather name="users" size={13} color={colors.greyDot} />
                      <Text style={styles.classCardMetaText}>
                        {isMarked && slot.session?.summary
                          ? `${slot.session.summary.present || 0} Present · ${
                              slot.session.summary.absent || 0
                            } Absent`
                          : `${slot.studentCount || slot.class?.capacity || 0} students enrolled`}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.cardActionPill,
                        isMarked ? styles.cardActionPillSecondary : styles.cardActionPillPrimary,
                      ]}
                    >
                      <Text
                        style={[
                          styles.cardActionText,
                          isMarked
                            ? styles.cardActionTextSecondary
                            : styles.cardActionTextPrimary,
                        ]}
                      >
                        {isMarked ? 'Edit' : 'Take Attendance'}
                      </Text>
                      <Feather
                        name="chevron-right"
                        size={14}
                        color={isMarked ? colors.navy : colors.white}
                      />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
        </ScrollView>
      ) : (
        /* ========================================================================= */
        /* SCREEN 2: CLASS ATTENDANCE ROSTER (For the tapped slot)                   */
        /* ========================================================================= */
        <View style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 160 }]}
            showsVerticalScrollIndicator={false}
          >
            {/* Header with Back Button to Hub */}
            <View style={styles.screen2Header}>
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.backButton}
                onPress={handleBackToClasses}
                accessibilityRole="button"
                accessibilityLabel="Back to all classes"
              >
                <Feather name="arrow-left" size={18} color={colors.navy} />
                <Text style={styles.backButtonText}>All Classes</Text>
              </TouchableOpacity>

              <View style={styles.screen2ClassPill}>
                <Text style={styles.screen2ClassPillText}>{formattedDatePill}</Text>
              </View>
            </View>

            {/* Loading Indicator */}
            {isLoading && (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={colors.blue} />
                <Text style={styles.loadingText}>Loading class attendance...</Text>
              </View>
            )}

            {/* Error Card */}
            {!isLoading && error && (
              <View style={styles.errorCard}>
                <Feather name="alert-circle" size={28} color={colors.red} />
                <Text style={styles.errorTitle}>Could not load attendance</Text>
                <Text style={styles.errorSubtitle}>{error}</Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.retryButton}
                  onPress={loadSlotAttendance}
                >
                  <Text style={styles.retryButtonText}>Tap to Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            {!isLoading && !error && (
              <>
                {/* Hero Card (.hero): Navy Background, Class Info & Stat Tiles */}
                <View style={styles.heroCard}>
                  <View style={styles.heroTopRow}>
                    <View style={styles.heroInfoCol}>
                      <Text style={styles.heroClassName} numberOfLines={1}>
                        {headerClassText}
                      </Text>
                      <Text style={styles.heroSubtitle} numberOfLines={1}>
                        {headerSubjectPeriod}
                      </Text>
                    </View>

                    {/* Status Chip */}
                    <View style={styles.heroStatusChip}>
                      <Text style={styles.heroStatusChipText}>
                        {isLocked
                          ? 'Locked'
                          : isSubmitted
                          ? 'Completed'
                          : selectedDate < todayISTStr
                          ? 'Past'
                          : 'Ongoing'}
                      </Text>
                    </View>
                  </View>

                  {/* 2 Stat Tiles (.st): Present and Absent */}
                  <View style={styles.statTilesRow}>
                    <View style={styles.statTile}>
                      <Text style={styles.statTileNumber}>{presentCount}</Text>
                      <Text style={styles.statTileLabel}>Present</Text>
                    </View>

                    <View style={styles.statTile}>
                      <Text style={styles.statTileNumber}>{absentCount}</Text>
                      <Text style={styles.statTileLabel}>Absent</Text>
                    </View>
                  </View>
                </View>

                {/* Students Header: "Students · N" & "Mark all present" Action */}
                <View style={styles.studentsHeaderRow}>
                  <Text style={styles.studentsCountText}>Students · {students.length}</Text>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    disabled={isLocked || students.length === 0}
                    style={[styles.markAllButton, isLocked && { opacity: 0.5 }]}
                    onPress={() => setShowMarkAllDialog(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Mark all present"
                  >
                    <Text style={styles.markAllButtonText}>Mark all present</Text>
                  </TouchableOpacity>
                </View>

                {/* Student List Container (.list) */}
                <View style={styles.studentListCard}>
                  {students.map((student, index) => {
                    const isLast = index === students.length - 1;
                    const studentStatus = marks[student.id] || 'P';

                    return (
                      <View
                        key={student.id}
                        style={[styles.studentRow, !isLast && styles.studentRowBorder]}
                      >
                        {/* Avatar Initials (.av) */}
                        <Avatar
                          uri={student.avatar}
                          name={student.name}
                          size={40}
                          variant="soft"
                        />

                        {/* Student Name & Roll Number (.nm) */}
                        <View style={styles.studentNameCol}>
                          <Text style={styles.studentNameText} numberOfLines={1}>
                            {student.name}
                          </Text>
                          <Text style={styles.studentRollText} numberOfLines={1}>
                            Roll {student.rollNumber || student.admissionNumber || index + 1}
                          </Text>
                        </View>

                        {/* 2-Segment Control (.seg): Present | Absent */}
                        <SegmentedControl
                          value={studentStatus}
                          disabled={isLocked}
                          onChange={(next) => handleStudentStatusChange(student.id, next)}
                        />
                      </View>
                    );
                  })}
                </View>
              </>
            )}
          </ScrollView>

          {/* Floating Save Button */}
          {!isLoading && !error && (
            <View style={styles.floatingButtonContainer} pointerEvents="box-none">
              <TouchableOpacity
                activeOpacity={0.85}
                disabled={isSubmitting || isLocked}
                style={[
                  styles.saveButton,
                  saveSuccessFeedback && { backgroundColor: colors.green },
                  isLocked && styles.saveButtonLocked,
                  isSubmitting && { opacity: 0.8 },
                ]}
                onPress={handleSaveAttendance}
                accessibilityRole="button"
                accessibilityLabel="Save attendance"
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : saveSuccessFeedback ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <Feather name="check" size={20} color={colors.white} />
                    <Text style={styles.saveButtonText}>Attendance Saved!</Text>
                  </View>
                ) : (
                  <Text style={styles.saveButtonText}>
                    {isLocked ? 'Session Locked (Read-Only)' : 'Save attendance'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* ConfirmDialog for "Mark all present" */}
      <ConfirmDialog
        visible={showMarkAllDialog}
        title="Mark All Present?"
        message={`Mark all ${students.length} students as Present? This will overwrite any students currently marked Absent.`}
        confirmText="Mark All Present"
        cancelText="Cancel"
        onConfirm={applyMarkAllPresent}
        onCancel={() => setShowMarkAllDialog(false)}
      />

      {/* Unsaved Changes Confirmation Dialog */}
      <ConfirmDialog
        visible={showUnsavedDialog}
        title="Unsaved Changes"
        message="You have unsaved attendance changes. Do you want to discard them and return to classes?"
        confirmText="Discard Changes"
        cancelText="Keep Editing"
        isDestructive
        onConfirm={() => {
          setShowUnsavedDialog(false);
          setMarks({ ...initialMarks });
          setSelectedSlotId(null);
        }}
        onCancel={() => setShowUnsavedDialog(false)}
      />

      {/* Date Picker Modal with Month Calendar */}
      <Modal
        visible={showDatePickerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDatePickerModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowDatePickerModal(false)}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCard}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select Date</Text>
                  <TouchableOpacity
                    onPress={() => setShowDatePickerModal(false)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather name="x" size={20} color={colors.navy} />
                  </TouchableOpacity>
                </View>

                {/* Quick Shortcuts */}
                <Text style={styles.modalSectionLabel}>QUICK SHORTCUTS</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateChipScroll}>
                  {availablePastDates.slice(0, 5).map((d) => {
                    const isSelected = selectedDate === d.dateStr;
                    return (
                      <TouchableOpacity
                        key={d.dateStr}
                        activeOpacity={0.7}
                        style={[styles.dateChip, isSelected && styles.dateChipSelected]}
                        onPress={() => {
                          setSelectedDate(d.dateStr);
                          setSelectedSlotId(null);
                          setShowDatePickerModal(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.dateChipText,
                            isSelected && styles.dateChipTextSelected,
                          ]}
                        >
                          {d.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Month Navigation */}
                <View style={styles.calMonthNavRow}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={handlePrevMonth}
                    style={styles.calNavBtn}
                    accessibilityLabel="Previous month"
                  >
                    <Feather name="chevron-left" size={18} color={colors.navy} />
                  </TouchableOpacity>

                  <Text style={styles.calMonthLabel}>{calendarMonthData.monthName}</Text>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={handleNextMonth}
                    style={styles.calNavBtn}
                    accessibilityLabel="Next month"
                  >
                    <Feather name="chevron-right" size={18} color={colors.navy} />
                  </TouchableOpacity>
                </View>

                {/* Weekday Headers */}
                <View style={styles.calWeekdayRow}>
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((w, idx) => (
                    <Text key={idx} style={styles.calWeekdayText}>{w}</Text>
                  ))}
                </View>

                {/* Days Grid */}
                <View style={styles.calDaysGrid}>
                  {calendarMonthData.cells.map((cell) => {
                    if (cell.isBlank) {
                      return <View key={cell.key} style={styles.calDayCell} />;
                    }
                    return (
                      <TouchableOpacity
                        key={cell.key}
                        activeOpacity={cell.isFuture ? 1 : 0.7}
                        disabled={cell.isFuture}
                        style={[
                          styles.calDayCell,
                          cell.isSelected && styles.calDaySelected,
                          cell.isToday && !cell.isSelected && styles.calDayToday,
                        ]}
                        onPress={() => {
                          setSelectedDate(cell.dateStr);
                          setSelectedSlotId(null);
                          setShowDatePickerModal(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.calDayNum,
                            cell.isSelected && styles.calDayNumSelected,
                            cell.isToday && !cell.isSelected && styles.calDayNumToday,
                            cell.isFuture && styles.calDayNumDisabled,
                          ]}
                        >
                          {cell.dayNum}
                        </Text>
                        {cell.isToday && (
                          <View
                            style={[
                              styles.calTodayDot,
                              cell.isSelected && { backgroundColor: colors.white },
                            ]}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Info Note */}
                <View style={styles.calFooterNote}>
                  <Feather name="info" size={12} color={colors.muted} />
                  <Text style={styles.calFooterNoteText}>
                    Sessions older than 7 days open in Read-Only view.
                  </Text>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Animated Success Toast Notification */}
      <SuccessToast
        visible={toastInfo.visible}
        title={toastInfo.title}
        subtitle={toastInfo.subtitle}
        variant={toastInfo.variant}
        onDismiss={() => setToastInfo((prev) => ({ ...prev, visible: false }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: colors.bg, // #F4F6FB
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },

  // Hub Header Row
  hubTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
  },
  screenHeading: {
    fontSize: 24,
    fontFamily: typography.fontFamily.extraBold,
    fontWeight: '800',
    color: colors.navy,
  },
  pickerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 14,
    ...shadows.card,
  },
  pickerPillText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    color: colors.navy,
  },

  // Hub Hero Card
  hubHeroCard: {
    marginTop: 12,
    backgroundColor: colors.navy,
    borderRadius: 22,
    padding: 18,
    ...shadows.card,
  },
  hubHeroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hubHeroTitle: {
    fontSize: 20,
    fontFamily: typography.fontFamily.extraBold,
    fontWeight: '800',
    color: colors.white,
  },
  hubHeroSubtitle: {
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
    color: colors.onDarkMuted,
    marginTop: 2,
  },
  hubHeroBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  hubHeroBadgeText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    color: colors.white,
  },
  hubStatRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  hubStatBox: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  hubStatNum: {
    fontSize: 20,
    fontFamily: typography.fontFamily.extraBold,
    fontWeight: '800',
    color: colors.white,
  },
  hubStatLabel: {
    fontSize: 11,
    fontFamily: typography.fontFamily.medium,
    color: colors.onDarkMuted,
    marginTop: 2,
  },

  // Hub Section Header
  hubSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 20,
    marginBottom: 10,
  },
  hubSectionTitle: {
    fontSize: 15,
    fontFamily: typography.fontFamily.extraBold,
    fontWeight: '800',
    color: colors.navy,
  },
  hubSectionHint: {
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
    color: colors.muted,
  },

  // Class Card in Hub
  classCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    ...shadows.card,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  classCardOngoing: {
    borderColor: '#E8A317',
  },
  classCardMissed: {
    borderColor: 'rgba(229, 72, 77, 0.25)',
  },
  classCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  classCardPeriodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  classCardPeriodText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    color: colors.navy,
    backgroundColor: colors.divider,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  classCardTimeText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
    color: colors.muted,
  },
  statusPillMarked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(18, 121, 74, 0.1)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  statusPillMarkedText: {
    fontSize: 11,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    color: '#12794A',
  },
  statusPillOngoing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(232, 163, 23, 0.14)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  statusPillOngoingText: {
    fontSize: 11,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    color: '#B87A00',
  },
  ongoingPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E8A317',
  },
  statusPillMissed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(229, 72, 77, 0.1)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  statusPillMissedText: {
    fontSize: 11,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    color: '#E5484D',
  },
  statusPillUpcoming: {
    backgroundColor: colors.divider,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  statusPillUpcomingText: {
    fontSize: 11,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    color: colors.muted,
  },
  classCardBody: {
    marginBottom: 12,
  },
  classCardTitle: {
    fontSize: 17,
    fontFamily: typography.fontFamily.extraBold,
    fontWeight: '800',
    color: colors.navy,
  },
  classCardSubject: {
    fontSize: 13,
    fontFamily: typography.fontFamily.medium,
    color: colors.blue,
    marginTop: 2,
  },
  classCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  classCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  classCardMetaText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
    color: colors.muted,
  },
  cardActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  cardActionPillPrimary: {
    backgroundColor: colors.blue,
  },
  cardActionPillSecondary: {
    backgroundColor: colors.soft,
  },
  cardActionText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
  },
  cardActionTextPrimary: {
    color: colors.white,
  },
  cardActionTextSecondary: {
    color: colors.navy,
  },

  // Empty State Card
  emptyCard: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    padding: 32,
    alignItems: 'center',
    marginTop: 16,
    ...shadows.card,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: typography.fontFamily.extraBold,
    fontWeight: '800',
    color: colors.navy,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: typography.fontFamily.medium,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },

  // Screen 2 Header
  screen2Header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
    marginBottom: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.white,
    ...shadows.card,
  },
  backButtonText: {
    fontSize: 13,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    color: colors.navy,
  },
  screen2ClassPill: {
    backgroundColor: colors.white,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 12,
    ...shadows.card,
  },
  screen2ClassPillText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    color: colors.navy,
  },

  // Screen 2 Hero Card (.hero)
  heroCard: {
    marginTop: 4,
    backgroundColor: colors.navy,
    borderRadius: 22,
    padding: 18,
    ...shadows.card,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroInfoCol: {
    flex: 1,
    marginRight: 10,
  },
  heroClassName: {
    fontSize: 26,
    fontFamily: typography.fontFamily.extraBold,
    fontWeight: '800',
    color: colors.white,
  },
  heroSubtitle: {
    fontSize: 13,
    fontFamily: typography.fontFamily.medium,
    color: colors.onDarkMuted,
    marginTop: 2,
  },
  heroStatusChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  heroStatusChipText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    color: colors.white,
  },

  // Stat Tiles (.st)
  statTilesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  statTile: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  statTileNumber: {
    fontSize: 22,
    fontFamily: typography.fontFamily.extraBold,
    fontWeight: '800',
    color: colors.white,
  },
  statTileLabel: {
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
    color: colors.onDarkMuted,
    marginTop: 2,
  },

  // Students Header Row
  studentsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    height: 36,
  },
  studentsCountText: {
    fontSize: 15,
    fontFamily: typography.fontFamily.extraBold,
    fontWeight: '800',
    color: colors.navy,
  },
  markAllButton: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markAllButtonText: {
    fontSize: 13,
    fontFamily: typography.fontFamily.extraBold,
    fontWeight: '800',
    color: colors.blue,
  },

  // Student List Card (.list)
  studentListCard: {
    marginTop: 8,
    backgroundColor: colors.white,
    borderRadius: 20,
    overflow: 'hidden',
    ...shadows.card,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  studentRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  studentNameCol: {
    flex: 1,
  },
  studentNameText: {
    fontSize: 15,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    color: colors.navy,
  },
  studentRollText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
    color: colors.muted,
    marginTop: 2,
  },

  // Floating Save Bar (.save)
  floatingButtonContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 92,
    zIndex: 99,
  },
  saveButton: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.floatingPrimary,
  },
  saveButtonLocked: {
    backgroundColor: colors.muted,
  },
  saveButtonText: {
    fontSize: 15,
    fontFamily: typography.fontFamily.extraBold,
    fontWeight: '800',
    color: colors.white,
  },

  // Loading & Error
  centerContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    fontFamily: typography.fontFamily.medium,
    color: colors.muted,
  },
  errorCard: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    padding: 24,
    alignItems: 'center',
    marginTop: 16,
    ...shadows.card,
  },
  errorTitle: {
    fontSize: 16,
    fontFamily: typography.fontFamily.bold,
    color: colors.navy,
    marginTop: 8,
  },
  errorSubtitle: {
    fontSize: 13,
    fontFamily: typography.fontFamily.medium,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 4,
  },
  retryButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: colors.soft,
  },
  retryButtonText: {
    fontSize: 13,
    fontFamily: typography.fontFamily.bold,
    color: colors.blue,
  },

  // Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 31, 79, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.white,
    borderRadius: radius.card,
    padding: 18,
    ...shadows.dropdownMenu,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: typography.fontFamily.extraBold,
    color: colors.navy,
  },
  modalSectionLabel: {
    fontSize: 10,
    fontFamily: typography.fontFamily.bold,
    color: colors.muted,
    letterSpacing: 0.6,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  dateChipScroll: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  dateChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.divider,
    marginRight: 6,
  },
  dateChipSelected: {
    backgroundColor: colors.navy,
  },
  dateChipText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.bold,
    color: colors.navy,
  },
  dateChipTextSelected: {
    color: colors.white,
  },
  calMonthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    marginTop: 2,
    marginBottom: 6,
  },
  calNavBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: colors.soft,
  },
  calMonthLabel: {
    fontSize: 14,
    fontFamily: typography.fontFamily.extraBold,
    fontWeight: '800',
    color: colors.navy,
  },
  calWeekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  calWeekdayText: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: 11,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    color: colors.muted,
  },
  calDaysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calDayCell: {
    width: `${100 / 7}%`,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
    borderRadius: 10,
  },
  calDaySelected: {
    backgroundColor: colors.blue,
  },
  calDayToday: {
    borderWidth: 1.5,
    borderColor: colors.blue,
  },
  calDayNum: {
    fontSize: 13,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    color: colors.navy,
  },
  calDayNumSelected: {
    color: colors.white,
  },
  calDayNumToday: {
    color: colors.blue,
  },
  calDayNumDisabled: {
    color: '#CBD5E1',
  },
  calTodayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.blue,
    position: 'absolute',
    bottom: 4,
  },
  calFooterNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  calFooterNoteText: {
    fontSize: 11,
    fontFamily: typography.fontFamily.medium,
    color: colors.muted,
    flex: 1,
  },
});
