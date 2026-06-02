import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

type RelocationRecord = {
	ts: string;
	fromCwd: string;
	toCwd: string;
	sourceSession: string;
	destinationSession: string;
	parent?: string;
	inferred?: boolean;
	confidence?: string;
	replacements?: number | null;
};

type OverlayRecord =
	| { kind: "root"; session: string; historicalCwd?: string; label?: string; confidence?: string; evidence?: string[]; notes?: string[] }
	| { kind: "edge"; source: string; destination: string; fromCwd?: string; toCwd?: string; ts?: string; confidence?: string; lineageKind?: string; evidence?: string[]; notes?: string[] }
	| { kind: "alias"; path: string; label: string; note?: string }
	| { kind: "session-label"; session?: string; sessionId?: string; cwd?: string; label?: string; source?: string; confidence?: string; note?: string }
	| { kind: "classification"; manifestIndex: number; lineageKind?: string; recordConfidence?: string; continuationConfidence?: string };

type SessionStats = {
	path: string;
	exists: boolean;
	currentLines: number;
	startTimestamp?: string;
	firstTimestamp?: string;
	lastTimestamp?: string;
	cwd?: string;
	bytes?: number;
};

type TemporalEdge = {
	id: string;
	kind: "manifest" | "overlay";
	manifestIndex?: number;
	lineageKind?: string;
	ts: string;
	fromCwd: string;
	toCwd: string;
	sourceSession: string;
	destinationSession: string;
	sourceLinesAtEvent?: number;
	sourceLastTimestampAtEvent?: string;
	sourceCurrentLines?: number;
	destinationCurrentLines?: number;
	confidence?: string;
	recordConfidence?: string;
	continuationConfidence?: string;
	replacements?: number | null;
	notes?: string[];
};

const home = process.env.HOME ?? ".";
const agentDir = process.env.PI_CODING_AGENT_DIR ?? join(home, ".pi", "agent");
const outputDir = join(agentDir, "session-graph");
const manifestPath = join(agentDir, "relocations.jsonl");
const overlayPath = join(outputDir, "lineage-overlays.jsonl");
const sessionsDir = join(agentDir, "sessions");

function shortHash(value: string) {
	return createHash("sha256").update(value).digest("hex").slice(0, 8);
}

function homeShort(path: string) {
	return path.startsWith(`${home}/`) ? `~/${path.slice(home.length + 1)}` : path;
}

function sessionStartTimestamp(path: string) {
	const match = basename(path).match(/^(\d{4}-\d{2}-\d{2}T\d{2}[-:]\d{2}[-:]\d{2}[.-]\d{3}Z)/);
	return match?.[1].replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, "T$1:$2:$3.$4Z");
}

function bucketLabel(session: string) {
	const bucket = session.match(/\/sessions\/--(.+?)--\//)?.[1];
	if (!bucket) return undefined;
	const rules: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
		[/^Users-sam-git-agents-(.+)$/, (match) => `agents/${match[1]}`],
		[/^Users-sam-git-public-(.+)$/, (match) => `public/${match[1]}`],
		[/^Users-sam-git-private-utilities-(.+)$/, (match) => `private/utilities/${match[1]}`],
		[/^Users-sam-git-utilities-(.+)$/, (match) => `utilities/${match[1]}`],
		[/^Users-sam-git-bespoke-thinking-(.+)$/, (match) => `bespoke-thinking/${match[1]}`],
		[/^Users-sam-git-forks-(.+)$/, (match) => `forks/${match[1]}`],
		[/^Users-sam-git-(.+)$/, (match) => match[1]],
		[/^Users-sam-Documents-GitHub-(.+)$/, (match) => `Documents/GitHub/${match[1]}`],
		[/^Users-sam-(.+)$/, (match) => `Users/sam/${match[1]}`],
	];
	for (const [pattern, format] of rules) {
		const match = bucket.match(pattern);
		if (match) return format(match);
	}
	return bucket;
}

function cwdDisplay(cwd: string) {
	if (cwd.startsWith(`${home}/git/`)) return cwd.slice(`${home}/git/`.length);
	if (cwd.startsWith(`${home}/`)) return cwd.slice(`${home}/`.length);
	return cwd;
}

function label(cwd: string | undefined, session: string) {
	if (cwd && !cwd.startsWith("(")) return cwdDisplay(cwd);
	return bucketLabel(session) ?? basename(session).slice(0, 32);
}

function sessionIdFromPath(path: string) {
	return basename(path).match(/_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:_|\.|$)/)?.[1];
}

function labelFor(report: Awaited<ReturnType<typeof build>>, session: string, cwd?: string) {
	if (cwd && !cwd.startsWith("(")) return label(cwd, session);
	const curated = report.sessionLabelsBySession[session];
	if (curated?.label) return curated.label;
	if (curated?.cwd) return label(curated.cwd, session);
	if (basename(session).includes("_relocated_")) return bucketLabel(session) ?? label(undefined, session);
	return label(report.sessionStats[session]?.cwd, session);
}

function isTempSession(path: string) {
	return path.includes("/var/folders/") || path.includes("/T/pi-precompact-test-") || path.includes("/T/pi-sessionstart-hook-");
}

async function listSessionFiles(root = sessionsDir) {
	const found: string[] = [];
	async function walk(dir: string) {
		let entries: import("node:fs").Dirent[];
		try {
			entries = await readdir(dir, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			const path = join(dir, entry.name);
			if (entry.isDirectory()) await walk(path);
			else if (entry.isFile() && entry.name.endsWith(".jsonl")) found.push(path);
		}
	}
	await walk(root);
	return found;
}

async function readJsonl<T>(path: string): Promise<T[]> {
	try {
		const raw = await readFile(path, "utf8");
		return raw.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => JSON.parse(line) as T);
	} catch {
		return [];
	}
}

function rowCwd(row: unknown): string | undefined {
	if (!row || typeof row !== "object") return undefined;
	const obj = row as Record<string, unknown>;
	const cwd = obj.cwd;
	if (typeof cwd === "string") return cwd;
	const session = obj.session;
	if (session && typeof session === "object") {
		const value = (session as Record<string, unknown>).cwd;
		if (typeof value === "string") return value;
	}
	return undefined;
}

function rowTimestamp(row: unknown): string | undefined {
	if (!row || typeof row !== "object") return undefined;
	const obj = row as Record<string, unknown>;
	for (const key of ["timestamp", "ts", "createdAt", "time"]) {
		const value = obj[key];
		if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return value;
	}
	const message = obj.message;
	if (message && typeof message === "object") {
		const value = (message as Record<string, unknown>).timestamp;
		if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return value;
	}
	return undefined;
}

async function sessionStats(path: string): Promise<SessionStats> {
	try {
		const [raw, st] = await Promise.all([readFile(path, "utf8"), stat(path)]);
		let currentLines = 0;
		let firstTimestamp: string | undefined;
		let lastTimestamp: string | undefined;
		let cwd: string | undefined;
		for (const line of raw.split("\n")) {
			if (!line.trim()) continue;
			currentLines++;
			try {
				const row = JSON.parse(line);
				const candidateCwd = rowCwd(row);
				if (candidateCwd && (!cwd || candidateCwd.length > cwd.length)) cwd = candidateCwd;
				const ts = rowTimestamp(row);
				if (ts) {
					firstTimestamp ??= ts;
					lastTimestamp = ts;
				}
			} catch {
				// Ignore malformed forensic rows; preserve counts.
			}
		}
		return { path, exists: true, currentLines, startTimestamp: sessionStartTimestamp(path), firstTimestamp, lastTimestamp, cwd, bytes: st.size };
	} catch {
		return { path, exists: false, currentLines: 0 };
	}
}

async function linesAt(path: string, eventTs: string): Promise<{ lines?: number; lastTimestamp?: string }> {
	try {
		const raw = await readFile(path, "utf8");
		let lines = 0;
		let lastTimestamp: string | undefined;
		for (const line of raw.split("\n")) {
			if (!line.trim()) continue;
			try {
				const ts = rowTimestamp(JSON.parse(line));
				if (ts && ts > eventTs) break;
				lines++;
				if (ts) lastTimestamp = ts;
			} catch {
				lines++;
			}
		}
		return { lines, lastTimestamp };
	} catch {
		return {};
	}
}

function manifestClassifications(overlays: OverlayRecord[]) {
	const byIndex = new Map<number, Extract<OverlayRecord, { kind: "classification" }>>();
	for (const record of overlays) if (record.kind === "classification") byIndex.set(record.manifestIndex, record);
	return byIndex;
}

async function build() {
	const manifest = await readJsonl<RelocationRecord>(manifestPath);
	const overlays = await readJsonl<OverlayRecord>(overlayPath);
	const discoveredSessions = await listSessionFiles();
	const classifications = manifestClassifications(overlays);
	const sessionLabels = overlays.filter((record): record is Extract<OverlayRecord, { kind: "session-label" }> => record.kind === "session-label");
	const sessionLabelsBySession = Object.fromEntries(sessionLabels.filter((record) => record.session).map((record) => [record.session!, record]));
	const sessionLabelsById = {};
	const overlayEdges = overlays.filter((record): record is Extract<OverlayRecord, { kind: "edge" }> => record.kind === "edge");
	const sessions = new Set<string>();
	for (const record of manifest) {
		sessions.add(record.sourceSession);
		sessions.add(record.destinationSession);
	}
	for (const record of overlayEdges) {
		sessions.add(record.source);
		sessions.add(record.destination);
	}
	for (const record of overlays) if (record.kind === "root") sessions.add(record.session);
	for (const session of discoveredSessions) sessions.add(session);

	const statsEntries = await Promise.all([...sessions].map(async (path) => [path, await sessionStats(path)] as const));
	const stats = new Map(statsEntries);
	const edges: TemporalEdge[] = [];

	for (const [index, record] of manifest.entries()) {
		const cls = classifications.get(index + 1);
		const at = await linesAt(record.sourceSession, record.ts);
		edges.push({
			id: `manifest-${index + 1}`,
			kind: "manifest",
			manifestIndex: index + 1,
			lineageKind: cls?.lineageKind ?? (record.inferred ? "manifest-inferred" : "manifest-explicit"),
			ts: record.ts,
			fromCwd: record.fromCwd,
			toCwd: record.toCwd,
			sourceSession: record.sourceSession,
			destinationSession: record.destinationSession,
			sourceLinesAtEvent: at.lines,
			sourceLastTimestampAtEvent: at.lastTimestamp,
			sourceCurrentLines: stats.get(record.sourceSession)?.currentLines,
			destinationCurrentLines: stats.get(record.destinationSession)?.currentLines,
			confidence: record.confidence,
			recordConfidence: cls?.recordConfidence,
			continuationConfidence: cls?.continuationConfidence,
			replacements: record.replacements,
		});
	}

	for (const [index, record] of overlayEdges.entries()) {
		const ts = record.ts ?? "0000-00-00T00:00:00.000Z";
		const at = await linesAt(record.source, ts);
		edges.push({
			id: `overlay-${index + 1}`,
			kind: "overlay",
			lineageKind: record.lineageKind ?? "overlay-edge",
			ts,
			fromCwd: record.fromCwd ?? "(overlay/unknown)",
			toCwd: record.toCwd ?? "(overlay/unknown)",
			sourceSession: record.source,
			destinationSession: record.destination,
			sourceLinesAtEvent: at.lines,
			sourceLastTimestampAtEvent: at.lastTimestamp,
			sourceCurrentLines: stats.get(record.source)?.currentLines,
			destinationCurrentLines: stats.get(record.destination)?.currentLines,
			confidence: record.confidence,
			notes: record.notes,
		});
	}

	edges.sort((a, b) => a.ts.localeCompare(b.ts));
	const sessionStarts = [...stats.values()]
		.filter((record) => record.startTimestamp)
		.map((record) => ({ path: record.path, ts: record.startTimestamp!, label: label(record.cwd, record.path), currentLines: record.currentLines, exists: record.exists }))
		.sort((a, b) => a.ts.localeCompare(b.ts));
	return { generatedAt: new Date().toISOString(), inputs: { manifestPath, overlayPath, sessionsDir }, sessionLabelsBySession, sessionLabelsById, sessionStats: Object.fromEntries(stats), sessionStarts, edges };
}

function visibleEdges(report: Awaited<ReturnType<typeof build>>, options: { includeUnresolved?: boolean } = {}) {
	return options.includeUnresolved ? report.edges : report.edges.filter((edge) => edge.lineageKind !== "inferred-unresolved");
}

function selectedStarts(report: Awaited<ReturnType<typeof build>>, options: { allStarts?: boolean; includeUnresolved?: boolean } = {}) {
	const connectedSessions = new Set<string>();
	for (const edge of visibleEdges(report, options)) {
		connectedSessions.add(edge.sourceSession);
		connectedSessions.add(edge.destinationSession);
	}
	const bucketCounts = new Map<string, number>();
	for (const start of report.sessionStarts) {
		const bucket = bucketLabel(start.path);
		if (bucket) bucketCounts.set(bucket, (bucketCounts.get(bucket) ?? 0) + 1);
	}
	const bucketImportantPaths = new Set<string>();
	const startsByBucket = new Map<string, typeof report.sessionStarts>();
	for (const start of report.sessionStarts) {
		const bucket = bucketLabel(start.path);
		if (!bucket || connectedSessions.has(start.path) || isTempSession(start.path)) continue;
		const list = startsByBucket.get(bucket) ?? [];
		list.push(start);
		startsByBucket.set(bucket, list);
	}
	for (const [bucket, starts] of startsByBucket) {
		if ((bucketCounts.get(bucket) ?? 0) < 5) continue;
		for (const start of starts.sort((a, b) => b.currentLines - a.currentLines || b.ts.localeCompare(a.ts)).slice(0, 3)) bucketImportantPaths.add(start.path);
	}
	function importantStandalone(start: (typeof report.sessionStarts)[number]) {
		if (connectedSessions.has(start.path) || isTempSession(start.path)) return false;
		return start.currentLines >= 500 || bucketImportantPaths.has(start.path);
	}
	return options.allStarts ? report.sessionStarts : report.sessionStarts.filter((start) => connectedSessions.has(start.path) || importantStandalone(start));
}

function mermaid(report: Awaited<ReturnType<typeof build>>, options: { allStarts?: boolean; includeUnresolved?: boolean } = {}) {
	const lines = ["flowchart LR"];
	const sessionIds = new Map<string, string>();
	function sessionNode(path: string, cwd: string | undefined, currentLines: number | undefined) {
		const existing = sessionIds.get(path);
		if (existing) return existing;
		const id = `n_${shortHash(path)}`;
		sessionIds.set(path, id);
		lines.push(`  ${id}["${labelFor(report, path, cwd)}<br/>session<br/>current lines: ${currentLines ?? "?"}"]`);
		return id;
	}
	const edges = visibleEdges(report, options);
	const starts = selectedStarts(report, options);
	for (const start of starts) {
		const nodeId = sessionNode(start.path, undefined, start.currentLines);
		const startId = `start_${shortHash(start.path)}`;
		lines.push(`  ${startId}(("start<br/>${start.ts.slice(0, 16)}"))`);
		lines.push(`  ${startId} --> ${nodeId}`);
	}
	const edgesBySource = new Map<string, TemporalEdge[]>();
	for (const edge of edges) {
		const list = edgesBySource.get(edge.sourceSession) ?? [];
		list.push(edge);
		edgesBySource.set(edge.sourceSession, list);
		sessionNode(edge.sourceSession, edge.fromCwd, edge.sourceCurrentLines);
		sessionNode(edge.destinationSession, edge.toCwd, edge.destinationCurrentLines);
	}
	for (const [source, sourceEdges] of edgesBySource) {
		sourceEdges.sort((a, b) => a.ts.localeCompare(b.ts));
		const sourceId = sessionIds.get(source)!;
		let previousState: string | undefined;
		for (const edge of sourceEdges) {
			const stateId = `s_${shortHash(`${edge.sourceSession}:${edge.ts}:${edge.id}`)}`;
			const destId = sessionIds.get(edge.destinationSession)!;
			const edgeLabel = `${edge.kind}${edge.manifestIndex ? ` #${edge.manifestIndex}` : ""}<br/>${edge.ts.slice(0, 16)}<br/>${edge.lineageKind ?? ""}`;
			const stateLabel = `state @ ${edge.ts.slice(0, 16)}<br/>lines≤ts: ${edge.sourceLinesAtEvent ?? "?"}`;
			lines.push(`  ${sourceId} -. progression .-> ${stateId}{{"${stateLabel}"}}`);
			if (previousState) lines.push(`  ${previousState} -. later .-> ${stateId}`);
			lines.push(`  ${stateId} -->|"${edgeLabel}"| ${destId}`);
			previousState = stateId;
		}
	}
	lines.push("  classDef start fill:#e0e7ff,stroke:#4f46e5;");
	lines.push("  classDef session fill:#dbeafe,stroke:#2563eb,stroke-width:1.5px;");
	lines.push("  classDef state fill:#fef3c7,stroke:#d97706;");
	for (const start of starts) lines.push(`  class start_${shortHash(start.path)} start;`);
	for (const id of sessionIds.values()) lines.push(`  class ${id} session;`);
	for (const edge of edges) lines.push(`  class s_${shortHash(`${edge.sourceSession}:${edge.ts}:${edge.id}`)} state;`);
	return lines.join("\n");
}

function lineageSvgHtml(report: Awaited<ReturnType<typeof build>>, options: { allStarts?: boolean; includeUnresolved?: boolean; focused?: boolean } = {}) {
	const edges = visibleEdges(report, options);
	const starts = options.focused ? [] : selectedStarts(report, options);
	const sessionPaths = new Set<string>();
	for (const start of starts) sessionPaths.add(start.path);
	for (const edge of edges) { sessionPaths.add(edge.sourceSession); sessionPaths.add(edge.destinationSession); }
	const sessions = [...sessionPaths].sort((a, b) => {
		const at = report.sessionStats[a]?.startTimestamp ?? edges.find((e) => e.sourceSession === a || e.destinationSession === a)?.ts ?? "";
		const bt = report.sessionStats[b]?.startTimestamp ?? edges.find((e) => e.sourceSession === b || e.destinationSession === b)?.ts ?? "";
		return at.localeCompare(bt) || labelFor(report, a).localeCompare(labelFor(report, b));
	});
	const rowBySession = new Map(sessions.map((path, index) => [path, index]));
	const width = 2400;
	const rowHeight = 82;
	const top = 80;
	const height = Math.max(420, top + sessions.length * rowHeight + 90);
	const times = [
		...starts.map((start) => Date.parse(start.ts)),
		...edges.map((edge) => Date.parse(edge.ts)),
		...sessions.map((path) => Date.parse(report.sessionStats[path]?.startTimestamp ?? "")),
	].filter(Number.isFinite);
	const min = Math.min(...times, Date.now());
	const max = Math.max(...times, min + 1);
	const x = (ts?: string) => 340 + ((Date.parse(ts ?? "") - min) / Math.max(1, max - min)) * (width - 430);
	const y = (path: string) => top + (rowBySession.get(path) ?? 0) * rowHeight;
	const svg: string[] = [`<svg id="lineage-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">`];
	svg.push(`<style>.row{font:12px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;fill:#374151}.small{font:10px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;fill:#6b7280}.grid{stroke:#e5e7eb}.session{fill:#dbeafe;stroke:#2563eb;stroke-width:1.5}.state{fill:#fef3c7;stroke:#d97706}.start{fill:#e0e7ff;stroke:#4f46e5}.edge{stroke:#16a34a;stroke-width:1.5;fill:none;opacity:.78}.progress{stroke:#94a3b8;stroke-dasharray:4 4;fill:none}</style>`);
	for (const path of sessions) {
		const yy = y(path);
		svg.push(`<line class="grid" x1="0" y1="${yy + 34}" x2="${width}" y2="${yy + 34}"/>`);
		svg.push(`<text class="row" x="12" y="${yy + 4}">${escapeHtml(labelFor(report, path)).slice(0, 42)}</text>`);
		svg.push(`<text class="small" x="12" y="${yy + 22}">${escapeHtml(homeShort(path)).slice(0, 80)}</text>`);
		const sx = Number.isFinite(Date.parse(report.sessionStats[path]?.startTimestamp ?? "")) ? x(report.sessionStats[path]?.startTimestamp) : 330;
		svg.push(`<rect class="session" x="${sx.toFixed(1)}" y="${yy - 20}" width="150" height="38" rx="8"><title>${escapeHtml(path)}</title></rect>`);
		svg.push(`<text class="small" x="${(sx + 8).toFixed(1)}" y="${yy - 4}">session</text><text class="small" x="${(sx + 8).toFixed(1)}" y="${yy + 11}">lines: ${report.sessionStats[path]?.currentLines ?? "?"}</text>`);
	}
	for (const start of starts) {
		if (!rowBySession.has(start.path)) continue;
		const yy = y(start.path), xx = x(start.ts);
		svg.push(`<circle class="start" cx="${xx.toFixed(1)}" cy="${yy}" r="7"><title>${escapeHtml(`${start.ts} start ${start.label}`)}</title></circle>`);
	}
	const previousState = new Map<string, { x: number; y: number }>();
	for (const edge of edges) {
		if (!rowBySession.has(edge.sourceSession) || !rowBySession.has(edge.destinationSession)) continue;
		const sx = x(edge.ts), sy = y(edge.sourceSession), dy = y(edge.destinationSession);
		const prev = previousState.get(edge.sourceSession);
		if (prev) svg.push(`<path class="progress" d="M ${prev.x.toFixed(1)} ${prev.y.toFixed(1)} L ${sx.toFixed(1)} ${sy.toFixed(1)}"><title>later in same source session</title></path>`);
		svg.push(`<rect class="state" x="${(sx - 26).toFixed(1)}" y="${(sy - 15).toFixed(1)}" width="52" height="30" rx="6"><title>${escapeHtml(`${edge.ts} lines≤ts=${edge.sourceLinesAtEvent ?? "?"}`)}</title></rect>`);
		svg.push(`<path class="edge" d="M ${sx.toFixed(1)} ${sy.toFixed(1)} C ${(sx + 45).toFixed(1)} ${sy.toFixed(1)}, ${(sx + 45).toFixed(1)} ${dy.toFixed(1)}, ${sx.toFixed(1)} ${dy.toFixed(1)}"><title>${escapeHtml(`${edge.kind}${edge.manifestIndex ? ` #${edge.manifestIndex}` : ""} ${edge.lineageKind ?? ""}`)}</title></path>`);
		previousState.set(edge.sourceSession, { x: sx, y: sy });
	}
	svg.push(`</svg>`);
	const title = options.focused ? "SVG temporal lineage focused" : "SVG temporal lineage";
	return `<!doctype html>\n<html><head><meta charset="utf-8"><title>${title}</title><script src="https://cdn.jsdelivr.net/npm/svg-pan-zoom@3.6.2/dist/svg-pan-zoom.min.js"></script><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:2rem;line-height:1.4}.legend,.controls{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:1rem;margin:1rem 0}.controls{position:sticky;top:0;z-index:10}button{margin-right:.5rem;padding:.35rem .7rem;border:1px solid #d1d5db;border-radius:6px;background:white;cursor:pointer}#wrap{height:82vh;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden}svg{width:100%;height:100%}code{background:#f3f4f6;padding:.1rem .25rem;border-radius:4px}</style></head><body><h1>${title}</h1><p>Generated: ${report.generatedAt}</p><div class="legend"><p>${options.focused ? "Focused view: relocation/overlay progression only; standalone starts are omitted." : "Full view: relocation/overlay progression plus selected significant session starts."} This report renders inline SVG directly and does not use Mermaid.</p><ul><li>Purple circles: session starts.</li><li>Blue boxes: session files.</li><li>Yellow boxes: source-session states at relocation timestamps.</li><li>Green curves: relocation/fork edges.</li><li>Dotted lines: later progression inside the same source session.</li></ul></div><div class="controls"><button id="zoom-in">Zoom in</button><button id="zoom-out">Zoom out</button><button id="reset">Fit/reset</button><span>Drag to pan. Mouse wheel/trackpad to zoom.</span></div><div id="wrap">${svg.join("\n")}</div><script>const svg=document.getElementById('lineage-svg'); window.panZoom=svgPanZoom(svg,{controlIconsEnabled:true,fit:true,center:true,minZoom:0.03,maxZoom:80,zoomScaleSensitivity:.25}); document.getElementById('zoom-in').onclick=()=>panZoom.zoomIn(); document.getElementById('zoom-out').onclick=()=>panZoom.zoomOut(); document.getElementById('reset').onclick=()=>{panZoom.resetZoom();panZoom.center();panZoom.fit();};</script></body></html>\n`;
}

function escapeHtml(value: string) {
	return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function timelineData(report: Awaited<ReturnType<typeof build>>, options: { allStarts?: boolean; includeUnresolved?: boolean; groupBy?: "project" | "session" } = {}) {
	const starts = selectedStarts(report, options);
	const sessionPaths = new Set<string>();
	for (const start of starts) sessionPaths.add(start.path);
	const edges = visibleEdges(report, options);
	for (const edge of edges) {
		sessionPaths.add(edge.sourceSession);
		sessionPaths.add(edge.destinationSession);
	}
	const rows = options.groupBy === "session"
		? [...sessionPaths].map((path) => ({ path, label: labelFor(report, path) })).sort((a, b) => a.label.localeCompare(b.label) || a.path.localeCompare(b.path))
		: [...new Set([...sessionPaths].map((path) => projectKey(report, path)))].map((key) => ({ path: key, label: key })).sort((a, b) => a.label.localeCompare(b.label));
	const times = [
		...starts.map((start) => Date.parse(start.ts)),
		...edges.map((edge) => Date.parse(edge.ts)),
	].filter((time) => Number.isFinite(time));
	return { starts, rows, minTime: Math.min(...times), maxTime: Math.max(...times) };
}

function projectKey(report: Awaited<ReturnType<typeof build>>, path: string, cwd?: string) {
	return labelFor(report, path, cwd);
}

function temporalInventoryJson(report: Awaited<ReturnType<typeof build>>) {
	return {
		generatedAt: report.generatedAt,
		inputs: report.inputs,
		sessions: Object.values(report.sessionStats)
			.map((stats) => ({
				path: stats.path,
				label: label(stats.cwd, stats.path),
				startTimestamp: stats.startTimestamp,
				firstTimestamp: stats.firstTimestamp,
				lastTimestamp: stats.lastTimestamp,
				currentLines: stats.currentLines,
				exists: stats.exists,
				bytes: stats.bytes,
			}))
			.sort((a, b) => (a.startTimestamp ?? "").localeCompare(b.startTimestamp ?? "") || a.label.localeCompare(b.label)),
	};
}

function temporalTimelineJson(report: Awaited<ReturnType<typeof build>>, options: { allStarts?: boolean; includeUnresolved?: boolean; groupBy?: "project" | "session" } = {}) {
	const data = timelineData(report, options);
	return {
		generatedAt: report.generatedAt,
		inputs: report.inputs,
		mode: options.groupBy ?? "project",
		minTime: new Date(data.minTime).toISOString(),
		maxTime: new Date(data.maxTime).toISOString(),
		rows: data.rows,
		starts: data.starts,
		edges: visibleEdges(report, options),
	};
}

function focusedMermaid(report: Awaited<ReturnType<typeof build>>, options: { includeUnresolved?: boolean } = {}) {
	const lines = ["flowchart LR"];
	const sessionIds = new Map<string, string>();
	const firstEdgeBySession = new Map<string, string>();
	for (const edge of visibleEdges(report, options)) {
		for (const path of [edge.sourceSession, edge.destinationSession]) {
			const existing = firstEdgeBySession.get(path);
			if (!existing || edge.ts < existing) firstEdgeBySession.set(path, edge.ts);
		}
	}
	function sessionNode(path: string, cwd: string | undefined, currentLines: number | undefined) {
		const existing = sessionIds.get(path);
		if (existing) return existing;
		const id = `n_${shortHash(path)}`;
		sessionIds.set(path, id);
		const stats = report.sessionStats[path];
		const dates = [stats?.startTimestamp?.slice(0, 10), firstEdgeBySession.get(path)?.slice(0, 10), stats?.lastTimestamp?.slice(0, 10)].filter(Boolean);
		const dateLabel = dates.length ? `<br/>dates: ${[...new Set(dates)].join(" → ")}` : "";
		lines.push(`  ${id}["${labelFor(report, path, cwd)}<br/>session${dateLabel}<br/>current lines: ${currentLines ?? "?"}"]`);
		return id;
	}
	const edges = visibleEdges(report, options);
	const edgesBySource = new Map<string, TemporalEdge[]>();
	for (const edge of edges) {
		const list = edgesBySource.get(edge.sourceSession) ?? [];
		list.push(edge);
		edgesBySource.set(edge.sourceSession, list);
		sessionNode(edge.sourceSession, edge.fromCwd, edge.sourceCurrentLines);
		sessionNode(edge.destinationSession, edge.toCwd, edge.destinationCurrentLines);
	}
	for (const [source, sourceEdges] of edgesBySource) {
		sourceEdges.sort((a, b) => a.ts.localeCompare(b.ts));
		const sourceId = sessionIds.get(source)!;
		let previousState: string | undefined;
		for (const edge of sourceEdges) {
			const stateId = `s_${shortHash(`${edge.sourceSession}:${edge.ts}:${edge.id}`)}`;
			const destId = sessionIds.get(edge.destinationSession)!;
			const edgeLabel = `${edge.kind}${edge.manifestIndex ? ` #${edge.manifestIndex}` : ""}<br/>${edge.ts.slice(0, 16)}<br/>${edge.lineageKind ?? ""}`;
			const stateLabel = `state @ ${edge.ts.slice(0, 16)}<br/>lines≤ts: ${edge.sourceLinesAtEvent ?? "?"}`;
			lines.push(`  ${sourceId} -. progression .-> ${stateId}{{"${stateLabel}"}}`);
			if (previousState) lines.push(`  ${previousState} -. later .-> ${stateId}`);
			lines.push(`  ${stateId} -->|"${edgeLabel}"| ${destId}`);
			previousState = stateId;
		}
	}
	lines.push("  classDef session fill:#dbeafe,stroke:#2563eb,stroke-width:1.5px;");
	lines.push("  classDef state fill:#fef3c7,stroke:#d97706;");
	for (const id of sessionIds.values()) lines.push(`  class ${id} session;`);
	for (const edge of edges) lines.push(`  class s_${shortHash(`${edge.sourceSession}:${edge.ts}:${edge.id}`)} state;`);
	return lines.join("\n");
}


function temporalTimelineHtml(report: Awaited<ReturnType<typeof build>>, options: { allStarts?: boolean; includeUnresolved?: boolean; groupBy?: "project" | "session" } = {}) {
	const data = timelineData(report, options);
	const left = 280;
	const right = 80;
	const top = 50;
	const rowHeight = 28;
	const width = 2400;
	const height = top + data.rows.length * rowHeight + 80;
	const span = Math.max(1, data.maxTime - data.minTime);
	const rowY = new Map(data.rows.map((row, index) => [row.path, top + index * rowHeight]));
	const rowFor = (path: string, cwd?: string) => options.groupBy === "session" ? path : projectKey(report, path, cwd);
	const x = (ts: string) => left + ((Date.parse(ts) - data.minTime) / span) * (width - left - right);
	const tickCount = 10;
	const ticks = Array.from({ length: tickCount + 1 }, (_, index) => data.minTime + (span * index) / tickCount);
	const svg: string[] = [];
	svg.push(`<svg id="timeline-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">`);
	svg.push(`<style>.row{font:12px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;fill:#374151}.tick{font:11px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;fill:#6b7280}.grid{stroke:#e5e7eb;stroke-width:1}.row-boundary{stroke:#d1d5db;stroke-width:1}.start{fill:#818cf8;stroke:#4f46e5}.event{fill:#fbbf24;stroke:#d97706}.edge{stroke:#16a34a;stroke-width:1.5;fill:none;opacity:.75}.life{stroke:#93c5fd;stroke-width:2;opacity:.55}.tip{font:11px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;fill:#111827}</style>`);
	for (const tick of ticks) {
		const tx = left + ((tick - data.minTime) / span) * (width - left - right);
		svg.push(`<line class="grid" x1="${tx.toFixed(1)}" y1="25" x2="${tx.toFixed(1)}" y2="${height - 40}"/>`);
		svg.push(`<text class="tick" x="${tx.toFixed(1)}" y="${height - 18}" text-anchor="middle">${new Date(tick).toISOString().slice(0, 10)}</text>`);
	}
	for (let index = 0; index <= data.rows.length; index++) {
		const y = top - rowHeight / 2 + index * rowHeight;
		svg.push(`<line class="row-boundary" x1="0" y1="${y}" x2="${width - right}" y2="${y}"/>`);
	}
	for (const row of data.rows) {
		const y = rowY.get(row.path)!;
		svg.push(`<text class="row" x="10" y="${y + 4}">${escapeHtml(row.label)}</text>`);
	}
	for (const row of data.rows) {
		const rowStarts = data.starts.filter((start) => rowFor(start.path) === row.path);
		const rowSessions = Object.values(report.sessionStats).filter((stats) => rowFor(stats.path) === row.path && stats.startTimestamp && stats.lastTimestamp);
		const startMs = Math.min(...rowSessions.map((stats) => Date.parse(stats.startTimestamp!)).filter(Number.isFinite));
		const endMs = Math.max(...rowSessions.map((stats) => Date.parse(stats.lastTimestamp!)).filter(Number.isFinite));
		const y = rowY.get(row.path)!;
		if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs) {
			svg.push(`<line class="life" x1="${(left + ((startMs - data.minTime) / span) * (width - left - right)).toFixed(1)}" y1="${y}" x2="${(left + ((endMs - data.minTime) / span) * (width - left - right)).toFixed(1)}" y2="${y}"><title>${escapeHtml(`${row.label} active span ${new Date(startMs).toISOString()} to ${new Date(endMs).toISOString()}`)}</title></line>`);
			svg.push(`<circle cx="${(left + ((endMs - data.minTime) / span) * (width - left - right)).toFixed(1)}" cy="${y}" r="3" fill="#1d4ed8"><title>${escapeHtml(`${row.label} last used ${new Date(endMs).toISOString()}`)}</title></circle>`);
		}
		void rowStarts;
	}
	for (const start of data.starts) {
		const y = rowY.get(rowFor(start.path));
		if (y === undefined) continue;
		const sx = x(start.ts);
		svg.push(`<circle class="start" cx="${sx.toFixed(1)}" cy="${y}" r="4"><title>${escapeHtml(`${start.ts} start ${start.label} lines=${start.currentLines}`)}</title></circle>`);
	}
	for (const edge of visibleEdges(report, options)) {
		const sy = rowY.get(rowFor(edge.sourceSession, edge.fromCwd));
		const dy = rowY.get(rowFor(edge.destinationSession, edge.toCwd));
		if (sy === undefined || dy === undefined) continue;
		const ex = x(edge.ts);
		svg.push(`<circle class="event" cx="${ex.toFixed(1)}" cy="${sy}" r="5"><title>${escapeHtml(`${edge.ts} ${edge.kind}${edge.manifestIndex ? ` #${edge.manifestIndex}` : ""}: ${labelFor(report, edge.sourceSession, edge.fromCwd)} -> ${labelFor(report, edge.destinationSession, edge.toCwd)} lines≤ts=${edge.sourceLinesAtEvent ?? "?"}`)}</title></circle>`);
		svg.push(`<path class="edge" d="M ${ex.toFixed(1)} ${sy} C ${(ex + 30).toFixed(1)} ${sy}, ${(ex + 30).toFixed(1)} ${dy}, ${ex.toFixed(1)} ${dy}"><title>${escapeHtml(edge.lineageKind ?? "relocation")}</title></path>`);
	}
	svg.push(`</svg>`);
	return `<!doctype html>
<html><head><meta charset="utf-8"><title>Temporal session timeline</title>
<script src="https://cdn.jsdelivr.net/npm/svg-pan-zoom@3.6.2/dist/svg-pan-zoom.min.js"></script>
<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:2rem;line-height:1.4}.legend,.controls{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:1rem;margin:1rem 0}.controls{position:sticky;top:0;z-index:10}button{margin-right:.5rem;padding:.35rem .7rem;border:1px solid #d1d5db;border-radius:6px;background:white;cursor:pointer}#wrap{height:82vh;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden}svg{width:100%;height:100%}code{background:#f3f4f6;padding:.1rem .25rem;border-radius:4px}</style>
</head><body><h1>Temporal session timeline (${options.groupBy ?? "project"} rows)</h1><p>Generated: ${report.generatedAt}</p><div class="legend"><ul><li>x-axis is real time, linearly scaled.</li><li>Rows are ${options.groupBy === "session" ? "individual session files" : "project/folder labels"}, delimited by horizontal top/bottom boundary lines.</li><li>Blue horizontal bars show active span from first start to last observed event on that row; dark-blue dots mark last used.</li><li>Purple dots are session starts.</li><li>Yellow dots are relocation events on the source row.</li><li>Green curves connect relocation events to destination rows at the same timestamp.</li><li>Hover points/curves for details. No transcript content is included.</li></ul></div><div class="controls"><button id="zoom-in">Zoom in</button><button id="zoom-out">Zoom out</button><button id="reset">Fit/reset</button><span>Drag to pan. Mouse wheel/trackpad to zoom.</span></div><div id="wrap">${svg.join("\n")}</div><script>const svg=document.getElementById('timeline-svg'); window.panZoom=svgPanZoom(svg,{controlIconsEnabled:true,fit:true,center:true,minZoom:0.05,maxZoom:100,zoomScaleSensitivity:.25}); document.getElementById('zoom-in').onclick=()=>panZoom.zoomIn(); document.getElementById('zoom-out').onclick=()=>panZoom.zoomOut(); document.getElementById('reset').onclick=()=>{panZoom.resetZoom();panZoom.center();panZoom.fit();};</script></body></html>\n`;
}

function markdown(report: Awaited<ReturnType<typeof build>>, mmd: string) {
	const lines = [
		"# Temporal session lineage",
		"",
		`Generated: ${report.generatedAt}`,
		"",
		"This report models both topology and progression. Purple circles are session starts from JSONL filename timestamps; the Mermaid diagram shows relocation-connected starts plus significant standalone starts by default (current lines ≥ 500, or up to 3 largest starts from buckets with ≥ 5 sessions, excluding temp/test sessions), while JSON data includes all discovered starts. Blue boxes are session files. Yellow diamonds are time-indexed states of a source session at a relocation timestamp. Dotted arrows show progression within a session file; solid arrows show relocation/fork edges to destination sessions. It does not include transcript content.",
		"",
		`Manifest: ${homeShort(report.inputs.manifestPath)}`,
		`Overlay: ${homeShort(report.inputs.overlayPath)}`,
		`Session starts: ${report.sessionStarts.length}`,
		`Edges: ${report.edges.length}`,
		`Sessions: ${Object.keys(report.sessionStats).length}`,
		"",
		"```mermaid",
		mmd,
		"```",
		"",
		"## Events",
		"",
	];
	for (const edge of report.edges) {
		lines.push(`- ${edge.ts} ${edge.kind}${edge.manifestIndex ? ` #${edge.manifestIndex}` : ""}: ${labelFor(report, edge.sourceSession, edge.fromCwd)} -> ${labelFor(report, edge.destinationSession, edge.toCwd)} (${edge.lineageKind ?? "unclassified"})`);
		lines.push(`  - source lines at event: ${edge.sourceLinesAtEvent ?? "unknown"}; source current lines: ${edge.sourceCurrentLines ?? "unknown"}; destination current lines: ${edge.destinationCurrentLines ?? "unknown"}`);
	}
	lines.push("");
	return lines.join("\n");
}

async function main() {
	const snapshot = process.argv.includes("--snapshot");
	const allStarts = process.argv.includes("--all-starts");
	const includeUnresolved = process.argv.includes("--include-unresolved");
	await mkdir(outputDir, { recursive: true });
	const report = await build();
	const svgDoc = lineageSvgHtml(report, { allStarts, includeUnresolved });
	const focusedSvgDoc = lineageSvgHtml(report, { includeUnresolved, focused: true });
	const timelineJson = JSON.stringify(temporalTimelineJson(report, { allStarts, includeUnresolved, groupBy: "project" }), null, 2) + "\n";
	const timelineHtml = temporalTimelineHtml(report, { allStarts, includeUnresolved, groupBy: "project" });
	const timelineSessionsJson = JSON.stringify(temporalTimelineJson(report, { allStarts, includeUnresolved, groupBy: "session" }), null, 2) + "\n";
	const timelineSessionsHtml = temporalTimelineHtml(report, { allStarts, includeUnresolved, groupBy: "session" });
	const inventoryJson = JSON.stringify(temporalInventoryJson(report), null, 2) + "\n";
	const latestFiles = [
		["temporal-lineage-svg.json", JSON.stringify(report, null, 2) + "\n"],
		["temporal-lineage-svg.html", svgDoc],
		["temporal-lineage-focused-svg.html", focusedSvgDoc],
		["temporal-timeline.json", timelineJson],
		["temporal-timeline.html", timelineHtml],
		["temporal-timeline-sessions.json", timelineSessionsJson],
		["temporal-timeline-sessions.html", timelineSessionsHtml],
		["temporal-inventory.json", inventoryJson],
	] as const;
	for (const [name, content] of latestFiles) await writeFile(join(outputDir, name), content);
	let snapshotDir: string | undefined;
	if (snapshot) {
		const stamp = new Date().toISOString().replace(/[:.]/g, "-");
		snapshotDir = join(outputDir, "snapshots", "temporal-lineage");
		await mkdir(snapshotDir, { recursive: true });
		for (const [name, content] of latestFiles) await writeFile(join(snapshotDir, name.replace("temporal-lineage", `temporal-lineage_${stamp}`)), content);
	}
	console.log(`Wrote SVG temporal lineage with ${report.edges.length} edges to ${outputDir}`);
	if (snapshotDir) console.log(`Wrote timestamped snapshot to ${snapshotDir}`);
}

await main();
