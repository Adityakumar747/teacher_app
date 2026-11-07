import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ApiService from '../services/api';
import API_BASE_URL from '../config/api';

export default function SyllabusDetailScreen({ route, navigation }) {
  const { syllabus: initialSyllabus } = route.params;
  const [syllabus, setSyllabus] = useState(initialSyllabus);
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (initialSyllabus && initialSyllabus._id) {
      loadFullSyllabus();
    }
  }, [initialSyllabus]);

  const loadFullSyllabus = async () => {
    try {
      setLoading(true);
      const response = await ApiService.getSyllabusById(initialSyllabus._id);
      if (response.success) {
        setSyllabus(response.data);
      }
    } catch (error) {
      console.error('Error loading full syllabus:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDocument = async (document) => {
    if (!document.url) {
      Alert.alert('Error', 'Document URL is not available');
      return;
    }

    // Extract base URL from API_BASE_URL (remove /api) - same as assignments
    const baseUrl = API_BASE_URL.replace('/api', '');
    let fullUrl = document.url;
    
    // If URL contains localhost or 127.0.0.1, replace with correct server IP
    if (fullUrl.includes('localhost') || fullUrl.includes('127.0.0.1')) {
      // Extract just the path part
      const urlPath = fullUrl.replace(/https?:\/\/[^\/]+/, '');
      fullUrl = `${baseUrl}${urlPath}`;
    } else if (fullUrl.startsWith('/')) {
      // If it's a relative path (starts with /), prepend base URL
      fullUrl = `${baseUrl}${fullUrl}`;
    } else if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
      // If it doesn't start with http, add base URL
      fullUrl = `${baseUrl}/${fullUrl}`;
    }

    console.log('Opening document:', {
      original: document.url,
      final: fullUrl,
      baseUrl: baseUrl
    });

    try {
      // Open file directly using Linking - works for PDF, images, videos
      // Same approach as assignments where teachers view student submissions
      await Linking.openURL(fullUrl);
    } catch (error) {
      console.error('Error opening document:', error);
      Alert.alert('Error', 'Could not open the document. Please check your connection.');
    }
  };

  const classDisplay = syllabus.classId?.name && syllabus.classId?.section
    ? `${syllabus.classId.name} ${syllabus.classId.section}`
    : syllabus.classId?.name || 'Unknown Class';
  
  const subjectDisplay = syllabus.subjectId?.name || 'Unknown Subject';
  const subjectCode = syllabus.subjectId?.code || '';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {subjectDisplay}
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Class and Subject Info */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="book-outline" size={20} color="#007AFF" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Subject</Text>
              <Text style={styles.infoValue}>{subjectDisplay}</Text>
              {subjectCode ? (
                <Text style={styles.infoSubtext}>{subjectCode}</Text>
              ) : null}
            </View>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.infoRow}>
            <Ionicons name="school-outline" size={20} color="#34C759" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Class</Text>
              <Text style={styles.infoValue}>{classDisplay}</Text>
            </View>
          </View>
          
          {syllabus.academicYear && (
            <>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Ionicons name="calendar-outline" size={20} color="#FF9500" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Academic Year</Text>
                  <Text style={styles.infoValue}>{syllabus.academicYear}</Text>
                </View>
              </View>
            </>
          )}

          {syllabus.category && (
            <>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Ionicons name="pricetag-outline" size={20} color="#AF52DE" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Category</Text>
                  <Text style={styles.infoValue}>{syllabus.category}</Text>
                </View>
              </View>
            </>
          )}

          {syllabus.contentType && (
            <>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Ionicons 
                  name={
                    syllabus.contentType === 'upload_content' 
                      ? 'cloud-upload-outline'
                      : syllabus.contentType === 'assignment'
                      ? 'document-text-outline'
                      : syllabus.contentType === 'lesson_plan'
                      ? 'calendar-outline'
                      : 'book-outline'
                  } 
                  size={20} 
                  color="#FF3B30" 
                />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Content Type</Text>
                  <Text style={styles.infoValue}>
                    {syllabus.contentType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* Syllabus Content */}
        {syllabus.syllabusContent && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Syllabus Content</Text>
            <Text style={styles.contentText}>{syllabus.syllabusContent}</Text>
          </View>
        )}

        {/* Topics */}
        {syllabus.topics && syllabus.topics.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Topics ({syllabus.topics.length})
            </Text>
            {syllabus.topics.map((topic, index) => (
              <View key={index} style={styles.topicItem}>
                <View style={styles.topicNumber}>
                  <Text style={styles.topicNumberText}>{index + 1}</Text>
                </View>
                <View style={styles.topicContent}>
                  <Text style={styles.topicTitle}>{topic.topic}</Text>
                  {topic.description && (
                    <Text style={styles.topicDescription}>
                      {topic.description}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Learning Objectives */}
        {syllabus.learningObjectives && syllabus.learningObjectives.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Learning Objectives</Text>
            {syllabus.learningObjectives.map((objective, index) => (
              <View key={index} style={styles.objectiveItem}>
                <Ionicons name="checkmark-circle" size={20} color="#34C759" />
                <Text style={styles.objectiveText}>{objective}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Assessment Criteria */}
        {syllabus.assessmentCriteria && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Assessment Criteria</Text>
            <Text style={styles.contentText}>{syllabus.assessmentCriteria}</Text>
          </View>
        )}

        {/* Resources */}
        {syllabus.resources && syllabus.resources.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Resources</Text>
            {syllabus.resources.map((resource, index) => (
              <TouchableOpacity
                key={index}
                style={styles.resourceItem}
                onPress={() => {
                  if (resource.url) {
                    Linking.openURL(resource.url).catch(err => {
                      Alert.alert('Error', 'Could not open the resource URL');
                    });
                  }
                }}
                disabled={!resource.url}
              >
                <Ionicons
                  name={
                    resource.type === 'video'
                      ? 'videocam-outline'
                      : resource.type === 'website'
                      ? 'globe-outline'
                      : 'document-text-outline'
                  }
                  size={20}
                  color="#007AFF"
                />
                <View style={styles.resourceContent}>
                  <Text style={styles.resourceTitle}>{resource.title}</Text>
                  <Text style={styles.resourceType}>{resource.type}</Text>
                  {resource.url && (
                    <Text style={styles.resourceUrl} numberOfLines={1}>
                      {resource.url}
                    </Text>
                  )}
                </View>
                {resource.url && (
                  <Ionicons name="open-outline" size={20} color="#007AFF" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Documents/Files */}
        {syllabus.documents && syllabus.documents.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Documents & Files ({syllabus.documents.length})
            </Text>
            {syllabus.documents.map((document, index) => {
              // Determine file type for icon
              const isVideo = document.url?.toLowerCase().includes('.mp4') || 
                             document.url?.toLowerCase().includes('.mov') ||
                             document.url?.toLowerCase().includes('.avi');
              const isImage = document.url?.toLowerCase().includes('.jpg') || 
                             document.url?.toLowerCase().includes('.jpeg') ||
                             document.url?.toLowerCase().includes('.png') ||
                             document.url?.toLowerCase().includes('.gif');
              const isPdf = document.url?.toLowerCase().includes('.pdf') || 
                           document.name?.toLowerCase().endsWith('.pdf');
              
              return (
                <TouchableOpacity
                  key={index}
                  style={styles.documentItem}
                  onPress={() => handleOpenDocument(document)}
                  activeOpacity={0.7}
                >
                  <View style={styles.documentIcon}>
                    <Ionicons
                      name={
                        isVideo
                          ? 'videocam-outline'
                          : isPdf
                          ? 'document-text-outline'
                          : isImage
                          ? 'image-outline'
                          : 'document-outline'
                      }
                      size={24}
                      color="#007AFF"
                    />
                  </View>
                  <View style={styles.documentContent}>
                    <Text style={styles.documentTitle}>{document.name || 'Document'}</Text>
                    {document.description && (
                      <Text style={styles.documentDescription} numberOfLines={2}>
                        {document.description}
                      </Text>
                    )}
                    {document.uploadedAt && (
                      <Text style={styles.documentDate}>
                        Uploaded: {new Date(document.uploadedAt).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="open-outline" size={24} color="#007AFF" />
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 0, // Will be set dynamically
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  infoContent: {
    marginLeft: 12,
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  infoSubtext: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E5EA',
    marginVertical: 12,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 16,
  },
  contentText: {
    fontSize: 15,
    lineHeight: 24,
    color: '#000000',
  },
  scheduleItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  scheduleDay: {
    width: 80,
  },
  scheduleDayText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  scheduleDetails: {
    flex: 1,
  },
  scheduleTime: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 4,
  },
  scheduleRoom: {
    fontSize: 12,
    color: '#8E8E93',
  },
  topicItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  topicNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  topicNumberText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  topicContent: {
    flex: 1,
  },
  topicTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  topicDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#8E8E93',
  },
  objectiveItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  objectiveText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#000000',
    marginLeft: 12,
    flex: 1,
  },
  resourceItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  resourceContent: {
    marginLeft: 12,
    flex: 1,
  },
  resourceTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  resourceType: {
    fontSize: 12,
    color: '#8E8E93',
    textTransform: 'capitalize',
    marginBottom: 4,
  },
  resourceUrl: {
    fontSize: 12,
    color: '#007AFF',
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
  },
  documentIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  documentContent: {
    flex: 1,
  },
  documentTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  documentDescription: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 4,
  },
  documentDate: {
    fontSize: 11,
    color: '#8E8E93',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

