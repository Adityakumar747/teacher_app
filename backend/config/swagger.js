/**
 * OpenAPI 3.0 Specification for Sparkology ERP & Teacher Portal API
 */

const swaggerDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Sparkology ERP & Teacher Portal API',
    version: '1.0.0',
    description: `Complete REST API Documentation for Sparkology School Management System & Teacher App.
    
### 🔐 Authentication:
1. Go to **Auth > POST /api/auth/login** and login with:
   - **Email:** \`teacher@spark.edu\`
   - **Password:** \`teacher123\`
2. Copy the **\`token\`** from the response.
3. Click the green **Authorize 🔓** button at the top right, paste the token, and click **Authorize**.
4. Now you can test all protected endpoints directly from this Swagger UI!`
  },
  servers: [
    {
      url: 'http://localhost:5000',
      description: 'Local Development Server'
    },
    {
      url: 'http://192.168.1.11:5000',
      description: 'Local LAN Server (Mobile Devices)'
    }
  ],
  tags: [
    { name: 'System', description: 'Server Health & Diagnostics' },
    { name: 'Auth', description: 'Authentication & Session Management' },
    { name: 'Teacher Portal', description: 'Teacher Profile, Timetable, and Analytics' },
    { name: 'Attendance', description: 'Student Attendance & Slot Audits' },
    { name: 'Assignments', description: 'Homework Creation, Submissions & Grading' },
    { name: 'Leaves', description: 'Teacher Leave Management' },
    { name: 'Classes & Subjects', description: 'Academic Classes, Subjects & Syllabus' },
    { name: 'Students', description: 'Student Profiles & Management' },
    { name: 'Announcements', description: 'School Notices & Broadcasts' },
    { name: 'Uploads', description: 'Cloudinary Media & Document Uploads' }
  ],
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Server Health Check',
        responses: {
          '200': {
            description: 'Server is running healthy',
            content: {
              'application/json': {
                example: {
                  status: 'OK',
                  timestamp: '2026-11-07T06:00:00.000Z',
                  uptime: 1234.56,
                  environment: 'development'
                }
              }
            }
          }
        }
      }
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'User Login',
        description: 'Authenticate user with email and password to receive JWT token.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', example: 'teacher@spark.edu' },
                  password: { type: 'string', example: 'teacher123' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Login successful',
            content: {
              'application/json': {
                example: {
                  success: true,
                  message: 'Login successful',
                  data: {
                    user: {
                      id: '6ae76903f34fcf4bb228e16c',
                      name: 'Demo Teacher',
                      email: 'teacher@spark.edu',
                      role: 'teacher'
                    },
                    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
                  }
                }
              }
            }
          },
          '401': { description: 'Invalid credentials' }
        }
      }
    },
    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get Authenticated User Profile',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Current user profile data' },
          '401': { description: 'Unauthorized' }
        }
      }
    },
    '/api/teachers/me': {
      get: {
        tags: ['Teacher Portal'],
        summary: 'Get Teacher Profile & Ordered Weekly Timetable',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Returns profile details and Monday-to-Sunday timetable',
            content: {
              'application/json': {
                example: {
                  success: true,
                  data: {
                    teacher: { id: '6ae76903f34fcf4bb228e16c', name: 'Demo Teacher' },
                    weeklyTimetable: [],
                    timetableByDay: { Monday: [], Tuesday: [] }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/teachers/me/classes-today': {
      get: {
        tags: ['Teacher Portal'],
        summary: 'Get Scheduled Classes for Today (IST)',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Returns today\'s scheduled teaching slots with statuses' }
        }
      }
    },
    '/api/teachers/my-class/students': {
      get: {
        tags: ['Teacher Portal'],
        summary: 'Get Class Teacher Student Roster',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'List of students with overall attendance percentage' }
        }
      }
    },
    '/api/teachers/my-class/analytics': {
      get: {
        tags: ['Teacher Portal'],
        summary: 'Get Class Analytics Summary',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Aggregated attendance and performance analytics' }
        }
      }
    },
    '/api/attendance/slot/{slotId}': {
      get: {
        tags: ['Attendance'],
        summary: 'Get Slot Attendance Roster',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'slotId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            example: '6aea0701f4464cf3b7263e43'
          },
          {
            name: 'date',
            in: 'query',
            required: false,
            schema: { type: 'string', format: 'date' },
            example: '2026-11-07'
          }
        ],
        responses: {
          '200': { description: 'Returns active student roster and lock status' }
        }
      }
    },
    '/api/attendance/bulk': {
      post: {
        tags: ['Attendance'],
        summary: 'Bulk Save / Edit Slot Attendance',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['scheduleId', 'date', 'records'],
                properties: {
                  scheduleId: { type: 'string', example: '6aea0701f4464cf3b7263e43' },
                  date: { type: 'string', format: 'date', example: '2026-11-07' },
                  records: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        studentId: { type: 'string' },
                        status: { type: 'string', enum: ['present', 'absent', 'late', 'half_day'] },
                        remarks: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Attendance saved successfully' },
          '400': { description: 'Validation error (e.g., future date or duplicate students)' }
        }
      }
    },
    '/api/assignments': {
      get: {
        tags: ['Assignments'],
        summary: 'List Assignments',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'List of homework assignments' }
        }
      },
      post: {
        tags: ['Assignments'],
        summary: 'Create New Assignment',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'classId', 'subjectId', 'dueDate'],
                properties: {
                  title: { type: 'string', example: 'Chapter 4 Exercises' },
                  description: { type: 'string', example: 'Solve questions 1 through 10' },
                  classId: { type: 'string', example: '6ae76933fa64b2df6e9611cc' },
                  subjectId: { type: 'string', example: '6ae76933fa64b2df6e9611cf' },
                  dueDate: { type: 'string', format: 'date', example: '2026-11-15' },
                  totalMarks: { type: 'number', example: 50 }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Assignment created successfully' }
        }
      }
    },
    '/api/homework/{id}/submissions': {
      get: {
        tags: ['Assignments'],
        summary: 'Get Assignment Submissions',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'List of student submissions for this assignment' }
        }
      }
    },
    '/api/homework/submissions/{submissionId}/grade': {
      patch: {
        tags: ['Assignments'],
        summary: 'Grade Student Submission',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'submissionId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  marks: { type: 'number', example: 45 },
                  feedback: { type: 'string', example: 'Well solved!' },
                  status: { type: 'string', enum: ['graded', 'resubmit_requested'] }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Submission graded successfully' }
        }
      }
    },
    '/api/leaves': {
      get: {
        tags: ['Leaves'],
        summary: 'List Teacher Leaves',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'List of leaves applied by teacher' }
        }
      },
      post: {
        tags: ['Leaves'],
        summary: 'Apply for Leave',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['leaveType', 'startDate', 'endDate', 'reason'],
                properties: {
                  leaveType: { type: 'string', enum: ['sick', 'casual', 'earned', 'maternity', 'paternity', 'unpaid'], example: 'sick' },
                  startDate: { type: 'string', format: 'date', example: '2026-11-20' },
                  endDate: { type: 'string', format: 'date', example: '2026-11-22' },
                  reason: { type: 'string', example: 'Viral fever' }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Leave application submitted' }
        }
      }
    },
    '/api/classes': {
      get: {
        tags: ['Classes & Subjects'],
        summary: 'List Classes',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'List of active classes' } }
      }
    },
    '/api/subjects': {
      get: {
        tags: ['Classes & Subjects'],
        summary: 'List Subjects',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'List of curriculum subjects' } }
      }
    },
    '/api/students': {
      get: {
        tags: ['Students'],
        summary: 'List Students',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'List of enrolled students' } }
      }
    },
    '/api/announcements': {
      get: {
        tags: ['Announcements'],
        summary: 'List Announcements',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Broadcast notices and events' } }
      }
    },
    '/api/upload/signature': {
      get: {
        tags: ['Uploads'],
        summary: 'Get Cloudinary Signed Upload Parameters',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Cloudinary signature and upload folder' } }
      }
    }
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT token obtained from POST /api/auth/login'
      }
    }
  }
};

module.exports = swaggerDocument;

