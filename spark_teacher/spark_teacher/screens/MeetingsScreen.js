import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  TextInput,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import ApiService from '../services/api';

export default function MeetingsScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('Active');
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [classes, setClasses] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showClassPicker, setShowClassPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  
  // Form fields
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [meetingDescription, setMeetingDescription] = useState('');
  const [meetingDate, setMeetingDate] = useState(new Date());
  const [meetingTime, setMeetingTime] = useState(new Date());
  const [duration, setDuration] = useState('60');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Simple date/time picker states
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedHour, setSelectedHour] = useState(9);
  const [selectedMinute, setSelectedMinute] = useState(0);
  
  // Meeting detail modal
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const currentDate = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  
  const dayName = dayNames[currentDate.getDay()];
  const monthName = monthNames[currentDate.getMonth()];
  const day = currentDate.getDate();

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const getDaysInMonth = (month, year) => {
    return new Date(year, month, 0).getDate();
  };

  const days = Array.from({ length: getDaysInMonth(selectedMonth, selectedYear) }, (_, i) => i + 1);
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() + i);
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  const updateDateFromSimplePicker = () => {
    const newDate = new Date(selectedYear, selectedMonth - 1, selectedDay);
    setMeetingDate(newDate);
  };

  const updateTimeFromSimplePicker = () => {
    const newTime = new Date();
    newTime.setHours(selectedHour, selectedMinute, 0, 0);
    setMeetingTime(newTime);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (classes.length > 0 && !selectedClass) {
      setSelectedClass(classes[0]);
      if (classes[0].subjects.length > 0) {
        setSelectedSubject(classes[0].subjects[0]);
      }
    }
  }, [classes]);

  useEffect(() => {
    if (selectedClass && selectedSubject) {
      loadMeetings();
    }
  }, [selectedClass, selectedSubject, activeTab]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      await loadTeacherClasses();
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTeacherClasses = async () => {
    try {
      const response = await ApiService.getTeacherClasses();
      if (response.success) {
        setClasses(response.data);
      }
    } catch (error) {
      console.error('Error loading teacher classes:', error);
    }
  };

  const loadMeetings = useCallback(async () => {
    try {
      if (!selectedClass || !selectedSubject) {
        console.log('📅 Teacher Meetings: Cannot load - no class/subject selected');
        return;
      }

      const params = {
        classId: selectedClass._id,
        subjectId: selectedSubject._id
      };

      console.log('📅 Teacher Meetings: Loading meetings with params:', params);
      const response = await ApiService.getMeetings(params);
      if (response.success) {
        console.log('📅 Teacher Meetings: Loaded', response.data.length, 'meetings');
        setMeetings(response.data);
      }
    } catch (error) {
      console.error('Error loading meetings:', error);
    }
  }, [selectedClass, selectedSubject]);

  const handleCreateMeeting = async () => {
    if (!meetingTitle.trim()) {
      Alert.alert('Error', 'Please enter meeting title');
      return;
    }
    if (!meetingUrl.trim()) {
      Alert.alert('Error', 'Please enter meeting URL');
      return;
    }
    if (!selectedClass || !selectedSubject) {
      Alert.alert('Error', 'Please select class and subject');
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Combine date and time
      const meetingDateTime = new Date(meetingDate);
      meetingDateTime.setHours(meetingTime.getHours(), meetingTime.getMinutes(), 0, 0);

      const meetingData = {
        title: meetingTitle.trim(),
        url: meetingUrl.trim(),
        description: meetingDescription.trim(),
        meetingTime: meetingDateTime.toISOString(),
        duration: parseInt(duration) || 60,
        classId: selectedClass._id,
        subjectId: selectedSubject._id
      };

      console.log('📤 Teacher: Sending meeting data:', meetingData);
      
      const response = await ApiService.createMeeting(meetingData);
      
      if (response.success) {
        Alert.alert('Success', 'Meeting created successfully!');
        setShowCreateModal(false);
        resetForm();
        loadMeetings();
      } else {
        Alert.alert('Error', response.error || 'Failed to create meeting');
      }
    } catch (error) {
      console.error('Error creating meeting:', error);
      Alert.alert('Error', 'Failed to create meeting. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setMeetingTitle('');
    setMeetingUrl('');
    setMeetingDescription('');
    setMeetingDate(new Date());
    const defaultTime = new Date();
    defaultTime.setHours(9, 0, 0, 0);
    setMeetingTime(defaultTime);
    setDuration('60');
  };

  const handleClassSelect = (classItem) => {
    setSelectedClass(classItem);
    if (classItem.subjects.length > 0) {
      setSelectedSubject(classItem.subjects[0]);
    } else {
      setSelectedSubject(null);
    }
    setShowClassPicker(false);
  };

  const handleSubjectSelect = (classItem, subject) => {
    setSelectedClass(classItem);
    setSelectedSubject(subject);
    setShowClassPicker(false);
  };

  const formatDateTime = (dateStr) => {
    const date = new Date(dateStr);
    const monthName = monthNames[date.getMonth()].substring(0, 3);
    const day = date.getDate();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${monthName} ${day}, ${hours}:${minutes}`;
  };

  const handleMeetingPress = async (meeting) => {
    setSelectedMeeting(meeting);
    setShowDetailModal(true);
  };

  const handleDeleteMeeting = async (meetingId) => {
    Alert.alert(
      'Delete Meeting',
      'Are you sure you want to delete this meeting?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await ApiService.deleteMeeting(meetingId);
              if (response.success) {
                Alert.alert('Success', 'Meeting deleted successfully');
                setShowDetailModal(false);
                loadMeetings();
              }
            } catch (error) {
              console.error('Error deleting meeting:', error);
              Alert.alert('Error', 'Failed to delete meeting');
            }
          }
        }
      ]
    );
  };

  const handleJoinMeeting = (url) => {
    Linking.openURL(url).catch(err => {
      Alert.alert('Error', 'Failed to open meeting link');
      console.error('Error opening URL:', err);
    });
  };

  const getMeetingColor = (index) => {
    const colors = ['#007AFF', '#34C759', '#AF52DE', '#FF9500', '#FF3B30'];
    return colors[index % colors.length];
  };

  const filteredMeetings = () => {
    const now = new Date();
    if (activeTab === 'Active') {
      // Show meetings that are currently ongoing (LIVE) or scheduled for today
      return meetings.filter(m => {
        const meetingTime = new Date(m.meetingTime);
        const meetingEndTime = new Date(meetingTime.getTime() + (m.duration || 60) * 60000);
        return (now >= meetingTime && now <= meetingEndTime) || 
               (meetingTime.toDateString() === now.toDateString() && meetingTime >= now);
      });
    } else if (activeTab === 'Past') {
      // Show meetings that have ended
      return meetings.filter(m => {
        const meetingTime = new Date(m.meetingTime);
        const meetingEndTime = new Date(meetingTime.getTime() + (m.duration || 60) * 60000);
        return now > meetingEndTime;
      });
    }
    return meetings;
  };

  const getMeetingStatus = (meeting) => {
    const now = new Date();
    const meetingTime = new Date(meeting.meetingTime);
    const meetingEndTime = new Date(meetingTime.getTime() + (meeting.duration || 60) * 60000);
    
    if (now >= meetingTime && now <= meetingEndTime) {
      return { text: 'LIVE', color: '#34C759' };
    } else if (now < meetingTime) {
      return { text: 'UPCOMING', color: '#007AFF' };
    } else {
      return { text: 'ENDED', color: '#8E8E93' };
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1f3a" />
      
      {/* Header with Gradient */}
      <LinearGradient
        colors={['#1a1f3a', '#2d3561']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.headerGradient, { paddingTop: insets.top }]}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Video Classes</Text>
            {user?.school?.name && (
              <Text style={styles.schoolNameSubtitle}>{user.school.name}</Text>
            )}
          </View>
          <TouchableOpacity 
            style={styles.createIconButton}
            onPress={() => setShowCreateModal(true)}
          >
            <View style={styles.createIconContainer}>
              <Ionicons name="add" size={24} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : (
          <>
            {/* Class & Subject Selector */}
            {classes.length > 0 && (
              <View style={styles.classSelector}>
                <TouchableOpacity 
                  style={styles.classButton}
                  onPress={() => setShowClassPicker(true)}
                >
                  <View style={styles.classButtonContent}>
                    <View style={styles.classDot} />
                    <Text style={styles.classButtonText}>
                      {selectedClass && selectedSubject
                        ? `${selectedSubject.name} - ${selectedClass.name}`
                        : 'Select Class & Subject'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={20} color="#007AFF" />
                </TouchableOpacity>
              </View>
            )}

            {/* Meeting Navigation Tabs - Segmented Control */}
            <View style={styles.segmentedControl}>
              <TouchableOpacity 
                style={[styles.segmentTab, activeTab === 'Active' && styles.segmentTabActive]}
                onPress={() => setActiveTab('Active')}
              >
                <Text style={[styles.segmentTabText, activeTab === 'Active' && styles.segmentTabTextActive]}>Active</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.segmentTab, activeTab === 'Past' && styles.segmentTabActive]}
                onPress={() => setActiveTab('Past')}
              >
                <Text style={[styles.segmentTabText, activeTab === 'Past' && styles.segmentTabTextActive]}>Past</Text>
              </TouchableOpacity>
            </View>

            {/* Meetings List */}
            <View style={styles.section}>
              
              {filteredMeetings().length === 0 ? (
                <View style={styles.emptyState}>
                  <View style={styles.emptyStateIcon}>
                    <Ionicons name="videocam-outline" size={64} color="#E5E5EA" />
                  </View>
                  <Text style={styles.emptyStateText}>
                    {activeTab === 'Active' ? 'No active meetings found' : 'No past meetings found'}
                  </Text>
                </View>
              ) : (
                filteredMeetings().map((meeting, index) => {
                  const status = getMeetingStatus(meeting);
                  return (
                    <TouchableOpacity 
                      key={meeting._id} 
                      style={[styles.meetingCard, status.text === 'ENDED' && styles.endedMeetingCard]}
                      onPress={() => {
                        if (status.text === 'ENDED') {
                          Alert.alert('Meeting Ended', 'This meeting has already ended and cannot be opened.');
                        } else {
                          handleMeetingPress(meeting);
                        }
                      }}
                    >
                      <View style={[styles.meetingColorBar, { backgroundColor: getMeetingColor(index) }]} />
                      <View style={styles.meetingContent}>
                        <View style={styles.meetingHeader}>
                          <Text style={styles.meetingTitle}>{meeting.title}</Text>
                          <View style={[styles.statusBadge, { backgroundColor: status.color }]}>
                            <Text style={styles.statusText}>{status.text}</Text>
                          </View>
                        </View>
                        <View style={styles.meetingDetails}>
                          <View style={styles.meetingDetail}>
                            <Ionicons name="calendar-outline" size={14} color="#8E8E93" />
                            <Text style={styles.meetingDetailText}>{formatDateTime(meeting.meetingTime)}</Text>
                          </View>
                          <View style={styles.meetingDetail}>
                            <Ionicons name="time-outline" size={14} color="#8E8E93" />
                            <Text style={styles.meetingDetailText}>{meeting.duration || 60} mins</Text>
                          </View>
                        </View>
                        <View style={styles.meetingInfo}>
                          <Ionicons name="school-outline" size={14} color="#8E8E93" />
                          <Text style={styles.meetingInfoText}>
                            {meeting.classId?.name && meeting.classId?.section 
                              ? `${meeting.classId.name} ${meeting.classId.section}`
                              : meeting.classId?.name} - {meeting.subjectId?.name}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.meetingActions}>
                        <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Class Picker Modal */}
      <Modal
        visible={showClassPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowClassPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerModal}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Class & Subject</Text>
              <TouchableOpacity onPress={() => setShowClassPicker(false)}>
                <Ionicons name="close" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {classes.map((classItem) => (
                <View key={classItem._id} style={styles.classGroup}>
                  <View style={styles.classHeader}>
                    <Text style={styles.className}>
                      {classItem.name} {classItem.section ? `(${classItem.section})` : ''}
                    </Text>
                    <Text style={styles.subjectCount}>
                      {classItem.subjects.length} subject{classItem.subjects.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  {classItem.subjects.map((subject) => (
                    <TouchableOpacity
                      key={subject._id}
                      style={[
                        styles.subjectItem,
                        selectedClass?._id === classItem._id && selectedSubject?._id === subject._id && styles.selectedSubjectItem
                      ]}
                      onPress={() => handleSubjectSelect(classItem, subject)}
                    >
                      <View style={styles.subjectContent}>
                        <View style={styles.subjectDot} />
                        <Text style={styles.subjectText}>{subject.name}</Text>
                      </View>
                      {selectedClass?._id === classItem._id && selectedSubject?._id === subject._id && (
                        <Ionicons name="checkmark" size={20} color="#007AFF" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Create Meeting Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalHeader, { paddingTop: insets.top + 20 }]}>
            <TouchableOpacity 
              onPress={() => setShowCreateModal(false)}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={24} color="#8E8E93" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Meeting</Text>
            <TouchableOpacity 
              onPress={handleCreateMeeting}
              style={styles.modalSaveButton}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#007AFF" />
              ) : (
                <Text style={styles.modalSaveText}>Create</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Class & Subject</Text>
              <TouchableOpacity 
                style={styles.input}
                onPress={() => setShowClassPicker(true)}
              >
                <Text style={styles.inputText}>
                  {selectedClass && selectedSubject
                    ? `${selectedSubject.name} - ${selectedClass.name}`
                    : 'Select Class & Subject'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#8E8E93" />
              </TouchableOpacity>
            </View>
          
            <View style={styles.formGroup}>
              <Text style={styles.label}>Meeting Title *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g., Mathematics Class Review"
                placeholderTextColor="#8E8E93"
                value={meetingTitle}
                onChangeText={setMeetingTitle}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Meeting URL *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g., https://meet.google.com/abc-defg-hij"
                placeholderTextColor="#8E8E93"
                value={meetingUrl}
                onChangeText={setMeetingUrl}
                autoCapitalize="none"
                keyboardType="url"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Description (Optional)</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Add meeting details or agenda..."
                placeholderTextColor="#8E8E93"
                multiline
                numberOfLines={4}
                value={meetingDescription}
                onChangeText={setMeetingDescription}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.formGroup, styles.halfWidth]}>
                <Text style={styles.label}>Meeting Date *</Text>
                <TouchableOpacity 
                  style={[styles.input, { backgroundColor: '#F8F9FA' }]}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={styles.inputText}>
                    {meetingDate ? `${meetingDate.getDate()}/${meetingDate.getMonth() + 1}/${meetingDate.getFullYear()}` : 'Select Date'}
                  </Text>
                  <Ionicons name="calendar-outline" size={24} color="#007AFF" />
                </TouchableOpacity>
              </View>
              <View style={[styles.formGroup, styles.halfWidth]}>
                <Text style={styles.label}>Time *</Text>
                <TouchableOpacity 
                  style={[styles.input, { backgroundColor: '#F8F9FA' }]}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Text style={styles.inputText}>
                    {meetingTime ? `${meetingTime.getHours().toString().padStart(2, '0')}:${meetingTime.getMinutes().toString().padStart(2, '0')}` : 'Select Time'}
                  </Text>
                  <Ionicons name="time-outline" size={24} color="#007AFF" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Duration (minutes)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g., 60"
                placeholderTextColor="#8E8E93"
                keyboardType="numeric"
                value={duration}
                onChangeText={setDuration}
              />
            </View>
            
            <View style={{ height: 20 }} />
            
            {/* Date Picker Modal */}
            {showDatePicker && (
              <Modal
                visible={showDatePicker}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowDatePicker(false)}
              >
                <View style={styles.pickerModalOverlay}>
                  <View style={[styles.pickerModal, { backgroundColor: '#FFFFFF', height: '80%' }]}>
                    <View style={styles.pickerHeader}>
                      <Text style={styles.pickerTitle}>Select Meeting Date</Text>
                      <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                        <Ionicons name="close" size={24} color="#8E8E93" />
                      </TouchableOpacity>
                    </View>
                    
                    <View style={{
                      paddingHorizontal: 20,
                      paddingVertical: 15,
                      backgroundColor: '#F8F9FA',
                      borderBottomWidth: 1,
                      borderBottomColor: '#E5E5EA'
                    }}>
                      <Text style={{
                        fontSize: 18,
                        fontWeight: '600',
                        color: '#000000',
                        textAlign: 'center'
                      }}>
                        {months[selectedMonth - 1]} {selectedDay}, {selectedYear}
                      </Text>
                    </View>
                    
                    <View style={{ 
                      flex: 1,
                      backgroundColor: '#FFFFFF',
                      paddingHorizontal: 20,
                      paddingVertical: 20,
                      paddingBottom: 80
                    }}>
                      <View style={{ marginBottom: 20 }}>
                        <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 10, color: '#000000' }}>Month</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          <View style={{ flexDirection: 'row', gap: 10 }}>
                            {months.map((month, index) => (
                              <TouchableOpacity
                                key={index}
                                style={{
                                  paddingHorizontal: 15,
                                  paddingVertical: 10,
                                  backgroundColor: selectedMonth === index + 1 ? '#007AFF' : '#F0F0F0',
                                  borderRadius: 20,
                                  minWidth: 80,
                                  alignItems: 'center'
                                }}
                                onPress={() => {
                                  setSelectedMonth(index + 1);
                                  const maxDays = getDaysInMonth(index + 1, selectedYear);
                                  if (selectedDay > maxDays) {
                                    setSelectedDay(maxDays);
                                  }
                                }}
                              >
                                <Text style={{
                                  color: selectedMonth === index + 1 ? '#FFFFFF' : '#000000',
                                  fontWeight: '500'
                                }}>
                                  {month.substring(0, 3)}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </ScrollView>
                      </View>

                      <View style={{ marginBottom: 20 }}>
                        <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 10, color: '#000000' }}>Day</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            {days.map((day) => (
                              <TouchableOpacity
                                key={day}
                                style={{
                                  paddingHorizontal: 12,
                                  paddingVertical: 8,
                                  backgroundColor: selectedDay === day ? '#007AFF' : '#F0F0F0',
                                  borderRadius: 15,
                                  minWidth: 40,
                                  alignItems: 'center'
                                }}
                                onPress={() => setSelectedDay(day)}
                              >
                                <Text style={{
                                  color: selectedDay === day ? '#FFFFFF' : '#000000',
                                  fontWeight: '500'
                                }}>
                                  {day}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </ScrollView>
                      </View>

                      <View style={{ marginBottom: 60 }}>
                        <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 10, color: '#000000' }}>Year</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          <View style={{ flexDirection: 'row', gap: 10, paddingBottom: 20 }}>
                            {years.map((year) => (
                              <TouchableOpacity
                                key={year}
                                style={{
                                  paddingHorizontal: 15,
                                  paddingVertical: 10,
                                  backgroundColor: selectedYear === year ? '#007AFF' : '#F0F0F0',
                                  borderRadius: 20,
                                  minWidth: 80,
                                  alignItems: 'center'
                                }}
                                onPress={() => {
                                  setSelectedYear(year);
                                  const maxDays = getDaysInMonth(selectedMonth, year);
                                  if (selectedDay > maxDays) {
                                    setSelectedDay(maxDays);
                                  }
                                }}
                              >
                                <Text style={{
                                  color: selectedYear === year ? '#FFFFFF' : '#000000',
                                  fontWeight: '500'
                                }}>
                                  {year}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </ScrollView>
                      </View>
                    </View>
                    
                    <View style={[styles.pickerActions, { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFFFFF', paddingBottom: 20 }]}>
                      <TouchableOpacity 
                        style={styles.pickerCancelButton}
                        onPress={() => setShowDatePicker(false)}
                      >
                        <Text style={styles.pickerCancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.pickerDoneButton}
                        onPress={() => {
                          updateDateFromSimplePicker();
                          setShowDatePicker(false);
                        }}
                      >
                        <Text style={styles.pickerDoneText}>Done</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Modal>
            )}

            {/* Time Picker Modal */}
            {showTimePicker && (
              <Modal
                visible={showTimePicker}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowTimePicker(false)}
              >
                <View style={styles.pickerModalOverlay}>
                  <View style={[styles.pickerModal, { backgroundColor: '#FFFFFF', height: '70%' }]}>
                    <View style={styles.pickerHeader}>
                      <Text style={styles.pickerTitle}>Select Meeting Time</Text>
                      <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                        <Ionicons name="close" size={24} color="#8E8E93" />
                      </TouchableOpacity>
                    </View>
                    
                    <View style={{
                      paddingHorizontal: 20,
                      paddingVertical: 15,
                      backgroundColor: '#F8F9FA',
                      borderBottomWidth: 1,
                      borderBottomColor: '#E5E5EA'
                    }}>
                      <Text style={{
                        fontSize: 18,
                        fontWeight: '600',
                        color: '#000000',
                        textAlign: 'center'
                      }}>
                        {selectedHour.toString().padStart(2, '0')}:{selectedMinute.toString().padStart(2, '0')}
                        {selectedHour >= 12 ? ' PM' : ' AM'}
                      </Text>
                    </View>
                    
                    <View style={{ 
                      flex: 1,
                      backgroundColor: '#FFFFFF',
                      paddingHorizontal: 20,
                      paddingVertical: 20,
                      paddingBottom: 80
                    }}>
                      <View style={{ marginBottom: 20 }}>
                        <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 10, color: '#000000' }}>Hour</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            {hours.map((hour) => (
                              <TouchableOpacity
                                key={hour}
                                style={{
                                  paddingHorizontal: 12,
                                  paddingVertical: 8,
                                  backgroundColor: selectedHour === hour ? '#007AFF' : '#F0F0F0',
                                  borderRadius: 15,
                                  minWidth: 50,
                                  alignItems: 'center'
                                }}
                                onPress={() => setSelectedHour(hour)}
                              >
                                <Text style={{
                                  color: selectedHour === hour ? '#FFFFFF' : '#000000',
                                  fontWeight: '500'
                                }}>
                                  {hour.toString().padStart(2, '0')}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </ScrollView>
                      </View>

                      <View style={{ marginBottom: 20 }}>
                        <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 10, color: '#000000' }}>Minute</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            {minutes.filter((_, index) => index % 5 === 0).map((minute) => (
                              <TouchableOpacity
                                key={minute}
                                style={{
                                  paddingHorizontal: 12,
                                  paddingVertical: 8,
                                  backgroundColor: selectedMinute === minute ? '#007AFF' : '#F0F0F0',
                                  borderRadius: 15,
                                  minWidth: 50,
                                  alignItems: 'center'
                                }}
                                onPress={() => setSelectedMinute(minute)}
                              >
                                <Text style={{
                                  color: selectedMinute === minute ? '#FFFFFF' : '#000000',
                                  fontWeight: '500'
                                }}>
                                  {minute.toString().padStart(2, '0')}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </ScrollView>
                      </View>

                      <View style={{ marginBottom: 60 }}>
                        <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 10, color: '#000000' }}>Quick Select</Text>
                        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', paddingBottom: 20 }}>
                          {[
                            { hour: 9, minute: 0, label: '9:00 AM' },
                            { hour: 10, minute: 0, label: '10:00 AM' },
                            { hour: 11, minute: 0, label: '11:00 AM' },
                            { hour: 14, minute: 0, label: '2:00 PM' },
                            { hour: 15, minute: 0, label: '3:00 PM' },
                            { hour: 16, minute: 0, label: '4:00 PM' }
                          ].map((preset) => (
                            <TouchableOpacity
                              key={preset.label}
                              style={{
                                paddingHorizontal: 15,
                                paddingVertical: 8,
                                backgroundColor: selectedHour === preset.hour && selectedMinute === preset.minute ? '#007AFF' : '#F0F0F0',
                                borderRadius: 15,
                                alignItems: 'center'
                              }}
                              onPress={() => {
                                setSelectedHour(preset.hour);
                                setSelectedMinute(preset.minute);
                              }}
                            >
                              <Text style={{
                                color: selectedHour === preset.hour && selectedMinute === preset.minute ? '#FFFFFF' : '#000000',
                                fontWeight: '500',
                                fontSize: 14
                              }}>
                                {preset.label}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    </View>
                    
                    <View style={[styles.pickerActions, { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFFFFF', paddingBottom: 20 }]}>
                      <TouchableOpacity 
                        style={styles.pickerCancelButton}
                        onPress={() => setShowTimePicker(false)}
                      >
                        <Text style={styles.pickerCancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.pickerDoneButton}
                        onPress={() => {
                          updateTimeFromSimplePicker();
                          setShowTimePicker(false);
                        }}
                      >
                        <Text style={styles.pickerDoneText}>Done</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Modal>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Meeting Detail Modal */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalHeader, { paddingTop: insets.top + 20 }]}>
            <TouchableOpacity 
              onPress={() => setShowDetailModal(false)}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={24} color="#8E8E93" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Meeting Details</Text>
            <TouchableOpacity 
              onPress={() => selectedMeeting && handleDeleteMeeting(selectedMeeting._id)}
              style={styles.modalCloseButton}
            >
              <Ionicons name="trash-outline" size={24} color="#FF3B30" />
            </TouchableOpacity>
          </View>

          {selectedMeeting && (
            <ScrollView style={styles.modalContent}>
              <View style={styles.detailSection}>
                <Text style={styles.detailTitle}>{selectedMeeting.title}</Text>
                
                {selectedMeeting.description && (
                  <Text style={styles.detailDescription}>{selectedMeeting.description}</Text>
                )}
                
                <View style={styles.detailRow}>
                  <Ionicons name="calendar" size={16} color="#666" />
                  <Text style={styles.detailText}>
                    {formatDateTime(selectedMeeting.meetingTime)}
                  </Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Ionicons name="time" size={16} color="#666" />
                  <Text style={styles.detailText}>
                    Duration: {selectedMeeting.duration || 60} minutes
                  </Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Ionicons name="school" size={16} color="#666" />
                  <Text style={styles.detailText}>
                    {selectedMeeting.classId?.name} {selectedMeeting.classId?.section} - {selectedMeeting.subjectId?.name}
                  </Text>
                </View>

                <View style={styles.urlSection}>
                  <Text style={styles.urlLabel}>Meeting Link:</Text>
                  <TouchableOpacity 
                    style={styles.urlContainer}
                    onPress={() => handleJoinMeeting(selectedMeeting.url)}
                  >
                    <Ionicons name="link" size={16} color="#007AFF" />
                    <Text style={styles.urlText} numberOfLines={1}>{selectedMeeting.url}</Text>
                    <Ionicons name="open-outline" size={16} color="#007AFF" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity 
                  style={styles.joinButton}
                  onPress={() => handleJoinMeeting(selectedMeeting.url)}
                >
                  <Ionicons name="videocam" size={20} color="#FFFFFF" />
                  <Text style={styles.joinButtonText}>Join Meeting</Text>
                </TouchableOpacity>
              </View>
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
    backgroundColor: '#FFFFFF',
  },
  headerGradient: {
    paddingTop: 0, // Will be set dynamically
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  schoolNameSubtitle: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
    marginTop: 4,
  },
  createIconButton: {
    padding: 4,
  },
  createIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#8E8E93',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  classSelector: {
    paddingHorizontal: 20,
    marginBottom: 16,
    marginTop: 16,
  },
  classButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  classButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  classDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#007AFF',
    marginRight: 12,
  },
  classButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#000000',
    flex: 1,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 4,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 16,
  },
  segmentTab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentTabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#8E8E93',
  },
  segmentTabTextActive: {
    color: '#007AFF',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
    marginTop: 8,
  },
  meetingCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 12,
    marginHorizontal: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  endedMeetingCard: {
    opacity: 0.7,
    backgroundColor: '#F5F5F5',
  },
  meetingColorBar: {
    width: 4,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  meetingContent: {
    flex: 1,
    padding: 16,
  },
  meetingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  meetingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  meetingDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  meetingDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  meetingDetailText: {
    fontSize: 12,
    color: '#8E8E93',
    marginLeft: 4,
  },
  meetingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  meetingInfoText: {
    fontSize: 12,
    color: '#8E8E93',
    marginLeft: 4,
  },
  meetingActions: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 20,
    marginTop: 20,
    minHeight: 200,
  },
  emptyStateIcon: {
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  pickerItemSelected: {
    backgroundColor: '#F0F8FF',
  },
  pickerItemText: {
    fontSize: 16,
    color: '#000000',
  },
  classGroup: {
    marginBottom: 8,
  },
  classHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  className: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  subjectCount: {
    fontSize: 14,
    color: '#8E8E93',
  },
  subjectItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingLeft: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  selectedSubjectItem: {
    backgroundColor: '#F0F8FF',
  },
  subjectContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subjectDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#007AFF',
    marginRight: 12,
  },
  subjectText: {
    fontSize: 15,
    color: '#000000',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 0, // Will be set dynamically
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  modalSaveButton: {
    padding: 4,
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 8,
  },
  input: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
  },
  inputText: {
    fontSize: 16,
    color: '#000000',
    flex: 1,
    fontWeight: '500',
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000000',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfWidth: {
    width: '48%',
  },
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pickerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  pickerCancelButton: {
    flex: 1,
    marginRight: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    alignItems: 'center',
  },
  pickerCancelText: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '500',
  },
  pickerDoneButton: {
    flex: 1,
    marginLeft: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  pickerDoneText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  detailSection: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 16,
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  detailDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#333',
  },
  urlSection: {
    marginTop: 16,
    marginBottom: 20,
  },
  urlLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  urlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    gap: 8,
  },
  urlText: {
    fontSize: 14,
    color: '#007AFF',
    flex: 1,
  },
  joinButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  joinButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

