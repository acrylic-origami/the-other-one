CREATE TABLE admin1 ( code VARCHAR(20) PRIMARY KEY, name VARCHAR(1024), name_ascii VARCHAR(1024), geonameid INT );
CREATE TABLE admin2 ( code VARCHAR(80) PRIMARY KEY, name VARCHAR(1024), name_ascii VARCHAR(1024), geonameid INT );
CREATE TABLE places (
	geonameid INT PRIMARY KEY,
	name VARCHAR(200) ,
	asciiname VARCHAR(200),
	-- alternatename VARCHAR(10000),
	lat FLOAT,
	lon FLOAT,
	feature_class CHAR(1),
	feature_code VARCHAR(10),
	country_code CHAR(2),
	cc2 VARCHAR(200),
	admin1 VARCHAR(20), -- REFERENCES admin1 (code) ON UPDATE CASCADE ON DELETE CASCADE,
	admin2 VARCHAR(80), -- REFERENCES admin2 (code) ON UPDATE CASCADE ON DELETE CASCADE,
	admin3 VARCHAR(20),
	admin4 VARCHAR(20),
	pop BIGINT,
	dem VARCHAR(255),
	elevation INT,
	tz VARCHAR(40),
	mod VARCHAR(20)
);
CREATE TABLE names (
	geonameid INT REFERENCES places (geonameid),
	name VARCHAR(200),
	upper_name VARCHAR(200),
	name_rank INT
);
CREATE INDEX ON names (name);
CREATE INDEX ON names (upper_name);
CREATE INDEX ON names (name_rank);

CREATE INDEX ON places (name);
CREATE INDEX ON places (asciiname);
CREATE INDEX ON places (feature_class);
CREATE INDEX ON places (feature_code);
CREATE INDEX ON places (country_code);
CREATE INDEX ON places (admin1);
CREATE INDEX ON places (admin2);
CREATE INDEX ON places (admin3);
CREATE INDEX ON places (admin4);
CREATE INDEX ON places (pop);

CREATE TABLE top_cities (
	geonameid INT REFERENCES places (geonameid) PRIMARY KEY,
	name VARCHAR(200),
	c INT
);

CREATE INDEX ON top_cities (name);

\copy admin1 FROM 'admin1CodesASCII.txt' DELIMITER E'\t'
\copy admin2 FROM 'admin2Codes.txt' DELIMITER E'\t'
\copy places FROM 'cities.txt' DELIMITER E'\t'
\copy names (geonameid, name) FROM 'names.txt' DELIMITER E'\t'

------------------------------------

INSERT INTO top_cities SELECT t.geonameid, t.name, t.c FROM (SELECT p.geonameid, n0.name, (RANK() OVER (PARTITION BY n0.name ORDER BY p.pop DESC)) AS r, (COUNT(*) OVER (PARTITION BY n0.name)) AS c FROM places p INNER JOIN names n0 ON n0.geonameid = p.geonameid WHERE p.feature_class = 'P' AND n0.name_rank = 1) t WHERE r = 1; -- INNER JOIN names n1 ON n1.name ILIKE n0.name AND n0.geonameid <> n1.geonameid;

-----------------------

-- SELECT ptop.geonameid, t.name, ptop.lat, ptop.lon, ptop.pop, a1.name, ptop.country_code, SUM(prest.pop) OVER () AS poprest FROM top_cities t
-- INNER JOIN places ptop ON ptop.geonameid = t.geonameid
-- INNER JOIN names nrest ON nrest.name = t.name AND nrest.geonameid <> t.geonameid
-- INNER JOIN places prest ON prest.geonameid = nrest.geonameid
-- INNER JOIN admin1 a1 ON a1.code = CONCAT(ptop.country_code, '.', ptop.admin1)
-- WHERE t.name ILIKE $1;

---------------------------
								
CREATE TABLE pop_cmp (
	top_geonameid INT REFERENCES places (geonameid),
	name VARCHAR(200),
	poprest INT,
	c INT
);
CREATE INDEX ON pop_cmp (poprest);

INSERT INTO pop_cmp
	SELECT ptop.geonameid, t.name, SUM(prest.pop), COUNT(*) FROM top_cities t
		INNER JOIN places ptop ON ptop.geonameid = t.geonameid
		INNER JOIN names nrest ON nrest.name = t.name AND nrest.geonameid <> t.geonameid
		INNER JOIN places prest ON prest.geonameid = nrest.geonameid
		WHERE nrest.name_rank = 1
		GROUP BY ptop.geonameid, t.name;
	

--

SELECT * FROM (SELECT pc.name, p.country_code, (p.pop :: FLOAT) / pc.poprest AS frac, pc.c FROM pop_cmp pc INNER JOIN places p ON p.geonameid = pc.top_geonameid WHERE pc.poprest <> 0) t WHERE t.frac <> 0.0 ORDER BY frac DESC LIMIT 10;

--

UPDATE names SET upper_name = UPPER(name);
UPDATE names SET name_rank = t.r FROM ( SELECT geonameid, (RANK() OVER (PARTITION BY geonameid, upper_name ORDER BY name ASC )) AS r, name FROM names ) t WHERE names.geonameid = t.geonameid AND names.name = t.name;