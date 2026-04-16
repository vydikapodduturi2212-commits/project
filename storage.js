const fs = require("fs");

function createStorage(config) {
  if ((config.provider || "file").toLowerCase() === "mysql") {
    return createMySqlStorage(config.mysql);
  }
  return createFileStorage(config.dataFile);
}

function createFileStorage(dataFile) {
  return {
    provider: "file",
    async initialize() {},
    async loadStore() {
      return JSON.parse(fs.readFileSync(dataFile, "utf-8"));
    },
    async replaceSessionForUser(userId, token) {
      const store = JSON.parse(fs.readFileSync(dataFile, "utf-8"));
      store.sessions = store.sessions.filter((item) => item.userId !== userId);
      store.sessions.push({ token, userId, createdAt: new Date().toISOString() });
      fs.writeFileSync(dataFile, JSON.stringify(store, null, 2));
    },
    async deleteSession(token) {
      const store = JSON.parse(fs.readFileSync(dataFile, "utf-8"));
      store.sessions = store.sessions.filter((item) => item.token !== token);
      fs.writeFileSync(dataFile, JSON.stringify(store, null, 2));
    },
    async addStudent(student, notificationMessage) {
      const store = JSON.parse(fs.readFileSync(dataFile, "utf-8"));
      store.students.push(student);
      prependNotification(store, notificationMessage);
      fs.writeFileSync(dataFile, JSON.stringify(store, null, 2));
    },
    async addSubject(subject, notificationMessage) {
      const store = JSON.parse(fs.readFileSync(dataFile, "utf-8"));
      store.subjects.push(subject);
      prependNotification(store, notificationMessage);
      fs.writeFileSync(dataFile, JSON.stringify(store, null, 2));
    },
    async upsertResult(studentId, subjectMarks, notificationMessage) {
      const store = JSON.parse(fs.readFileSync(dataFile, "utf-8"));
      const now = new Date().toISOString();
      const existing = store.results.find((item) => item.studentId === studentId);
      if (existing) {
        existing.subjectMarks = subjectMarks;
        existing.updatedAt = now;
        existing.publishedAt = now;
      } else {
        store.results.push({
          id: `result-${Date.now()}`,
          studentId,
          subjectMarks,
          publishedAt: now,
          updatedAt: now
        });
      }
      prependNotification(store, notificationMessage);
      fs.writeFileSync(dataFile, JSON.stringify(store, null, 2));
    }
  };
}

function createMySqlStorage(mysqlConfig) {
  let pool;

  function getMySql() {
    return require("mysql2/promise");
  }

  function connectionOptions() {
    if (mysqlConfig.url) return mysqlConfig.url;
    return {
      host: mysqlConfig.host,
      port: mysqlConfig.port,
      user: mysqlConfig.user,
      password: mysqlConfig.password,
      database: mysqlConfig.database,
      waitForConnections: true,
      connectionLimit: 10
    };
  }

  async function query(sql, params = []) {
    const [rows] = await pool.query(sql, params);
    return rows;
  }

  async function queryValue(sql, params = []) {
    const rows = await query(sql, params);
    return rows[0] || null;
  }

  return {
    provider: "mysql",
    async initialize() {
      const mysql = getMySql();
      pool = mysql.createPool(connectionOptions());
      await pool.query("SELECT 1");
    },
    async loadStore() {
      const [users, students, subjects, results, marks, notifications, sessions] = await Promise.all([
        query("SELECT id, name, email, role, student_id AS studentId, password_salt AS passwordSalt, password_hash AS passwordHash FROM users"),
        query("SELECT id, name, roll_number AS rollNumber, branch, semester, previous_cgpa AS previousCgpa FROM students"),
        query("SELECT id, name, code, credits FROM subjects"),
        query("SELECT id, student_id AS studentId, published_at AS publishedAt, updated_at AS updatedAt FROM results"),
        query("SELECT result_id AS resultId, subject_id AS subjectId, mark, faculty_name AS faculty FROM result_marks"),
        query("SELECT id, message, created_at AS timestamp FROM notifications ORDER BY created_at DESC LIMIT 10"),
        query("SELECT token, user_id AS userId, created_at AS createdAt FROM sessions")
      ]);

      const marksByResultId = marks.reduce((acc, item) => {
        acc[item.resultId] = acc[item.resultId] || [];
        acc[item.resultId].push({ subjectId: item.subjectId, mark: item.mark, faculty: item.faculty });
        return acc;
      }, {});

      return {
        users,
        students,
        subjects,
        results: results.map((item) => ({ ...item, subjectMarks: marksByResultId[item.id] || [] })),
        notifications,
        sessions
      };
    },
    async replaceSessionForUser(userId, token) {
      await query("DELETE FROM sessions WHERE user_id = ?", [userId]);
      await query("INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)", [token, userId, new Date()]);
    },
    async deleteSession(token) {
      await query("DELETE FROM sessions WHERE token = ?", [token]);
    },
    async addStudent(student, notificationMessage) {
      await query(
        "INSERT INTO students (id, name, roll_number, branch, semester, previous_cgpa) VALUES (?, ?, ?, ?, ?, ?)",
        [student.id, student.name, student.rollNumber, student.branch, student.semester, student.previousCgpa]
      );
      await insertNotification(query, notificationMessage);
    },
    async addSubject(subject, notificationMessage) {
      await query("INSERT INTO subjects (id, name, code, credits) VALUES (?, ?, ?, ?)", [
        subject.id,
        subject.name,
        subject.code,
        subject.credits
      ]);
      await insertNotification(query, notificationMessage);
    },
    async upsertResult(studentId, subjectMarks, notificationMessage) {
      const existing = await queryValue("SELECT id FROM results WHERE student_id = ?", [studentId]);
      const now = new Date();
      const resultId = existing ? existing.id : `result-${Date.now()}`;

      if (existing) {
        await query("UPDATE results SET published_at = ?, updated_at = ? WHERE id = ?", [now, now, resultId]);
        await query("DELETE FROM result_marks WHERE result_id = ?", [resultId]);
      } else {
        await query("INSERT INTO results (id, student_id, published_at, updated_at) VALUES (?, ?, ?, ?)", [resultId, studentId, now, now]);
      }

      for (const mark of subjectMarks) {
        await query("INSERT INTO result_marks (result_id, subject_id, mark, faculty_name) VALUES (?, ?, ?, ?)", [
          resultId,
          mark.subjectId,
          mark.mark,
          mark.faculty
        ]);
      }
      await insertNotification(query, notificationMessage);
    }
  };
}

function prependNotification(store, message) {
  store.notifications.unshift({
    id: `notif-${Date.now()}`,
    message,
    timestamp: new Date().toISOString()
  });
  store.notifications = store.notifications.slice(0, 10);
}

async function insertNotification(query, message) {
  await query("INSERT INTO notifications (id, message, created_at) VALUES (?, ?, ?)", [
    `notif-${Date.now()}`,
    message,
    new Date()
  ]);
}

module.exports = { createStorage };
