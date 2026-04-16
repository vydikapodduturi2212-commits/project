// Server-based dashboard - Firebase imports removed

const state = {
  pageRole: document.body.dataset.role,
  profile: null,
  filters: {},
  students: [],
  subjects: [],
  results: [],
  notifications: [],
  currentStudentRecord: null
};

const elements = {
  roleBadge: document.getElementById("role-badge"),
  welcomeTitle: document.getElementById("welcome-title"),
  summaryCards: document.getElementById("summary-cards"),
  analytics: document.getElementById("analytics"),
  notifications: document.getElementById("notifications"),
  resultsContainer: document.getElementById("results-container"),
  exportButton: document.getElementById("export-button"),
  printButton: document.getElementById("print-result"),
  logoutButton: document.getElementById("logout-button"),
  filterForm: document.getElementById("filter-form"),
  studentForm: document.getElementById("student-form"),
  subjectForm: document.getElementById("subject-form"),
  resultsForm: document.getElementById("results-form"),
  resultStudentSelect: document.getElementById("result-student"),
  subjectMarkGrid: document.getElementById("subject-mark-grid")
};

function getDashboardPath(role) {
  if (role === "admin") return "/admin.html";
  if (role === "faculty") return "/faculty.html";
  return "/student.html";
}

function toMillis(value) {
  if (!value) return null;
  if (value && typeof value.toMillis === "function") return value.toMillis();
  if (value && typeof value.toDate === "function") return value.toDate().getTime();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function formatDate(value) {
  const millis = toMillis(value);
  if (!millis) return "Not published";
  return new Date(millis).toLocaleString();
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

function createSummaryCards(cards) {
  elements.summaryCards.innerHTML = cards.map((card) => `
    <article class="stat-card">
      <p>${card.label}</p>
      <strong>${card.value}</strong>
    </article>
  `).join("");
}

function renderNotifications(items) {
  elements.notifications.innerHTML = items.length ? items.map((item) => `
    <article class="notification-item">
      <p>${item.message}</p>
      <small>${formatDate(item.timestamp)}</small>
    </article>
  `).join("") : `<div class="empty-state">No notifications available.</div>`;
}

function renderAnalytics(analytics) {
  const branchEntries = Object.entries(analytics.branchCounts || {});
  const highest = Math.max(...branchEntries.map(([, value]) => value), 1);
  elements.analytics.innerHTML = `
    <article class="stat-card"><p>Published Results</p><strong>${analytics.publishedResults}</strong></article>
    <article class="stat-card"><p>Average GPA</p><strong>${analytics.averageGpa}</strong></article>
    <article class="stat-card"><p>Pass Rate</p><strong>${analytics.passRate}%</strong></article>
    <article class="stat-card"><p>Top Performer</p><strong>${analytics.topPerformer ? analytics.topPerformer.name : "Pending"}</strong></article>
    <article class="stat-card">
      <p>Branch Performance</p>
      <div class="chart-bars">
        ${branchEntries.length ? branchEntries.map(([branch, value]) => `
          <div class="bar-row">
            <span>${branch}</span>
            <div class="bar-track"><div class="bar-fill" style="width:${(value / highest) * 100}%"></div></div>
          </div>
        `).join("") : "<p>No published records yet.</p>"}
      </div>
    </article>
  `;
}

function renderStudentAnalytics(record) {
  const marks = record.subjectEntries.map((item) => item.mark);
  const highest = marks.length ? Math.max(...marks) : "-";
  const lowest = marks.length ? Math.min(...marks) : "-";
  elements.analytics.innerHTML = `
    <article class="stat-card"><p>Subjects</p><strong>${record.subjectEntries.length}</strong></article>
    <article class="stat-card"><p>Highest Mark</p><strong>${highest}</strong></article>
    <article class="stat-card"><p>Lowest Mark</p><strong>${lowest}</strong></article>
    <article class="stat-card"><p>Status</p><strong>${record.status || "Pending"}</strong></article>
  `;
}

function badgeClass(value) {
  return String(value).toLowerCase();
}

function renderResultCard(record) {
  return `
    <article class="result-card">
      <div class="result-card-head">
        <div>
          <h3>${record.name}</h3>
          <div class="meta-row">
            <span class="subject-pill">${record.rollNumber}</span>
            <span class="subject-pill">${record.branch}</span>
            <span class="subject-pill">Semester ${record.semester}</span>
          </div>
        </div>
        <span class="badge ${badgeClass(record.status)}">${record.status}</span>
      </div>
      <div class="result-highlights">
        <div class="highlight-box"><span>GPA</span><strong>${record.gpa ?? "-"}</strong></div>
        <div class="highlight-box"><span>CGPA</span><strong>${record.cgpa ?? "-"}</strong></div>
        <div class="highlight-box"><span>Total Marks</span><strong>${record.totalMarks ?? "-"}</strong></div>
        <div class="highlight-box"><span>Published</span><strong>${record.publishedAt ? new Date(toMillis(record.publishedAt)).toLocaleDateString() : "Pending"}</strong></div>
      </div>
      ${record.subjectEntries?.length ? `
        <div class="student-table">
          <table>
            <thead>
              <tr><th>Subject</th><th>Code</th><th>Credits</th><th>Marks</th><th>Grade</th><th>Faculty</th></tr>
            </thead>
            <tbody>
              ${record.subjectEntries.map((entry) => `
                <tr>
                  <td>${entry.subjectName}</td>
                  <td>${entry.subjectCode}</td>
                  <td>${entry.credits}</td>
                  <td>${entry.mark}</td>
                  <td>${entry.grade}</td>
                  <td>${entry.faculty}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      ` : `<div class="empty-state">No marks have been published for this student yet.</div>`}
    </article>
  `;
}

function renderResults(records) {
  elements.resultsContainer.innerHTML = records.length ? records.map(renderResultCard).join("") : `<div class="empty-state">No results available.</div>`;
}

function toCsv(records) {
  const rows = [["Student", "Roll Number", "Branch", "Semester", "GPA", "CGPA", "Status"]];
  records.forEach((record) => {
    rows.push([record.name, record.rollNumber, record.branch, String(record.semester), String(record.gpa ?? ""), String(record.cgpa ?? ""), record.status || ""]);
  });
  return rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
}

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

// Utility functions for dashboard

function buildStudentRecord(student, subjectMap, result) {
  const subjectEntries = (result?.subjectMarks || []).map((entry) => {
    const subject = subjectMap.get(entry.subjectId);
    const grade = calculateGrade(entry.mark);
    return {
      subjectId: entry.subjectId,
      subjectCode: subject?.code || "NA",
      subjectName: subject?.name || "Unknown Subject",
      credits: subject?.credits || 0,
      mark: entry.mark,
      grade,
      faculty: entry.faculty || "-"
    };
  });

  const totalCredits = subjectEntries.reduce((sum, item) => sum + Number(item.credits || 0), 0) || 1;
  const weightedPoints = subjectEntries.reduce((sum, item) => sum + gradePoint(item.grade) * Number(item.credits || 0), 0);
  const gpa = Number((weightedPoints / totalCredits).toFixed(2));
  const status = subjectEntries.length && subjectEntries.some((item) => item.grade === "F") ? "Fail" : "Pass";

  return {
    ...student,
    publishedAt: result?.publishedAt || null,
    subjectEntries,
    totalMarks: subjectEntries.reduce((sum, item) => sum + Number(item.mark || 0), 0),
    gpa: subjectEntries.length ? gpa : null,
    cgpa: subjectEntries.length ? Number((((Number(student.previousCgpa) || 0) + gpa) / 2).toFixed(2)) : Number(student.previousCgpa || 0),
    status: subjectEntries.length ? status : "Pending"
  };
}

function buildAnalytics(records) {
  const published = records.filter((item) => item.subjectEntries.length > 0);
  const passing = published.filter((item) => item.status === "Pass");
  const topPerformer = [...published].sort((a, b) => (b.gpa || 0) - (a.gpa || 0))[0] || null;
  const branchCounts = published.reduce((acc, item) => {
    acc[item.branch] = (acc[item.branch] || 0) + 1;
    return acc;
  }, {});

  return {
    publishedResults: published.length,
    averageGpa: published.length ? Number((published.reduce((sum, item) => sum + (item.gpa || 0), 0) / published.length).toFixed(2)) : 0,
    passRate: published.length ? Number(((passing.length / published.length) * 100).toFixed(1)) : 0,
    topPerformer,
    branchCounts
  };
}

function applyFilters(records) {
  const { rollNumber = "", semester = "", branch = "" } = state.filters;
  return records.filter((record) => {
    const matchesRoll = !rollNumber || record.rollNumber.toLowerCase().includes(rollNumber.toLowerCase());
    const matchesSemester = !semester || String(record.semester) === String(semester);
    const matchesBranch = !branch || record.branch.toLowerCase().includes(branch.toLowerCase());
    return matchesRoll && matchesSemester && matchesBranch;
  });
}

function populateResultForm(records) {
  if (!elements.resultStudentSelect || !elements.subjectMarkGrid) return;
  elements.resultStudentSelect.innerHTML = records.map((record) => `<option value="${record.id}">${record.name} (${record.rollNumber})</option>`).join("");
  elements.subjectMarkGrid.innerHTML = state.subjects.map((subject) => `
    <label>
      ${subject.code} - ${subject.name}
      <input data-subject-id="${subject.id}" type="number" min="0" max="100" required />
    </label>
  `).join("");
}

async function refreshAdminOrFacultyDashboard() {
  const token = localStorage.getItem("authToken");
  const response = await fetch("/api/dashboard", {
    headers: { "Authorization": `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new Error("Failed to load dashboard data");
  }

  const data = await response.json();
  state.notifications = data.notifications || [];
  const records = data.records || [];
  const analytics = data.analytics || {};

  // Load additional data if needed
  const subjectsResponse = await fetch("/api/subjects", {
    headers: { "Authorization": `Bearer ${token}` }
  });
  const subjectsData = subjectsResponse.ok ? await subjectsResponse.json() : { subjects: [] };
  state.subjects = subjectsData.subjects || [];

  const studentsResponse = await fetch("/api/students", {
    headers: { "Authorization": `Bearer ${token}` }
  });
  const studentsData = studentsResponse.ok ? await studentsResponse.json() : { students: [] };
  state.students = studentsData.students || [];

  elements.roleBadge.textContent = `${state.profile.role} dashboard`;
  elements.roleBadge.className = `eyebrow badge ${badgeClass(state.profile.role)}`;
  elements.welcomeTitle.textContent = `Welcome back, ${state.profile.name}`;

  createSummaryCards([
    { label: "Role", value: state.profile.role === "admin" ? "Admin" : "Faculty" },
    { label: "Total Students", value: state.students.length },
    { label: "Published Results", value: analytics.publishedResults || 0 },
    { label: "Pass Rate", value: `${analytics.passRate || 0}%` }
  ]);
  renderAnalytics(analytics);
  renderNotifications(state.notifications);
  renderResults(records);
  populateResultForm(records);
}

async function refreshStudentDashboard() {
  const token = localStorage.getItem("authToken");
  const response = await fetch("/api/dashboard", {
    headers: { "Authorization": `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new Error("Failed to load dashboard data");
  }

  const data = await response.json();
  state.notifications = data.notifications || [];
  state.currentStudentRecord = data.record;
  const record = state.currentStudentRecord;

  elements.roleBadge.textContent = "student dashboard";
  elements.roleBadge.className = "eyebrow badge student";
  elements.welcomeTitle.textContent = `Welcome back, ${state.profile.name}`;

  createSummaryCards([
    { label: "Role", value: "Student" },
    { label: "Current GPA", value: record?.gpa ?? "-" },
    { label: "Current Status", value: record?.status ?? "Pending" },
    { label: "CGPA", value: record?.cgpa ?? "-" }
  ]);
  renderNotifications(state.notifications);
  if (record) {
    renderStudentAnalytics(record);
    renderResults([record]);
  } else {
    elements.analytics.innerHTML = `<div class="empty-state">No student record was found for this Firebase profile.</div>`;
    renderResults([]);
  }
}

// Notifications are handled by the server

async function initializePage() {
  // Check server authentication instead of Firebase
  const token = localStorage.getItem("authToken");
  if (!token) {
    window.location.href = "/";
    return;
  }

  try {
    const response = await fetch("/api/me", {
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (!response.ok) {
      console.error("/api/me failed", response.status);
      localStorage.removeItem("authToken");
      window.location.href = "/";
      return;
    }

    const data = await response.json();
    const profile = {
      role: data.user.role,
      name: data.user.name,
      email: data.user.email,
      studentId: data.user.studentId
    };

    console.log("Dashboard profile", profile);
    state.profile = profile;
    if (profile.role !== state.pageRole) {
      window.location.href = getDashboardPath(profile.role);
      return;
    }

    if (state.pageRole === "student") {
      await refreshStudentDashboard();
      return;
    }

    await refreshAdminOrFacultyDashboard();
  } catch (error) {
    console.error("initializePage failed", error);
    localStorage.removeItem("authToken");
    window.location.href = "/";
  }
}

if (elements.filterForm) {
  elements.filterForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(elements.filterForm);
    state.filters = {
      rollNumber: String(formData.get("rollNumber") || "").trim(),
      semester: String(formData.get("semester") || "").trim(),
      branch: String(formData.get("branch") || "").trim()
    };
    await refreshAdminOrFacultyDashboard();
  });
}

if (elements.studentForm) {
  elements.studentForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const token = localStorage.getItem("authToken");
    const formData = new FormData(elements.studentForm);
    
    const studentData = {
      name: String(formData.get("name") || "").trim(),
      rollNumber: String(formData.get("rollNumber") || "").trim(),
      branch: String(formData.get("branch") || "").trim(),
      semester: Number(formData.get("semester")),
      previousCgpa: Number(formData.get("previousCgpa") || 0)
    };

    const response = await fetch("/api/students", {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(studentData)
    });

    if (response.ok) {
      elements.studentForm.reset();
      await refreshAdminOrFacultyDashboard();
    } else {
      const error = await response.json();
      alert(error.error || "Failed to add student");
    }
  });
}

if (elements.subjectForm) {
  elements.subjectForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const token = localStorage.getItem("authToken");
    const formData = new FormData(elements.subjectForm);
    
    const subjectData = {
      name: String(formData.get("name") || "").trim(),
      code: String(formData.get("code") || "").trim().toUpperCase(),
      credits: Number(formData.get("credits"))
    };

    const response = await fetch("/api/subjects", {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(subjectData)
    });

    if (response.ok) {
      elements.subjectForm.reset();
      await refreshAdminOrFacultyDashboard();
    } else {
      const error = await response.json();
      alert(error.error || "Failed to add subject");
    }
  });
}

if (elements.resultsForm) {
  elements.resultsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const token = localStorage.getItem("authToken");
    const studentId = elements.resultStudentSelect.value;
    const subjectMarks = Array.from(elements.subjectMarkGrid.querySelectorAll("input[data-subject-id]"))
      .map((input) => ({
        subjectId: input.dataset.subjectId,
        mark: Number(input.value),
        faculty: state.profile.name
      }))
      .filter((entry) => Number.isFinite(entry.mark));

    const response = await fetch("/api/results", {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ studentId, subjectMarks })
    });

    if (response.ok) {
      elements.resultsForm.reset();
      await refreshAdminOrFacultyDashboard();
    } else {
      const error = await response.json();
      alert(error.error || "Failed to publish results");
    }
  });
}

if (elements.exportButton) {
  elements.exportButton.addEventListener("click", () => {
    const subjectMap = new Map(state.subjects.map((item) => [item.id, item]));
    const resultMap = new Map(state.results.map((item) => [item.studentId, item]));
    const records = state.pageRole === "student"
      ? (state.currentStudentRecord ? [state.currentStudentRecord] : [])
      : state.students.map((student) => buildStudentRecord(student, subjectMap, resultMap.get(student.id)));
    const payload = state.pageRole === "student" ? records : applyFilters(records);
    if (!payload.length) return;
    downloadFile("ace-nexus-results.csv", toCsv(payload), "text/csv;charset=utf-8");
  });
}

if (elements.printButton) {
  elements.printButton.addEventListener("click", () => window.print());
}

elements.logoutButton.addEventListener("click", async () => {
  const token = localStorage.getItem("authToken");
  if (token) {
    await fetch("/api/logout", {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` }
    });
  }
  localStorage.removeItem("authToken");
  window.location.href = "/";
});

initializePage().catch((error) => {
  elements.resultsContainer.innerHTML = `<div class="empty-state">${error.message}</div>`;
});
