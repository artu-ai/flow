#!/usr/bin/env node

/**
 * Flow daemon — manages dashboard server processes for multiple projects.
 *
 * State directory: ~/.flow/
 *   daemon.sock  — Unix domain socket for IPC
 *   daemon.pid   — PID file
 *   daemon.log   — log output (when daemonized)
 *   state.json   — persisted project registry
 */

import { createServer, createConnection } from 'node:net';
import { fork } from 'node:child_process';
import { readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import { existsSync, statSync, createWriteStream } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_JS = join(__dirname, 'server.js');

const FLOW_DIR = join(homedir(), '.flow');
const SOCK_PATH = join(FLOW_DIR, 'daemon.sock');
const PID_PATH = join(FLOW_DIR, 'daemon.pid');
const STATE_PATH = join(FLOW_DIR, 'state.json');

const BASE_PORT = 3420;
const MAX_PORT_RETRIES = 5;
const SPAWN_TIMEOUT = 10_000;
const SHUTDOWN_GRACE = 5_000;

/** @type {Map<string, { projectRoot: string, port: number, pid: number, child: import('node:child_process').ChildProcess }>} */
const running = new Map();

/** @type {import('node:net').Server | null} */
let ipcServer = null;

// ─── Logging ─────────────────────────────────────────────────────────

const LOG_PATH = join(FLOW_DIR, 'daemon.log');
let logStream = null;

function initLogStream() {
	logStream = createWriteStream(LOG_PATH, { flags: 'a' });
	logStream.on('error', () => {}); // Prevent crashes on write errors
}

function log(msg) {
	const ts = new Date().toISOString();
	const line = `[${ts}] ${msg}\n`;
	if (logStream) {
		logStream.write(line);
	}
}

// ─── Helpers ─────────────────────────────────────────────────────────

async function ensureDir() {
	await mkdir(FLOW_DIR, { recursive: true });
}

async function saveState() {
	const entries = [];
	for (const [, info] of running) {
		entries.push({ projectRoot: info.projectRoot, port: info.port, pid: info.pid });
	}
	await writeFile(STATE_PATH, JSON.stringify(entries, null, 2) + '\n');
}

function usedPorts() {
	const ports = new Set();
	for (const [, info] of running) ports.add(info.port);
	return ports;
}

async function isPortFree(port) {
	return new Promise((resolve) => {
		const srv = createServer();
		srv.once('error', () => resolve(false));
		srv.listen(port, '127.0.0.1', () => {
			srv.close(() => resolve(true));
		});
	});
}

async function allocatePort() {
	const used = usedPorts();
	for (let i = 0; i < MAX_PORT_RETRIES; i++) {
		const port = BASE_PORT + i;
		if (!used.has(port) && (await isPortFree(port))) return port;
	}
	// Try higher ports
	for (let port = BASE_PORT + MAX_PORT_RETRIES; port < BASE_PORT + 100; port++) {
		if (!used.has(port) && (await isPortFree(port))) return port;
	}
	throw new Error('No free port found');
}

// ─── Commands ────────────────────────────────────────────────────────

async function handleOpen(args) {
	const projectRoot = resolve(args.projectRoot);

	// Validate .git exists
	if (!existsSync(join(projectRoot, '.git'))) {
		return { error: `Not a git repository: ${projectRoot}` };
	}

	// Already running?
	if (running.has(projectRoot)) {
		const info = running.get(projectRoot);
		// Verify child is still alive
		try {
			process.kill(info.pid, 0);
			return { port: info.port, pid: info.pid, url: `http://localhost:${info.port}`, started: false };
		} catch {
			// Process died — clean up and re-spawn
			running.delete(projectRoot);
		}
	}

	const port = await allocatePort();

	return new Promise((resolveCmd, rejectCmd) => {
		const child = fork(SERVER_JS, [], {
			env: { ...process.env, PROJECT_ROOT: projectRoot, PORT: String(port), HOST: '127.0.0.1' },
			stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
			detached: false,
		});

		const timeout = setTimeout(() => {
			child.kill();
			rejectCmd(new Error('Server startup timed out'));
		}, SPAWN_TIMEOUT);

		child.on('message', (msg) => {
			if (msg && msg.type === 'ready') {
				clearTimeout(timeout);
				const info = { projectRoot, port, pid: child.pid, child };
				running.set(projectRoot, info);
				saveState().catch(() => {});
				log(`Started server for ${projectRoot} on port ${port} (PID ${child.pid})`);
				resolveCmd({ port, pid: child.pid, url: `http://localhost:${port}`, started: true });
			}
		});

		child.on('exit', (code) => {
			clearTimeout(timeout);
			if (running.has(projectRoot) && running.get(projectRoot).child === child) {
				running.delete(projectRoot);
				saveState().catch(() => {});
				log(`Server for ${projectRoot} exited (code ${code})`);
			}
		});

		if (child.stdout) child.stdout.on('data', (d) => { if (logStream) logStream.write(d); });
		if (child.stderr) child.stderr.on('data', (d) => { if (logStream) logStream.write(d); });
	});
}

function handleList() {
	const list = [];
	for (const [, info] of running) {
		// Verify still alive
		try {
			process.kill(info.pid, 0);
			list.push({ projectRoot: info.projectRoot, port: info.port, pid: info.pid, url: `http://localhost:${info.port}` });
		} catch {
			running.delete(info.projectRoot);
		}
	}
	return list;
}

async function handleStop(args) {
	const projectRoot = resolve(args.projectRoot);
	const info = running.get(projectRoot);
	if (!info) return { error: 'Not running' };

	return new Promise((resolveCmd) => {
		info.child.on('exit', () => {
			running.delete(projectRoot);
			saveState().catch(() => {});
			log(`Stopped server for ${projectRoot}`);
			resolveCmd({});
		});

		info.child.kill('SIGTERM');

		setTimeout(() => {
			try {
				info.child.kill('SIGKILL');
			} catch { /* already dead */ }
		}, SHUTDOWN_GRACE);
	});
}

async function handleStopAll() {
	const promises = [];
	for (const [projectRoot] of running) {
		promises.push(handleStop({ projectRoot }));
	}
	await Promise.all(promises);
	return {};
}

async function handleShutdown() {
	await handleStopAll();
	cleanup();
	process.exit(0);
}

// ─── IPC Server ──────────────────────────────────────────────────────

function startIPC() {
	ipcServer = createServer((conn) => {
		let buffer = '';
		conn.on('data', (chunk) => {
			buffer += chunk.toString();
			const newlineIdx = buffer.indexOf('\n');
			if (newlineIdx === -1) return;

			const line = buffer.slice(0, newlineIdx);
			buffer = buffer.slice(newlineIdx + 1);

			let req;
			try {
				req = JSON.parse(line);
			} catch {
				conn.end(JSON.stringify({ error: 'Invalid JSON' }) + '\n');
				return;
			}

			processCommand(req)
				.then((res) => conn.end(JSON.stringify(res) + '\n'))
				.catch((err) => conn.end(JSON.stringify({ error: err.message }) + '\n'));
		});
	});

	ipcServer.listen(SOCK_PATH, () => {
		log(`Daemon listening on ${SOCK_PATH}`);
	});

	ipcServer.on('error', (err) => {
		log(`IPC server error: ${err.message}`);
		process.exit(1);
	});
}

async function processCommand(req) {
	switch (req.command) {
		case 'open':
			return await handleOpen(req.args || {});
		case 'list':
			return handleList();
		case 'stop':
			return await handleStop(req.args || {});
		case 'stop-all':
			return await handleStopAll();
		case 'shutdown':
			await handleShutdown();
			return {}; // Won't reach here
		default:
			return { error: `Unknown command: ${req.command}` };
	}
}

// ─── Startup & Cleanup ──────────────────────────────────────────────

function cleanup() {
	try { ipcServer?.close(); } catch { /* ignore */ }
	try { if (existsSync(SOCK_PATH)) unlinkSync(SOCK_PATH); } catch { /* ignore */ }
	try { if (existsSync(PID_PATH)) unlinkSync(PID_PATH); } catch { /* ignore */ }
}

// Use async unlink for cleanup where possible
import { unlinkSync } from 'node:fs';

async function checkExistingDaemon() {
	if (!existsSync(SOCK_PATH)) return false;

	return new Promise((resolve) => {
		const conn = createConnection(SOCK_PATH);
		conn.on('connect', () => {
			conn.destroy();
			resolve(true); // Daemon is running
		});
		conn.on('error', () => {
			// Stale socket — remove it
			try { unlinkSync(SOCK_PATH); } catch { /* ignore */ }
			resolve(false);
		});
	});
}

async function main() {
	await ensureDir();
	initLogStream();

	const alreadyRunning = await checkExistingDaemon();
	if (alreadyRunning) {
		log('Daemon is already running');
		process.exit(1);
	}

	// Write PID
	await writeFile(PID_PATH, String(process.pid) + '\n');

	startIPC();

	// Graceful shutdown handlers
	process.on('SIGTERM', async () => {
		log('Received SIGTERM');
		await handleStopAll();
		cleanup();
		process.exit(0);
	});

	process.on('SIGINT', async () => {
		log('Received SIGINT');
		await handleStopAll();
		cleanup();
		process.exit(0);
	});

	// Notify parent (if started by CLI via fork)
	if (process.send) {
		process.send({ type: 'ready' });
	}

	log('Daemon started (PID ' + process.pid + ')');
}

main().catch((err) => {
	console.error('Daemon failed to start:', err.message);
	process.exit(1);
});
