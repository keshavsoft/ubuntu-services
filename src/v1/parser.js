import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { detectRepoInfo } from "./repo.js";

export function parseIni(content) {
    const lines = content.split(/\r?\n/);
    const sections = {};
    let currentSection = null;

    for (let rawLine of lines) {
        const line = rawLine.trim();

        if (!line || line.startsWith("#") || line.startsWith(";")) {
            continue;
        }

        const sectionMatch = line.match(/^\[([^\]]+)\]$/);
        if (sectionMatch) {
            currentSection = sectionMatch[1].trim();
            if (!sections[currentSection]) {
                sections[currentSection] = {};
            }
            continue;
        }

        const eqIdx = line.indexOf("=");
        if (eqIdx !== -1 && currentSection) {
            const key = line.slice(0, eqIdx).trim();
            const value = line.slice(eqIdx + 1).trim();

            const existing = sections[currentSection][key];
            if (existing !== undefined) {
                if (Array.isArray(existing)) {
                    existing.push(value);
                } else {
                    sections[currentSection][key] = [existing, value];
                }
            } else {
                sections[currentSection][key] = value;
            }
        }
    }

    return sections;
}

export function readPortFromEnvFile(filePath) {
    if (!filePath || typeof filePath !== "string") return null;
    const cleanPath = filePath.replace(/^-/, "").trim();

    try {
        if (fs.existsSync(cleanPath)) {
            const content = fs.readFileSync(cleanPath, "utf8");
            const match = content.match(/^\s*PORT\s*=\s*['"]?(\d{2,5})['"]?/m);
            if (match) {
                return { port: match[1], envFilePath: cleanPath };
            }
        }
    } catch {}

    return null;
}

export function extractPort(unit, serviceFilePath = "") {
    if (!unit || !unit.Service) {
        return { port: null, source: null, envFile: null };
    }

    const service = unit.Service;

    const envs = [];
    if (Array.isArray(service.Environment)) {
        envs.push(...service.Environment);
    } else if (typeof service.Environment === "string") {
        envs.push(service.Environment);
    }

    for (const env of envs) {
        const match = env.match(/\bPORT\s*=\s*(\d{2,5})\b/i);
        if (match) {
            return { port: match[1], source: "Environment directive", envFile: null };
        }
    }

    const execStart = service.ExecStart || "";

    const execPortMatch = execStart.match(/(?:PORT\s*=\s*|--port(?:=|\s+))(\d{2,5})/i);
    if (execPortMatch) {
        return { port: execPortMatch[1], source: "ExecStart argument", envFile: null };
    }

    const envFileMatch = execStart.match(/--env-file\s*=\s*([^\s"']+)|--env-file\s+([^\s"']+)/i);
    const execEnvPath = envFileMatch ? (envFileMatch[1] || envFileMatch[2]) : null;
    if (execEnvPath) {
        const envResult = readPortFromEnvFile(execEnvPath);
        if (envResult) {
            return {
                port: envResult.port,
                source: `ExecStart --env-file (${path.basename(execEnvPath)})`,
                envFile: execEnvPath
            };
        }
    }

    const envFiles = [];
    if (Array.isArray(service.EnvironmentFile)) {
        envFiles.push(...service.EnvironmentFile);
    } else if (typeof service.EnvironmentFile === "string") {
        envFiles.push(service.EnvironmentFile);
    }

    for (const rawEnvFile of envFiles) {
        const envResult = readPortFromEnvFile(rawEnvFile);
        if (envResult) {
            return {
                port: envResult.port,
                source: `EnvironmentFile (${path.basename(rawEnvFile)})`,
                envFile: envResult.envFilePath
            };
        }
    }

    const workingDir = service.WorkingDirectory;
    if (workingDir && workingDir !== "-") {
        const defaultEnv = path.join(workingDir, ".env");
        const envResult = readPortFromEnvFile(defaultEnv);
        if (envResult) {
            return {
                port: envResult.port,
                source: `WorkingDirectory/.env`,
                envFile: defaultEnv
            };
        }
    }

    return { port: null, source: null, envFile: null };
}

/**
 * Validates whether the physical working directory exists on the filesystem.
 */
export function checkDirectoryHealth(workingDirectory) {
    if (!workingDirectory || workingDirectory === "-" || typeof workingDirectory !== "string") {
        return {
            exists: null,
            status: "none",
            label: "No WorkingDirectory set"
        };
    }

    try {
        const exists = fs.existsSync(workingDirectory);
        return {
            exists,
            status: exists ? "ok" : "missing",
            label: exists ? "✅ Exists" : "❌ MISSING FOLDER"
        };
    } catch {
        return {
            exists: false,
            status: "missing",
            label: "❌ Access Error / Missing"
        };
    }
}

/**
 * Gets live status and detects crash-loops or exit codes (such as 200/CHDIR).
 */
export function getServiceHealth(serviceName) {
    if (process.platform !== "linux") {
        return { status: "configured", errorDetails: null };
    }

    try {
        const statusOutput = execSync(`systemctl status ${serviceName} 2>/dev/null`, {
            encoding: "utf8",
            timeout: 2500
        });

        let status = "active";
        let errorDetails = null;

        if (statusOutput.includes("status=200/CHDIR")) {
            status = "crash_loop_missing_dir";
            errorDetails = "status=200/CHDIR (WorkingDirectory does not exist on disk)";
        } else if (statusOutput.includes("activating (auto-restart)")) {
            status = "auto_restart";
            errorDetails = "Service in continuous restart loop";
        } else if (statusOutput.includes("Active: active")) {
            status = "active";
        } else if (statusOutput.includes("Active: inactive")) {
            status = "inactive";
        } else if (statusOutput.includes("Active: failed")) {
            status = "failed";
        }

        return { status, errorDetails };
    } catch (err) {
        const stdout = err.stdout ? err.stdout.toString() : "";
        if (stdout.includes("status=200/CHDIR")) {
            return {
                status: "crash_loop_missing_dir",
                errorDetails: "status=200/CHDIR (WorkingDirectory does not exist on disk)"
            };
        }
        if (stdout.includes("activating (auto-restart)")) {
            return {
                status: "auto_restart",
                errorDetails: "Service in continuous restart loop"
            };
        }
        return { status: "failed", errorDetails: "Process exited or service inactive" };
    }
}

export function parseServiceFile(filePath) {
    const rawContent = fs.readFileSync(filePath, "utf8");
    const parsed = parseIni(rawContent);
    const fileName = path.basename(filePath);
    const domain = fileName.replace(/\.service$/i, "");
    const portInfo = extractPort(parsed, filePath);

    const serviceSection = parsed.Service || {};
    const unitSection = parsed.Unit || {};

    const workingDir = serviceSection.WorkingDirectory || "-";
    const dirHealth = checkDirectoryHealth(workingDir);
    const health = getServiceHealth(fileName);
    const repoInfo = detectRepoInfo(workingDir);

    const isBroken = dirHealth.status === "missing" ||
                     health.status === "crash_loop_missing_dir" ||
                     health.status === "failed";

    return {
        serviceName: fileName,
        domain,
        filePath,
        port: portInfo.port || "-",
        portSource: portInfo.source || "-",
        envFile: portInfo.envFile || "-",
        description: unitSection.Description || "",
        workingDirectory: workingDir,
        dirExists: dirHealth.exists,
        dirStatus: dirHealth.status,
        dirLabel: dirHealth.label,
        status: health.status,
        errorDetails: health.errorDetails,
        isBroken,
        githubUrl: repoInfo.githubUrl || "-",
        packageName: repoInfo.packageName || "-",
        packageVersion: repoInfo.packageVersion || "-",
        execStart: serviceSection.ExecStart || "-",
        user: serviceSection.User || "root",
        restart: serviceSection.Restart || "-",
        restartSec: serviceSection.RestartSec || "-",
        raw: parsed
    };
}
