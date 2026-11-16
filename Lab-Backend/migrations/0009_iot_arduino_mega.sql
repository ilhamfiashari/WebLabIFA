ALTER TABLE iot_projects DROP CONSTRAINT IF EXISTS iot_projects_board_check;
ALTER TABLE iot_projects ADD CONSTRAINT iot_projects_board_check
    CHECK (board IN ('esp32-c3', 'esp32', 'arduino-uno', 'arduino-mega', 'pico-w'));
