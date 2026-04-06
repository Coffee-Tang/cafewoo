DROP DATABASE IF EXISTS cafewoo;
CREATE DATABASE cafewoo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cafewoo;

CREATE TABLE boards (
  id INT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  description VARCHAR(200),
  post_count INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nickname VARCHAR(100) NOT NULL UNIQUE,
  post_count INT DEFAULT 0,
  first_post_at DATETIME,
  last_post_at DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_signatures (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  content TEXT NOT NULL,
  first_seen_at DATETIME,
  last_seen_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE posts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bbsid INT NOT NULL,
  board_id INT NOT NULL,
  user_id INT NOT NULL,
  title VARCHAR(500),
  content MEDIUMTEXT,
  content_text MEDIUMTEXT,
  signature TEXT,
  posted_at DATETIME,
  reply_count INT DEFAULT 0,
  source_file VARCHAR(200),
  wayback_ts VARCHAR(14),
  FOREIGN KEY (board_id) REFERENCES boards(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY uk_bbsid (bbsid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE replies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  post_id INT NOT NULL,
  user_id INT NOT NULL,
  content MEDIUMTEXT,
  content_text MEDIUMTEXT,
  signature TEXT,
  posted_at DATETIME,
  sort_order INT DEFAULT 0,
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE guestbook (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nickname VARCHAR(100),
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ip_hash VARCHAR(64)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
