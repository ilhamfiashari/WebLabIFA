-- Standarisasi mata kuliah pada tabel classes hanya menjadi 2 pilihan resmi:
-- 'Keamanan Web' dan 'IoT'

UPDATE classes
SET name = 'IF-3A · Keamanan Web',
    course = 'Keamanan Web'
WHERE id = 'IF-3A';

UPDATE classes
SET name = 'IF-3B · Keamanan Web',
    course = 'Keamanan Web'
WHERE id = 'IF-3B';

UPDATE classes
SET name = 'IF-4A · IoT',
    course = 'IoT'
WHERE id = 'IF-4A';

UPDATE classes
SET course = CASE
    WHEN lower(course) LIKE '%iot%'
      OR lower(course) LIKE '%tertanam%'
      OR lower(course) LIKE '%embedded%'
      OR lower(name) LIKE '%iot%'
    THEN 'IoT'
    ELSE 'Keamanan Web'
END
WHERE course NOT IN ('Keamanan Web', 'IoT');

ALTER TABLE classes DROP CONSTRAINT IF EXISTS classes_course_check;
ALTER TABLE classes ADD CONSTRAINT classes_course_check CHECK (course IN ('Keamanan Web', 'IoT'));
