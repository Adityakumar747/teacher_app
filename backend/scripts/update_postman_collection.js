const fs = require('fs');
const path = require('path');

const postmanPath = path.join(__dirname, '../../docs/postman_collection.json');
const postman = JSON.parse(fs.readFileSync(postmanPath, 'utf8'));

// 1. Add Soft Delete to Homework folder
const homeworkFolder = postman.item.find(f => f.name === 'Homework');
if (homeworkFolder) {
  const hasDelete = homeworkFolder.item.some(i => i.name.includes('Delete Homework'));
  if (!hasDelete) {
    homeworkFolder.item.push({
      name: "Soft Delete Homework (DELETE /api/homework/:id)",
      request: {
        method: "DELETE",
        header: [
          { key: "Authorization", value: "Bearer {{authToken}}" }
        ],
        url: {
          raw: "{{baseUrl}}/api/homework/{{homeworkId}}",
          host: ["{{baseUrl}}"],
          path: ["api", "homework", "{{homeworkId}}"]
        },
        description: "Soft deletes a homework assignment (isActive=false, deletedAt timestamp). Only the owner teacher can delete it."
      }
    });
  }
}

// 2. Add Class Teacher Analytics folder
let classTeacherFolder = postman.item.find(f => f.name === 'Class Teacher (Analytics & Timeline)');
if (!classTeacherFolder) {
  classTeacherFolder = {
    name: "Class Teacher (Analytics & Timeline)",
    item: [
      {
        name: "Get Class Teacher Analytics (GET /api/teachers/my-class/analytics)",
        request: {
          method: "GET",
          header: [
            { key: "Authorization", value: "Bearer {{authToken}}" }
          ],
          url: {
            raw: "{{baseUrl}}/api/teachers/my-class/analytics",
            host: ["{{baseUrl}}"],
            path: ["api", "teachers", "my-class", "analytics"]
          },
          description: "Server authorization enforced: class.teacherId === req.user._id (403 for non-class teachers). Single aggregation computes overall class attendance %, low-attendance count, subject breakdown, and homework completion rates."
        }
      },
      {
        name: "Get Student Subject Breakdown & Timeline (GET /api/teachers/my-class/students/:id/attendance)",
        request: {
          method: "GET",
          header: [
            { key: "Authorization", value: "Bearer {{authToken}}" }
          ],
          url: {
            raw: "{{baseUrl}}/api/teachers/my-class/students/{{studentId}}/attendance",
            host: ["{{baseUrl}}"],
            path: ["api", "teachers", "my-class", "students", "{{studentId}}", "attendance"]
          },
          description: "Returns student subject-wise attendance breakdown and 50-session historical timeline with dates, statuses (P/A/L), periods, and teacher names."
        }
      }
    ]
  };
  postman.item.push(classTeacherFolder);
}

// 3. Add Academic Calendar folder
let calendarFolder = postman.item.find(f => f.name === 'Academic Calendar');
if (!calendarFolder) {
  calendarFolder = {
    name: "Academic Calendar",
    item: [
      {
        name: "Get Month Academic Calendar & Leaves (GET /api/calendar/calendar)",
        request: {
          method: "GET",
          header: [
            { key: "Authorization", value: "Bearer {{authToken}}" }
          ],
          url: {
            raw: "{{baseUrl}}/api/calendar/calendar?year=2026&month=11",
            host: ["{{baseUrl}}"],
            path: ["api", "calendar", "calendar"],
            query: [
              { key: "year", value: "2026" },
              { key: "month", value: "11" }
            ]
          },
          description: "Returns eventsByDate hash for the specified month containing holidays, exams, events, and the logged-in teacher's approved leaves."
        }
      },
      {
        name: "List Important Dates (GET /api/calendar)",
        request: {
          method: "GET",
          header: [
            { key: "Authorization", value: "Bearer {{authToken}}" }
          ],
          url: {
            raw: "{{baseUrl}}/api/calendar",
            host: ["{{baseUrl}}"],
            path: ["api", "calendar"]
          },
          description: "Lists active important dates for the school."
        }
      }
    ]
  };
  postman.item.push(calendarFolder);
}

fs.writeFileSync(postmanPath, JSON.stringify(postman, null, 2), 'utf8');
console.log('✅ postman_collection.json updated with latest endpoints!');

