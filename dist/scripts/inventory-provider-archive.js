import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
const defaultArchiveRoot = "/Users/sam/Desktop/developer-archive/x-backups-coding-sessions";
const archiveRoot = process.env.AGENT_SESSION_ARCHIVE_ROOT ?? process.argv[2] ?? defaultArchiveRoot;
const storeDir = process.env.AGENT_SESSION_STORE_DIR ?? join(process.env.HOME ?? ".", ".pi", "agent", "session-store");
const providerRoots = [
    { provider: "claude", path: "keep-session-data/claude/transcripts", strategy: "transcript files" },
    { provider: "codex", path: "keep-session-data/codex/sessions", strategy: "session files" },
    { provider: "oh-my-pi", path: "keep-session-data/omp/agent", strategy: "agent session files" },
    { provider: "oh-my-pi-html", path: "keep-session-data/omp/html-session-exports", strategy: "manual HTML exports" },
    { provider: "opencode", path: "keep-session-data/opencode-sessions/storage", strategy: "storage records" },
    { provider: "rovodev", path: "keep-session-data/rovodev/sessions", strategy: "session files" },
    { provider: "late", path: "keep-session-data/late/sessions", strategy: "session files" },
    { provider: "factory", path: "keep-session-data/factory/sessions", strategy: "session files" },
    { provider: "codex-sqlite", path: "review-other/codex", strategy: "review SQLite/history fallback" },
    { provider: "opencode-sqlite", path: "review-other/opencode-sessions", strategy: "review SQLite fallback" },
];
async function walk(dir) {
    const out = [];
    async function visit(path) {
        let entries;
        try {
            entries = await readdir(path, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            if (entry.name === ".DS_Store")
                continue;
            const child = join(path, entry.name);
            if (entry.isDirectory())
                await visit(child);
            else if (entry.isFile())
                out.push(child);
        }
    }
    await visit(dir);
    return out;
}
function addCount(map, key) { map[key] = (map[key] ?? 0) + 1; }
function extension(path) { return extname(path).toLowerCase() || "(none)"; }
function sha256(data) { return createHash("sha256").update(data).digest("hex"); }
function scanObject(value) {
    const fields = { timestamps: new Set(), cwd: new Set(), titles: new Set(), models: new Set(), keys: new Set() };
    function visit(obj, prefix = "") {
        if (!obj || typeof obj !== "object")
            return;
        if (Array.isArray(obj)) {
            for (const item of obj.slice(0, 10))
                visit(item, prefix);
            return;
        }
        for (const [key, child] of Object.entries(obj)) {
            const path = prefix ? `${prefix}.${key}` : key;
            fields.keys.add(path);
            const lower = key.toLowerCase();
            if (/(^|_)(time|timestamp|created|updated|date|started|finished|modified|mtime|birthtime|lastseen|firstseen)/.test(lower))
                fields.timestamps.add(path);
            if (["cwd", "project", "projectpath", "workspace", "workspacepath", "repo", "repository", "directory"].includes(lower))
                fields.cwd.add(path);
            if (["title", "summary", "name", "task", "prompt"].includes(lower))
                fields.titles.add(path);
            if (["model", "modelid", "modelname"].includes(lower))
                fields.models.add(path);
            if (typeof child === "object")
                visit(child, path);
        }
    }
    visit(value);
    return fields;
}
function detectJsonText(text, file) {
    const notes = [];
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    let parsed;
    let kind = "json";
    try {
        parsed = JSON.parse(text);
    }
    catch {
        const parsedLines = [];
        for (const line of lines.slice(0, 200)) {
            try {
                parsedLines.push(JSON.parse(line));
            }
            catch {
                break;
            }
        }
        if (parsedLines.length) {
            parsed = parsedLines;
            kind = "jsonl";
            notes.push(`sampled ${parsedLines.length} JSONL rows`);
        }
        else
            return { kind: extension(file).slice(1) || "text", parseable: false, timestampFields: [], cwdFields: [], titleFields: [], modelFields: [], notes: ["not JSON/JSONL parseable"] };
    }
    const fields = scanObject(parsed);
    return { kind, parseable: true, keys: [...fields.keys].slice(0, 40), timestampFields: [...fields.timestamps], cwdFields: [...fields.cwd], titleFields: [...fields.titles], modelFields: [...fields.models], eventCount: Array.isArray(parsed) ? parsed.length : undefined, notes };
}
function detectHtml(text) {
    const lower = text.slice(0, 20000).toLowerCase();
    const timestampFields = lower.match(/datetime|timestamp|time/g) ? ["html time/datetime markers"] : [];
    return { kind: "html", parseable: true, timestampFields, cwdFields: lower.includes("cwd") || lower.includes("project") ? ["html cwd/project text"] : [], titleFields: lower.includes("<title") ? ["html title"] : [], modelFields: lower.includes("model") ? ["html model text"] : [], notes: ["HTML export; parse with DOM/text extractor"] };
}
async function detect(file) {
    const ext = extension(file);
    const data = await readFile(file);
    const text = data.toString("utf8");
    if ([".json", ".jsonl", ".log", ".txt", "(none)"].includes(ext))
        return detectJsonText(text, file);
    if ([".html", ".htm"].includes(ext))
        return detectHtml(text);
    if ([".md", ".markdown"].includes(ext))
        return { kind: "markdown", parseable: true, timestampFields: /\d{4}-\d{2}-\d{2}/.test(text) ? ["markdown date text"] : [], cwdFields: /cwd|project|repo/i.test(text) ? ["markdown cwd/project text"] : [], titleFields: ["markdown heading/filename"], modelFields: /model/i.test(text) ? ["markdown model text"] : [], notes: ["manual Markdown export"] };
    if ([".sqlite", ".db"].includes(ext))
        return { kind: "sqlite", parseable: true, timestampFields: ["inspect sqlite schema"], cwdFields: [], titleFields: [], modelFields: [], notes: ["SQLite database; requires schema inspection"] };
    return { kind: ext.slice(1) || "unknown", parseable: false, timestampFields: [], cwdFields: [], titleFields: [], modelFields: [], notes: ["unsupported extension for session import"] };
}
function chooseSamples(files) {
    const byExt = new Map();
    for (const file of files) {
        const list = byExt.get(extension(file)) ?? [];
        list.push(file);
        byExt.set(extension(file), list);
    }
    return [...byExt.values()].flatMap((list) => list.slice(0, 3)).slice(0, 18);
}
async function inventoryProvider(rootInfo) {
    const root = join(archiveRoot, rootInfo.path);
    if (!existsSync(root))
        return { provider: rootInfo.provider, root, exists: false, strategy: rootInfo.strategy, fileCount: 0, totalBytes: 0, extensions: {}, samples: [], detectedTimestampFields: {}, detectedCwdFields: {}, detectedTitleFields: {}, detectedModelFields: {}, recommendedImportStrategy: "skip", skippedReason: "root missing" };
    const files = await walk(root);
    const extensions = {};
    let totalBytes = 0;
    for (const file of files) {
        const st = await stat(file);
        totalBytes += st.size;
        addCount(extensions, extension(file));
    }
    const samples = [];
    const detectedTimestampFields = {}, detectedCwdFields = {}, detectedTitleFields = {}, detectedModelFields = {};
    for (const file of chooseSamples(files)) {
        const data = await readFile(file);
        const st = await stat(file);
        const detected = await detect(file);
        for (const field of detected.timestampFields)
            addCount(detectedTimestampFields, field);
        for (const field of detected.cwdFields)
            addCount(detectedCwdFields, field);
        for (const field of detected.titleFields)
            addCount(detectedTitleFields, field);
        for (const field of detected.modelFields)
            addCount(detectedModelFields, field);
        samples.push({ path: relative(archiveRoot, file), size: st.size, sha256: sha256(data), detected });
    }
    const parseable = samples.filter((sample) => sample.detected.parseable).length;
    const recommendedImportStrategy = parseable ? `${rootInfo.strategy}; implement adapter for ${Object.keys(extensions).join(", ")}` : "manual review before import";
    return { provider: rootInfo.provider, root, exists: true, strategy: rootInfo.strategy, fileCount: files.length, totalBytes, extensions, samples, detectedTimestampFields, detectedCwdFields, detectedTitleFields, detectedModelFields, recommendedImportStrategy };
}
function formatBytes(bytes) {
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} KiB`;
    if (bytes < 1024 * 1024 * 1024)
        return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GiB`;
}
function formatMap(map) {
    const entries = Object.entries(map).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return entries.length ? entries.map(([key, value]) => `${key}: ${value}`).join(", ") : "none detected";
}
function markdown(inventories) {
    const lines = [`# Provider archive format inventory`, ``, `Generated: ${new Date().toISOString()}`, `Archive root: \`${archiveRoot}\``, ``, `## Summary`, ``, `| Provider | Files | Size | Extensions | Strategy |`, `| --- | ---: | ---: | --- | --- |`];
    for (const inv of inventories)
        lines.push(`| ${inv.provider} | ${inv.exists ? inv.fileCount : "missing"} | ${inv.exists ? formatBytes(inv.totalBytes) : "-"} | ${inv.exists ? formatMap(inv.extensions) : "-"} | ${inv.recommendedImportStrategy} |`);
    for (const inv of inventories) {
        lines.push(``, `## ${inv.provider}`, ``, `Root: \`${inv.root}\``, ``, `Existing strategy: ${inv.strategy}`, `Recommended: ${inv.recommendedImportStrategy}`, `Timestamp fields: ${formatMap(inv.detectedTimestampFields)}`, `CWD/project fields: ${formatMap(inv.detectedCwdFields)}`, `Title fields: ${formatMap(inv.detectedTitleFields)}`, `Model fields: ${formatMap(inv.detectedModelFields)}`, ``, `### Samples`, ``);
        for (const sample of inv.samples)
            lines.push(`- \`${sample.path}\` (${formatBytes(sample.size)}, ${sample.detected.kind}, parseable=${sample.detected.parseable})`, `  - timestamps: ${sample.detected.timestampFields.join(", ") || "none"}`, `  - cwd/project: ${sample.detected.cwdFields.join(", ") || "none"}`, `  - title: ${sample.detected.titleFields.join(", ") || "none"}`, `  - model: ${sample.detected.modelFields.join(", ") || "none"}`, `  - notes: ${sample.detected.notes.join("; ") || "none"}`);
    }
    return lines.join("\n");
}
const inventories = await Promise.all(providerRoots.map(inventoryProvider));
await writeFile(join(storeDir, "provider-format-inventory.json"), JSON.stringify({ generatedAt: new Date().toISOString(), archiveRoot, inventories }, null, 2));
await writeFile(join(storeDir, "provider-format-inventory.md"), markdown(inventories));
console.log(`Wrote ${join(storeDir, "provider-format-inventory.json")}`);
console.log(`Wrote ${join(storeDir, "provider-format-inventory.md")}`);
//# sourceMappingURL=inventory-provider-archive.js.map