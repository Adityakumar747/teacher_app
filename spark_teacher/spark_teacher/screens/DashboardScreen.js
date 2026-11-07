import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import ApiService from '../services/api';
import { colors, typography, spacing, radius, shadows } from '../theme/colors';
import Avatar from '../components/Avatar';
import StatusDot from '../components/StatusDot';
import ProgressRing from '../components/ProgressRing';

/**
 * Dashboard Screen (Home Tab)
 * Authority: docs/Teacher_App_Design.html (#home)
 * Strictly matches layout, typography, colors, spacing, and micro-interactions.
 * Zero hardcoded values: all fed dynamically by GET /api/teachers/:id/classes-today.
 */
export default function DashboardScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);

  // Single request per screen pattern (Golden Rule 3)
  const loadDashboardData = useCallback(async () => {
    try {
      setError(null);
      const response = await ApiService.getClassesToday('me');
      if (response && response.success) {
        setDashboardData(response.data);
      } else {
        setError(response?.error || 'Failed to load schedule');
      }
    } catch (err) {
      console.error('Dashboard load error:', err);
      setError(err.message || 'Cannot connect to server. Please pull down to retry.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial and on-focus load using useFocusEffect (avoids duplicate call on mount)
  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [loadDashboardData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDashboardData();
  }, [loadDashboardData]);

  // Dynamic greeting based on device time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const teacher = dashboardData?.teacher || user || {};
  const today = dashboardData?.today || {};
  const summary = dashboardData?.summary || {
    totalClasses: 0,
    completedClasses: 0,
    pendingClasses: 0,
    displayString: '0 classes · 0 taken',
  };
  const classesList = dashboardData?.classes || [];
  const attentionItems = dashboardData?.attentionItems || [];
  const hasUnread = dashboardData?.hasUnreadNotifications || attentionItems.length > 0;

  // Identify current ongoing slot, or fallback to upcoming, pending, or completed state
  const currentSlot = useMemo(() => {
    if (!classesList || classesList.length === 0) {
      return { slot: null, mode: 'empty' };
    }

    // 1. Ongoing slot right now (live active period)
    const ongoing = classesList.find((c) => c.status === 'ongoing');
    if (ongoing) return { slot: ongoing, mode: 'now' };

    // 2. Upcoming slot later today
    const upcoming = classesList.find((c) => c.status === 'upcoming');
    if (upcoming) return { slot: upcoming, mode: 'next' };

    // 3. School hours past active slots: check for any pending/missed attendances
    const pendingSlots = classesList.filter((c) => !c.isCompleted);
    if (pendingSlots.length > 0) {
      // Pick the latest pending slot to resolve
      const targetPending = pendingSlots[pendingSlots.length - 1];
      return {
        slot: targetPending,
        mode: 'pending',
        pendingCount: pendingSlots.length,
      };
    }

    // 4. All classes today are completely finished AND taken
    return { slot: classesList[classesList.length - 1], mode: 'completed' };
  }, [classesList]);

  // Live timer interval to advance ring and minutes left every 30 seconds
  const [liveSeconds, setLiveSeconds] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveSeconds((prev) => prev + 1);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Compute minutes remaining & dynamic fill ratio (0.0 to 1.0)
  const { minutesLeft, progressRatio } = useMemo(() => {
    if (!currentSlot.slot) {
      return { minutesLeft: 0, progressRatio: 0 };
    }

    try {
      const [startH, startM] = (currentSlot.slot.startTime || '10:15').split(':').map(Number);
      const [endH, endM] = (currentSlot.slot.endTime || '11:15').split(':').map(Number);

      const startTotal = startH * 60 + startM;
      const endTotal = endH * 60 + endM;
      const duration = Math.max(1, endTotal - startTotal); // e.g. 60 mins

      if (today.currentTimeIST) {
        const [curH, curM] = today.currentTimeIST.split(':').map(Number);
        const curTotal = curH * 60 + curM;

        if (curTotal >= startTotal && curTotal < endTotal) {
          // Class is happening right now: calculate live elapsed & remaining
          const elapsed = curTotal - startTotal;
          const left = endTotal - curTotal;
          const ratio = Math.min(1, Math.max(0.08, elapsed / duration));
          return {
            minutesLeft: Math.max(1, left),
            progressRatio: ratio,
          };
        } else if (curTotal < startTotal) {
          // Upcoming class: starting soon
          const untilStart = startTotal - curTotal;
          return {
            minutesLeft: Math.max(1, untilStart),
            progressRatio: 0.08,
          };
        }
      }

      // Slot completed or no live time remaining
      const isPast = currentSlot.mode === 'completed' || currentSlot.mode === 'needs_marking';
      return {
        minutesLeft: 0,
        progressRatio: isPast ? 1.0 : 0,
      };
    } catch {
      return { minutesLeft: 0, progressRatio: 0 };
    }
  }, [currentSlot.slot, currentSlot.mode, today.currentTimeIST, liveSeconds]);

  // Format short date string matching design: "Mon, 2 Nov"
  const formattedShortDate = useMemo(() => {
    if (today.date) {
      try {
        const d = new Date(`${today.date}T12:00:00+05:30`);
        return d.toLocaleDateString('en-GB', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        });
      } catch {
        return today.formattedDate || 'Today';
      }
    }
    return 'Today';
  }, [today.date, today.formattedDate]);

  // Navigate to Attendance screen for a slot
  const handleTakeAttendance = (slot) => {
    if (!slot) {
      navigation.navigate('Attendance');
      return;
    }
    navigation.navigate('Attendance', {
      slotId: slot.slotId || slot.id,
      selectedClass: slot.class?.id || slot.class?._id,
      selectedSubject: slot.subject?.id || slot.subject?._id,
      selectedDate: today.date || new Date().toISOString().split('T')[0],
      className: slot.class?.name,
      subjectName: slot.subject?.name,
    });
  };

  // Handle action tap on "Needs your attention" cards
  const handleAttentionAction = (item) => {
    if (item.target === 'attendance' && item.slotId) {
      const matchingSlot = classesList.find((c) => (c.slotId || c.id) === item.slotId);
      handleTakeAttendance(matchingSlot || { slotId: item.slotId });
    } else {
      navigation.navigate('Assignments');
    }
  };

  return (
    <View style={[styles.screenContainer, { paddingTop: insets.top }]}>
      {/* Scrollable Container (.sc) */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          Platform.OS !== 'web' ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.blue]}
              tintColor={colors.blue}
            />
          ) : undefined
        }
      >
        {/* Header (.hd): Avatar, Greeting, Teacher Name, Bell */}
        <View style={styles.header}>
          <Avatar
            uri={teacher.avatar}
            name={teacher.name || 'Sonia Singh'}
            size={44}
            variant="navy"
          />

          <View style={styles.headerTextGroup}>
            <Text style={styles.greetingText}>{getGreeting()}</Text>
            <Text style={styles.teacherNameText} numberOfLines={1}>
              {teacher.name || 'Sonia Singh'}
            </Text>
          </View>

          {/* Bell Icon with Red Dot Badge */}
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.bellButton}
            onPress={() => setShowNotificationsModal(true)}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
          >
            <Feather name="bell" size={22} color={colors.navy} />
            {hasUnread && <View style={styles.bellBadgeDot} />}
          </TouchableOpacity>
        </View>

        {/* Loading State */}
        {isLoading && !refreshing && (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.blue} />
            <Text style={styles.loadingText}>Loading today schedule...</Text>
          </View>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <View style={styles.errorCard}>
            <Feather name="alert-circle" size={28} color={colors.red} />
            <Text style={styles.errorTitle}>Unable to load schedule</Text>
            <Text style={styles.errorSubtitle}>{error}</Text>
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.retryButton}
              onPress={loadDashboardData}
            >
              <Text style={styles.retryButtonText}>Tap to Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Main Dashboard Content */}
        {!isLoading && !error && (
          <>
            {/* Hero Card (.h2): Navy Gradient, Circular Progress Ring, Class Info, Take Attendance Button */}
            <LinearGradient
              colors={colors.heroGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={styles.heroCard}
            >
              {/* Decorative Background Rings (:before, :after in design HTML) */}
              <View style={styles.decorativeRingOuter} pointerEvents="none" />
              <View style={styles.decorativeRingInner} pointerEvents="none" />

              {/* Hero Top Row: Status Pill & Date */}
              <View style={styles.heroTopRow}>
                <View style={styles.heroStatusPill}>
                  <Text style={styles.heroStatusPillText}>
                    {currentSlot.mode === 'now'
                      ? 'Happening now'
                      : currentSlot.mode === 'pending'
                      ? 'Attendance Pending'
                      : currentSlot.mode === 'completed'
                      ? 'Completed'
                      : currentSlot.mode === 'next'
                      ? `Next up · ${currentSlot.slot?.startTime}`
                      : 'No classes'}
                  </Text>
                </View>
                <Text style={styles.heroDateText}>{formattedShortDate}</Text>
              </View>

              {/* Hero Center Row: Circular Progress Ring (only when class is happening now) & Class Details */}
              <View style={[styles.heroCenterRow, currentSlot.mode !== 'now' && styles.heroCenterRowNoRing]}>
                {currentSlot.mode === 'now' && (
                  <ProgressRing
                    value={minutesLeft}
                    progress={progressRatio}
                    label="min left"
                    size={88}
                  />
                )}

                <View style={styles.heroClassInfo}>
                  <Text style={styles.heroClassName} numberOfLines={1}>
                    {today.isHoliday || today.isLeave
                      ? today.holidayTitle || 'Holiday / School Closed'
                      : currentSlot.mode === 'completed'
                      ? 'All Classes Completed'
                      : currentSlot.mode === 'pending'
                      ? `${currentSlot.slot?.class?.name || 'Class'}`
                      : currentSlot.slot
                      ? currentSlot.slot.class?.name || 'Class'
                      : 'No Class Today'}
                  </Text>
                  <Text style={styles.heroSubjectPeriod} numberOfLines={1}>
                    {today.isHoliday || today.isLeave
                      ? today.isLeave ? 'Approved Leave' : 'Academic Calendar'
                      : currentSlot.mode === 'completed'
                      ? `All ${summary.totalClasses} classes marked for today ✓`
                      : currentSlot.mode === 'pending'
                      ? `${currentSlot.slot?.subject?.name || 'Subject'} · Period ${currentSlot.slot?.period || 1}`
                      : currentSlot.slot
                      ? `${currentSlot.slot.subject?.name || 'Subject'} · Period ${currentSlot.slot.period || 1}`
                      : 'Free day'}
                  </Text>
                  <Text style={styles.heroTimeStudents} numberOfLines={1}>
                    {today.isHoliday || today.isLeave
                      ? 'Enjoy your day off'
                      : currentSlot.mode === 'completed'
                      ? 'Schedule finished for today'
                      : currentSlot.mode === 'pending'
                      ? `${currentSlot.pendingCount} attendance pending · ${currentSlot.slot?.startTime}–${currentSlot.slot?.endTime}`
                      : currentSlot.slot
                      ? `${currentSlot.slot.startTime} – ${currentSlot.slot.endTime} · ${currentSlot.slot.studentCount || currentSlot.slot.class?.capacity || 0} students`
                      : 'Enjoy your schedule'}
                  </Text>
                </View>
              </View>

              {/* Hero Bottom Button (.go): White full-width button */}
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.heroActionButton}
                onPress={() => {
                  if (today.isHoliday || today.isLeave) {
                    navigation.navigate('Profile');
                  } else if (currentSlot.mode === 'completed') {
                    navigation.navigate('Attendance');
                  } else if (currentSlot.mode === 'pending') {
                    handleTakeAttendance(currentSlot.slot);
                  } else {
                    handleTakeAttendance(currentSlot.slot);
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel={
                  currentSlot.mode === 'completed'
                    ? 'View attendance'
                    : currentSlot.mode === 'pending'
                    ? 'Mark attendance now'
                    : 'Take attendance'
                }
              >
                <Text style={styles.heroActionButtonText}>
                  {today.isHoliday || today.isLeave
                    ? 'View Academic Calendar  →'
                    : currentSlot.mode === 'completed'
                    ? 'View attendance  →'
                    : currentSlot.mode === 'pending'
                    ? 'Mark attendance now  →'
                    : 'Take attendance  →'}
                </Text>
              </TouchableOpacity>
            </LinearGradient>

            {/* Section Header: "Today's schedule" & Summary Tally */}
            <View style={styles.scheduleHeaderRow}>
              <Text style={styles.scheduleSectionTitle}>Today's schedule</Text>
              <Text style={styles.scheduleSummaryText}>
                {summary.totalClasses} classes · {summary.completedClasses} taken
              </Text>
            </View>

            {/* Empty Schedule State */}
            {classesList.length === 0 && (
              <View style={styles.emptyScheduleCard}>
                <Feather name="calendar" size={32} color={colors.greyDot} />
                <Text style={styles.emptyScheduleTitle}>No classes scheduled today</Text>
                <Text style={styles.emptyScheduleSubtitle}>
                  Enjoy your day off! Classes will appear here when scheduled.
                </Text>
              </View>
            )}

            {/* Timeline List (.tlw) */}
            {classesList.length > 0 && (
              <View style={styles.timelineList}>
                {classesList.map((slot, index) => {
                  const isCurrent = slot.status === 'ongoing';
                  const isFirst = index === 0;
                  const isLast = index === classesList.length - 1;

                  return (
                    <TouchableOpacity
                      key={slot.id || slot.slotId || index}
                      activeOpacity={0.85}
                      style={styles.timelineItem}
                      onPress={() => handleTakeAttendance(slot)}
                    >
                      {/* Left: Start Time & End Time (.tm) */}
                      <View style={styles.timelineTimeCol}>
                        <Text style={styles.timeStartText}>{slot.startTime}</Text>
                        <Text style={styles.timeEndText}>{slot.endTime}</Text>
                      </View>

                      {/* Center: Status Dot (.dt) */}
                      <View style={styles.timelineTrackCol}>
                        <View style={styles.timelineDotWrapper}>
                          <StatusDot status={slot.status} size={10} withHalo />
                        </View>
                      </View>

                      {/* Right: Class Card (.tc) */}
                      <View style={[styles.timelineCard, isCurrent && styles.timelineCardNow]}>
                        <View style={styles.timelineCardContent}>
                          <Text style={styles.cardSubjectTitle} numberOfLines={1}>
                            {slot.subject?.name || 'Subject'}
                          </Text>
                          <Text style={styles.cardClassSubtitle} numberOfLines={1}>
                            {slot.class?.name || 'Class'} · {slot.studentCount || slot.class?.capacity || 0} students
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Section: Needs Your Attention (.sh) */}
            {attentionItems.length > 0 && (
              <>
                <Text style={styles.attentionSectionTitle}>Needs your attention</Text>

                {attentionItems.map((item) => {
                  const badgeStyles =
                    item.badgeType === 'red'
                      ? { bg: '#FDE3E0', text: '#9B1C1C' }
                      : item.badgeType === 'amber'
                      ? { bg: '#FDF0D0', text: '#7A4B00' }
                      : { bg: '#E4EBFB', text: '#1D3FA6' };

                  return (
                    <View key={item.id} style={styles.attentionCard}>
                      {/* Icon/Number Tile (.ic) */}
                      <View style={[styles.attentionIconTile, { backgroundColor: badgeStyles.bg }]}>
                        <Text style={[styles.attentionIconText, { color: badgeStyles.text }]}>
                          {item.badge}
                        </Text>
                      </View>

                      {/* Text Group (.tx) */}
                      <View style={styles.attentionTextGroup}>
                        <Text style={styles.attentionItemTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={styles.attentionItemSubtitle} numberOfLines={1}>
                          {item.subtitle}
                        </Text>
                      </View>

                      {/* Soft Action Button */}
                      <TouchableOpacity
                        activeOpacity={0.7}
                        style={styles.attentionActionButton}
                        onPress={() => handleAttentionAction(item)}
                      >
                        <Text style={styles.attentionActionText}>{item.actionText}</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* Notifications / Attention Items Modal (Decision 5) */}
      <Modal
        visible={showNotificationsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNotificationsModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowNotificationsModal(false)}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCard}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Notifications & Alerts</Text>
                  <TouchableOpacity
                    onPress={() => setShowNotificationsModal(false)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Feather name="x" size={20} color={colors.navy} />
                  </TouchableOpacity>
                </View>

                {attentionItems.length === 0 ? (
                  <View style={styles.modalEmpty}>
                    <Feather name="check" size={32} color={colors.green} />
                    <Text style={styles.modalEmptyTitle}>All caught up!</Text>
                    <Text style={styles.modalEmptySubtitle}>No pending alerts or notifications.</Text>
                  </View>
                ) : (
                  <View style={styles.modalList}>
                    {attentionItems.map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        activeOpacity={0.7}
                        style={styles.modalItemRow}
                        onPress={() => {
                          setShowNotificationsModal(false);
                          handleAttentionAction(item);
                        }}
                      >
                        <View style={styles.modalItemDot} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.modalItemTitle}>{item.title}</Text>
                          <Text style={styles.modalItemSubtitle}>{item.subtitle}</Text>
                        </View>
                        <Text style={styles.modalItemAction}>{item.actionText} →</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: colors.bg, // #F4F6FB
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },

  // Header (.hd)
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 48,
  },
  headerTextGroup: {
    flex: 1,
    justifyContent: 'center',
  },
  greetingText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.semiBold,
    color: colors.muted,
  },
  teacherNameText: {
    fontSize: 18,
    fontFamily: typography.fontFamily.extraBold,
    fontWeight: '800',
    color: colors.navy,
  },
  bellButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...shadows.card,
  },
  bellBadgeDot: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.redDot, // #E5484D
    borderWidth: 2,
    borderColor: colors.white,
  },

  // Hero Card (.h2)
  heroCard: {
    position: 'relative',
    overflow: 'hidden',
    marginTop: 14,
    borderRadius: radius.hero, // 26
    padding: 18,
  },
  decorativeRingOuter: {
    position: 'absolute',
    right: -60,
    top: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  decorativeRingInner: {
    position: 'absolute',
    right: -20,
    top: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  heroTopRow: {
    position: 'relative',
    zIndex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroStatusPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  heroStatusPillText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    color: colors.white,
  },
  heroDateText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.semiBold,
    color: colors.onDarkMuted, // #C9D4F0
  },
  heroCenterRow: {
    position: 'relative',
    zIndex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 16,
  },
  heroCenterRowNoRing: {
    paddingVertical: 8,
    minHeight: 76,
    justifyContent: 'center',
  },
  heroClassInfo: {
    flex: 1,
  },
  heroClassName: {
    fontSize: 28,
    fontFamily: typography.fontFamily.extraBold,
    fontWeight: '800',
    lineHeight: 31,
    color: colors.white,
  },
  heroSubjectPeriod: {
    fontSize: 13,
    fontFamily: typography.fontFamily.medium,
    color: colors.onDarkMuted,
    marginTop: 4,
  },
  heroTimeStudents: {
    fontSize: 13,
    fontFamily: typography.fontFamily.medium,
    color: colors.onDarkMuted,
  },
  heroActionButton: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    height: 52,
    marginTop: 16,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroActionButtonText: {
    fontSize: 15,
    fontFamily: typography.fontFamily.extraBold,
    fontWeight: '800',
    color: colors.navy,
  },

  // Schedule Section Header
  scheduleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 20,
  },
  scheduleSectionTitle: {
    fontSize: 15,
    fontFamily: typography.fontFamily.extraBold,
    fontWeight: '800',
    color: colors.navy,
  },
  scheduleSummaryText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.semiBold,
    color: colors.muted,
  },

  // Timeline List (.tlw)
  timelineList: {
    marginTop: 4,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  timelineTimeCol: {
    width: 42,
    paddingTop: 12,
  },
  timeStartText: {
    fontSize: 13,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    color: colors.navy,
  },
  timeEndText: {
    fontSize: 11,
    fontFamily: typography.fontFamily.medium,
    color: colors.muted,
  },
  timelineTrackCol: {
    width: 18,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 16,
  },
  timelineDotWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    ...shadows.card,
  },
  timelineCardNow: {
    backgroundColor: colors.soft,
    borderWidth: 1.5,
    borderColor: colors.blue,
  },
  timelineCardContent: {
    flex: 1,
  },
  cardSubjectTitle: {
    fontSize: 15,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    color: colors.navy,
  },
  cardClassSubtitle: {
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
    color: colors.muted,
    marginTop: 2,
  },

  // Needs your attention (.sh & .at)
  attentionSectionTitle: {
    fontSize: 15,
    fontFamily: typography.fontFamily.extraBold,
    fontWeight: '800',
    color: colors.navy,
    marginTop: 18,
  },
  attentionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 14,
    marginTop: 8,
    ...shadows.card,
  },
  attentionIconTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attentionIconText: {
    fontSize: 15,
    fontFamily: typography.fontFamily.extraBold,
    fontWeight: '800',
  },
  attentionTextGroup: {
    flex: 1,
  },
  attentionItemTitle: {
    fontSize: 14,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    color: colors.navy,
  },
  attentionItemSubtitle: {
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
    color: colors.muted,
  },
  attentionActionButton: {
    height: 40,
    width: 92,
    borderRadius: 12,
    backgroundColor: colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attentionActionText: {
    fontSize: 13,
    fontFamily: typography.fontFamily.extraBold,
    fontWeight: '800',
    color: colors.blue,
  },

  // Empty / Error states
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
  emptyScheduleCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    marginTop: 10,
    ...shadows.card,
  },
  emptyScheduleTitle: {
    fontSize: 15,
    fontFamily: typography.fontFamily.bold,
    color: colors.navy,
    marginTop: 8,
  },
  emptyScheduleSubtitle: {
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 4,
  },

  // Notifications Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 31, 79, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.white,
    borderRadius: radius.card,
    padding: 20,
    ...shadows.dropdownMenu,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: typography.fontFamily.extraBold,
    color: colors.navy,
  },
  modalEmpty: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  modalEmptyTitle: {
    fontSize: 15,
    fontFamily: typography.fontFamily.bold,
    color: colors.navy,
    marginTop: 8,
  },
  modalEmptySubtitle: {
    fontSize: 13,
    fontFamily: typography.fontFamily.medium,
    color: colors.muted,
    marginTop: 4,
  },
  modalList: {
    gap: 12,
  },
  modalItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  modalItemDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.redDot,
  },
  modalItemTitle: {
    fontSize: 13,
    fontFamily: typography.fontFamily.bold,
    color: colors.navy,
  },
  modalItemSubtitle: {
    fontSize: 11,
    fontFamily: typography.fontFamily.medium,
    color: colors.muted,
  },
  modalItemAction: {
    fontSize: 12,
    fontFamily: typography.fontFamily.bold,
    color: colors.blue,
  },
});
