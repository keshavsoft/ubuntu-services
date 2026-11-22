import {
    listAllServices,
    findBrokenServices,
    findServiceByName,
    discoverServiceDirs,
    resolveTargetDir
} from "./index.js";

export function printHelp() {
    console.log(`
ubuntu-services (v1) — Discover, inventory & health-check Ubuntu systemd services

Usage:
  npx ubuntu-services [flags]
  npx ubuntu-services broken [flags]
  npx ubuntu-services doctor [flags]
  npx ubuntu-services dirs [flags]
  npx ubuntu-services inspect <service-or-domain> [flags]

Commands:
  (default)            Table of all services with physical directory verification
  broken / doctor      Alert report of broken services (missing folders / crash loops)
  dirs                 List all systemd unit directories on this Ubuntu system
  inspect <name>       Deep inspection of a specific service unit file

Options:
  --dir <path>         Specify custom systemd directory
  --keshavsoft         Filter to only KeshavSoft domain services
  --json               Output machine-readable JSON
  -h, --help           Show this help message

Aliases:
  usv                  Short alias for npx ubuntu-services

Examples:
  npx ubuntu-services
  npx ubuntu-services broken
  npx ubuntu-services doctor
  npx ubuntu-services dirs
  npx ubuntu-services inspect appointment.keshavsoft.com
`);
}

export function runCli(argv = process.argv.slice(2)) {
    const isJson = argv.includes("--json");
    const isHelp = argv.includes("-h") || argv.includes("--help");
    const keshavsoftOnly = argv.includes("--keshavsoft");

    if (isHelp) {
        printHelp();
        return 0;
    }

    let customDir = null;
    const dirIdx = argv.indexOf("--dir");
    if (dirIdx !== -1 && argv[dirIdx + 1]) {
        customDir = argv[dirIdx + 1];
    }

    const args = argv.filter((arg, i) => {
        if (arg === "--json" || arg === "-h" || arg === "--help" || arg === "--keshavsoft") return false;
        if (arg === "--dir" || (i > 0 && argv[i - 1] === "--dir")) return false;
        return true;
    });

    const command = args[0] ? args[0].toLowerCase() : "";

    // 1. Dirs command: `usv dirs`
    if (command === "dirs") {
        const dirs = discoverServiceDirs(customDir);
        if (isJson) {
            console.log(JSON.stringify(dirs, null, 2));
            return 0;
        }

        console.log(`\nDiscovered Ubuntu Systemd Service Directories:\n`);
        const rows = dirs.map(d => ({
            "Directory": d.dirPath,
            "Exists": d.exists ? "✅ Yes" : "❌ No",
            "Units Found": d.unitCount
        }));
        console.table(rows);
        return 0;
    }

    // 2. Broken / Doctor command: `usv broken` or `usv doctor` or `usv missing`
    if (command === "broken" || command === "doctor" || command === "missing") {
        const brokenServices = findBrokenServices({ dir: customDir, keshavsoftOnly });
        if (isJson) {
            console.log(JSON.stringify(brokenServices, null, 2));
            return brokenServices.length === 0 ? 0 : 2;
        }

        console.log(`\n======================================================================`);
        console.log(`🩺 Ubuntu Systemd Health Audit: Broken Services & Missing Folders`);
        console.log(`======================================================================\n`);

        if (brokenServices.length === 0) {
            console.log(`✅ All services are healthy! Every WorkingDirectory physically exists on disk.\n`);
            return 0;
        }

        console.log(`⚠️  Found ${brokenServices.length} service(s) with physical folder issues or crash loops:\n`);

        brokenServices.forEach((s, idx) => {
            console.log(`[${idx + 1}] Service: ${s.serviceName}`);
            console.log(`    Domain            : ${s.domain}`);
            console.log(`    Unit File         : ${s.filePath}`);
            console.log(`    Service Status    : 🚨 ${s.status}`);
            if (s.errorDetails) {
                console.log(`    Error Details     : ${s.errorDetails}`);
            }
            console.log(`    Working Directory : ${s.workingDirectory}`);
            console.log(`    Folder Health     : ${s.dirLabel}`);
            if (s.port && s.port !== "-") {
                console.log(`    Assigned Port     : ${s.port}`);
            }
            if (s.githubUrl && s.githubUrl !== "-") {
                console.log(`    GitHub Repo       : ${s.githubUrl}`);
            }
            console.log("");
        });

        console.log(`======================================================================`);
        console.log(`Action Required: Either restore the missing folder, or update the service unit.`);
        console.log(`======================================================================\n`);

        return 2;
    }

    // 3. Inspect command: `usv inspect <name>`
    if (command === "inspect" && args[1]) {
        const targetName = args[1];
        const svc = findServiceByName(targetName, { dir: customDir });
        if (!svc) {
            console.error(`Error: Service '${targetName}' not found.`);
            return 1;
        }

        if (isJson) {
            console.log(JSON.stringify(svc, null, 2));
            return 0;
        }

        console.log(`\n======================================================================`);
        console.log(`🔍 Service Details: ${svc.serviceName}`);
        console.log(`======================================================================\n`);

        console.log(`Domain            : ${svc.domain}`);
        console.log(`Unit File         : ${svc.filePath}`);
        console.log(`Service Status    : ${svc.status === "active" ? "🟢 active" : (svc.isBroken ? "🚨 " + svc.status : "⚪ " + svc.status)}`);
        console.log(`Working Directory : ${svc.workingDirectory}`);
        console.log(`Folder Health     : ${svc.dirLabel}`);
        console.log(`Port              : ${svc.port} (${svc.portSource})`);
        if (svc.githubUrl !== "-") {
            console.log(`GitHub Repo       : 🔗 ${svc.githubUrl}`);
        }
        if (svc.packageName !== "-") {
            console.log(`Package           : ${svc.packageName} (v${svc.packageVersion})`);
        }
        console.log(`ExecStart         : ${svc.execStart}`);
        console.log(`User              : ${svc.user}`);
        console.log(`Restart Policy    : ${svc.restart} (${svc.restartSec}s)`);

        console.log(`\nRaw Unit Sections:\n`);
        console.log(JSON.stringify(svc.raw, null, 2));
        return 0;
    }

    // 4. Default Overview Table: `usv`
    const services = listAllServices({ dir: customDir, keshavsoftOnly });
    if (isJson) {
        console.log(JSON.stringify(services, null, 2));
        return 0;
    }

    const targetDir = resolveTargetDir(customDir);
    const brokenCount = services.filter(s => s.isBroken).length;

    console.log(`\nUbuntu Systemd Services (${services.length} services in ${targetDir}):\n`);

    const tableRows = services.map(s => ({
        "Service": s.serviceName,
        "Domain": s.domain,
        "Status": s.status === "active" ? "🟢 active" : (s.isBroken ? "🚨 " + s.status : s.status),
        "Physical Folder": s.dirLabel,
        "Port": s.port,
        "GitHub Repo": s.githubUrl !== "-" ? s.githubUrl.replace("https://github.com/", "") : "-",
        "Working Directory": s.workingDirectory
    }));

    console.table(tableRows);

    if (brokenCount > 0) {
        console.log(`⚠️  Alert: ${brokenCount} service(s) have missing physical folders or crash loops!`);
        console.log(`    Run 'npx ubuntu-services broken' for diagnostic details.\n`);
    } else {
        console.log(`Tip: Run 'npx ubuntu-services broken' to audit for missing folders or broken units.`);
        console.log(`     Run 'npx ubuntu-services dirs' to list systemd directories on Ubuntu.\n`);
    }

    return 0;
}

export default runCli;
