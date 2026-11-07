import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ApiService from '../services/api';
import { colors, typography, spacing, radius, shadows } from '../theme/colors';
import Avatar from '../components/Avatar';
import Tag from '../components/Tag';

/**
 * ClassTeacherViewScreen (All-Subject Attendance & Performance Overview)
 * Class Teacher Dedicated View Screen
 * Features:
 * - Server-authorized (class.teacherId === req.user._id)
 * - Overall class attendance % and low attendance count (< 75%)
 * - Student list with attendance % and homework submission rates
 * - Detailed modal with subject-wise breakdown & 50-session timeline
 */
export default function ClassTeacherViewScreen({ onClose }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [classInfo, setClassInfo] = useState(null);
  const [students, setStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Student breakdown modal state
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [studentBreakdown, setStudentBreakdown] = useState(null);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const res = await ApiService.getClassTeacherAnalytics();
      if (res.success && res.data) {
        setClassInfo(res.data.classInfo);
        setStudents(res.data.students || []);
      }
    } catch (err) {
      console.error('Error loading class analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const openStudentDetail = async (student) => {
    setSelectedStudent(student);
    try {
      setBreakdownLoading(true);
      const res = await ApiService.getClassStudentAttendance(student._id);
      if (res.success && res.data) {
        setStudentBreakdown(res.data);
      }
    } catch (err) {
      console.error('Error fetching student breakdown:', err);
    } finally {
      setBreakdownLoading(false);
    }
  };

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.rollNumber && String(s.rollNumber).toLowerCase().includes(q))
    );
  }, [students, searchQuery]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <Feather name="chevron-left" size={24} color={colors.navy} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Class Teacher Overview</Text>
          <Text style={styles.headerSubtitle}>
            {classInfo?.fullName || 'Grade 10 - A'} · Performance & Attendance
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={colors.blue} />
          <Text style={styles.loadingText}>Loading class analytics...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 60 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Class Summary Metrics */}
          <View style={styles.metricsRow}>
            <View style={[styles.metricCard, { borderLeftColor: colors.blue }]}>
              <Text style={styles.metricValue}>{classInfo?.averageAttendance || 0}%</Text>
              <Text style={styles.metricLabel}>Class Avg. Attendance</Text>
            </View>

            <View
              style={[
                styles.metricCard,
                { borderLeftColor: classInfo?.lowAttendanceCount > 0 ? colors.amber : colors.green },
              ]}
            >
              <Text style={styles.metricValue}>{classInfo?.lowAttendanceCount || 0}</Text>
              <Text style={styles.metricLabel}>Low Attendance (&lt;75%)</Text>
            </View>

            <View style={[styles.metricCard, { borderLeftColor: colors.navy }]}>
              <Text style={styles.metricValue}>{classInfo?.studentCount || students.length}</Text>
              <Text style={styles.metricLabel}>Total Students</Text>
            </View>
          </View>

          {/* Search Box */}
          <View style={styles.searchContainer}>
            <Feather name="search" size={16} color={colors.mut} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by student name or roll number..."
              placeholderTextColor={colors.mut}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Feather name="x" size={16} color={colors.mut} />
              </TouchableOpacity>
            )}
          </View>

          {/* Section Title */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Students Performance</Text>
            <Text style={styles.sectionBadge}>{filteredStudents.length} Students</Text>
          </View>

          {/* Student Cards List */}
          {filteredStudents.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="user-x" size={32} color={colors.mut} />
              <Text style={styles.emptyText}>No students matching "{searchQuery}"</Text>
            </View>
          ) : (
            filteredStudents.map((student) => {
              const isLow = student.isLowAttendance;
              return (
                <TouchableOpacity
                  key={student._id}
                  style={styles.studentCard}
                  onPress={() => openStudentDetail(student)}
                  activeOpacity={0.8}
                >
                  <View style={styles.studentCardTop}>
                    <Avatar
                      name={student.name}
                      size={40}
                      backgroundColor={colors.soft}
                      textColor={colors.navy}
                    />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.studentName}>{student.name}</Text>
                      <Text style={styles.studentRoll}>
                        Roll {student.rollNumber || '—'} · Adm {student.admissionNumber || '—'}
                      </Text>
                    </View>
                    <View style={styles.attendancePill}>
                      <Text
                        style={[
                          styles.attendancePct,
                          { color: isLow ? colors.amber : colors.green },
                        ]}
                      >
                        {student.overallAttendance}%
                      </Text>
                      {isLow && (
                        <Tag variant="warning" size="small">
                          Low
                        </Tag>
                      )}
                    </View>
                  </View>

                  {/* Quick Progress Bar */}
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressBar,
                        {
                          width: `${Math.min(100, student.overallAttendance)}%`,
                          backgroundColor: isLow ? colors.amber : colors.green,
                        },
                      ]}
                    />
                  </View>

                  {/* Secondary Metrics */}
                  <View style={styles.studentCardFooter}>
                    <Text style={styles.footerMetric}>
                      Sessions: <Text style={styles.footerBold}>{student.presentSessions}/{student.totalSessions}</Text>
                    </Text>
                    <Text style={styles.footerMetric}>
                      Homework:{' '}
                      <Text style={styles.footerBold}>{student.homeworkSubmissionRate}%</Text>
                    </Text>
                    <Feather name="chevron-right" size={16} color={colors.mut} />
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {/* ----------------------------------------------------
          STUDENT SUBJECT BREAKDOWN & TIMELINE MODAL
          ---------------------------------------------------- */}
      <Modal
        visible={!!selectedStudent}
        animationType="slide"
        onRequestClose={() => setSelectedStudent(null)}
      >
        <View style={[styles.container, { paddingTop: insets.top }]}>
          {/* Modal Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => setSelectedStudent(null)}
              activeOpacity={0.7}
            >
              <Feather name="x" size={24} color={colors.navy} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>{selectedStudent?.name}</Text>
              <Text style={styles.headerSubtitle}>
                Roll {selectedStudent?.rollNumber} · Subject Breakdown & History
              </Text>
            </View>
          </View>

          {breakdownLoading ? (
            <View style={styles.centerLoading}>
              <ActivityIndicator size="large" color={colors.blue} />
              <Text style={styles.loadingText}>Fetching attendance breakdown...</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={[styles.scrollContent, { paddingBottom: 60 }]}
              showsVerticalScrollIndicator={false}
            >
              {/* Overall Summary Card */}
              <View style={styles.detailSummaryCard}>
                <View style={styles.detailSummaryLeft}>
                  <Text style={styles.detailSummaryTitle}>Overall Class Attendance</Text>
                  <Text style={styles.detailSummarySubtitle}>
                    {studentBreakdown?.student?.presentSessions || 0} of{' '}
                    {studentBreakdown?.student?.totalSessions || 0} total sessions attended
                  </Text>
                </View>
                <View
                  style={[
                    styles.detailPctCircle,
                    {
                      borderColor:
                        studentBreakdown?.student?.isLowAttendance ? colors.amber : colors.green,
                    },
                  ]}
                >
                  <Text style={styles.detailPctText}>
                    {studentBreakdown?.student?.overallAttendance || 0}%
                  </Text>
                </View>
              </View>

              {/* Subject Breakdown Cards */}
              <Text style={styles.detailSectionTitle}>Subject-Wise Attendance</Text>
              {studentBreakdown?.subjects?.map((sub) => (
                <View key={sub.code || sub.name} style={styles.subjectRowCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.subjectRowName}>{sub.name}</Text>
                    <Text style={styles.subjectRowTeacher}>
                      {sub.teacherName || 'Subject Teacher'} · {sub.present}/{sub.total} sessions
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.subjectRowPct,
                      { color: sub.percentage < 75 ? colors.amber : colors.green },
                    ]}
                  >
                    {sub.percentage}%
                  </Text>
                </View>
              ))}

              {/* Attendance Sessions Timeline */}
              <Text style={[styles.detailSectionTitle, { marginTop: 24 }]}>
                Recent Sessions History ({studentBreakdown?.timeline?.length || 0})
              </Text>
              {studentBreakdown?.timeline?.length === 0 ? (
                <Text style={styles.noHistoryText}>No recorded attendance sessions found</Text>
              ) : (
                studentBreakdown?.timeline?.map((item) => {
                  const isPresent = item.isPresent;
                  const isLate = item.status === 'L' || item.status === 'late';
                  return (
                    <View key={item._id} style={styles.timelineRow}>
                      <View
                        style={[
                          styles.timelineDot,
                          {
                            backgroundColor: isPresent
                              ? isLate
                                ? colors.amber
                                : colors.green
                              : colors.red,
                          },
                        ]}
                      />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.timelineSubject}>{item.subjectName}</Text>
                        <Text style={styles.timelineDate}>
                          {item.date} · {item.period} ({item.time || 'Scheduled'})
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.timelineBadge,
                          {
                            backgroundColor: isPresent
                              ? isLate
                                ? '#FEF3C7'
                                : '#DDF3E6'
                              : '#FDE3E0',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.timelineBadgeText,
                            {
                              color: isPresent
                                ? isLate
                                  ? colors.amber
                                  : colors.green
                                : colors.red,
                            },
                          ]}
                        >
                          {isPresent ? (isLate ? 'Late' : 'Present') : 'Absent'}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: typography.bold,
    color: colors.navy,
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: typography.medium,
    color: colors.mut,
    marginTop: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    fontFamily: typography.medium,
    color: colors.mut,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: radius.md,
    padding: 12,
    borderLeftWidth: 4,
    ...shadows.card,
  },
  metricValue: {
    fontSize: 20,
    fontFamily: typography.extraBold,
    color: colors.navy,
  },
  metricLabel: {
    fontSize: 10,
    fontFamily: typography.medium,
    color: colors.mut,
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 20,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: typography.medium,
    color: colors.navy,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: typography.bold,
    color: colors.navy,
  },
  sectionBadge: {
    fontSize: 12,
    fontFamily: typography.medium,
    color: colors.mut,
  },
  studentCard: {
    backgroundColor: '#fff',
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadows.card,
  },
  studentCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  studentName: {
    fontSize: 14,
    fontFamily: typography.semiBold,
    color: colors.navy,
  },
  studentRoll: {
    fontSize: 11,
    fontFamily: typography.medium,
    color: colors.mut,
    marginTop: 2,
  },
  attendancePill: {
    alignItems: 'flex-end',
    gap: 4,
  },
  attendancePct: {
    fontSize: 16,
    fontFamily: typography.extraBold,
  },
  progressTrack: {
    height: 6,
    backgroundColor: colors.soft,
    borderRadius: 3,
    marginVertical: 10,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  studentCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  footerMetric: {
    fontSize: 11,
    fontFamily: typography.medium,
    color: colors.mut,
  },
  footerBold: {
    fontFamily: typography.bold,
    color: colors.navy,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: typography.medium,
    color: colors.mut,
    marginTop: 8,
  },
  detailSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    padding: 18,
    marginBottom: 20,
    ...shadows.card,
  },
  detailSummaryLeft: {
    flex: 1,
    paddingRight: 12,
  },
  detailSummaryTitle: {
    fontSize: 15,
    fontFamily: typography.bold,
    color: colors.navy,
  },
  detailSummarySubtitle: {
    fontSize: 12,
    fontFamily: typography.medium,
    color: colors.mut,
    marginTop: 4,
  },
  detailPctCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailPctText: {
    fontSize: 16,
    fontFamily: typography.extraBold,
    color: colors.navy,
  },
  detailSectionTitle: {
    fontSize: 14,
    fontFamily: typography.bold,
    color: colors.navy,
    marginBottom: 10,
  },
  subjectRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.line,
  },
  subjectRowName: {
    fontSize: 13,
    fontFamily: typography.semiBold,
    color: colors.navy,
  },
  subjectRowTeacher: {
    fontSize: 11,
    fontFamily: typography.medium,
    color: colors.mut,
    marginTop: 2,
  },
  subjectRowPct: {
    fontSize: 15,
    fontFamily: typography.extraBold,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  timelineSubject: {
    fontSize: 13,
    fontFamily: typography.semiBold,
    color: colors.navy,
  },
  timelineDate: {
    fontSize: 11,
    fontFamily: typography.medium,
    color: colors.mut,
    marginTop: 2,
  },
  timelineBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  timelineBadgeText: {
    fontSize: 10,
    fontFamily: typography.bold,
  },
  noHistoryText: {
    fontSize: 12,
    fontFamily: typography.medium,
    color: colors.mut,
    paddingVertical: 12,
  },
});

