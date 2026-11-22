import fs from "node:fs";
import path from "node:path";
import { parseServiceFile } from "./parser.js";

export const STANDARD_SERVICE_DIRS = [
    "/etc/systemd/system",
    "/run/systemd/system",
    "/usr/lib/systemd/system",
    "/lib/systemd/system"
];

/**
 * Discovers and reports all standard systemd directories present on the OS.
 */
export function discoverServiceDirs(customDir) {
    const dirsToCheck = customDir ? [path.resolve(customDir)] : STANDARD_SERVICE_DIRS;
    const discovered = [];

    for (const dir of dirsToCheck) {
        if (fs.existsSync(dir)) {
            try {
                const files = fs.readdirSync(dir).filter(f => f.endsWith(".service"));
                discovered.push({
                    dirPath: dir,
                    exists: true,
                    unitCount: files.length,
                    serviceFiles: files
                });
            } catch {
                discovered.push({
                    dirPath: dir,
                    exists: true,
                    unitCount: 0,
                    error: "Permission denied or unreadable"
                });
            }
        } else {
            if (customDir) {
                discovered.push({
                    dirPath: dir,
                    exists: false,
                    unitCount: 0
                });
            }
        }
    }

    return discovered;
}

/**
 * Resolves the default directory to scan.
 */
export function resolveTargetDir(customDir) {
    if (customDir) {
        return path.resolve(customDir);
    }
    if (fs.existsSync("/etc/systemd/system")) {
        return "/etc/systemd/system";
    }
    const localFixtures = path.resolve("./test/fixtures/systemd-dir");
    if (fs.existsSync(localFixtures)) {
        return localFixtures;
    }
    return "/etc/systemd/system";
}

/**
 * Scans and parses all systemd services in the target directory.
 */
export function listAllServices(options = {}) {
    const targetDir = resolveTargetDir(options.dir);

    if (!fs.existsSync(targetDir)) {
        throw new Error(`Target systemd directory not found: ${targetDir}`);
    }

    const files = fs.readdirSync(targetDir).filter(f => f.endsWith(".service"));
    const services = [];

    for (const file of files) {
        if (options.keshavsoftOnly) {
            if (!file.includes("keshavsoft.com")) continue;
        }

        try {
            const parsed = parseServiceFile(path.join(targetDir, file));
            services.push(parsed);
        } catch {}
    }

    if (options.brokenOnly) {
        return services.filter(s => s.isBroken);
    }

    return services;
}

/**
 * Returns only broken services (missing physical working directory or crash loop).
 */
export function findBrokenServices(options = {}) {
    return listAllServices({ ...options, brokenOnly: true });
}

/**
 * Finds a single service by unit name or domain.
 */
export function findServiceByName(targetName, options = {}) {
    if (!targetName) return null;
    const clean = String(targetName).trim().toLowerCase().replace(/\.service$/i, "");
    const services = listAllServices(options);
    return services.find(s => s.domain.toLowerCase() === clean || s.serviceName.toLowerCase() === `${clean}.service`) || null;
}
