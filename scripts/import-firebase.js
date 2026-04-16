const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const DEFAULT_DATA_DIR = "C:\\Users\\Vydik\\OneDrive\\Documents";

function clean(value) {
  return String(value ?? "").trim();
}

function parseCsv(content) {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = splitCsvLine(lines[0]).map((header) => header.replace(/^\uFEFF/, "").trim());
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

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function upsertAuthUser(user) {
  const auth = admin.auth();
  const email = clean(user.email);
  const password = clean(user.password);

  try {
    const existing = await auth.getUserByEmail(email);
    await auth.updateUser(existing.uid, {
      password
    });
    return existing;
  } catch (error) {
    if (error.code !== "auth/user-not-found") throw error;

    return auth.createUser({
      email,
      password,
      displayName: clean(user.name)
    });
  }
}

async function main() {
  const serviceAccountPath = getRequiredEnv("FIREBASE_SERVICE_ACCOUNT");
  const dataDir = process.env.FIREBASE_IMPORT_DIR || DEFAULT_DATA_DIR;

  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  const db = admin.firestore();

  const users = readCsv(path.join(dataDir, "users.csv"));
  const students = readCsv(path.join(dataDir, "students.csv"));
  const results = readCsv(path.join(dataDir, "results.csv"));
  const subjects = readCsv(path.join(dataDir, "subjects.csv"));

  console.log(`Loaded ${users.length} users, ${students.length} students, ${subjects.length} subjects, ${results.length} result rows.`);

  const subjectCodeToId = new Map();
  for (const subject of subjects) {
    const subjectId = clean(subject.subjectId);
    const subjectCode = clean(subject.subjectCode);
    if (!subjectId || !subjectCode) continue;
    subjectCodeToId.set(subjectCode, subjectId);
    await db.collection("subjects").doc(subjectId).set({
      name: clean(subject.subjectName),
      code: subjectCode,
      credits: Number(subject.credits)
    });
  }

  for (const user of users) {
    if (!clean(user.email) || !clean(user.password) || !clean(user.role) || !clean(user.rollNumber)) {
      continue;
    }
    const authUser = await upsertAuthUser(user);
    const payload = {
      name: clean(user.name),
      email: clean(user.email),
      role: clean(user.role),
      rollNumber: clean(user.rollNumber)
    };

    if (clean(user.studentId)) payload.studentId = clean(user.studentId);
    if (clean(user.department)) payload.department = clean(user.department);

    await db.collection("users").doc(authUser.uid).set(payload);
  }

  for (const student of students) {
    const studentId = clean(student.studentId);
    if (!studentId) continue;
    await db.collection("students").doc(studentId).set({
      name: clean(student.name),
      rollNumber: clean(student.rollNumber),
      branch: clean(student.branch),
      semester: Number(student.semester),
      previousCgpa: Number(student.previousCgpa || 0)
    });
  }

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
      mark: Number(row.mark),
      faculty: clean(row.faculty)
    });
  }

  for (const [studentId, subjectMarks] of resultRowsByStudent.entries()) {
    await db.collection("results").doc(studentId).set({
      studentId,
      subjectMarks,
      publishedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  await db.collection("notifications").add({
    message: `Imported ${users.length} users and ${resultRowsByStudent.size} result records from CSV files.`,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log("Firebase import complete.");
}

main().catch((error) => {
  console.error("Import failed:", error.message);
  process.exit(1);
});
