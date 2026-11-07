const mongoose = require('mongoose');
const Student = require('./models/Student');
const Parent = require('./models/Parent');
const School = require('./models/School');
require('dotenv').config({ path: './config.env' });

async function checkData() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const students = await Student.find().limit(5);
        console.log(`Found ${students.length} students`);

        for (const student of students) {
            const parents = await Parent.find({ 
                $or: [
                    { studentId: student._id },
                    { studentIds: student._id }
                ]
            });
            console.log(`Student: ${student.name} (${student._id}) - Parents found: ${parents.length}`);
            parents.forEach(p => console.log(`  - Parent: ${p.name} (${p.parentType}), Phone: ${p.phone}`));
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkData();
