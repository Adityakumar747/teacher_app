import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  Switch,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
// Dynamic require on native only to prevent web bundle crash with expo-image-picker
import ApiService from '../services/api';
import { colors, typography, spacing, radius, shadows } from '../theme/colors';
import Avatar from '../components/Avatar';
import ConfirmDialog from '../components/ConfirmDialog';
import SuccessToast from '../components/SuccessToast';

/**
 * AssignmentsScreen (Homework & Submissions Review)
 * Authority: docs/Teacher_App_Design.html (#asg)
 * Features:
 * - Clean title "Assignments"
 * - Class dropdown (.dd) with student counts (.ddv)
 * - Tabs: Active | Past (Drafts removed per Decision 11)
 * - "New homework for {class}" navy card (.cr) with Upload file, Take photo, Gallery actions
 * - Homework cards (.card) with status tags (Due today, N to review, N days left), progress bar, cap
 * - Card tap opens Submissions Review Screen (Decision 11: Submitted, Pending, Late, Graded tabs)
 * - Grading Drawer: marks input, feedback, request resubmission, save via PATCH API
 * - Signed Cloudinary upload via POST /api/uploads/sign with server fallback
 * - Real API data: zero hardcoding
 */
export default function AssignmentsScreen() {
  const insets = useSafeAreaInsets();

  // Tab State: 'Active' | 'Past'
  const [activeTab, setActiveTab] = useState('Active');

  // Classes & Selection
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [showClassDropdown, setShowClassDropdown] = useState(false);

  // Assignments List State
  const [assignments, setAssignments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Create Homework Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState(null);
  const [dueDaysOffset, setDueDaysOffset] = useState(3); // default 3 days
  const [customDueDate, setCustomDueDate] = useState('');
  const [totalMarksInput, setTotalMarksInput] = useState('50');
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [isCreating, setIsCreating] = useState(false);

  // Submissions Review Modal State
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewAssignment, setReviewAssignment] = useState(null);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionsData, setSubmissionsData] = useState(null);
  const [submissionFilterTab, setSubmissionFilterTab] = useState('all'); // 'all' | 'submitted' | 'pending' | 'late' | 'graded'

  // Grading Drawer State
  const [showGradingDrawer, setShowGradingDrawer] = useState(false);
  const [gradingStudent, setGradingStudent] = useState(null);
  const [gradeMarks, setGradeMarks] = useState('');
  const [gradeFeedback, setGradeFeedback] = useState('');
  const [gradeResubmit, setGradeResubmit] = useState(false);
  const [isSavingGrade, setIsSavingGrade] = useState(false);

  // Delete Homework State
  const [deleteTargetHw, setDeleteTargetHw] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toast Feedback Animation State
  const [toastInfo, setToastInfo] = useState({
    visible: false,
    title: '',
    subtitle: '',
    variant: 'success',
  });

  // ----------------------------------------------------
  // Initial Load: Classes
  // ----------------------------------------------------
  useEffect(() => {
    loadClasses();
  }, []);

  const loadClasses = async () => {
    try {
      setIsLoading(true);
      const res = await ApiService.getTeacherClasses();
      if (res.success && res.data && res.data.length > 0) {
        setClasses(res.data);
        const initial = res.data[0];
        setSelectedClass(initial);
        if (initial.subjects && initial.subjects.length > 0) {
          setSelectedSubjectId(initial.subjects[0]._id);
        }
      }
    } catch (err) {
      console.error('Error fetching teacher classes:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // ----------------------------------------------------
  // Fetch Assignments for Selected Class (BUG-08 fix: eliminate duplicate call)
  // ----------------------------------------------------
  const prevClassIdRef = useRef(null);

  const loadAssignments = useCallback(async (forcedClassId = null) => {
    const targetClassId = forcedClassId || selectedClass?._id;
    if (!targetClassId) return;
    try {
      setIsRefreshing(true);
      const res = await ApiService.getAssignments({ classId: targetClassId });
      if (res.success && res.data) {
        setAssignments(res.data);
      }
    } catch (err) {
      console.error('Error loading assignments:', err);
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  }, [selectedClass?._id]);

  useEffect(() => {
    if (selectedClass?._id && prevClassIdRef.current !== selectedClass._id) {
      prevClassIdRef.current = selectedClass._id;
      loadAssignments(selectedClass._id);
    }
  }, [selectedClass?._id, loadAssignments]);

  // Filter assignments by Active vs Past tab (BUG-09 fix: due until 23:59:59 end-of-day)
  const filteredAssignments = useMemo(() => {
    const now = new Date();

    return assignments.filter((hw) => {
      let dueTimestamp;
      if (hw.dueDate && hw.dueDate.length === 10) {
        const timePart = hw.dueTime ? `${hw.dueTime}:59` : '23:59:59';
        dueTimestamp = new Date(`${hw.dueDate}T${timePart}`);
      } else {
        dueTimestamp = new Date(hw.dueDate);
      }

      const isDueFutureOrToday = dueTimestamp >= now;

      if (activeTab === 'Active') {
        return isDueFutureOrToday && hw.status !== 'completed';
      } else {
        return !isDueFutureOrToday || hw.status === 'completed';
      }
    });
  }, [assignments, activeTab]);

  // ----------------------------------------------------
  // Helper: Format Due Tag and Subtitle
  // ----------------------------------------------------
  const getHomeworkTagInfo = (hw) => {
    // 1. If has un-reviewed submissions (submitted or late not yet graded)
    const toReview = (hw.submittedCount || 0) + (hw.lateCount || 0);
    if (toReview > 0) {
      return {
        text: `${toReview} to review`,
        bg: '#FDF0D0',
        color: '#7A4B00',
      };
    }

    // 2. Check due date relative to today
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const due = new Date(hw.dueDate);
    due.setHours(0, 0, 0, 0);

    const diffDays = Math.round((due - now) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return { text: 'Due today', bg: '#FDE3E0', color: '#9B1C1C' };
    }
    if (diffDays > 0) {
      return {
        text: `${diffDays} day${diffDays > 1 ? 's' : ''} left`,
        bg: colors.soft,
        color: colors.blue,
      };
    }

    return { text: 'Completed', bg: '#DDF3E6', color: colors.green };
  };

  const formatDueDate = (dateString) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const cmp = new Date(dateString);
    cmp.setHours(0, 0, 0, 0);

    if (cmp.getTime() === now.getTime()) {
      return 'Due today';
    }

    return `Due ${d.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })}`;
  };

  // ----------------------------------------------------
  // Universal Document, Camera & Gallery Picker (Web & Native)
  // ----------------------------------------------------
  const pickUniversalFile = (options = { type: 'document' }) => {
    return new Promise(async (resolve, reject) => {
      try {
        if (Platform.OS === 'web' && typeof document !== 'undefined') {
          const input = document.createElement('input');
          input.type = 'file';
          if (options.type === 'camera') {
            input.accept = 'image/*';
            input.setAttribute('capture', 'environment');
          } else if (options.type === 'gallery') {
            input.accept = 'image/*';
          } else {
            input.accept = '.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,image/*,application/pdf';
          }

          input.onchange = (e) => {
            const file = e.target?.files?.[0];
            if (file) {
              resolve({
                name: file.name,
                uri: URL.createObjectURL(file),
                size: file.size,
                mimeType: file.type || (options.type === 'document' ? 'application/pdf' : 'image/jpeg'),
                rawFile: file,
              });
            } else {
              resolve(null);
            }
          };

          input.onerror = (err) => reject(err);
          input.click();
        } else if (options.type === 'camera') {
          // Native camera launch using expo-image-picker
          const ImagePicker = Platform.OS !== 'web' ? require('expo-image-picker') : null;
          if (!ImagePicker) {
            resolve(null);
            return;
          }
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission Required', 'Camera permission is required to capture assignment photos.');
            resolve(null);
            return;
          }

          const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            quality: 0.8,
          });

          if (!result.canceled && result.assets && result.assets.length > 0) {
            const asset = result.assets[0];
            resolve({
              name: asset.fileName || `camera_${Date.now()}.jpg`,
              uri: asset.uri,
              size: asset.fileSize || 0,
              mimeType: asset.mimeType || 'image/jpeg',
            });
          } else {
            resolve(null);
          }
        } else if (options.type === 'gallery') {
          // Native gallery picker using expo-image-picker
          const ImagePicker = Platform.OS !== 'web' ? require('expo-image-picker') : null;
          if (!ImagePicker) {
            resolve(null);
            return;
          }
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission Required', 'Photo library permission is required to select photos.');
            resolve(null);
            return;
          }

          const result = await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true,
            quality: 0.8,
          });

          if (!result.canceled && result.assets && result.assets.length > 0) {
            const asset = result.assets[0];
            resolve({
              name: asset.fileName || `gallery_${Date.now()}.jpg`,
              uri: asset.uri,
              size: asset.fileSize || 0,
              mimeType: asset.mimeType || 'image/jpeg',
            });
          } else {
            resolve(null);
          }
        } else {
          // Native document picker for documents/PDFs
          const result = await DocumentPicker.getDocumentAsync({
            type: ['*/*'],
            copyToCacheDirectory: true,
            multiple: false,
          });

          if (!result.canceled && result.assets && result.assets.length > 0) {
            const file = result.assets[0];
            resolve({
              name: file.name,
              uri: file.uri,
              size: file.size,
              mimeType: file.mimeType || 'application/pdf',
            });
          } else {
            resolve(null);
          }
        }
      } catch (err) {
        reject(err);
      }
    });
  };

  const handlePickDocument = async () => {
    try {
      const file = await pickUniversalFile({ type: 'document' });
      if (file) {
        setAttachedFiles((prev) => [...prev, file]);
        setShowCreateModal(true);
      }
    } catch (err) {
      console.error('File pick error:', err);
      Alert.alert('File Selection', 'Unable to pick file: ' + err.message);
    }
  };

  const handleTakePhoto = async () => {
    try {
      const file = await pickUniversalFile({ type: 'camera' });
      if (file) {
        setAttachedFiles((prev) => [...prev, file]);
        setShowCreateModal(true);
      }
    } catch (err) {
      console.error('Camera error:', err);
      Alert.alert('Camera Error', 'Could not open camera: ' + err.message);
    }
  };

  const handlePickGallery = async () => {
    try {
      const file = await pickUniversalFile({ type: 'gallery' });
      if (file) {
        setAttachedFiles((prev) => [...prev, file]);
        setShowCreateModal(true);
      }
    } catch (err) {
      console.error('Gallery error:', err);
      Alert.alert('Gallery Error', 'Could not open gallery: ' + err.message);
    }
  };

  const removeAttachedFile = (idx) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  // ----------------------------------------------------
  // Create Homework Submission
  // ----------------------------------------------------
  const handleCreateHomework = async () => {
    if (!newTitle.trim()) {
      Alert.alert('Required', 'Please enter a homework title.');
      return;
    }
    if (!selectedClass?._id) {
      Alert.alert('Required', 'Please select a class.');
      return;
    }

    const subjectId =
      selectedSubjectId ||
      (selectedClass.subjects && selectedClass.subjects[0]?._id);

    if (!subjectId) {
      Alert.alert('Required', 'Please assign a subject to this class.');
      return;
    }

    try {
      setIsCreating(true);

      // Compute due date
      let dueDateObj = new Date();
      if (customDueDate) {
        dueDateObj = new Date(customDueDate);
      } else {
        dueDateObj.setDate(dueDateObj.getDate() + dueDaysOffset);
      }
      let dueDateStr;
      try {
        dueDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(dueDateObj);
      } catch {
        dueDateStr = dueDateObj.toISOString().split('T')[0];
      }

      // Step 1: Upload attached files to Cloudinary if configured
      const processedAttachments = [];
      for (const file of attachedFiles) {
        try {
          const ext = file.name.split('.').pop().toLowerCase();
          const signRes = await ApiService.getUploadSignature(ext);
          if (signRes.success && signRes.data?.uploadUrl && signRes.data?.isConfigured) {
            // Direct signed Cloudinary upload
            const formData = new FormData();
            if (file.rawFile) {
              formData.append('file', file.rawFile);
            } else if (Platform.OS === 'web' && file.uri) {
              const fileBlob = await (await fetch(file.uri)).blob();
              formData.append('file', fileBlob, file.name || 'upload.bin');
            } else {
              formData.append('file', {
                uri: file.uri,
                name: file.name,
                type: file.mimeType || 'application/octet-stream',
              });
            }
            formData.append('api_key', signRes.data.apiKey);
            formData.append('timestamp', String(signRes.data.timestamp));
            formData.append('signature', signRes.data.signature);
            formData.append('folder', signRes.data.folder);

            const uploadRes = await fetch(signRes.data.uploadUrl, {
              method: 'POST',
              body: formData,
            });
            const uploadJson = await uploadRes.json();
            if (uploadJson.secure_url) {
              processedAttachments.push({
                name: file.name,
                url: uploadJson.secure_url,
                type: file.mimeType?.startsWith('image') ? 'image' : 'pdf',
                size: file.size,
                cloudinaryPublicId: uploadJson.public_id,
              });
            }
          }
        } catch (uploadErr) {
          console.warn('Cloudinary upload warning:', uploadErr);
        }
      }

      // Step 2: Create Assignment record
      const payload = {
        title: newTitle.trim(),
        description: newDescription.trim() || 'Please complete and submit before due date.',
        classId: selectedClass._id,
        subjectId: subjectId,
        dueDate: dueDateStr,
        dueTime: '23:59',
        totalMarks: Number(totalMarksInput) || 50,
        points: Number(totalMarksInput) || 50,
        attachments: processedAttachments,
      };

      let res;
      if (attachedFiles.length > 0 && processedAttachments.length === 0) {
        // Fallback to backend multipart handler
        res = await ApiService.createAssignmentWithFiles(payload, attachedFiles);
      } else {
        res = await ApiService.createAssignment(payload);
      }

      if (res.success) {
        const assignedTitle = newTitle.trim();
        const assignedClass = selectedClass?.name || 'Class';
        setShowCreateModal(false);
        setNewTitle('');
        setNewDescription('');
        setAttachedFiles([]);
        loadAssignments();

        setToastInfo({
          visible: true,
          title: 'Homework Assigned!',
          subtitle: `"${assignedTitle}" assigned to ${assignedClass}`,
          variant: 'success',
        });
      } else {
        Alert.alert('Error', res.error || 'Failed to create homework.');
      }
    } catch (err) {
      console.error('Create homework error:', err);
      Alert.alert('Error', err.message || 'Unable to create homework.');
    } finally {
      setIsCreating(false);
    }
  };

  // ----------------------------------------------------
  // Submissions Review Handling
  // ----------------------------------------------------
  const openSubmissionsReview = async (hw) => {
    setReviewAssignment(hw);
    setShowReviewModal(true);
    setSubmissionFilterTab('all');
    try {
      setSubmissionsLoading(true);
      const res = await ApiService.getHomeworkSubmissions(hw._id);
      if (res.success && res.data) {
        setSubmissionsData(res.data);
      }
    } catch (err) {
      console.error('Error fetching submissions:', err);
      Alert.alert('Error', 'Unable to fetch submissions for this assignment.');
    } finally {
      setSubmissionsLoading(false);
    }
  };

  const getFilteredSubmissionsList = () => {
    if (!submissionsData) return [];
    if (submissionFilterTab === 'submitted') return submissionsData.groups?.submitted || [];
    if (submissionFilterTab === 'pending') return submissionsData.groups?.pending || [];
    if (submissionFilterTab === 'late') return submissionsData.groups?.late || [];
    if (submissionFilterTab === 'graded') return submissionsData.groups?.graded || [];
    return submissionsData.all || [];
  };

  // ----------------------------------------------------
  // Grading Drawer Handling
  // ----------------------------------------------------
  const openGradingDrawer = (item) => {
    setGradingStudent(item);
    setGradeMarks(item.marks != null ? String(item.marks) : '');
    setGradeFeedback(item.feedback || '');
    setGradeResubmit(Boolean(item.needsResubmission));
    setShowGradingDrawer(true);
  };

  const handleSaveGrade = async () => {
    if (!gradingStudent || !reviewAssignment) return;

    if (!gradeResubmit && gradeMarks !== '') {
      const num = Number(gradeMarks);
      if (isNaN(num) || num < 0) {
        Alert.alert('Validation Error', 'Marks must be a non-negative number.');
        return;
      }
      const maxMarks = reviewAssignment.totalMarks || 50;
      if (num > maxMarks) {
        Alert.alert('Validation Error', `Marks (${num}) cannot exceed total marks (${maxMarks}).`);
        return;
      }
    }

    try {
      setIsSavingGrade(true);
      const payload = {
        marks: gradeMarks !== '' ? Number(gradeMarks) : null,
        feedback: gradeFeedback.trim(),
        needsResubmission: gradeResubmit,
        status: gradeResubmit ? 'resubmit_requested' : 'graded',
      };

      const res = await ApiService.gradeSubmission(
        gradingStudent._id,
        payload,
        reviewAssignment._id
      );

      if (res.success) {
        setShowGradingDrawer(false);
        const studentName = gradingStudent.name || 'Student';
        // Refresh submissions
        const updated = await ApiService.getHomeworkSubmissions(reviewAssignment._id);
        if (updated.success && updated.data) {
          setSubmissionsData(updated.data);
        }
        loadAssignments();

        setToastInfo({
          visible: true,
          title: gradeResubmit ? 'Resubmission Requested' : 'Grade & Feedback Saved!',
          subtitle: gradeResubmit
            ? `Requested ${studentName} to resubmit homework`
            : `Marks saved for ${studentName}`,
          variant: 'success',
        });
      } else {
        Alert.alert('Error', res.error || 'Failed to save grade.');
      }
    } catch (err) {
      console.error('Save grade error:', err);
      Alert.alert('Error', err.message || 'Failed to submit grade.');
    } finally {
      setIsSavingGrade(false);
    }
  };

  // ----------------------------------------------------
  // Delete Homework Handling
  // ----------------------------------------------------
  const executeDeleteAssignment = async () => {
    if (!deleteTargetHw?._id) return;
    try {
      setIsDeleting(true);
      const res = await ApiService.deleteAssignment(deleteTargetHw._id);
      if (res && res.success) {
        setShowReviewModal(false);
        const deletedTitle = deleteTargetHw.title;
        setDeleteTargetHw(null);
        loadAssignments();

        setToastInfo({
          visible: true,
          title: 'Homework Deleted',
          subtitle: `"${deletedTitle}" removed from assignments`,
          variant: 'deleted',
        });
      } else {
        Alert.alert('Error', res?.error || 'Failed to delete assignment.');
      }
    } catch (err) {
      console.error('Delete error:', err);
      Alert.alert('Error', err.message || 'Unable to delete assignment.');
    } finally {
      setIsDeleting(false);
    }
  };

  const openAttachmentUrl = (att) => {
    if (!att?.url) return;
    Linking.openURL(att.url).catch((e) => {
      Alert.alert('Attachment', 'Unable to open document: ' + e.message);
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ----------------------------------------------------
          1. HEADER & CLASS DROPDOWN (.dd)
          ---------------------------------------------------- */}
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Assignments</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 110 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Class Dropdown Selector */}
        <View style={styles.ddContainer}>
          <TouchableOpacity
            style={styles.ddButton}
            onPress={() => setShowClassDropdown((prev) => !prev)}
            activeOpacity={0.85}
          >
            <View>
              <Text style={styles.ddLabel}>SELECT CLASS</Text>
              <Text style={styles.ddValue}>
                {selectedClass ? `Class ${selectedClass.name}` : 'Select Class'}
              </Text>
            </View>
            <Feather
              name="chevron-down"
              size={20}
              color={colors.navy}
              style={{
                transform: [{ rotate: showClassDropdown ? '180deg' : '0deg' }],
              }}
            />
          </TouchableOpacity>

          {/* Dropdown Menu Modal / Inline List */}
          {showClassDropdown && (
            <View style={styles.ddMenu}>
              {classes.map((c) => {
                const isSelected = selectedClass?._id === c._id;
                return (
                  <TouchableOpacity
                    key={c._id}
                    style={[styles.ddMenuItem, isSelected && styles.ddMenuItemSelected]}
                    onPress={() => {
                      setSelectedClass(c);
                      if (c.subjects && c.subjects.length > 0) {
                        setSelectedSubjectId(c.subjects[0]._id);
                      }
                      setShowClassDropdown(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.ddMenuItemTitle,
                        isSelected && { color: colors.blue },
                      ]}
                    >
                      Class {c.name}
                    </Text>
                    <Text style={styles.ddMenuItemCount}>
                      {c.studentCount != null ? c.studentCount : 0} students
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* ----------------------------------------------------
            2. TABS: Active | Past (Decision 11)
            ---------------------------------------------------- */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'Active' && styles.tabButtonActive]}
            onPress={() => setActiveTab('Active')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'Active' && styles.tabTextActive,
              ]}
            >
              Active
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'Past' && styles.tabButtonActive]}
            onPress={() => setActiveTab('Past')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'Past' && styles.tabTextActive,
              ]}
            >
              Past
            </Text>
          </TouchableOpacity>
        </View>

        {/* ----------------------------------------------------
            3. NEW HOMEWORK CARD (.cr)
            ---------------------------------------------------- */}
        <View style={styles.crCard}>
          <Text style={styles.crTitle}>
            New homework for {selectedClass?.name || 'Class'}
          </Text>
          <View style={styles.crActionsRow}>
            <TouchableOpacity
              style={styles.crActionBtn}
              onPress={handlePickDocument}
              activeOpacity={0.8}
            >
              <Text style={styles.crActionText}>Upload file</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.crActionBtn}
              onPress={handleTakePhoto}
              activeOpacity={0.8}
            >
              <Text style={styles.crActionText}>Take photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.crActionBtn}
              onPress={handlePickGallery}
              activeOpacity={0.8}
            >
              <Text style={styles.crActionText}>Gallery</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ----------------------------------------------------
            4. HOMEWORK CARDS LIST (.card)
            ---------------------------------------------------- */}
        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={colors.blue} />
            <Text style={styles.loadingText}>Loading homework...</Text>
          </View>
        ) : filteredAssignments.length === 0 ? (
          <View style={styles.emptyCard}>
            <Feather name="file-text" size={36} color={colors.mut} />
            <Text style={styles.emptyTitle}>No {activeTab.toLowerCase()} homework</Text>
            <Text style={styles.emptySubtitle}>
              Tap "Upload file" or "Take photo" above to assign new homework.
            </Text>
          </View>
        ) : (
          filteredAssignments.map((hw) => {
            const tagInfo = getHomeworkTagInfo(hw);
            const totalStudents = hw.totalStudents || selectedClass?.studentCount || 0;
            const submittedCount = hw.submissionCount || hw.submittedCount || 0;
            const percent = totalStudents > 0 ? Math.min(100, Math.round((submittedCount / totalStudents) * 100)) : 0;

            return (
              <TouchableOpacity
                key={hw._id}
                style={styles.hwCard}
                onPress={() => openSubmissionsReview(hw)}
                activeOpacity={0.85}
              >
                {/* Header Row (.t) */}
                <View style={styles.hwCardHeader}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.hwTitle} numberOfLines={1}>
                      {hw.title}
                    </Text>
                    <Text style={styles.hwSubtitle}>
                      {selectedClass?.name || 'Class'} · {formatDueDate(hw.dueDate)}
                    </Text>
                  </View>
                  <View style={styles.hwActionsRight}>
                    <View style={[styles.hwTag, { backgroundColor: tagInfo.bg }]}>
                      <Text style={[styles.hwTagText, { color: tagInfo.color }]}>
                        {tagInfo.text}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.hwDeleteBtn}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        setDeleteTargetHw(hw);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel="Delete assignment"
                    >
                      <Feather name="trash-2" size={14} color={colors.red} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Progress Bar (.bar) */}
                <View style={styles.bar}>
                  <View style={[styles.barFill, { width: `${percent}%` }]} />
                </View>

                {/* Caption (.cap) */}
                <Text style={styles.cap}>
                  {submittedCount} / {totalStudents} submitted
                </Text>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* ----------------------------------------------------
          MODAL 1: CREATE HOMEWORK SHEET
          ---------------------------------------------------- */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                New Homework · {selectedClass?.name}
              </Text>
              <TouchableOpacity
                onPress={() => setShowCreateModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Feather name="x" size={22} color={colors.navy} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Title Input */}
              <Text style={styles.inputLabel}>Homework Title *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Mensuration Practice · Ex 11.2"
                placeholderTextColor={colors.mut}
                value={newTitle}
                onChangeText={setNewTitle}
              />

              {/* Description Input */}
              <Text style={styles.inputLabel}>Instructions / Description</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Details of questions or chapters to solve..."
                placeholderTextColor={colors.mut}
                multiline
                numberOfLines={3}
                value={newDescription}
                onChangeText={setNewDescription}
              />

              {/* Subject Selector */}
              {selectedClass?.subjects && selectedClass.subjects.length > 1 && (
                <>
                  <Text style={styles.inputLabel}>Subject</Text>
                  <View style={styles.chipsRow}>
                    {selectedClass.subjects.map((s) => (
                      <TouchableOpacity
                        key={s._id}
                        style={[
                          styles.chip,
                          selectedSubjectId === s._id && styles.chipSelected,
                        ]}
                        onPress={() => setSelectedSubjectId(s._id)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            selectedSubjectId === s._id && styles.chipTextSelected,
                          ]}
                        >
                          {s.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* Due Date Presets */}
              <Text style={styles.inputLabel}>Due In</Text>
              <View style={styles.chipsRow}>
                {[1, 2, 3, 5, 7].map((days) => (
                  <TouchableOpacity
                    key={days}
                    style={[
                      styles.chip,
                      dueDaysOffset === days && !customDueDate && styles.chipSelected,
                    ]}
                    onPress={() => {
                      setDueDaysOffset(days);
                      setCustomDueDate('');
                    }}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        dueDaysOffset === days && !customDueDate && styles.chipTextSelected,
                      ]}
                    >
                      {days === 1 ? 'Tomorrow' : `${days} days`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Total Marks */}
              <Text style={styles.inputLabel}>Total Marks</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                value={totalMarksInput}
                onChangeText={setTotalMarksInput}
                placeholder="50"
                placeholderTextColor={colors.mut}
              />

              {/* Attached Files List */}
              {attachedFiles.length > 0 && (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.inputLabel}>Attached Files</Text>
                  {attachedFiles.map((f, i) => (
                    <View key={i} style={styles.fileRow}>
                      <Feather name="file-text" size={16} color={colors.blue} />
                      <Text style={styles.fileName} numberOfLines={1}>
                        {f.name}
                      </Text>
                      <TouchableOpacity onPress={() => removeAttachedFile(i)}>
                        <Feather name="trash-2" size={16} color={colors.red} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Add file button */}
              <TouchableOpacity
                style={styles.addFileBtn}
                onPress={handlePickDocument}
              >
                <Feather name="paperclip" size={16} color={colors.blue} />
                <Text style={styles.addFileText}>Attach file</Text>
              </TouchableOpacity>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.primaryBtn, isCreating && { opacity: 0.7 }]}
                onPress={handleCreateHomework}
                disabled={isCreating}
              >
                {isCreating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>Assign Homework</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ----------------------------------------------------
          MODAL 2: SUBMISSIONS REVIEW SCREEN (Decision 11)
          ---------------------------------------------------- */}
      <Modal
        visible={showReviewModal}
        animationType="slide"
        onRequestClose={() => setShowReviewModal(false)}
      >
        <View style={[styles.reviewContainer, { paddingTop: insets.top }]}>
          {/* Review Header (.oh) */}
          <View style={styles.reviewHeader}>
            <TouchableOpacity
              style={styles.reviewBackBtn}
              onPress={() => setShowReviewModal(false)}
            >
              <Feather name="chevron-left" size={24} color={colors.navy} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.reviewTitle} numberOfLines={1}>
                {reviewAssignment?.title || 'Submissions Review'}
              </Text>
              <Text style={styles.reviewSubtitle}>
                {selectedClass?.name} · Max {reviewAssignment?.totalMarks || 50} marks
              </Text>
            </View>
            <TouchableOpacity
              style={styles.reviewDeleteBtn}
              onPress={() => setDeleteTargetHw(reviewAssignment)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Delete assignment"
            >
              <Feather name="trash-2" size={18} color={colors.red} />
            </TouchableOpacity>
          </View>

          {/* Submissions Filter Tabs */}
          <View style={styles.reviewTabs}>
            {[
              { id: 'all', label: `All (${submissionsData?.stats?.total || 0})` },
              { id: 'submitted', label: `Submitted (${submissionsData?.stats?.submitted || 0})` },
              { id: 'late', label: `Late (${submissionsData?.stats?.late || 0})` },
              { id: 'graded', label: `Graded (${submissionsData?.stats?.graded || 0})` },
              { id: 'pending', label: `Pending (${submissionsData?.stats?.pending || 0})` },
            ].map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[
                  styles.reviewTabPill,
                  submissionFilterTab === t.id && styles.reviewTabPillActive,
                ]}
                onPress={() => setSubmissionFilterTab(t.id)}
              >
                <Text
                  style={[
                    styles.reviewTabPillText,
                    submissionFilterTab === t.id && styles.reviewTabPillTextActive,
                  ]}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Student Submissions List */}
          {submissionsLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={colors.blue} />
              <Text style={styles.loadingText}>Loading submissions...</Text>
            </View>
          ) : getFilteredSubmissionsList().length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No submissions in this tab</Text>
            </View>
          ) : (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
              showsVerticalScrollIndicator={false}
            >
              {getFilteredSubmissionsList().map((item, idx) => {
                const isPending = item.status === 'pending';
                const isGraded = item.status === 'graded';
                const isLate = item.status === 'late';
                const isResubmit = item.status === 'resubmit_requested';

                let tagBg = colors.soft;
                let tagColor = colors.blue;
                let tagText = 'Submitted';

                if (isPending) {
                  tagBg = '#EEF1F7';
                  tagColor = colors.mut;
                  tagText = 'Pending';
                } else if (isGraded) {
                  tagBg = '#DDF3E6';
                  tagColor = colors.green;
                  tagText = `${item.marks ?? 0} / ${reviewAssignment?.totalMarks || 50}`;
                } else if (isLate) {
                  tagBg = '#FDF0D0';
                  tagColor = '#7A4B00';
                  tagText = 'Late';
                } else if (isResubmit) {
                  tagBg = '#FDE3E0';
                  tagColor = colors.red;
                  tagText = 'Resubmit';
                }

                return (
                  <View key={item._id || item.studentId || idx} style={styles.subCard}>
                    <View style={styles.subCardRow}>
                      <Avatar name={item.studentName} size={40} />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.subStudentName}>{item.studentName}</Text>
                        <Text style={styles.subStudentRoll}>
                          Roll {item.rollNumber || String(idx + 1).padStart(2, '0')}
                        </Text>
                      </View>
                      <View style={[styles.subStatusTag, { backgroundColor: tagBg }]}>
                        <Text style={[styles.subStatusText, { color: tagColor }]}>
                          {tagText}
                        </Text>
                      </View>
                    </View>

                    {/* Attachments if any */}
                    {item.attachments && item.attachments.length > 0 && (
                      <View style={styles.subAttachmentsRow}>
                        {item.attachments.map((att, aIdx) => (
                          <TouchableOpacity
                            key={aIdx}
                            style={styles.subAttachmentPill}
                            onPress={() => openAttachmentUrl(att)}
                          >
                            <Feather name="file-text" size={14} color={colors.blue} />
                            <Text style={styles.subAttachmentText} numberOfLines={1}>
                              {att.name || 'Student Submission'}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    {/* Feedback if already graded */}
                    {item.feedback ? (
                      <Text style={styles.subFeedbackText}>
                        Feedback: "{item.feedback}"
                      </Text>
                    ) : null}

                    {/* Action: Grade Button (if not pending) */}
                    {!isPending && (
                      <TouchableOpacity
                        style={styles.gradeButton}
                        onPress={() => openGradingDrawer(item)}
                      >
                        <Text style={styles.gradeButtonText}>
                          {isGraded ? 'Edit Grade & Feedback' : 'Grade Submission'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}

          {/* ----------------------------------------------------
              GRADING DRAWER (Bottom Modal)
              ---------------------------------------------------- */}
          <Modal
            visible={showGradingDrawer}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowGradingDrawer(false)}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={{ flex: 1 }}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalSheet}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>
                      Grade · {gradingStudent?.studentName}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setShowGradingDrawer(false)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Feather name="x" size={22} color={colors.navy} />
                    </TouchableOpacity>
                  </View>

                  <ScrollView showsVerticalScrollIndicator={false}>
                    {/* Marks input */}
                    <Text style={styles.inputLabel}>
                      Marks (out of {reviewAssignment?.totalMarks || 50})
                    </Text>
                    <TextInput
                      style={styles.textInput}
                      keyboardType="numeric"
                      placeholder="e.g. 45"
                      placeholderTextColor={colors.mut}
                      value={gradeMarks}
                      onChangeText={setGradeMarks}
                    />

                    {/* Feedback */}
                    <Text style={styles.inputLabel}>Teacher Feedback</Text>
                    <TextInput
                      style={[styles.textInput, styles.textArea]}
                      placeholder="Add constructive comments for the student..."
                      placeholderTextColor={colors.mut}
                      multiline
                      numberOfLines={3}
                      value={gradeFeedback}
                      onChangeText={setGradeFeedback}
                    />

                    {/* Ask to resubmit */}
                    <View style={styles.resubmitRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.resubmitTitle}>Request Resubmission</Text>
                        <Text style={styles.resubmitSubtitle}>
                          Ask student to redo work and resubmit
                        </Text>
                      </View>
                      <Switch
                        value={gradeResubmit}
                        onValueChange={setGradeResubmit}
                        trackColor={{ false: '#D5DCEC', true: colors.blue }}
                      />
                    </View>

                    {/* Save button */}
                    <TouchableOpacity
                      style={[styles.primaryBtn, isSavingGrade && { opacity: 0.7 }]}
                      onPress={handleSaveGrade}
                      disabled={isSavingGrade}
                    >
                      {isSavingGrade ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.primaryBtnText}>Save Grade</Text>
                      )}
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              </View>
            </KeyboardAvoidingView>
          </Modal>
        </View>
      </Modal>

      {/* Confirmation Dialog for Homework Deletion */}
      <ConfirmDialog
        visible={!!deleteTargetHw}
        title="Delete Homework?"
        message={`Are you sure you want to delete "${deleteTargetHw?.title}"? All student submissions and evaluations will also be removed. This cannot be undone.`}
        confirmText={isDeleting ? 'Deleting...' : 'Delete Homework'}
        cancelText="Cancel"
        isDestructive={true}
        onConfirm={executeDeleteAssignment}
        onCancel={() => setDeleteTargetHw(null)}
      />

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
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.navy,
    fontFamily: typography.fontFamily.extraBold,
    lineHeight: 44,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },

  // Class Dropdown (.dd)
  ddContainer: {
    position: 'relative',
    zIndex: 10,
    marginTop: 4,
  },
  ddButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadows.sm,
  },
  ddLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.mut,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: typography.fontFamily.bold,
  },
  ddValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.navy,
    fontFamily: typography.fontFamily.extraBold,
    marginTop: 1,
  },
  ddMenu: {
    position: 'absolute',
    top: 62,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 6,
    ...shadows.lg,
    zIndex: 20,
    elevation: 8,
  },
  ddMenuItem: {
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ddMenuItemSelected: {
    backgroundColor: colors.soft,
  },
  ddMenuItemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.navy,
    fontFamily: typography.fontFamily.bold,
  },
  ddMenuItemCount: {
    fontSize: 12,
    color: colors.mut,
    fontFamily: typography.fontFamily.regular,
  },

  // Tabs (.tabs)
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.soft,
    borderRadius: 14,
    padding: 4,
    marginTop: 14,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 11,
  },
  tabButtonActive: {
    backgroundColor: '#fff',
    ...shadows.sm,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.mut,
    fontFamily: typography.fontFamily.bold,
  },
  tabTextActive: {
    color: colors.navy,
  },

  // New Homework Card (.cr)
  crCard: {
    marginTop: 14,
    backgroundColor: colors.navy,
    borderRadius: 22,
    padding: 16,
  },
  crTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    fontFamily: typography.fontFamily.extraBold,
  },
  crActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  crActionBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crActionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: typography.fontFamily.bold,
  },

  // Homework Cards (.card)
  hwCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginTop: 10,
    ...shadows.sm,
  },
  hwCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  hwTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.navy,
    fontFamily: typography.fontFamily.extraBold,
  },
  hwSubtitle: {
    fontSize: 12,
    color: colors.mut,
    marginTop: 2,
    fontFamily: typography.fontFamily.regular,
  },
  hwTag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  hwTagText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: typography.fontFamily.bold,
  },
  hwActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hwDeleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.soft,
    marginTop: 14,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.green,
  },
  cap: {
    fontSize: 12,
    color: colors.mut,
    marginTop: 8,
    fontFamily: typography.fontFamily.regular,
  },

  // Loading & Empty States
  loadingBox: {
    padding: 30,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: colors.mut,
    fontFamily: typography.fontFamily.regular,
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.navy,
    fontFamily: typography.fontFamily.bold,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.mut,
    textAlign: 'center',
    fontFamily: typography.fontFamily.regular,
  },

  // Modal Sheet Components
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(11,31,79,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.navy,
    fontFamily: typography.fontFamily.extraBold,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.mut,
    marginTop: 12,
    marginBottom: 6,
    fontFamily: typography.fontFamily.bold,
  },
  textInput: {
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
  textArea: {
    height: 76,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#EEF1F7',
  },
  chipSelected: {
    backgroundColor: colors.navy,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.mut,
    fontFamily: typography.fontFamily.bold,
  },
  chipTextSelected: {
    color: '#fff',
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.soft,
    padding: 10,
    borderRadius: 10,
    marginTop: 6,
    gap: 8,
  },
  fileName: {
    flex: 1,
    fontSize: 13,
    color: colors.navy,
    fontFamily: typography.fontFamily.regular,
  },
  addFileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    alignSelf: 'flex-start',
  },
  addFileText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.blue,
    fontFamily: typography.fontFamily.bold,
  },
  primaryBtn: {
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 10,
    ...shadows.md,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    fontFamily: typography.fontFamily.extraBold,
  },

  // Review Screen Styling
  reviewContainer: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  reviewBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  reviewDeleteBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  reviewTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.navy,
    fontFamily: typography.fontFamily.extraBold,
  },
  reviewSubtitle: {
    fontSize: 12,
    color: colors.mut,
    fontFamily: typography.fontFamily.regular,
  },
  reviewTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
    overflow: 'hidden',
  },
  reviewTabPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#EEF1F7',
  },
  reviewTabPillActive: {
    backgroundColor: colors.navy,
  },
  reviewTabPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.mut,
    fontFamily: typography.fontFamily.bold,
  },
  reviewTabPillTextActive: {
    color: '#fff',
  },

  // Submissions Cards in Review
  subCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    ...shadows.sm,
  },
  subCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subStudentName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.navy,
    fontFamily: typography.fontFamily.bold,
  },
  subStudentRoll: {
    fontSize: 12,
    color: colors.mut,
    fontFamily: typography.fontFamily.regular,
  },
  subStatusTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  subStatusText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: typography.fontFamily.bold,
  },
  subAttachmentsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  subAttachmentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.soft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  subAttachmentText: {
    fontSize: 12,
    color: colors.blue,
    fontWeight: '600',
    maxWidth: 200,
  },
  subFeedbackText: {
    fontSize: 12,
    color: colors.mut,
    fontStyle: 'italic',
    marginTop: 8,
  },
  gradeButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: colors.soft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  gradeButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.blue,
    fontFamily: typography.fontFamily.bold,
  },

  // Grading Drawer switches
  resubmitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 14,
  },
  resubmitTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.navy,
    fontFamily: typography.fontFamily.bold,
  },
  resubmitSubtitle: {
    fontSize: 12,
    color: colors.mut,
  },
});
