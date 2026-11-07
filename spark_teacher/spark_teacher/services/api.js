import { auth } from '../config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import API_BASE_URL from '../config/api';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.onUnauthorized = null;
  }

  setUnauthorizedHandler(handler) {
    this.onUnauthorized = handler;
  }

  // Generic request method
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    let token = null;
    try {
      if (auth && auth.currentUser) {
        token = await auth.currentUser.getIdToken();
      }
    } catch (tokenErr) {
      // Fallback to stored token if offline or getIdToken fails
    }
    if (!token) {
      token = await AsyncStorage.getItem('authToken');
    }

    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

    const controller = new AbortController();
    const timeoutDuration = options.timeoutMs || 15000; // 15-second timeout
    const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

    const config = {
      ...options,
      signal: controller.signal,
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      clearTimeout(timeoutId);

      if (response.status === 401) {
        console.warn('⚠️ API 401 Unauthorized received. Clearing auth token.');
        await AsyncStorage.removeItem('authToken');
        if (typeof this.onUnauthorized === 'function') {
          this.onUnauthorized();
        }
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Request failed with status ${response.status}`);
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timed out. Please check your connection and try again.');
      }
      if (error.message && error.message.includes('Network request failed')) {
        throw new Error('Cannot connect to server. Please check your network connection.');
      }
      throw error;
    }
  }

  // Authentication methods
  async login(email, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async firebaseLogin(idToken) {
    return this.request('/auth/firebase-login', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
  }

  async getMe() {
    return this.request('/auth/me');
  }

  async getTeacherProfile() {
    return this.request('/teachers/me');
  }

  // Leave methods
  async getLeaves(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/leaves${queryString ? `?${queryString}` : ''}`);
  }

  async applyLeave(leaveData) {
    return this.request('/leaves', {
      method: 'POST',
      body: JSON.stringify(leaveData),
    });
  }

  async getMyClassStudents() {
    return this.request('/teachers/my-class/students');
  }

  async getClassTeacherAnalytics() {
    return this.request('/teachers/my-class/analytics');
  }

  async getClassStudentAttendance(studentId) {
    return this.request(`/teachers/my-class/students/${studentId}/attendance`);
  }

  async getAcademicCalendar(year, month) {
    const params = new URLSearchParams();
    if (year) params.append('year', String(year));
    if (month) params.append('month', String(month));
    const qs = params.toString();
    return this.request(`/calendar/calendar${qs ? `?${qs}` : ''}`);
  }

  async getLeaveById(leaveId) {
    return this.request(`/leaves/${leaveId}`);
  }

  async logout() {
    return this.request('/auth/logout', {
      method: 'POST',
    });
  }

  // Schedule & Dashboard methods
  async getClassesToday(teacherId = 'me', date = null) {
    const query = date ? `?date=${date}` : '';
    return this.request(`/teachers/${teacherId}/classes-today${query}`);
  }

  async getSchedules(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/schedules${queryString ? `?${queryString}` : ''}`);
  }

  async getTeacherSchedule(teacherId, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/schedules/teacher/${teacherId}${queryString ? `?${queryString}` : ''}`);
  }

  async getWeeklySchedule(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/schedules/weekly${queryString ? `?${queryString}` : ''}`);
  }

  // Student methods
  async getStudents(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/students${queryString ? `?${queryString}` : ''}`);
  }

  // Attendance methods
  async getAttendance(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/attendance${queryString ? `?${queryString}` : ''}`);
  }

  async markAttendance(attendanceData) {
    return this.request('/attendance', {
      method: 'POST',
      body: JSON.stringify(attendanceData),
    });
  }

  // Assignment & Homework methods
  async getAssignments(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/homework${queryString ? `?${queryString}` : ''}`);
  }

  async getHomework(params = {}) {
    return this.getAssignments(params);
  }

  async getAssignment(assignmentId) {
    return this.request(`/homework/${assignmentId}`);
  }

  async getHomeworkById(assignmentId) {
    return this.getAssignment(assignmentId);
  }

  async getHomeworkSubmissions(assignmentId) {
    return this.request(`/homework/${assignmentId}/submissions`);
  }

  async gradeSubmission(submissionId, gradeData, assignmentId = null) {
    const endpoint = assignmentId
      ? `/homework/${assignmentId}/submissions/${submissionId}/grade`
      : `/homework/submissions/${submissionId}/grade`;
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(gradeData),
    });
  }

  async getUploadSignature(fileType = 'pdf', folder = 'sparkology/homework') {
    return this.request('/uploads/sign', {
      method: 'POST',
      body: JSON.stringify({ fileType, folder }),
    });
  }

  async createAssignment(assignmentData) {
    return this.request('/homework', {
      method: 'POST',
      body: JSON.stringify(assignmentData),
    });
  }

  async createHomework(assignmentData) {
    return this.createAssignment(assignmentData);
  }

  async createAssignmentWithFiles(assignmentData, files) {
    try {
      if (typeof FormData !== 'undefined') {
        const formData = new FormData();
        formData.append('title', assignmentData.title);
        formData.append('description', assignmentData.description || '');
        formData.append('classId', assignmentData.classId);
        formData.append('subjectId', assignmentData.subjectId);
        formData.append('dueDate', assignmentData.dueDate);
        formData.append('dueTime', assignmentData.dueTime || '23:59');
        formData.append('totalMarks', String(assignmentData.totalMarks || 0));
        formData.append('points', String(assignmentData.points || 0));
        if (files && files.length > 0) {
          for (const f of files) {
            if (f.rawFile) {
              formData.append('files', f.rawFile, f.name);
            } else if (typeof window !== 'undefined' && f.uri && f.uri.startsWith('blob:')) {
              try {
                const b = await (await fetch(f.uri)).blob();
                formData.append('files', b, f.name || 'attachment');
              } catch (e) {
                formData.append('files', {
                  uri: f.uri,
                  name: f.name || 'attachment',
                  type: f.mimeType || 'application/octet-stream',
                });
              }
            } else if (f.uri) {
              formData.append('files', {
                uri: f.uri,
                name: f.name || 'attachment',
                type: f.mimeType || 'application/octet-stream',
              });
            }
          }
        }
        return await this.request('/homework', {
          method: 'POST',
          body: formData,
        });
      }

      const token = await AsyncStorage.getItem('authToken');
      const uploadResult = await FileSystem.uploadAsync(
        `${this.baseURL}/homework`,
        files[0].uri,
        {
          httpMethod: 'POST',
          uploadType: 1,
          fieldName: 'files',
          parameters: {
            title: assignmentData.title,
            description: assignmentData.description,
            classId: assignmentData.classId,
            subjectId: assignmentData.subjectId,
            dueDate: assignmentData.dueDate,
            dueTime: assignmentData.dueTime,
            totalMarks: String(assignmentData.totalMarks || 0),
            points: String(assignmentData.points || 0),
          },
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        }
      );
      const data = JSON.parse(uploadResult.body);
      if (uploadResult.status !== 200 && uploadResult.status !== 201) {
        throw new Error(data.error || `Assignment creation failed with status ${uploadResult.status}`);
      }
      return data;
    } catch (error) {
      throw error;
    }
  }

  async updateAssignment(assignmentId, assignmentData) {
    return this.request(`/homework/${assignmentId}`, {
      method: 'PUT',
      body: JSON.stringify(assignmentData),
    });
  }

  async deleteAssignment(assignmentId) {
    return this.request(`/homework/${assignmentId}`, {
      method: 'DELETE',
    });
  }

  async getTeacherClasses() {
    return this.request('/assignments/teacher/classes');
  }

  // Classes and Subjects methods for teachers
  async getClasses() {
    // This will return classes with subjects that the teacher teaches
    return this.request('/assignments/teacher/classes');
  }

  async getSubjects() {
    // For now, we'll extract subjects from the teacher classes response
    // In the future, this could be a dedicated endpoint
    const response = await this.request('/assignments/teacher/classes');
    if (response.success && response.data) {
      // Extract unique subjects from the classes
      const subjects = [];
      const subjectMap = new Map();
      
      response.data.forEach(classItem => {
        if (classItem.subjects) {
          classItem.subjects.forEach(subject => {
            if (!subjectMap.has(subject._id)) {
              subjectMap.set(subject._id, subject);
              subjects.push(subject);
            }
          });
        }
      });
      
      return {
        success: true,
        data: subjects
      };
    }
    return response;
  }

  // Student methods
  async getStudentsByClass(classId, params = {}) {
    const queryString = new URLSearchParams({ classId, ...params }).toString();
    return this.request(`/students${queryString ? `?${queryString}` : ''}`);
  }

  // Attendance methods
  async getSlotAttendance(slotId, date = null) {
    const query = date ? `?date=${date}` : '';
    return this.request(`/attendance/slot/${slotId}${query}`);
  }

  async getAttendanceHistory(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/attendance/history${queryString ? `?${queryString}` : ''}`);
  }

  async getAttendanceForClass(classId, subjectId, date, params = {}) {
    const queryString = new URLSearchParams({ classId, subjectId, date, ...params }).toString();
    return this.request(`/attendance${queryString ? `?${queryString}` : ''}`);
  }

  async markBulkAttendance(data) {
    // Supports either { slotId, date, records } or an array of legacy attendanceRecords
    const body = Array.isArray(data) ? { attendanceRecords: data } : data;
    return this.request('/attendance/bulk', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // Group methods
  async getGroups(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/groups${queryString ? `?${queryString}` : ''}`);
  }

  async getGroup(groupId) {
    return this.request(`/groups/${groupId}`);
  }

  async createGroup(groupData) {
    return this.request('/groups', {
      method: 'POST',
      body: JSON.stringify(groupData),
    });
  }

  async updateGroup(groupId, groupData) {
    return this.request(`/groups/${groupId}`, {
      method: 'PUT',
      body: JSON.stringify(groupData),
    });
  }

  async deleteGroup(groupId) {
    return this.request(`/groups/${groupId}`, {
      method: 'DELETE',
    });
  }

  async addGroupMembers(groupId, memberData) {
    return this.request(`/groups/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify(memberData),
    });
  }

  async removeGroupMembers(groupId, memberData) {
    return this.request(`/groups/${groupId}/members`, {
      method: 'DELETE',
      body: JSON.stringify(memberData),
    });
  }

  async getAvailableStudents(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/groups/available-students${queryString ? `?${queryString}` : ''}`);
  }

  // Message methods
  async getGroupMessages(groupId, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/messages/group/${groupId}${queryString ? `?${queryString}` : ''}`);
  }

  async sendMessage(messageData) {
    return this.request('/messages', {
      method: 'POST',
      body: JSON.stringify(messageData),
    });
  }

  async markMessagesAsRead(groupId, type = 'group') {
    if (type === 'direct') {
      // For direct messages, we need to mark messages from a specific contact as read
      return this.request(`/messages/direct/${groupId}/read`, {
        method: 'PUT',
      });
    } else {
      // For group messages
      return this.request(`/messages/group/${groupId}/read`, {
        method: 'PUT',
      });
    }
  }

  async editMessage(messageId, content) {
    return this.request(`/messages/${messageId}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
  }

  async deleteMessage(messageId) {
    return this.request(`/messages/${messageId}`, {
      method: 'DELETE',
    });
  }

  async addReaction(messageId, emoji) {
    return this.request(`/messages/${messageId}/reaction`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    });
  }

  async removeReaction(messageId) {
    return this.request(`/messages/${messageId}/reaction`, {
      method: 'DELETE',
    });
  }

  async getUnreadCounts() {
    return this.request('/messages/unread-counts');
  }

  // Video Call methods - REMOVED

  // Profile methods
  async getTeacherProfileDetails() {
    return this.request('/teachers/me');
  }

  // Individual chat methods
  async createOrFindIndividualChat(contactId, contactType) {
    return this.request('/groups/individual-chat', {
      method: 'POST',
      body: JSON.stringify({ contactId, contactType }),
    });
  }

  async getIndividualChats(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/groups/individual-chats${queryString ? `?${queryString}` : ''}`);
  }

  // Direct message methods
  async sendDirectMessage(messageData) {
    return this.request('/messages/direct', {
      method: 'POST',
      body: JSON.stringify(messageData),
    });
  }

  async getDirectMessages(recipientId, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/messages/direct/${recipientId}${queryString ? `?${queryString}` : ''}`);
  }

  // Notes API methods
  async createNote(noteData) {
    return this.request('/notes', {
      method: 'POST',
      body: JSON.stringify(noteData),
    });
  }

  async createNoteWithFiles(noteData, files) {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const uploadResult = await FileSystem.uploadAsync(
        `${this.baseURL}/notes`,
        files[0].uri,
        {
          httpMethod: 'POST',
          uploadType: 1,
          fieldName: 'files',
          parameters: {
            title: noteData.title,
            content: noteData.content,
            classId: noteData.classId,
            subjectId: noteData.subjectId,
          },
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        }
      );
      const data = JSON.parse(uploadResult.body);
      if (uploadResult.status !== 200 && uploadResult.status !== 201) {
        throw new Error(data.error || `Note creation failed with status ${uploadResult.status}`);
      }
      return data;
    } catch (error) {
      throw error;
    }
  }

  async getNotesForTeacher() {
    return this.request('/notes/teacher');
  }

  async getNotesForClassSubject(classId, subjectId) {
    return this.request(`/notes/class/${classId}/subject/${subjectId}`);
  }

  async getNoteById(noteId) {
    return this.request(`/notes/${noteId}`);
  }

  async updateNote(noteId, noteData) {
    return this.request(`/notes/${noteId}`, {
      method: 'PUT',
      body: JSON.stringify(noteData),
    });
  }

  async deleteNote(noteId) {
    return this.request(`/notes/${noteId}`, {
      method: 'DELETE',
    });
  }

  async updateNoteAttachments(noteId, attachments) {
    return this.request(`/notes/${noteId}/attachments`, {
      method: 'PUT',
      body: JSON.stringify({ attachments }),
    });
  }

  async updateNoteWithFiles(noteId, noteData, files) {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const uploadResult = await FileSystem.uploadAsync(
        `${this.baseURL}/notes/${noteId}/attachments`,
        files[0].uri,
        {
          httpMethod: 'POST',
          uploadType: 1,
          fieldName: 'files',
          parameters: {
            title: noteData.title,
            content: noteData.content,
            classId: noteData.classId,
            subjectId: noteData.subjectId,
          },
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        }
      );
      const data = JSON.parse(uploadResult.body);
      if (uploadResult.status !== 200 && uploadResult.status !== 201) {
        throw new Error(data.error || `Note update failed with status ${uploadResult.status}`);
      }
      return data;
    } catch (error) {
      throw error;
    }
  }

  // Meeting API methods
  async getMeetings(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/meetings${queryString ? `?${queryString}` : ''}`);
  }

  async getMeeting(meetingId) {
    return this.request(`/meetings/${meetingId}`);
  }

  async createMeeting(meetingData) {
    return this.request('/meetings', {
      method: 'POST',
      body: JSON.stringify(meetingData),
    });
  }

  async updateMeeting(meetingId, meetingData) {
    return this.request(`/meetings/${meetingId}`, {
      method: 'PUT',
      body: JSON.stringify(meetingData),
    });
  }

  async deleteMeeting(meetingId) {
    return this.request(`/meetings/${meetingId}`, {
      method: 'DELETE',
    });
  }

  async getTeacherClassesForMeetings() {
    return this.request('/meetings/teacher/classes');
  }

  async getUpcomingMeetings() {
    return this.request('/meetings/upcoming');
  }

  async getPastMeetings() {
    return this.request('/meetings/past');
  }

  // Syllabus API methods
  async getTeacherSyllabus(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/syllabus/teacher${queryString ? `?${queryString}` : ''}`);
  }

  async getSyllabusById(syllabusId) {
    return this.request(`/syllabus/${syllabusId}`);
  }

  async getSyllabusByClassSubject(classId, subjectId, academicYear) {
    const params = academicYear ? `?academicYear=${academicYear}` : '';
    return this.request(`/syllabus/class/${classId}/subject/${subjectId}${params}`);
  }
}

export default new ApiService();
