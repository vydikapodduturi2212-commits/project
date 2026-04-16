CREATE DATABASE IF NOT EXISTS ace_nexus;
USE ace_nexus;

CREATE TABLE users (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  role ENUM('admin', 'faculty', 'student') NOT NULL,
  student_id VARCHAR(50) NULL,
  password_salt VARCHAR(64) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE students (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  roll_number VARCHAR(50) NOT NULL UNIQUE,
  branch VARCHAR(100) NOT NULL,
  semester INT NOT NULL,
  previous_cgpa DECIMAL(4,2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE subjects (
  id VARCHAR(50) PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  credits INT NOT NULL
);

CREATE TABLE results (
  id VARCHAR(50) PRIMARY KEY,
  student_id VARCHAR(50) NOT NULL,
  published_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL,
  CONSTRAINT fk_results_student FOREIGN KEY (student_id) REFERENCES students(id)
);

CREATE TABLE result_marks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  result_id VARCHAR(50) NOT NULL,
  subject_id VARCHAR(50) NOT NULL,
  mark INT NOT NULL,
  faculty_name VARCHAR(120) NOT NULL,
  CONSTRAINT fk_marks_result FOREIGN KEY (result_id) REFERENCES results(id),
  CONSTRAINT fk_marks_subject FOREIGN KEY (subject_id) REFERENCES subjects(id)
);

CREATE TABLE notifications (
  id VARCHAR(50) PRIMARY KEY,
  message VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sessions (
  token VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
