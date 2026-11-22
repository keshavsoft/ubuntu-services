import fs from "node:fs";
import path from "node:path";

export function cleanGitHubUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== "string") return null;

    let url = rawUrl.trim();
    url = url.replace(/^git\+https?:\/\//i, "https://");
    url = url.replace(/^git\+ssh:\/\/git@github\.com[:/]/i, "https://github.com/");
    url = url.replace(/^git:\/\/github\.com\//i, "https://github.com/");
    url = url.replace(/^git@github\.com:/i, "https://github.com/");

    if (/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9._-]+$/.test(url)) {
        url = `https://github.com/${url}`;
    }

    url = url.replace(/\.git$/i, "");
    url = url.replace(/\/+$/, "");

    return url.startsWith("https://github.com/") ? url : (url.startsWith("http") ? url : null);
}

export function detectRepoInfo(workingDirectory) {
    if (!workingDirectory || workingDirectory === "-" || typeof workingDirectory !== "string") {
        return { githubUrl: null, packageName: null, packageVersion: null };
    }

    try {
        const pkgPath = path.join(workingDirectory, "package.json");
        if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
            const rawRepo = pkg.repository ? (typeof pkg.repository === "string" ? pkg.repository : pkg.repository.url) : null;
            return {
                githubUrl: cleanGitHubUrl(rawRepo || pkg.homepage),
                packageName: pkg.name || null,
                packageVersion: pkg.version || null
            };
        }
    } catch {}

    try {
        const gitConfigPath = path.join(workingDirectory, ".git", "config");
        if (fs.existsSync(gitConfigPath)) {
            const content = fs.readFileSync(gitConfigPath, "utf8");
            const match = content.match(/\[remote\s+"origin"\][^\[]*?url\s*=\s*([^\r\n]+)/i);
            if (match) {
                return {
                    githubUrl: cleanGitHubUrl(match[1]),
                    packageName: null,
                    packageVersion: null
                };
            }
        }
    } catch {}

    return { githubUrl: null, packageName: null, packageVersion: null };
}
