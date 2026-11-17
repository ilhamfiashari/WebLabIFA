export const LAPTOP_MODES = ['security', 'pentest', 'vulnerability', 'attacks', 'iot', 'protocols'] as const
export type LaptopMode = typeof LAPTOP_MODES[number]
export const LAPTOP_MENU = ['Cybersecurity', 'Pentest', 'Vulnerability', 'Attacks', 'IoT simulation', 'Networks']
export const LAPTOP_CONTENT: Record<LaptopMode, { pages: [string, string]; file: string; code: string[]; cli: string[] }> = {
  security: {
    pages: ['Signed telemetry / trust verification', 'Zero-trust network / policy enforcement'], file: 'security_pipeline.py',
    code: ['from hashlib import sha256', 'from lab import hmac, policy, audit', '', 'def verify(packet, key):', '    digest = sha256(packet.body).digest()', '    valid = hmac.compare(packet.sig, digest)', '    return valid and policy.allows(packet)', '', 'for packet in fixture.stream():', '    if verify(packet, lab_key):', '        audit.record(packet, "verified")', '        gateway.forward(packet)', '    else:', '        gateway.quarantine(packet)', '        audit.record(packet, "blocked")', '', 'assert audit.chain_is_valid()'],
    cli: ['$ lab replay signed-telemetry.fixture', '[TLS] certificate chain verified', '[HMAC] signed payload accepted', '[POLICY] least-privilege enforced', '[ALERT] altered payload quarantined', '[AUDIT] evidence chain verified', '[PASS] integrity checks complete'],
  },
  pentest: {
    pages: ['Scope discovery / isolated lab', 'Assessment graph / evidence collection'], file: 'assessment.py',
    code: ['from lab import Scope, Fixture', '', 'scope = Scope("192.0.2.0/24")', 'target = scope.authorize("192.0.2.10")', 'fixture = Fixture.open("web-lab")', '', 'for service in fixture.services(target):', '    headers = service.response_headers()', '    checks = inspect_headers(headers)', '    assert checks.no_sensitive_tokens()', '', 'for role in ["guest", "student"]:', '    result = fixture.check_access(role)', '    evidence.append(result)', '', 'report = evidence.summarize()', 'report.save("assessment.json")'],
    cli: ['$ lab assess --fixture web-lab', '[SCOPE] 192.0.2.10 authorized', '[DISCOVERY] fixture services loaded', '[HTTP] security headers inspected', '[AUTHZ] guest boundary verified', '[EVIDENCE] assessment.json saved', '[PASS] local assessment complete'],
  },
  vulnerability: {
    pages: ['Dependency inventory / advisory scan', 'Patch verification / remediation chain'], file: 'dependency_scan.py',
    code: ['from lab import SBOM, Advisories', '', 'inventory = SBOM.load("fixture.json")', 'advisories = Advisories.local_snapshot()', 'findings = []', '', 'for package in inventory.packages:', '    matches = advisories.match(package)', '    findings.extend(matches)', '', 'ranked = sort_by_severity(findings)', 'for issue in ranked:', '    fix = remediation.plan(issue)', '    patched = fixture.apply(fix)', '    assert rescan(patched).resolved(issue)', '', 'write_report(ranked, "scan.json")'],
    cli: ['$ lab scan --sbom fixture.json', '[INVENTORY] 48 fixture packages', '[MATCH] advisory signatures loaded', '[FINDING] outdated package detected', '[PATCH] fixture update applied', '[RESCAN] remediation verified', '[REPORT] scan.json ready'],
  },
  attacks: {
    pages: ['Attack replay / defensive isolation', 'Intrusion containment / recovery'], file: 'defense_replay.py',
    code: ['from lab import Replay, Firewall', '', 'replay = Replay("attack-fixture.json")', 'firewall = Firewall.default_deny()', 'baseline = fixture.snapshot()', '', 'for event in replay.events():', '    verdict = firewall.evaluate(event)', '    if event.signature in known_tests:', '        verdict = "block"', '    if verdict == "block":', '        quarantine.add(event)', '        alert.emit(event.category)', '    else:', '        fixture.forward(event)', '', 'assert fixture.integrity() == baseline'],
    cli: ['$ lab replay attack-fixture.json', '[REPLAY] synthetic events only', '[DETECT] invalid token rejected', '[RATE] request burst throttled', '[ISOLATE] suspicious node contained', '[RESTORE] fixture integrity verified', '[PASS] no external traffic sent'],
  },
  iot: {
    pages: ['ESP32 telemetry / sensor sampling', 'Ultrasonic echo / MQTT transport'], file: 'sensor_node.py',
    code: ['from machine import Pin', 'from lab import DHT22, HCSR04, MQTT', '', 'climate = DHT22(Pin(4))', 'ranger = HCSR04(trigger=5, echo=18)', 'led = Pin(2, Pin.OUT)', 'broker = MQTT("lab/sensors", qos=1)', '', 'while fixture.running():', '    temp, humidity = climate.read()', '    distance = ranger.measure_cm()', '    led.value(distance < 30)', '    broker.publish({', '        "temperature": temp,', '        "humidity": humidity,', '        "distance_cm": distance,', '    })'],
    cli: ['$ lab serial --fixture esp32', '[UART] 115200 baud / connected', '[DHT22] temperature + RH sampled', '[HC-SR04] trigger / echo received', '[MQTT] lab/sensors published', '[BROKER] QoS 1 acknowledged', '[SENSOR] next sample scheduled'],
  },
  protocols: {
    pages: ['DHCP / DNS / TCP handshake', 'Protocol layers / packet delivery'], file: 'network_flow.py',
    code: ['from lab import DHCP, ARP, DNS, TCP', '', 'lease = DHCP.discover()', 'gateway = ARP.resolve(lease.router)', 'address = DNS.query("broker.lab.test")', '', 'socket = TCP.syn(address, port=443)', 'socket.accept_syn_ack()', 'socket.acknowledge()', '', 'channel = TLS.wrap(socket)', 'assert channel.verify_certificate()', 'channel.publish("lab/sensors", payload)', '', 'for frame in channel.capture():', '    timeline.append(frame.layers)', 'assert channel.delivery_confirmed()'],
    cli: ['$ lab capture --fixture sensor-net', '[DHCP] discover → offer → ack', '[ARP] gateway address resolved', '[DNS] broker.lab.test answered', '[TCP] SYN → SYN-ACK → ACK', '[TLS] secure channel established', '[MQTT] sensor message delivered'],
  },
}
