#!/usr/bin/env node
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const home = process.env.HOME ?? ".";
const agentDir = process.env.PI_CODING_AGENT_DIR ?? join(home, ".pi", "agent");
const storeDir = process.env.AGENT_SESSION_STORE_DIR ?? join(agentDir, "session-store");
const graphDir = join(agentDir, "session-graph");
const storePath = join(storeDir, "session-store.export.json");

type Store = { generatedAt: string; logicalThreads?: Thread[]; threadMembers?: Member[]; threadEdges?: Edge[]; threadResumeTargets?: ResumeTarget[]; sessions?: Session[] };
type Thread = { id: string; label?: string; confidence: string; source: string; metadata?: { sessionCount?: number } };
type Member = { threadId: string; sessionId: string; role: string; ordinal: number };
type Edge = { threadId: string; relation: string };
type Session = { id: string; canonicalKey: string; providerSessionId?: string; metadata?: { cwd?: string; displayName?: string } };
type ResumeTarget = { threadId: string; status: string; recommendedSessionId?: string; activeLeafSessionIds: string[]; recoverableSessionIds: string[]; reasons: string[] };

const store = JSON.parse(await readFile(storePath, "utf8")) as Store;
const sessions = new Map((store.sessions ?? []).map((session) => [session.id, session]));
const membersByThread = new Map<string, Member[]>();
for (const member of store.threadMembers ?? []) membersByThread.set(member.threadId, [...(membersByThread.get(member.threadId) ?? []), member]);
const edgeCounts = new Map<string, Record<string, number>>();
for (const edge of store.threadEdges ?? []) {
	const counts = edgeCounts.get(edge.threadId) ?? {};
	counts[edge.relation] = (counts[edge.relation] ?? 0) + 1;
	edgeCounts.set(edge.threadId, counts);
}
const resumeByThread = new Map((store.threadResumeTargets ?? []).map((target) => [target.threadId, target]));
const threads = [...(store.logicalThreads ?? [])].sort((a, b) => (b.metadata?.sessionCount ?? 0) - (a.metadata?.sessionCount ?? 0));
const report = [
	"# Logical thread report",
	"",
	`Generated: ${new Date().toISOString()}`,
	`Store generated: ${store.generatedAt}`,
	`Logical threads: ${threads.length}`,
	`Thread members: ${(store.threadMembers ?? []).length}`,
	`Thread edges: ${(store.threadEdges ?? []).length}`,
	`Resume targets: ${(store.threadResumeTargets ?? []).length}`,
	"",
	"## Largest threads",
	...threads.slice(0, 100).map((thread) => {
		const members = (membersByThread.get(thread.id) ?? []).sort((a, b) => a.ordinal - b.ordinal);
		const first = sessions.get(members[0]?.sessionId ?? "");
		const last = sessions.get(members.at(-1)?.sessionId ?? "");
		const counts = edgeCounts.get(thread.id) ?? {};
		const resume = resumeByThread.get(thread.id);
		const recommended = resume?.recommendedSessionId ? sessions.get(resume.recommendedSessionId) : undefined;
		return `- ${thread.label ?? thread.id}: ${members.length} members, edges=${JSON.stringify(counts)}, resume=${resume?.status ?? "?"}${recommended ? ` -> ${recommended.metadata?.cwd ?? recommended.canonicalKey}` : ""}, first=${first?.metadata?.cwd ?? first?.canonicalKey ?? "?"}, last=${last?.metadata?.cwd ?? last?.canonicalKey ?? "?"}`;
	}),
	"",
	"Note: logical threads are derived metadata. Raw session JSONLs are not merged or rewritten.",
	"",
].join("\n");
await mkdir(storeDir, { recursive: true });
await mkdir(graphDir, { recursive: true });
await writeFile(join(storeDir, "logical-threads.md"), report);
await writeFile(join(graphDir, "logical-threads.md"), report);
console.log(`Wrote ${join(storeDir, "logical-threads.md")}`);
