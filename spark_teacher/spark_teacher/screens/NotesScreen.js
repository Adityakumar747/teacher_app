import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '../context/AuthContext';
import ApiService from '../services/api';
import SocketService from '../services/socketService';

export default function NotesScreen({ navigation }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classFilteredSubjects, setClassFilteredSubjects] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);

  const currentDate = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  
  const dayName = dayNames[currentDate.getDay()];
  const monthName = monthNames[currentDate.getMonth()];
  const day = currentDate.getDate();

  useEffect(() => {
    loadData();
    setupSocketListeners();
  }, []);

  // Filter subjects based on selected class
  useEffect(() => {
    if (selectedClass && subjects.length > 0) {
      console.log('📚 Filtering subjects for class:', selectedClass.name);
      console.log('📚 All subjects:', subjects);
      
      // Filter subjects that belong to the selected class
      const classSubjects = subjects.filter(subject => {
        // Check if the subject is associated with the selected class
        // Multiple ways to check the association:
        // 1. Subject has the class ID
        // 2. Class has subjects array containing this subject
        // 3. Subject belongs to the teacher's classes for this class
        const isAssociatedWithClass = 
          subject.classId === selectedClass._id || 
          (selectedClass.subjects && selectedClass.subjects.some(s => s._id === subject._id)) ||
          (subject.classes && subject.classes.some(c => c._id === selectedClass._id));
        
        console.log(`📚 Subject ${subject.name} (${subject._id}) associated with class ${selectedClass.name} (${selectedClass._id}):`, isAssociatedWithClass);
        return isAssociatedWithClass;
      });
      
      console.log('📚 Filtered subjects for class:', classSubjects);
      setClassFilteredSubjects(classSubjects);
      
      // Reset selected subject if it's not in the filtered list
      if (selectedSubject && !classSubjects.find(s => s._id === selectedSubject._id)) {
        console.log('📚 Resetting selected subject as it\'s not available for this class');
        setSelectedSubject(null);
      }
    } else {
      // If no class selected, show all subjects
      setClassFilteredSubjects(subjects);
    }
  }, [selectedClass, subjects, selectedSubject]);

  const loadData = async () => {
    try {
      setLoading(true);
      console.log('🔄 Loading data for NotesScreen...');
      await Promise.all([
        loadNotes(),
        loadClasses(),
        loadSubjects()
      ]);
      console.log('✅ Data loading completed');
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load notes data');
    } finally {
      setLoading(false);
    }
  };

  const loadNotes = async () => {
    try {
      const response = await ApiService.getNotesForTeacher();
      if (response.success) {
        setNotes(response.data);
        console.log('📝 Loaded notes:', response.data.length);
      }
    } catch (error) {
      console.error('Error loading notes:', error);
    }
  };

  const loadClasses = async () => {
    try {
      console.log('🔄 Loading classes...');
      const response = await ApiService.getClasses();
      console.log('📚 Classes response:', response);
      if (response.success) {
        setClasses(response.data);
        console.log('📚 Loaded classes:', response.data.length, response.data);
      } else {
        console.log('❌ Classes response failed:', response);
      }
    } catch (error) {
      console.error('Error loading classes:', error);
      Alert.alert('Error', 'Failed to load classes. Please try again.');
    }
  };

  const loadSubjects = async () => {
    try {
      console.log('🔄 Loading subjects...');
      const response = await ApiService.getSubjects();
      console.log('📖 Subjects response:', response);
      if (response.success) {
        setSubjects(response.data);
        console.log('📖 Loaded subjects:', response.data.length, response.data);
      } else {
        console.log('❌ Subjects response failed:', response);
      }
    } catch (error) {
      console.error('Error loading subjects:', error);
      Alert.alert('Error', 'Failed to load subjects. Please try again.');
    }
  };

  const setupSocketListeners = () => {
    // Listen for notes updates
    const handleNoteUpdate = (data) => {
      console.log('📝 Teacher: Received note update:', data);
      loadNotes(); // Reload notes when updated
    };

    SocketService.on('note_updated', handleNoteUpdate);
    SocketService.on('note_deleted', handleNoteUpdate);

    return () => {
      SocketService.off('note_updated', handleNoteUpdate);
      SocketService.off('note_deleted', handleNoteUpdate);
    };
  };

  const handleSelectFiles = async () => {
    try {
      // Check if we already have 5 files
      if (selectedFiles.length >= 5) {
        Alert.alert('Limit Reached', 'You can only attach up to 5 files per note.');
        return;
      }

      console.log('Opening document picker for notes...');

      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf', // Start with just PDF for better compatibility
        multiple: false,
        copyToCacheDirectory: true,
      });

      console.log('Notes DocumentPicker result:', JSON.stringify(result, null, 2));

      // Check result type
      if (result.type === 'cancel') {
        console.log('File selection was canceled');
        return;
      }

      if (result.canceled === true) {
        console.log('File selection was canceled (canceled flag)');
        return;
      }

      // Handle different result structures
      if (result.assets && result.assets.length > 0) {
        // New API structure
        const file = result.assets[0];
        const newFile = {
          name: file.name || 'Unknown File',
          uri: file.uri,
          size: file.size || 0,
          type: file.mimeType || 'application/pdf'
        };
        
        console.log('📎 Adding file to notes:', newFile);
        setSelectedFiles(prev => [...prev, newFile]);
      } else if (result.uri) {
        // Legacy API structure
        const newFile = {
          name: result.name || 'Unknown File',
          uri: result.uri,
          size: result.size || 0,
          type: result.type || 'application/pdf'
        };
        
        console.log('📎 Adding file to notes (legacy):', newFile);
        setSelectedFiles(prev => [...prev, newFile]);
      } else {
        console.log('📎 No valid file data found in result');
        Alert.alert('Error', 'No file selected');
      }
    } catch (error) {
      console.error('Error selecting files for notes:', error);
      Alert.alert('Error', 'Failed to select file: ' + error.message);
    }
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleCreateNote = async () => {
    if (!noteTitle.trim() || !noteContent.trim() || !selectedClass || !selectedSubject) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      setCreating(true);
      
      // If there are files, use the file upload method
      if (selectedFiles.length > 0) {
        const response = await ApiService.createNoteWithFiles({
          title: noteTitle.trim(),
          content: noteContent.trim(),
          classId: selectedClass._id,
          subjectId: selectedSubject._id
        }, selectedFiles);

        if (response.success) {
          Alert.alert('Success', 'Note with attachments created successfully!');
          setShowCreateModal(false);
          resetForm();
          loadNotes(); // Reload notes
        } else {
          Alert.alert('Error', response.error || 'Failed to create note');
        }
      } else {
        // Create note without files (existing functionality)
        const response = await ApiService.createNote({
          title: noteTitle.trim(),
          content: noteContent.trim(),
          classId: selectedClass._id,
          subjectId: selectedSubject._id
        });

        if (response.success) {
          Alert.alert('Success', 'Note created successfully!');
          setShowCreateModal(false);
          resetForm();
          loadNotes(); // Reload notes
        } else {
          Alert.alert('Error', response.error || 'Failed to create note');
        }
      }
    } catch (error) {
      console.error('Error creating note:', error);
      Alert.alert('Error', 'Failed to create note');
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setNoteTitle('');
    setNoteContent('');
    setSelectedClass(null);
    setSelectedSubject(null);
    setSelectedFiles([]);
    setClassFilteredSubjects([]);
  };

  const getSubjectColor = (subjectName) => {
    const colors = {
      'Mathematics': '#007AFF',
      'Science': '#34C759',
      'English': '#AF52DE',
      'History': '#FF9500',
      'Geography': '#FF3B30',
    };
    return colors[subjectName] || '#8E8E93';
  };

  // Group notes by subject for class notes display
  const classNotes = subjects.map(subject => {
    const subjectNotes = notes.filter(note => note.subjectId?._id === subject._id);
    return {
      subject: subject.name,
      count: subjectNotes.length,
      color: getSubjectColor(subject.name),
      notes: subjectNotes.map(note => ({
        id: note._id,
        title: note.title
      }))
    };
  }).filter(item => item.count > 0);

  // Recent uploads (last 5 notes)
  const recentUploads = notes
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5)
    .map(note => ({
      id: note._id,
      title: note.title,
      subject: note.subjectId?.name || 'Unknown',
      date: new Date(note.createdAt).toLocaleDateString(),
      type: 'Note',
      size: `${note.content.length} chars`,
      color: getSubjectColor(note.subjectId?.name),
    }));

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
          <Text style={styles.headerTitle}>Educational Notes</Text>
          {user?.school?.name && (
            <Text style={styles.schoolNameSubtitle}>{user.school.name}</Text>
          )}
          <TouchableOpacity 
            style={styles.createIconButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Ionicons name="add-circle" size={32} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Shared Resources Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Shared Resources</Text>
            <View style={styles.fileCountBadge}>
              <Text style={styles.fileCountText}>{notes.length} Files</Text>
            </View>
          </View>

          {/* Upload New Material Card */}
          <TouchableOpacity 
            style={styles.uploadCard}
            onPress={() => setShowCreateModal(true)}
            activeOpacity={0.8}
          >
            <View style={styles.uploadIcon}>
              <Ionicons name="cloud-upload-outline" size={32} color="#007AFF" />
            </View>
            <View style={styles.uploadContent}>
              <Text style={styles.uploadTitle}>Upload New Material</Text>
              <Text style={styles.uploadSubtext}>Share documents with your classes</Text>
            </View>
            <View style={styles.uploadPlusButton}>
              <Ionicons name="add" size={24} color="#007AFF" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Recent Notes Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Notes</Text>

          {recentUploads.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyStateIcon}>
                <Ionicons name="document-text-outline" size={64} color="#E5E5EA" />
              </View>
              <Text style={styles.emptyStateText}>No notes uploaded yet</Text>
            </View>
          ) : (
            recentUploads.map((upload) => (
              <TouchableOpacity 
                key={upload.id} 
                style={styles.noteCard}
                onPress={() => navigation.navigate('NoteDetail', { noteId: upload.id })}
                activeOpacity={0.7}
              >
                <View style={[styles.noteColorBar, { backgroundColor: upload.color }]} />
                <View style={styles.noteIconContainer}>
                  <Ionicons name="document-text" size={24} color={upload.color} />
                </View>
                <View style={styles.noteContent}>
                  <Text style={styles.noteTitle}>{upload.title}</Text>
                  <Text style={styles.noteSubject}>{upload.subject}</Text>
                  <Text style={styles.noteDate}>{upload.date}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Class Notes Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Class Notes</Text>

          {classNotes.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="folder-open-outline" size={48} color="#8E8E93" />
              <Text style={styles.emptyStateText}>No class notes available</Text>
            </View>
          ) : (
            classNotes.map((classNote, index) => (
              <View key={index} style={styles.classNoteSection}>
                <View style={styles.classNoteHeader}>
                  <View style={[styles.classNoteColorBar, { backgroundColor: classNote.color }]} />
                  <Text style={styles.classNoteTitle}>{classNote.subject}</Text>
                  <Text style={[styles.classNoteCount, { color: classNote.color }]}>
                    {classNote.count} notes
                  </Text>
                </View>
                
                <View style={styles.noteCards}>
                  {classNote.notes.slice(0, 3).map((note, noteIndex) => (
                    <TouchableOpacity 
                      key={noteIndex} 
                      style={styles.classNoteCard}
                      onPress={() => navigation.navigate('NoteDetail', { noteId: note.id })}
                    >
                      <Ionicons name="document-text" size={24} color={classNote.color} />
                      <Text style={styles.noteCardText}>{note.title}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Create Note Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.modalHeader, { paddingTop: insets.top + 20 }]}>
              <Text style={styles.modalTitle}>Create New Note</Text>
              <TouchableOpacity 
                onPress={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.debugText}>Modal is working! Classes: {classes.length}, Subjects: {subjects.length}</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Note Title</Text>
                <TextInput
                  style={styles.textInput}
                  value={noteTitle}
                  onChangeText={setNoteTitle}
                  placeholder="Enter note title"
                  multiline={false}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Select Class</Text>
                {loading ? (
                  <Text style={styles.noDataText}>Loading classes...</Text>
                ) : classes.length === 0 ? (
                  <Text style={styles.noDataText}>No classes available</Text>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.optionContainer}>
                      {classes.map((classItem) => (
                        <TouchableOpacity
                          key={classItem._id}
                          style={[
                            styles.optionButton,
                            selectedClass?._id === classItem._id && styles.selectedOption
                          ]}
                          onPress={() => {
                            console.log('📚 Class selected:', classItem.name);
                            setSelectedClass(classItem);
                            // Reset selected subject when class changes
                            setSelectedSubject(null);
                          }}
                        >
                          <Text style={[
                            styles.optionText,
                            selectedClass?._id === classItem._id && styles.selectedOptionText
                          ]}>
                            {classItem.name} {classItem.section}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Select Subject {selectedClass ? `for ${selectedClass.name}` : ''}
                </Text>
                {loading ? (
                  <Text style={styles.noDataText}>Loading subjects...</Text>
                ) : !selectedClass ? (
                  <Text style={styles.noDataText}>Please select a class first</Text>
                ) : classFilteredSubjects.length === 0 ? (
                  <Text style={styles.noDataText}>No subjects available for this class</Text>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.optionContainer}>
                      {classFilteredSubjects.map((subject) => (
                        <TouchableOpacity
                          key={subject._id}
                          style={[
                            styles.optionButton,
                            selectedSubject?._id === subject._id && styles.selectedOption
                          ]}
                          onPress={() => setSelectedSubject(subject)}
                        >
                          <Text style={[
                            styles.optionText,
                            selectedSubject?._id === subject._id && styles.selectedOptionText
                          ]}>
                            {subject.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Note Content</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={noteContent}
                  onChangeText={setNoteContent}
                  placeholder="Enter note content..."
                  multiline={true}
                  numberOfLines={6}
                />
              </View>

              {/* File Attachments Section */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Attachments (Optional)</Text>
                <Text style={styles.inputSubtext}>You can attach PDF files to your note</Text>
                
                <TouchableOpacity 
                  style={styles.fileSelectButton}
                  onPress={handleSelectFiles}
                  disabled={selectedFiles.length >= 5}
                >
                  <Ionicons name="attach" size={20} color="#007AFF" />
                  <Text style={styles.fileSelectButtonText}>
                    {selectedFiles.length >= 5 ? 'Max 5 files' : 'Select PDF File'}
                  </Text>
                </TouchableOpacity>

                {/* Selected Files List */}
                {selectedFiles.length > 0 && (
                  <View style={styles.selectedFilesContainer}>
                    <Text style={styles.selectedFilesTitle}>Selected Files:</Text>
                    {selectedFiles.map((file, index) => (
                      <View key={index} style={styles.fileItem}>
                        <View style={styles.fileInfo}>
                          <Ionicons name="document-text" size={20} color="#007AFF" />
                          <View style={styles.fileDetails}>
                            <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                            <Text style={styles.fileSize}>{formatFileSize(file.size)}</Text>
                          </View>
                        </View>
                        <TouchableOpacity 
                          style={styles.removeFileButton}
                          onPress={() => removeFile(index)}
                        >
                          <Ionicons name="close-circle" size={20} color="#FF3B30" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.createButton, creating && styles.disabledButton]}
                onPress={handleCreateNote}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.createButtonText}>Create Note</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
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
    paddingHorizontal: 20,
    paddingBottom: 20,
    position: 'relative',
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
    position: 'absolute',
    right: 20,
    top: 0,
    padding: 4,
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
  },
  fileCountBadge: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  fileCountText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
  },
  uploadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  uploadIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  uploadContent: {
    flex: 1,
  },
  uploadTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  uploadSubtext: {
    fontSize: 14,
    color: '#8E8E93',
  },
  uploadPlusButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginTop: 8,
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
  noteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  noteColorBar: {
    width: 4,
    height: '100%',
  },
  noteIconContainer: {
    padding: 16,
  },
  noteContent: {
    flex: 1,
    paddingVertical: 16,
  },
  noteTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  noteSubject: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
    textTransform: 'lowercase',
  },
  noteDate: {
    fontSize: 13,
    color: '#8E8E93',
  },
  classNoteSection: {
    marginBottom: 24,
  },
  classNoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  classNoteColorBar: {
    width: 4,
    height: 20,
    borderRadius: 2,
    marginRight: 12,
  },
  classNoteTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
  },
  classNoteCount: {
    fontSize: 14,
    fontWeight: '500',
  },
  noteCards: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  classNoteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    minWidth: 80,
  },
  noteCardText: {
    fontSize: 12,
    color: '#000000',
    marginTop: 8,
    textAlign: 'center',
  },
  noDataText: {
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '85%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  optionContainer: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  optionButton: {
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  selectedOption: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  optionText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  selectedOptionText: {
    color: '#FFFFFF',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    paddingVertical: 12,
    marginRight: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
  },
  createButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 12,
    marginLeft: 8,
    alignItems: 'center',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  disabledButton: {
    backgroundColor: '#C7C7CC',
  },
  debugText: {
    fontSize: 12,
    color: '#FF3B30',
    backgroundColor: '#FFEBEE',
    padding: 8,
    borderRadius: 4,
    marginBottom: 16,
    textAlign: 'center',
  },
  inputSubtext: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  fileSelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  fileSelectButtonText: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 8,
    fontWeight: '500',
  },
  selectedFilesContainer: {
    marginTop: 8,
  },
  selectedFilesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  fileDetails: {
    marginLeft: 12,
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 2,
  },
  fileSize: {
    fontSize: 12,
    color: '#8E8E93',
  },
  removeFileButton: {
    padding: 4,
  },
});
