const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DEFAULT_DATA_DIR = "C:\\Users\\Vydik\\OneDrive\\Documents";

function clean(value) {
  return String(value ?? "").trim();
}

function parseCsv(content) {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];

  // Handle quoted headers
  let rawHeaders = splitCsvLine(lines[0]);
  console.log("Raw headers from splitCsvLine:", rawHeaders);
  let headers = rawHeaders;
  if (headers.length === 1) {
    // If it's one field, split by comma
    headers = headers[0].split(',');
    console.log("Split headers:", headers);
  }
  headers = headers.map((header) => header.replace(/^\uFEFF/, "").trim());

  return lines.slice(1).map((line) => {
    let values = splitCsvLine(line);
    if (values.length === 1 && headers.length > 1 && values[0].includes(",")) {
      values = splitCsvLine(values[0]);
    }
    const row = {};
    headers.forEach((header, index) => {
      row[header] = (values[index] || "").trim();
    });
    return row;
  });
}

function splitCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}

function readCsv(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV file not found: ${filePath}`);
  }
  return parseCsv(fs.readFileSync(filePath, "utf8"));
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function createSalt() {
  return crypto.randomBytes(16).toString("hex");
}

async function main() {
  const dataDir = process.env.CSV_DATA_DIR || DEFAULT_DATA_DIR;

  const users = readCsv(path.join(dataDir, "users.csv"));
  const students = readCsv(path.join(dataDir, "students.csv"));
  const results = readCsv(path.join(dataDir, "results.csv"));
  const subjects = readCsv(path.join(dataDir, "subjects.csv"));

  console.log(`Loaded ${users.length} users, ${students.length} students, ${subjects.length} subjects, ${results.length} result rows.`);
  console.log("First user:", users[0]);
  console.log("Headers would be:", Object.keys(users[0] || {}));

  const subjectCodeToId = new Map();
  const subjectsData = subjects.map((subject, index) => {
    const subjectId = clean(subject.subjectId) || `subject-${index + 1}`;
    const subjectCode = clean(subject.subjectCode);
    if (subjectCode) subjectCodeToId.set(subjectCode, subjectId);
    return {
      id: subjectId,
      code: subjectCode,
      name: clean(subject.subjectName),
      credits: Number(subject.credits) || 0
    };
  });

  const studentsData = students.map((student, index) => ({
    id: clean(student.studentId) || `student-${index + 1}`,
    name: clean(student.name),
    rollNumber: clean(student.rollNumber),
    branch: clean(student.branch),
    semester: Number(student.semester) || 1,
    previousCgpa: Number(student.previousCgpa) || 0
  }));

  const usersData = users.map((user, index) => {
    const userId = `user-${index + 1}`;
    const salt = createSalt();
    const password = clean(user.password) || "password";
    const hash = hashPassword(password, salt);

    const userData = {
      id: userId,
      name: clean(user.name),
      email: clean(user.email),
      role: clean(user.role),
      passwordSalt: salt,
      passwordHash: hash
    };

    if (clean(user.studentId)) userData.studentId = clean(user.studentId);
    if (clean(user.department)) userData.department = clean(user.department);
    if (clean(user.rollNumber)) userData.rollNumber = clean(user.rollNumber);

    return userData;
  });

  const resultRowsByStudent = new Map();
  for (const row of results) {
    const studentId = clean(row.studentId);
    const subjectCode = clean(row.subjectCode);
    if (!studentId || !subjectCode) continue;
    if (!resultRowsByStudent.has(studentId)) {
      resultRowsByStudent.set(studentId, []);
    }

    resultRowsByStudent.get(studentId).push({
      subjectId: subjectCodeToId.get(subjectCode) || subjectCode,
      mark: Number(row.mark) || 0,
      faculty: clean(row.faculty) || ""
    });
  }

  const resultsData = [];
  for (const [studentId, subjectMarks] of resultRowsByStudent.entries()) {
    resultsData.push({
      id: `result-${studentId}`,
      studentId,
      subjectMarks,
      publishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  const storeData = {
    users: usersData,
    students: studentsData,
    subjects: subjectsData,
    results: resultsData,
    resultMarks: [], // Not used in this structure
    notifications: [{
      id: "notif-1",
      message: `Imported ${users.length} users and ${resultsData.length} result records from CSV files.`,
      timestamp: new Date().toISOString()
    }],
    sessions: []
  };

  const storePath = path.join(__dirname, "..", "data", "store.json");
  fs.writeFileSync(storePath, JSON.stringify(storeData, null, 2));

  console.log("CSV import to store.json complete.");
  console.log(`Created ${usersData.length} users, ${studentsData.length} students, ${subjectsData.length} subjects, ${resultsData.length} results.`);
}

main().catch((error) => {
  console.error("Import failed:", error.message);
  process.exit(1);
});