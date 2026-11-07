import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import ApiService from '../services/api';
import { colors, typography, spacing, radius, shadows } from '../theme/colors';
import Avatar from '../components/Avatar';

/**
 * StudentsScreen (Students Overlay)
 * Authority: docs/Teacher_App_Design.html (#ovS)
 * Features:
 * - Header with back button, Class title & student count
 * - Search bar (.srch) for filtering by name or roll number
 * - Student list (.stu) showing avatar, name, roll, attendance %
 * - "Low" tag if attendance < 80%
 * - Today's status dot (green: present today, red: absent today)
 * - Row expand actions: Call parent (tel:) and Message (sms:) (Decision 9)
 * - Legend: Present today vs Absent today
 * - Real API: GET /api/teachers/my-class/students
 */
export default function StudentsScreen({ onClose }) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [classInfo, setClassInfo] = useState(null);
  const [students, setStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedStudentId, setExpandedStudentId] = useState(null);

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    try {
      setLoading(true);
      const res = await ApiService.getMyClassStudents();
      if (res.success && res.data) {
        if (res.data.classInfo) {
          setClassInfo(res.data.classInfo);
        }
        if (res.data.students) {
          setStudents(res.data.students);
        }
      }
    } catch (err) {
      console.error('Error fetching students:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (onClose) {
      onClose();
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  // Filter students by name or roll number
  const filteredStudents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.rollNumber && s.rollNumber.toLowerCase().includes(q))
    );
  }, [students, searchQuery]);

  const toggleExpand = (id) => {
    setExpandedStudentId((prev) => (prev === id ? null : id));
  };

  const handleCallParent = (phone, name) => {
    if (!phone) {
      Alert.alert('No Phone', `No contact number found for ${name}'s parent.`);
      return;
    }
    const cleanPhone = phone.replace(/\s+/g, '');
    Linking.openURL(`tel:${cleanPhone}`).catch((err) => {
      Alert.alert('Error', 'Unable to initiate call: ' + err.message);
    });
  };

  const handleMessageParent = (phone, name) => {
    if (!phone) {
      Alert.alert('No Phone', `No contact number found for ${name}'s parent.`);
      return;
    }
    const cleanPhone = phone.replace(/\s+/g, '');
    Linking.openURL(`sms:${cleanPhone}`).catch((err) => {
      Alert.alert('Error', 'Unable to open SMS: ' + err.message);
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ----------------------------------------------------
          Header (.oh)
          ---------------------------------------------------- */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <Feather name="chevron-left" size={24} color={colors.navy} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Students</Text>
          <Text style={styles.headerSubtitle}>
            {loading && !classInfo
              ? 'Loading roster...'
              : `${classInfo?.fullName || 'Class'} · ${classInfo?.studentCount ?? students.length} students`}
          </Text>
        </View>
      </View>

      {/* ----------------------------------------------------
          Search Bar (.srch)
          ---------------------------------------------------- */}
      <View style={styles.searchBar}>
        <Feather name="search" size={18} color={colors.navy} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or roll no."
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

      {/* ----------------------------------------------------
          Student List (.wc #stuList)
          ---------------------------------------------------- */}
            {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={colors.blue} />
          <Text style={styles.loadingText}>Loading students...</Text>
        </View>
      ) : (
        <FlatList
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 110 }]}
          showsVerticalScrollIndicator={false}
          data={filteredStudents}
          keyExtractor={(item, index) => item._id || String(index)}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No student found</Text>
            </View>
          }
          renderItem={({ item: s, index }) => {
            const isExpanded = expandedStudentId === s._id;
            const isLast = index === filteredStudents.length - 1;

            return (
              <View
                style={[
                  styles.studentRowContainer,
                  isExpanded && styles.studentRowExpanded,
                  !isLast && styles.borderBottom,
                ]}
              >
                <TouchableOpacity
                  style={styles.studentRow}
                  onPress={() => toggleExpand(s._id)}
                  activeOpacity={0.8}
                >
                  <Avatar name={s.name} size={40} />

                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>{s.name}</Text>
                    <Text style={styles.studentSubtitle}>
                      Roll {s.rollNumber || String(index + 1).padStart(2, '0')} · {s.attendancePct}% attendance
                    </Text>
                  </View>

                  {s.isLow && (
                    <View style={styles.lowTag}>
                      <Text style={styles.lowTagText}>Low</Text>
                    </View>
                  )}

                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor: s.presentToday
                          ? colors.green
                          : colors.red,
                      },
                    ]}
                  />
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => handleCallParent(s.parentPhone, s.name)}
                      activeOpacity={0.7}
                    >
                      <Feather name="phone" size={14} color={colors.blue} />
                      <Text style={styles.actionBtnText}>Call parent</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => handleMessageParent(s.parentPhone, s.name)}
                      activeOpacity={0.7}
                    >
                      <Feather name="message-square" size={14} color={colors.blue} />
                      <Text style={styles.actionBtnText}>Message</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          }}
          ListFooterComponent={
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.green }]} />
                <Text style={styles.legendText}>Present today</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.red }]} />
                <Text style={styles.legendText}>Absent today</Text>
              </View>
            </View>
          }
        />
      )}
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
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.navy,
    fontFamily: typography.fontFamily.extraBold,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.mut,
    fontFamily: typography.fontFamily.regular,
    marginTop: 2,
  },
  searchBar: {
    marginHorizontal: 16,
    marginTop: 10,
    height: 48,
    backgroundColor: '#fff',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
    ...shadows.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.navy,
    fontFamily: typography.fontFamily.regular,
  },
  scroll: {
    flex: 1,
    marginTop: 12,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  listCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    overflow: 'hidden',
    ...shadows.sm,
  },
  studentRowContainer: {
    backgroundColor: '#fff',
  },
  studentRowExpanded: {
    backgroundColor: '#FAFBFE',
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1F7',
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.navy,
    fontFamily: typography.fontFamily.bold,
  },
  studentSubtitle: {
    fontSize: 12,
    color: colors.mut,
    marginTop: 2,
    fontFamily: typography.fontFamily.regular,
  },
  lowTag: {
    backgroundColor: '#FDE3E0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 8,
  },
  lowTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9B1C1C',
    fontFamily: typography.fontFamily.bold,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.soft,
  },
  actionBtnText: {
    color: colors.blue,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: typography.fontFamily.bold,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 14,
    paddingHorizontal: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: colors.mut,
    fontWeight: '600',
    fontFamily: typography.fontFamily.semiBold,
  },
  loadingBox: {
    padding: 40,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: colors.mut,
    fontFamily: typography.fontFamily.regular,
  },
  emptyBox: {
    padding: 30,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: colors.mut,
    fontFamily: typography.fontFamily.regular,
  },
});
