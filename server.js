const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");
const { createStorage } = require("./storage");

loadEnvFile(path.join(__dirname, ".env"));

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const storage = createStorage({
  provider: process.env.DB_PROVIDER || "file",
  dataFile: path.join(__dirname, "data", "store.json"),
  mysql: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    url: process.env.DATABASE_URL
  }
});

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon"
};

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf-8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const equalsIndex = line.indexOf("=");
    if (equalsIndex <= 0) continue;
    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || "application/octet-stream";
  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendJson(res, 404, { error: "File not found" });
      return;
    }
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
      if (body.length > 1e6) reject(new Error("Payload too large"));
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON payload"));
      }
    });
  });
}

function sanitizeText(value) {
  return String(value || "").trim().replace(/[<>]/g, "");
}

function createToken() {
  return crypto.randomBytes(24).toString("hex");
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function verifyPassword(password, user) {
  const computedHash = hashPassword(password, user.passwordSalt);
  return crypto.timingSafeEqual(Buffer.from(computedHash, "hex"), Buffer.from(user.passwordHash, "hex"));
}

function getSession(req, store) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length);
  const session = store.sessions.find((item) => item.token === token);
  if (!session) return null;
  const user = store.users.find((item) => item.id === session.userId);
  return user ? { token, user } : null;
}

function ensureAuth(req, res, store, roles = []) {
  const session = getSession(req, store);
  console.log("ensureAuth session", session ? session.user.id : null, "roles", roles);
  if (!session) {
    sendJson(res, 401, { error: "Authentication required" });
    return null;
  }
  if (roles.length > 0 && !roles.includes(session.user.role)) {
    sendJson(res, 403, { error: "You do not have access to this resource" });
    return null;
  }
  return session;
}

function calculateGrade(mark) {
  if (mark >= 90) return "A+";
  if (mark >= 80) return "A";
  if (mark >= 70) return "B+";
  if (mark >= 60) return "B";
  if (mark >= 50) return "C";
  if (mark >= 40) return "D";
  return "F";
}

function gradePoint(grade) {
  const points = { "A+": 10, A: 9, "B+": 8, B: 7, C: 6, D: 5, F: 0 };
  return points[grade] ?? 0;
}

function buildStudentRecord(store, studentId) {
  const student = store.students.find((item) => item.id === studentId);
  if (!student) return null;
  const result = store.results.find((item) => item.studentId === studentId);
  const subjectEntries = result ? result.subjectMarks.map((entry) => {
    const subject = store.subjects.find((item) => item.id === entry.subjectId);
    const grade = calculateGrade(entry.mark);
    return {
      subjectId: entry.subjectId,
      subjectCode: subject ? subject.code : "NA",
      subjectName: subject ? subject.name : "Unknown Subject",
      credits: subject ? subject.credits : 0,
      mark: entry.mark,
      grade,
      faculty: entry.faculty
    };
  }) : [];
  const totalCredits = subjectEntries.reduce((sum, item) => sum + item.credits, 0) || 1;
  const weightedPoints = subjectEntries.reduce((sum, item) => sum + gradePoint(item.grade) * item.credits, 0);
  const gpa = Number((weightedPoints / totalCredits).toFixed(2));
  const status = subjectEntries.some((item) => item.grade === "F") ? "Fail" : "Pass";

  return {
    ...student,
    resultId: result ? result.id : null,
    publishedAt: result ? result.publishedAt : null,
    subjectEntries,
    totalMarks: subjectEntries.reduce((sum, item) => sum + item.mark, 0),
    gpa,
    cgpa: Number(((student.previousCgpa + gpa) / 2).toFixed(2)),
    status
  };
}

function buildAnalytics(store) {
  const records = store.students.map((student) => buildStudentRecord(store, student.id)).filter(Boolean);
  const published = records.filter((item) => item.subjectEntries.length > 0);
  const passing = published.filter((item) => item.status === "Pass");
  const topPerformer = [...published].sort((a, b) => b.gpa - a.gpa)[0] || null;
  const branchCounts = published.reduce((acc, item) => {
    acc[item.branch] = (acc[item.branch] || 0) + 1;
    return acc;
  }, {});

  return {
    totalStudents: store.students.length,
    publishedResults: published.length,
    passRate: published.length ? Number(((passing.length / published.length) * 100).toFixed(1)) : 0,
    averageGpa: published.length ? Number((published.reduce((sum, item) => sum + item.gpa, 0) / published.length).toFixed(2)) : 0,
    topPerformer,
    branchCounts
  };
}

function filterRecords(records, searchParams) {
  const rollNumber = sanitizeText(searchParams.get("rollNumber"));
  const semester = sanitizeText(searchParams.get("semester"));
  const branch = sanitizeText(searchParams.get("branch"));
  return records.filter((record) => {
    const matchesRoll = !rollNumber || record.rollNumber.toLowerCase().includes(rollNumber.toLowerCase());
    const matchesSemester = !semester || String(record.semester) === semester;
    const matchesBranch = !branch || record.branch === branch;
    return matchesRoll && matchesSemester && matchesBranch;
  });
}

function createNotification(store, message) {
  store.notifications.unshift({
    id: `notif-${Date.now()}`,
    message,
    timestamp: new Date().toISOString()
  });
  store.notifications = store.notifications.slice(0, 10);
}

async function handleApi(req, res, parsedUrl) {
  const store = await storage.loadStore();
  console.log("API request", req.method, parsedUrl.pathname);

  if (req.method === "POST" && parsedUrl.pathname === "/api/login") {
    const body = await parseBody(req);
    const rollNumber = sanitizeText(body.rollNumber).toLowerCase();
    const password = String(body.password || "");
    
    console.log("Login attempt:", { rollNumber, password: password ? "***" : "" });
    
    // Find user by roll number
    let user = null;
    if (rollNumber) {
      // For students, find by roll number
      const student = store.students.find((item) => item.rollNumber.toLowerCase() === rollNumber);
      console.log("Found student:", student ? student.name : "none");
      if (student) {
        user = store.users.find((item) => item.studentId === student.id);
        console.log("Found user:", user ? user.name : "none");
      }
    }
    
    // If not found by student roll number, try user email or user roll number
    if (!user) {
      user = store.users.find((item) =>
        item.email.toLowerCase() === rollNumber || String(item.rollNumber || "").toLowerCase() === rollNumber
      );
      console.log("Found user by email or roll number:", user ? user.name : "none");
    }
    
    if (!user || !verifyPassword(password, user)) {
      console.log("Login failed for user:", user ? user.name : "none");
      return sendJson(res, 401, { error: "Invalid credentials" });
    }

    const token = createToken();
    await storage.replaceSessionForUser(user.id, token);
    return sendJson(res, 200, {
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, studentId: user.studentId || null }
    });
  }

  if (req.method === "POST" && parsedUrl.pathname === "/api/logout") {
    const session = getSession(req, store);
    if (session) await storage.deleteSession(session.token);
    return sendJson(res, 200, { success: true });
  }

  if (req.method === "GET" && parsedUrl.pathname === "/api/me") {
    console.log("/api/me requested");
    const session = ensureAuth(req, res, store);
    if (!session) return;
    console.log("/api/me session valid", session.user.id, session.user.role);
    return sendJson(res, 200, {
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: session.user.role,
        studentId: session.user.studentId || null
      }
    });
  }

  if (req.method === "GET" && parsedUrl.pathname === "/api/dashboard") {
    console.log("/api/dashboard requested");
    const session = ensureAuth(req, res, store);
    if (!session) return;
    const analytics = buildAnalytics(store);
    const notifications = store.notifications;
    if (session.user.role === "student") {
      return sendJson(res, 200, { analytics, notifications, record: buildStudentRecord(store, session.user.studentId) });
    }
    const records = store.students.map((student) => buildStudentRecord(store, student.id)).filter(Boolean);
    return sendJson(res, 200, { analytics, notifications, records: filterRecords(records, parsedUrl.searchParams) });
  }

  if (req.method === "GET" && parsedUrl.pathname === "/api/students") {
    const session = ensureAuth(req, res, store, ["admin", "faculty"]);
    if (!session) return;
    const records = store.students.map((student) => buildStudentRecord(store, student.id)).filter(Boolean);
    return sendJson(res, 200, { students: filterRecords(records, parsedUrl.searchParams), subjects: store.subjects });
  }

  if (req.method === "POST" && parsedUrl.pathname === "/api/students") {
    const session = ensureAuth(req, res, store, ["admin"]);
    if (!session) return;
    const body = await parseBody(req);
    const name = sanitizeText(body.name);
    const rollNumber = sanitizeText(body.rollNumber);
    const branch = sanitizeText(body.branch);
    const semester = Number(body.semester);
    const previousCgpa = Number(body.previousCgpa || 0);
    if (!name || !rollNumber || !branch || !semester) return sendJson(res, 400, { error: "Name, roll number, branch, and semester are required" });
    if (store.students.some((item) => item.rollNumber.toLowerCase() === rollNumber.toLowerCase())) return sendJson(res, 409, { error: "Roll number already exists" });

    const studentId = `student-${Date.now()}`;
    await storage.addStudent(
      { id: studentId, name, rollNumber, branch, semester, previousCgpa },
      `Admin added student ${name} (${rollNumber}).`
    );
    const freshStore = await storage.loadStore();
    return sendJson(res, 201, { student: buildStudentRecord(freshStore, studentId) });
  }

  if (req.method === "POST" && parsedUrl.pathname === "/api/results") {
    const session = ensureAuth(req, res, store, ["admin", "faculty"]);
    if (!session) return;
    const body = await parseBody(req);
    const studentId = sanitizeText(body.studentId);
    const subjectMarks = Array.isArray(body.subjectMarks) ? body.subjectMarks : [];
    const student = store.students.find((item) => item.id === studentId);
    if (!student) return sendJson(res, 404, { error: "Student not found" });

    const validatedMarks = subjectMarks.map((entry) => ({
      subjectId: sanitizeText(entry.subjectId),
      mark: Number(entry.mark),
      faculty: session.user.name
    })).filter((entry) => entry.subjectId && Number.isFinite(entry.mark) && entry.mark >= 0 && entry.mark <= 100);
    if (validatedMarks.length === 0) return sendJson(res, 400, { error: "Please provide at least one valid subject mark" });

    await storage.upsertResult(
      studentId,
      validatedMarks,
      `Results published for ${student.name} by ${session.user.name}.`
    );
    const freshStore = await storage.loadStore();
    return sendJson(res, 200, { record: buildStudentRecord(freshStore, studentId) });
  }

  if (req.method === "GET" && parsedUrl.pathname === "/api/subjects") {
    const session = ensureAuth(req, res, store);
    if (!session) return;
    return sendJson(res, 200, { subjects: store.subjects });
  }

  if (req.method === "POST" && parsedUrl.pathname === "/api/subjects") {
    const session = ensureAuth(req, res, store, ["admin"]);
    if (!session) return;
    const body = await parseBody(req);
    const name = sanitizeText(body.name);
    const code = sanitizeText(body.code).toUpperCase();
    const credits = Number(body.credits);
    if (!name || !code || !credits) return sendJson(res, 400, { error: "Name, code, and credits are required" });
    await storage.addSubject(
      { id: `subject-${Date.now()}`, name, code, credits },
      `New subject ${code} - ${name} was added.`
    );
    const freshStore = await storage.loadStore();
    return sendJson(res, 201, { subjects: freshStore.subjects });
  }

  return sendJson(res, 404, { error: "API route not found" });
}

const server = http.createServer(async (req, res) => {
  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    if (parsedUrl.pathname.startsWith("/api/")) return handleApi(req, res, parsedUrl);

    let requestedPath = parsedUrl.pathname === "/" ? "/index.html" : parsedUrl.pathname;
    requestedPath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(PUBLIC_DIR, requestedPath);
    if (!filePath.startsWith(PUBLIC_DIR)) return sendJson(res, 403, { error: "Forbidden" });
    return sendFile(res, filePath);
  } catch (error) {
    return sendJson(res, 500, { error: error.message || "Internal server error" });
  }
});

storage
  .initialize()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Ace Nexus is running at http://localhost:${PORT}`);
      console.log(`Storage provider: ${storage.provider}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize storage:", error.message);
    process.exit(1);
  });
