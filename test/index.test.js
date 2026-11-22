import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
    listAllServices,
    findBrokenServices,
    findServiceByName,
    discoverServiceDirs,
    checkDirectoryHealth,
    parseServiceFile
} from "../src/index.js";
import { listAllServices as listAllServicesV1 } from "../src/v1/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "fixtures", "systemd-dir");
const sampleAppDir = path.join(__dirname, "fixtures", "sample-app");

test("checkDirectoryHealth() identifies existing directory", () => {
    const health = checkDirectoryHealth(sampleAppDir);
    assert.equal(health.exists, true);
    assert.equal(health.status, "ok");
    assert.ok(health.label.includes("Exists"));
});

test("checkDirectoryHealth() flags non-existent physical directory as missing", () => {
    const health = checkDirectoryHealth("/non/existent/path/appointment-notifier");
    assert.equal(health.exists, false);
    assert.equal(health.status, "missing");
    assert.ok(health.label.includes("MISSING"));
});

test("parseServiceFile() flags service with missing physical folder as broken", () => {
    const svcPath = path.join(fixturesDir, "appointment.keshavsoft.com.service");
    const svc = parseServiceFile(svcPath);
    assert.equal(svc.serviceName, "appointment.keshavsoft.com.service");
    assert.equal(svc.domain, "appointment.keshavsoft.com");
    assert.equal(svc.dirExists, false);
    assert.equal(svc.dirStatus, "missing");
    assert.equal(svc.isBroken, true);
});

test("parseServiceFile() parses healthy service with existing folder", () => {
    const svcPath = path.join(fixturesDir, "active-app.service");
    const svc = parseServiceFile(svcPath);
    assert.equal(svc.serviceName, "active-app.service");
    assert.equal(svc.dirExists, true);
    assert.equal(svc.dirStatus, "ok");
    assert.equal(svc.isBroken, false);
    assert.equal(svc.port, "4000");
    assert.equal(svc.githubUrl, "https://github.com/keshavsoft/sample-app");
});

test("listAllServices() lists all services in fixtures directory", () => {
    const all = listAllServices({ dir: fixturesDir });
    assert.equal(all.length, 2);
});

test("findBrokenServices() isolates only services with missing physical folders", () => {
    const broken = findBrokenServices({ dir: fixturesDir });
    assert.equal(broken.length, 1);
    assert.equal(broken[0].serviceName, "appointment.keshavsoft.com.service");
    assert.equal(broken[0].dirStatus, "missing");
});

test("findServiceByName() finds service by domain name", () => {
    const svc = findServiceByName("appointment.keshavsoft.com", { dir: fixturesDir });
    assert.ok(svc);
    assert.equal(svc.domain, "appointment.keshavsoft.com");
});

test("discoverServiceDirs() checks custom directory", () => {
    const dirs = discoverServiceDirs(fixturesDir);
    assert.equal(dirs.length, 1);
    assert.equal(dirs[0].exists, true);
    assert.equal(dirs[0].unitCount, 2);
});

test("src/index.js orchestrates cleanly from v1", () => {
    const viaRoot = listAllServices({ dir: fixturesDir });
    const viaV1 = listAllServicesV1({ dir: fixturesDir });
    assert.deepEqual(viaRoot, viaV1);
});
