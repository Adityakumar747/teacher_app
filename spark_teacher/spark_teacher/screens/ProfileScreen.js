import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Alert,
  Linking,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import ApiService from '../services/api';
import { colors, typography, spacing, radius, shadows } from '../theme/colors';
import StudentsScreen from './StudentsScreen';
import ClassTeacherViewScreen from './ClassTeacherViewScreen';
import CalendarScreen from './CalendarScreen';
import ConfirmDialog from '../components/ConfirmDialog';

/**
 * ProfileScreen (Teacher Profile, Quick Access, and Leave Overlay)
 * Authority: docs/Teacher_App_Design.html (#prof & #ovL)
 * Features:
 * - Profile Card (.pc) with #4C7DFF avatar ring, teacher details, school pill, 3 stats (.pst)
 * - "My class" section (.sec) with Class Teacher tag (.tag)
 * - "Quick access" section: Students overlay (.ent data-open="ovS") & Leave overlay (.ent data-open="ovL")
 * - "Contact" section: phone, email, Log out
 * - Leave Overlay (#ovL): Quota cards (Casual 8/12, Sick 5/8), Apply leave form, Recent requests list
 * - Real API: GET /api/teachers/me, GET /api/leaves, POST /api/leaves
 */
export default function ProfileScreen({ onLogout }) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  // Profile data
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Leave data & Overlay
  const [showLeaveOverlay, setShowLeaveOverlay] = useState(false);
  const [showStudentsOverlay, setShowStudentsOverlay] = useState(false);
  const [showClassAnalyticsOverlay, setShowClassAnalyticsOverlay] = useState(false);
  const [showCalendarOverlay, setShowCalendarOverlay] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [leavesData, setLeavesData] = useState([]);
  const [leaveSummary, setLeaveSummary] = useState({
    casualTotal: 12,
    casualRemaining: 12,
    sickTotal: 8,
    sickRemaining: 8,
    pendingCount: 0,
  });

  // Apply Leave Form State
  const [selectedLeaveType, setSelectedLeaveType] = useState('Casual'); // 'Casual' | 'Sick' | 'Other'
  const [fromDateStr, setFromDateStr] = useState(
    new Date(Date.now() + 24 * 3600 * 1000).toISOString().split('T')[0]
  );
  const [toDateStr, setToDateStr] = useState(
    new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString().split('T')[0]
  );
  const [leaveReason, setLeaveReason] = useState('');
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false);

  useEffect(() => {
    loadProfile();
    loadLeaves();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const res = await ApiService.getTeacherProfile();
      if (res.success && res.data) {
        setProfile(res.data);
      }
    } catch (err) {
      console.error('Error loading teacher profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadLeaves = async () => {
    try {
      const res = await ApiService.getLeaves({ limit: 20 });
      if (res.success) {
        if (res.data) setLeavesData(res.data);
        if (res.summary) setLeaveSummary(res.summary);
      }
    } catch (err) {
      console.error('Error loading leaves:', err);
    }
  };

  const handleApplyLeave = async () => {
    if (!leaveReason.trim()) {
      Alert.alert('Required', 'Please enter a short reason for leave.');
      return;
    }
    if (new Date(fromDateStr) > new Date(toDateStr)) {
      Alert.alert('Invalid Dates', 'From date cannot be after To date.');
      return;
    }

    try {
      setIsSubmittingLeave(true);
      const res = await ApiService.applyLeave({
        leaveType: selectedLeaveType.toLowerCase(),
        fromDate: fromDateStr,
        toDate: toDateStr,
        reason: leaveReason.trim(),
      });

      if (res.success) {
        Alert.alert('Submitted', 'Leave application submitted successfully.');
        setLeaveReason('');
        await loadLeaves();
      } else {
        Alert.alert('Error', res.error || 'Failed to submit leave.');
      }
    } catch (err) {
      console.error('Apply leave error:', err);
      Alert.alert('Error', err.message || 'Failed to submit leave.');
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  const handleLogoutPress = () => {
    setShowLogoutConfirm(true);
  };

  // Helper: Format leave date range
  const formatLeaveDates = (from, to) => {
    if (!from) return '';
    const d1 = new Date(from);
    const d2 = to ? new Date(to) : d1;
    const diff = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1);
    const f1 = d1.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const f2 = d2.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

    if (f1 === f2) {
      return `${f1} · 1 day`;
    }
    return `${f1} – ${f2} · ${diff} days`;
  };

  // Helper for tag status style
  const getLeaveStatusStyle = (status) => {
    if (status === 'approved') {
      return { bg: '#DDF3E6', color: colors.green, label: 'Approved' };
    }
    if (status === 'rejected') {
      return { bg: '#FDE3E0', color: colors.red, label: 'Rejected' };
    }
    return { bg: '#FDF0D0', color: '#7A4B00', label: 'Pending' };
  };

  const teacher = profile?.teacher || {};
  const stats = profile?.stats || {
    classesCount: 0,
    subjectsCount: 0,
    weeklySlotsCount: 0,
  };
  const myClass = profile?.classes?.find((c) => c.isClassTeacher) || profile?.classes?.[0] || null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 110 }]}
        showsVerticalScrollIndicator={false}
      >
        {loading && !profile ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color={colors.blue} />
            <Text style={styles.loadingText}>Loading profile...</Text>
          </View>
        ) : (
          <>
        {/* ----------------------------------------------------
            1. PROFILE CARD (.pc)
            ---------------------------------------------------- */}
        <LinearGradient
          colors={['#081742', '#0E2670']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.pc}
        >
          {/* Avatar with #4C7DFF ring (.pav) */}
          <View style={styles.pav}>
            <Text style={styles.pavText}>
              {teacher.name
                ? teacher.name
                    .split(' ')
                    .map((n) => n[0])
                    .filter((_, i, a) => i === 0 || i === a.length - 1)
                    .join('')
                    .toUpperCase()
                : 'SS'}
            </Text>
          </View>

          <Text style={styles.teacherName}>{teacher.name || 'Teacher'}</Text>
          <Text style={styles.designation}>
            {teacher.designation || 'Teacher'}
          </Text>

          <View style={styles.schoolPill}>
            <Text style={styles.schoolPillText}>
              {teacher.school?.name || 'School'}
            </Text>
          </View>

          {/* 3 Stats (.pst) */}
          <View style={styles.pst}>
            <View style={styles.pstItem}>
              <Text style={styles.pstNum}>{stats.classesCount}</Text>
              <Text style={styles.pstLabel}>Classes assigned</Text>
            </View>
            <View style={styles.pstItem}>
              <Text style={styles.pstNum}>{stats.subjectsCount}</Text>
              <Text style={styles.pstLabel}>Subject teaching</Text>
            </View>
            <View style={styles.pstItem}>
              <Text style={styles.pstNum}>{stats.weeklySlotsCount}</Text>
              <Text style={styles.pstLabel}>Slots per week</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ----------------------------------------------------
            2. SECTION: My class
            ---------------------------------------------------- */}
        {myClass && (
          <>
            <View style={styles.sec}>
              <Text style={styles.secText}>My class</Text>
              <View style={styles.secLine} />
            </View>

            <View style={styles.wc}>
              <TouchableOpacity
                style={styles.ln}
                onPress={() => setShowClassAnalyticsOverlay(true)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.lnTitle}>{myClass.fullName || 'Class'}</Text>
                  <Text style={styles.lnSubtitle}>
                    {myClass.room || 'Classroom'} · {myClass.studentCount || 0} students · Tap for Performance
                  </Text>
                </View>
                <View style={styles.classTeacherTag}>
                  <Text style={styles.classTeacherTagText}>Class Teacher</Text>
                </View>
                <Text style={[styles.entChevron, { marginLeft: 8 }]}>›</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ----------------------------------------------------
            3. SECTION: Quick access
            ---------------------------------------------------- */}
        <View style={styles.sec}>
          <Text style={styles.secText}>Quick access</Text>
          <View style={styles.secLine} />
        </View>

        {/* Students entry button */}
        <TouchableOpacity
          style={styles.ent}
          onPress={() => setShowStudentsOverlay(true)}
          activeOpacity={0.8}
        >
          <View style={styles.ib}>
            <Feather name="users" size={20} color={colors.navy} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.entTitle}>Students</Text>
            <Text style={styles.entSubtitle}>
              {myClass ? `${myClass.fullName} · ${myClass.studentCount || 0} students` : 'View roster'}
            </Text>
          </View>
          <Text style={styles.entChevron}>›</Text>
        </TouchableOpacity>

                {/* Academic Calendar entry button */}
        <TouchableOpacity
          style={styles.ent}
          onPress={() => setShowCalendarOverlay(true)}
          activeOpacity={0.8}
        >
          <View style={[styles.ib, { backgroundColor: '#EEF4FF' }]}>
            <Feather name="calendar" size={20} color={colors.blue} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.entTitle}>Academic Calendar</Text>
            <Text style={styles.entSubtitle}>
              Exams, Holidays & School Events
            </Text>
          </View>
          <Text style={styles.entChevron}>›</Text>
        </TouchableOpacity>

{/* Leave entry button */}
        <TouchableOpacity
          style={styles.ent}
          onPress={() => setShowLeaveOverlay(true)}
          activeOpacity={0.8}
        >
          <View style={styles.ib}>
            <Feather name="calendar" size={20} color={colors.navy} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.entTitle}>Leave</Text>
            <Text style={styles.entSubtitle}>
              {leaveSummary.casualRemaining} casual left · {leaveSummary.pendingCount} request pending
            </Text>
          </View>
          <Text style={styles.entChevron}>›</Text>
        </TouchableOpacity>

        {/* ----------------------------------------------------
            4. SECTION: Contact & Logout
            ---------------------------------------------------- */}
        <View style={styles.sec}>
          <Text style={styles.secText}>Contact</Text>
          <View style={styles.secLine} />
        </View>

        <View style={styles.wc}>
          <TouchableOpacity
            style={styles.ln}
            onPress={() => teacher.phone ? Linking.openURL(`tel:${teacher.phone}`) : Alert.alert('Contact', 'No phone number available')}
            activeOpacity={0.7}
          >
            <Feather name="phone" size={18} color={colors.navy} />
            <Text style={styles.contactText}>
              {teacher.phone || '+91 98765 43210'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.ln}
            onPress={() => Linking.openURL(`mailto:${teacher.email || 'teacher@spark.edu'}`)}
            activeOpacity={0.7}
          >
            <Feather name="mail" size={18} color={colors.navy} />
            <Text style={styles.contactText}>
              {teacher.email || 'teacher@spark.edu'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.ln}
            onPress={handleLogoutPress}
            activeOpacity={0.7}
          >
            <Text style={styles.logoutText}>Log out</Text>
            <Text style={[styles.entChevron, { color: '#B3261E' }]}>›</Text>
          </TouchableOpacity>
        </View>
          </>
        )}
      </ScrollView>

      {/* ----------------------------------------------------
          STUDENTS OVERLAY MODAL (#ovS)
          ---------------------------------------------------- */}
      <Modal
        visible={showStudentsOverlay}
        animationType="slide"
        onRequestClose={() => setShowStudentsOverlay(false)}
      >
        <StudentsScreen onClose={() => setShowStudentsOverlay(false)} />
      </Modal>

      {/* ----------------------------------------------------
          LEAVE OVERLAY MODAL (#ovL)
          ---------------------------------------------------- */}
      <Modal
        visible={showLeaveOverlay}
        animationType="slide"
        onRequestClose={() => setShowLeaveOverlay(false)}
      >
        <View style={[styles.overlayContainer, { paddingTop: insets.top }]}>
          {/* Header (.oh) */}
          <View style={styles.oh}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => setShowLeaveOverlay(false)}
              activeOpacity={0.7}
            >
              <Feather name="chevron-left" size={24} color={colors.navy} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.ohTitle}>Leave</Text>
              <Text style={styles.ohSubtitle}>Apply and track requests</Text>
            </View>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: 60 }]}
            showsVerticalScrollIndicator={false}
          >
            {/* 2 Quota Cards (.lv) */}
            <View style={styles.quotaRow}>
              {/* Casual */}
              <View style={styles.lv}>
                <Text style={styles.lvCount}>
                  {leaveSummary.casualRemaining}
                  <Text style={styles.lvTotal}> / {leaveSummary.casualTotal}</Text>
                </Text>
                <Text style={styles.lvLabel}>Casual left</Text>
                <View style={styles.bar}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${Math.round(
                          (leaveSummary.casualRemaining / leaveSummary.casualTotal) * 100
                        )}%`,
                      },
                    ]}
                  />
                </View>
              </View>

              {/* Sick */}
              <View style={styles.lv}>
                <Text style={styles.lvCount}>
                  {leaveSummary.sickRemaining}
                  <Text style={styles.lvTotal}> / {leaveSummary.sickTotal}</Text>
                </Text>
                <Text style={styles.lvLabel}>Sick left</Text>
                <View style={styles.bar}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${Math.round(
                          (leaveSummary.sickRemaining / leaveSummary.sickTotal) * 100
                        )}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            </View>

            {/* Section: Apply for leave */}
            <View style={styles.sec}>
              <Text style={styles.secText}>Apply for leave</Text>
              <View style={styles.secLine} />
            </View>

            <View style={styles.applyCard}>
              {/* Type pills (.ty) */}
              <View style={styles.ty}>
                {['Casual', 'Sick', 'Other'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.tyBtn,
                      selectedLeaveType === type && styles.tyBtnActive,
                    ]}
                    onPress={() => setSelectedLeaveType(type)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.tyBtnText,
                        selectedLeaveType === type && styles.tyBtnTextActive,
                      ]}
                    >
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* From & To Date inputs */}
              <View style={styles.dateRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>From (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.in}
                    value={fromDateStr}
                    onChangeText={setFromDateStr}
                    placeholder="2026-11-09"
                    placeholderTextColor={colors.mut}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>To (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.in}
                    value={toDateStr}
                    onChangeText={setToDateStr}
                    placeholder="2026-11-10"
                    placeholderTextColor={colors.mut}
                  />
                </View>
              </View>

              {/* Reason textarea */}
              <Text style={styles.fieldLabel}>Reason</Text>
              <TextInput
                style={[styles.in, styles.reasonInput]}
                placeholder="Add a short reason"
                placeholderTextColor={colors.mut}
                multiline
                numberOfLines={3}
                value={leaveReason}
                onChangeText={setLeaveReason}
              />

              {/* Submit button */}
              <TouchableOpacity
                style={[styles.btn, isSubmittingLeave && { opacity: 0.7 }]}
                onPress={handleApplyLeave}
                disabled={isSubmittingLeave}
                activeOpacity={0.85}
              >
                {isSubmittingLeave ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.btnText}>Submit request</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Section: Recent requests */}
            <View style={styles.sec}>
              <Text style={styles.secText}>Recent requests</Text>
              <View style={styles.secLine} />
            </View>

            <View style={styles.wc}>
              {leavesData.length === 0 ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: colors.mut }}>
                    No recent leave requests
                  </Text>
                </View>
              ) : (
                leavesData.map((l, index) => {
                  const tag = getLeaveStatusStyle(l.status);
                  const isLast = index === leavesData.length - 1;

                  return (
                    <View
                      key={l._id || index}
                      style={[styles.ln, !isLast && styles.borderBottom]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.lnTitle}>
                          {l.leaveType
                            ? l.leaveType.charAt(0).toUpperCase() + l.leaveType.slice(1)
                            : 'Casual'}{' '}
                          leave
                        </Text>
                        <Text style={styles.lnSubtitle}>
                          {formatLeaveDates(l.fromDate, l.toDate)}
                        </Text>
                      </View>
                      <View style={[styles.leaveTag, { backgroundColor: tag.bg }]}>
                        <Text style={[styles.leaveTagText, { color: tag.color }]}>
                          {tag.label}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>

      
      {/* ----------------------------------------------------
          CLASS TEACHER PERFORMANCE OVERLAY
          ---------------------------------------------------- */}
      <Modal
        visible={showClassAnalyticsOverlay}
        animationType="slide"
        onRequestClose={() => setShowClassAnalyticsOverlay(false)}
      >
        <ClassTeacherViewScreen onClose={() => setShowClassAnalyticsOverlay(false)} />
      </Modal>

      {/* ----------------------------------------------------
          ACADEMIC CALENDAR OVERLAY
          ---------------------------------------------------- */}
      <Modal
        visible={showCalendarOverlay}
        animationType="slide"
        onRequestClose={() => setShowCalendarOverlay(false)}
      >
        <CalendarScreen onClose={() => setShowCalendarOverlay(false)} />
      </Modal>

      {/* Confirmation Dialog for Logout */}
      <ConfirmDialog
        visible={showLogoutConfirm}
        title="Log Out"
        message="Are you sure you want to log out of Sparkology Teacher App?"
        confirmText="Log Out"
        cancelText="Cancel"
        isDestructive={true}
        onConfirm={() => {
          setShowLogoutConfirm(false);
          if (onLogout) {
            onLogout();
          }
        }}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },

  // 1. Profile Card (.pc)
  pc: {
    borderRadius: 26,
    padding: 20,
    alignItems: 'center',
    ...shadows.md,
  },
  pav: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: '#4C7DFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.soft,
  },
  pavText: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.navy,
    fontFamily: typography.fontFamily.extraBold,
  },
  teacherName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginTop: 12,
    fontFamily: typography.fontFamily.extraBold,
  },
  designation: {
    fontSize: 13,
    color: '#E3EAFB',
    marginTop: 2,
    fontFamily: typography.fontFamily.regular,
  },
  schoolPill: {
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
  },
  schoolPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    fontFamily: typography.fontFamily.bold,
  },
  pst: {
    flexDirection: 'row',
    marginTop: 20,
    width: '100%',
  },
  pstItem: {
    flex: 1,
    alignItems: 'center',
  },
  pstNum: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    fontFamily: typography.fontFamily.extraBold,
  },
  pstLabel: {
    fontSize: 12,
    color: '#E3EAFB',
    marginTop: 2,
    textAlign: 'center',
    fontFamily: typography.fontFamily.regular,
  },

  // Section divider (.sec)
  sec: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 22,
    marginBottom: 8,
  },
  secText: {
    fontSize: 13,
    color: colors.mut,
    fontWeight: '700',
    fontFamily: typography.fontFamily.bold,
  },
  secLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#D5DCEC',
  },

  // White Card Container (.wc)
  wc: {
    backgroundColor: '#fff',
    borderRadius: 18,
    overflow: 'hidden',
    ...shadows.sm,
  },
  ln: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1F7',
  },
  lnTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.navy,
    fontFamily: typography.fontFamily.bold,
  },
  lnSubtitle: {
    fontSize: 12,
    color: colors.mut,
    marginTop: 2,
    fontFamily: typography.fontFamily.regular,
  },
  classTeacherTag: {
    backgroundColor: colors.soft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  classTeacherTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.blue,
    fontFamily: typography.fontFamily.bold,
  },

  // Quick access row (.ent)
  ent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    marginTop: 8,
    ...shadows.sm,
  },
  ib: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.navy,
    fontFamily: typography.fontFamily.bold,
  },
  entSubtitle: {
    fontSize: 12,
    color: colors.mut,
    marginTop: 2,
    fontFamily: typography.fontFamily.regular,
  },
  entChevron: {
    color: colors.mut,
    fontSize: 22,
    fontWeight: '400',
  },
  contactText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.navy,
    fontFamily: typography.fontFamily.bold,
  },
  logoutText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#B3261E',
    fontFamily: typography.fontFamily.bold,
  },

  // Leave Overlay (#ovL)
  overlayContainer: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  oh: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  ohTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.navy,
    fontFamily: typography.fontFamily.extraBold,
  },
  ohSubtitle: {
    fontSize: 12,
    color: colors.mut,
    fontFamily: typography.fontFamily.regular,
    marginTop: 2,
  },
  quotaRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  lv: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    ...shadows.sm,
  },
  lvCount: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.navy,
    fontFamily: typography.fontFamily.extraBold,
  },
  lvTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.mut,
  },
  lvLabel: {
    fontSize: 12,
    color: colors.mut,
    marginTop: 2,
    fontFamily: typography.fontFamily.regular,
  },
  bar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.soft,
    marginTop: 10,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.blue,
  },

  // Apply leave form (.wc)
  applyCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    ...shadows.sm,
  },
  ty: {
    flexDirection: 'row',
    backgroundColor: '#EEF1F7',
    borderRadius: 14,
    padding: 3,
    gap: 4,
  },
  tyBtn: {
    flex: 1,
    height: 40,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tyBtnActive: {
    backgroundColor: colors.navy,
  },
  tyBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.mut,
    fontFamily: typography.fontFamily.bold,
  },
  tyBtnTextActive: {
    color: '#fff',
  },
  dateRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.mut,
    marginTop: 12,
    marginBottom: 6,
    fontFamily: typography.fontFamily.bold,
  },
  in: {
    height: 46,
    borderWidth: 1,
    borderColor: '#D5DCEC',
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 14,
    color: colors.navy,
    backgroundColor: '#fff',
    fontFamily: typography.fontFamily.regular,
  },
  reasonInput: {
    height: 76,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  btn: {
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    ...shadows.md,
  },
  btnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    fontFamily: typography.fontFamily.extraBold,
  },
  leaveTag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  leaveTagText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: typography.fontFamily.bold,
  },
  centerLoading: {
    minHeight: 380,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.muted,
    fontFamily: typography.fontFamily.semiBold,
  },
});
