# Part 1.1 of drawy.io migration script

# Remove possible db lingering from previous run
DROP DATABASE IF EXISTS :settings.DB_NAME;

# create the database and use
CREATE DATABASE :settings.DB_NAME;
USE :settings.DB_NAME;

# create session table
CREATE TABLE session (
	id CHAR(:settings.SESSION_ID_LEN) NOT NULL,
	name VARCHAR(:settings.USER_NAME_LEN) NOT NULL,
	ip_address VARCHAR(255) NOT NULL,
	last_active DATETIME NOT NULL,
	PRIMARY KEY (id)
);

# create table for registered users
CREATE TABLE user (
	id BIGINT NOT NULL AUTO_INCREMENT,
	name VARCHAR(:settings.USER_NAME_LEN) NOT NULL UNIQUE,
	session_id VARCHAR(:settings.SESSION_ID_LEN),
	password VARCHAR(:settings.PASSWORD_HASH_LEN) NOT NULL,
	type ENUM('user', 'mod') NOT NULL,
	joined DATETIME NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY (session_id) REFERENCES session(id)
);

# create room table
CREATE TABLE room (
	id CHAR(:settings.ID_LEN),
	snapshot_id CHAR(:settings.ID_LEN) REFERENCES snapshot(id),
	name VARCHAR(:settings.ROOM_NAME_LEN) DEFAULT ':settings.DEFAULT_ROOM_NAME',
	is_private BOOLEAN NOT NULL DEFAULT '0',
	is_deleted BOOLEAN NOT NULL DEFAULT '0',
	created DATETIME NOT NULL,
	modified DATETIME NOT NULL,
	PRIMARY KEY (id)
);

# create snapshot table
CREATE TABLE snapshot (
	id CHAR(:settings.ID_LEN),
	room_id CHAR(:settings.ID_LEN) NOT NULL REFERENCES room(id),
	name VARCHAR(:settings.SNAPSHOT_NAME_LEN) DEFAULT ':settings.DEFAULT_SNAPSHOT_NAME',
	is_private BOOLEAN NOT NULL DEFAULT '0',
	is_deleted BOOLEAN NOT NULL DEFAULT '0',
	is_staff_pick BOOLEAN NOT NULL DEFAULT '0',
	created DATETIME NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY (room_id) REFERENCES room(id)
);

# Foreign key shizzle
ALTER TABLE room
ADD CONSTRAINT FOREIGN KEY (snapshot_id) REFERENCES snapshot(id);
