USE ace_nexus;

INSERT INTO users (id, name, email, role, student_id, password_salt, password_hash) VALUES
('user-admin', 'Aarav Sharma', 'admin@acenexus.edu', 'admin', NULL, '4fa96af1918768485c994f01c36ad5f7', '924114f0ceedfe90546ee2b74573a5717d676060b345cb336c21fa837d031b2f49f3d3ca5f2b9e50235494240e403acead01cf4517e02dbed56bcd1fb383586d'),
('user-faculty', 'Dr. Meera Iyer', 'faculty@acenexus.edu', 'faculty', NULL, '6db60b9e010e38677dc7acd9bec9d6d5', '36b2149212cedca8466d37c7cd149e5a607a29f60aa62d1e36de11458a842a49c48545fc881d5fa47cded82d48337844ae8afb37fcc5c42d1de115d7915c07a4'),
('user-student', 'Riya Patel', 'student@acenexus.edu', 'student', 'student-001', '0d0b5590de152e3fa88dbf49b50101e0', 'b816e9791c54b68f86ed005faace56ce2c264c48f93e25a0f0901254199999582297a8974b5e7920cde5bfca4a18d1b9a84eacc0570301e59ad63da2eac58ae4');

INSERT INTO students (id, name, roll_number, branch, semester, previous_cgpa) VALUES
('student-001', 'Riya Patel', 'ACE2026CSE01', 'Computer Science', 6, 8.10),
('student-002', 'Karan Singh', 'ACE2026ECE02', 'Electronics', 6, 7.50),
('student-003', 'Ananya Das', 'ACE2026IT03', 'Information Technology', 4, 8.70);

INSERT INTO subjects (id, code, name, credits) VALUES
('subject-001', 'CS601', 'Database Management Systems', 4),
('subject-002', 'CS602', 'Cloud Computing', 3),
('subject-003', 'CS603', 'Operating Systems', 4),
('subject-004', 'MA401', 'Applied Mathematics', 3);

INSERT INTO results (id, student_id, published_at, updated_at) VALUES
('result-001', 'student-001', '2026-04-07 08:00:00', '2026-04-07 08:00:00'),
('result-002', 'student-002', '2026-04-07 08:30:00', '2026-04-07 08:30:00');

INSERT INTO result_marks (result_id, subject_id, mark, faculty_name) VALUES
('result-001', 'subject-001', 92, 'Dr. Meera Iyer'),
('result-001', 'subject-002', 84, 'Dr. Meera Iyer'),
('result-001', 'subject-003', 88, 'Dr. Meera Iyer'),
('result-001', 'subject-004', 79, 'Dr. Meera Iyer'),
('result-002', 'subject-001', 72, 'Dr. Meera Iyer'),
('result-002', 'subject-002', 68, 'Dr. Meera Iyer'),
('result-002', 'subject-003', 74, 'Dr. Meera Iyer'),
('result-002', 'subject-004', 81, 'Dr. Meera Iyer');

INSERT INTO notifications (id, message, created_at) VALUES
('notif-001', 'Semester 6 results are now live for Computer Science and Electronics.', '2026-04-07 08:45:00'),
('notif-002', 'Faculty dashboard is ready for new mark uploads.', '2026-04-07 07:20:00');
