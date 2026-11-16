CREATE TABLE IF NOT EXISTS iot_projects (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title text NOT NULL,
    board text NOT NULL CHECK (board IN ('esp32-c3', 'esp32', 'arduino-uno', 'pico-w')),
    mission_id text,
    code text NOT NULL,
    components_json jsonb NOT NULL DEFAULT '[]'::jsonb,
    wires_json jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS iot_projects_user_updated ON iot_projects(user_id, updated_at DESC);

-- Remove legacy Smart Irrigation Kebun A modules and replace with ESP32 Hardware Simulator missions
DELETE FROM lab_modules WHERE lab_id IN ('iot-mqtt-acl', 'iot-replay', 'iot-ota', 'iot-interlock');
DELETE FROM assignments WHERE lab_id IN ('iot-mqtt-acl', 'iot-replay', 'iot-ota', 'iot-interlock');
DELETE FROM lab_sessions WHERE lab_id IN ('iot-mqtt-acl', 'iot-replay', 'iot-ota', 'iot-interlock');

INSERT INTO lab_modules (lab_id, track, owasp_code, status, version) VALUES
('iot-esp32-gpio', 'iot', NULL, 'Terbit', '2.0.0'),
('iot-esp32-ultrasonic', 'iot', NULL, 'Terbit', '2.0.0'),
('iot-esp32-dht-oled', 'iot', NULL, 'Terbit', '2.0.0'),
('iot-esp32-mqtt', 'iot', NULL, 'Terbit', '2.0.0')
ON CONFLICT (lab_id) DO UPDATE SET track = EXCLUDED.track, status = EXCLUDED.status, version = EXCLUDED.version;
