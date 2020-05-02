# Some tweaks for a new version of the site

USE :settings.DB_NAME;
DROP TABLE IF EXISTS prefs;

CREATE TABLE prefs (
	id BIGINT NOT NULL AUTO_INCREMENT,
	hide_gallery_warning BOOLEAN NOT NULL DEFAULT '0',
	PRIMARY KEY (id)
);

ALTER TABLE session
ADD COLUMN user_id BIGINT AFTER name,
ADD COLUMN prefs_id BIGINT AFTER user_id,
ADD CONSTRAINT FOREIGN KEY (user_id) REFERENCES user(id),
ADD CONSTRAINT FOREIGN KEY (prefs_id) REFERENCES prefs(id);

ALTER TABLE user
DROP FOREIGN KEY user_ibfk_1,
DROP COLUMN session_id,
ADD COLUMN prefs_id BIGINT AFTER name,
ADD CONSTRAINT FOREIGN KEY (prefs_id) REFERENCES prefs(id);
