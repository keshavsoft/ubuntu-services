# ubuntu-services

[![npm](https://img.shields.io/npm/v/ubuntu-services.svg)](https://www.npmjs.com/package/ubuntu-services)
[![GitHub Pages](https://img.shields.io/badge/docs-GitHub_Pages-emerald)](https://keshavsoft.github.io/ubuntu-services/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)
[![KeshavSoft](https://img.shields.io/badge/org-KeshavSoft-purple)](https://github.com/keshavsoft)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)](https://nodejs.org)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](#zero-dependencies)

> **Discover, list, and health-check all registered Ubuntu systemd services, verifying physical working directories on disk.**  
> The OS service registry and health audit companion to `ubuntu-service-cli` and `ubuntu-service-port`.

---

## 🌐 Live Documentation & Terminal Simulator

Interactive web portal, architecture guide, and live VPS simulator:  
👉 **[https://keshavsoft.github.io/ubuntu-services/](https://keshavsoft.github.io/ubuntu-services/)**

---

## 📖 The Problem: Ghost Services and Missing Physical Folders

When deploying and renaming Node.js applications on an Ubuntu VPS, a common failure pattern occurs:
1. A service is configured in `/etc/systemd/system/appointment.keshavsoft.com.service`.
2. Someone moves, deletes, or renames the folder `/root/KeshavSoft/appointment-notifier`.
3. Systemd attempts to start the service, fails immediately with `(code=exited, status=200/CHDIR)`, and enters a silent background restart loop.
4. Caddy routes traffic to `localhost:3000` and serves `502 Bad Gateway`.
5. Standard tools don't tell you *which* service has a broken directory.

**`ubuntu-services` audits every systemd unit and physically checks if its `WorkingDirectory` exists on disk.**

---

## ⚡ Quick Start

Run directly via `npx` on your Ubuntu VPS (zero installation required):

```bash
# 1. Overview table of all services with Physical Folder verification
npx ubuntu-services

# Short alias
npx usv

# 2. Isolate only broken services (missing folders / crash loops)
npx ubuntu-services broken
# or
npx usv doctor

# 3. Discover all systemd directories on Ubuntu
npx ubuntu-services dirs

# 4. Deeply inspect a specific service
npx ubuntu-services inspect appointment.keshavsoft.com
```

---

## 🛠️ CLI Features & Output

### 1. Default Service Inventory Table
Every service displays its domain, live status, and whether its physical code directory exists on disk:

```bash
npx ubuntu-services
```

```
Ubuntu Systemd Services (6 services in /etc/systemd/system):

┌─────────┬──────────────────────────────────────┬──────────────────────────────┬──────────┬─────────────────────┬────────┬─────────────────────────────────────────┐
│ (index) │ Service                              │ Domain                       │ Status   │ Physical Folder     │ Port   │ Working Directory                       │
├─────────┼──────────────────────────────────────┼──────────────────────────────┼──────────┼─────────────────────┼────────┼─────────────────────────────────────────┤
│ 0       │ 'call.keshavsoft.com.service'        │ 'call.keshavsoft.com'        │ 'active' │ '✅ Exists'         │ '3001' │ '/root/KeshavSoft/appointment-notifier' │
│ 1       │ 'appointment.keshavsoft.com.service' │ 'appointment.keshavsoft.com' │ '🚨 200' │ '❌ MISSING FOLDER' │ '3000' │ '/root/KeshavSoft/old-appointment'      │
│ 2       │ 'lab14.keshavsoft.com.service'       │ 'lab14.keshavsoft.com'       │ 'active' │ '✅ Exists'         │ '9012' │ '/root/KeshavSoft/lab14.keshavsoft.com' │
└─────────┴──────────────────────────────────────┴──────────────────────────────┴──────────┴─────────────────────┴────────┴─────────────────────────────────────────┘
⚠️  Alert: 1 service(s) have missing physical folders or crash loops!
    Run 'npx ubuntu-services broken' for diagnostic details.
```

---

### 2. Broken Services Diagnostic (`broken` or `doctor`)
Instantly isolates units that have broken physical folders or are stuck in `status=200/CHDIR` restart loops:

```bash
npx ubuntu-services broken
```

```
======================================================================
🩺 Ubuntu Systemd Health Audit: Broken Services & Missing Folders
======================================================================

⚠️  Found 1 service(s) with physical folder issues or crash loops:

[1] Service: appointment.keshavsoft.com.service
    Domain            : appointment.keshavsoft.com
    Unit File         : /etc/systemd/system/appointment.keshavsoft.com.service
    Service Status    : 🚨 crash_loop_missing_dir
    Error Details     : status=200/CHDIR (WorkingDirectory does not exist on disk)
    Working Directory : /root/KeshavSoft/old-appointment
    Folder Health     : ❌ MISSING FOLDER
    Assigned Port     : 3000

======================================================================
Action Required: Either restore the missing folder, or update the service unit.
======================================================================
```

---

### 3. Systemd Directories Discovery (`dirs`)
Reports all service directories present on your Linux installation and the number of unit files in each:

```bash
npx ubuntu-services dirs
```

```
Discovered Ubuntu Systemd Service Directories:

┌─────────┬────────────────────────┬─────────┬───────────────┐
│ (index) │ Directory              │ Exists  │ Units Found   │
├─────────┼────────────────────────┼─────────┼───────────────┤
│ 0       │ '/etc/systemd/system'  │ '✅ Yes'│ 18            │
│ 1       │ '/run/systemd/system'  │ '✅ Yes'│ 2             │
│ 2       │ '/usr/lib/systemd/system'│ '✅ Yes'│ 245          │
│ 3       │ '/lib/systemd/system'  │ '✅ Yes'│ 245           │
└─────────┴────────────────────────┴─────────┴───────────────┘
```

---

## 💻 Programmatic JavaScript API

```javascript
import {
    listAllServices,
    findBrokenServices,
    discoverServiceDirs
} from "ubuntu-services";

// 1. Get all broken services with missing physical directories
const broken = findBrokenServices();
console.log(broken.map(s => ({
    service: s.serviceName,
    missingDir: s.workingDirectory
})));

// 2. Discover systemd unit directories
const dirs = discoverServiceDirs();
```

---

## 🪶 Zero Dependencies

Engineered with **0 external npm runtime dependencies**. Uses only native Node.js core modules:
- `node:fs`
- `node:path`
- `node:child_process`

---

## 📄 License

ISC © [KeshavSoft](https://github.com/keshavsoft)
