#!/usr/bin/env node

/**
 * Flow CLI — interface to the daemon process manager.
 *
 * Usage:
 *   flow open [path]       Start/open a project dashboard (default: cwd)
 *   flow list              List running dashboards
 *   flow stop [path]       Stop a project dashboard (default: cwd)
 *   flow stop-all          Stop all dashboards
 *   flow shutdown          Stop daemon and all dashboards
 *   flow expose [path]     Expose project via Tailscale (subpath per project)
 *   flow expose --all      Expose all running dashboards via Tailscale
 *   flow unexpose [path]   Remove Tailscale exposure for a project
 *   flow unexpose --all    Remove all Flow Tailscale exposures
 */

import { createConnection } from 'node:net';
import { fork, execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DAEMON_JS = join(__dirname, 'daemon.js');
const FLOW_DIR = join(homedir(), '.flow');
const SOCK_PATH = join(FLOW_DIR, 'daemon.sock');

// ─── Slug & expose tracking ─────────────────────────────────────────

const EXPOSED_PATH = join(FLOW_DIR, 'exposed.json');

function projectSlug(projectRoot) {
	const name = projectRoot.split('/').filter(Boolean).pop() || 'project';
	return name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function loadExposed() {
	try {
		return JSON.parse(readFileSync(EXPOSED_PATH, 'utf-8'));
	} catch {
		return {};
	}
}

function saveExposed(data) {
	mkdirSync(FLOW_DIR, { recursive: true });
	writeFileSync(EXPOSED_PATH, JSON.stringify(data, null, 2) + '\n');
}

function addExposed(slug, projectRoot, port) {
	const data = loadExposed();
	data['/' + slug] = { projectRoot, port };
	saveExposed(data);
}

function removeExposed(slug) {
	const data = loadExposed();
	delete data['/' + slug];
	saveExposed(data);
}

// ─── Arg parsing ─────────────────────────────────────────────────────

const args = process.argv.slice(2);
const command = args[0];
const flags = new Set(args.filter((a) => a.startsWith('--')));
const positional = args.filter((a) => !a.startsWith('--')).slice(1);

// ─── IPC Client ──────────────────────────────────────────────────────

function sendCommand(cmd, cmdArgs) {
	return new Promise((resolveCmd, reject) => {
		const conn = createConnection(SOCK_PATH);
		let buffer = '';

		conn.on('connect', () => {
			conn.write(JSON.stringify({ command: cmd, args: cmdArgs }) + '\n');
		});

		conn.on('data', (chunk) => {
			buffer += chunk.toString();
		});

		conn.on('end', () => {
			try {
				resolveCmd(JSON.parse(buffer.trim()));
			} catch {
				reject(new Error('Invalid response from daemon'));
			}
		});

		conn.on('error', (err) => {
			reject(err);
		});
	});
}

function isDaemonRunning() {
	return new Promise((resolve) => {
		if (!existsSync(SOCK_PATH)) return resolve(false);
		const conn = createConnection(SOCK_PATH);
		conn.on('connect', () => { conn.destroy(); resolve(true); });
		conn.on('error', () => resolve(false));
	});
}

async function ensureDaemon() {
	if (await isDaemonRunning()) return;

	// Fork daemon detached — daemon writes its own log file directly
	const child = fork(DAEMON_JS, [], {
		detached: true,
		stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
	});

	// Wait for the daemon to signal readiness
	await new Promise((resolveStart, reject) => {
		const timeout = setTimeout(() => {
			reject(new Error('Daemon startup timed out'));
		}, 10_000);

		child.on('message', (msg) => {
			if (msg && msg.type === 'ready') {
				clearTimeout(timeout);
				resolveStart();
			}
		});

		child.on('exit', (code) => {
			clearTimeout(timeout);
			reject(new Error(`Daemon exited with code ${code}`));
		});
	});

	// Detach so CLI can exit
	child.unref();
	child.disconnect();
}

// ─── Commands ────────────────────────────────────────────────────────

async function cmdOpen() {
	const projectRoot = resolve(positional[0] || process.cwd());
	await ensureDaemon();
	const res = await sendCommand('open', { projectRoot });

	if (res.error) {
		console.log(`STATUS: FAILED`);
		console.log(`ERROR: ${res.error}`);
		process.exit(1);
	}

	if (res.started) {
		console.log('STATUS: STARTED');
	} else {
		console.log('STATUS: ALREADY_RUNNING');
	}
	console.log(`URL: ${res.url}`);
	console.log(`PID: ${res.pid}`);
	console.log(`PORT: ${res.port}`);
	console.log(`PROJECT: ${projectRoot}`);

	// Open browser unless --no-browser
	if (!flags.has('--no-browser')) {
		try {
			execFileSync('open', [res.url], { stdio: 'ignore' });
		} catch { /* ignore */ }
	}

	// Expose via Tailscale if --expose
	if (flags.has('--expose')) {
		try {
			const { slug, output } = exposeProject(projectRoot, res.port);
			console.log('EXPOSE_STATUS: EXPOSED');
			console.log(`SLUG: /${slug}`);
			console.log(`TAILSCALE_OUTPUT: ${output}`);
		} catch (err) {
			console.log('EXPOSE_STATUS: FAILED');
			console.log(`EXPOSE_ERROR: ${err.message}`);
		}
	}

	process.exit(0);
}

async function cmdList() {
	await ensureDaemon();
	const list = await sendCommand('list');

	if (Array.isArray(list) && list.length === 0) {
		console.log('STATUS: NO_PROJECTS');
		return;
	}

	if (Array.isArray(list)) {
		for (const entry of list) {
			console.log(`PROJECT: ${entry.projectRoot}`);
			console.log(`  URL: ${entry.url}`);
			console.log(`  PID: ${entry.pid}`);
			console.log(`  PORT: ${entry.port}`);
		}
	} else if (list.error) {
		console.log(`STATUS: FAILED`);
		console.log(`ERROR: ${list.error}`);
	}
}

async function cmdStop() {
	const projectRoot = resolve(positional[0] || process.cwd());

	if (!(await isDaemonRunning())) {
		console.log('STATUS: NOT_RUNNING');
		return;
	}

	const res = await sendCommand('stop', { projectRoot });
	if (res.error) {
		console.log('STATUS: NOT_RUNNING');
	} else {
		console.log('STATUS: STOPPED');
		console.log(`PROJECT: ${projectRoot}`);
	}
}

async function cmdStopAll() {
	if (!(await isDaemonRunning())) {
		console.log('STATUS: NOT_RUNNING');
		return;
	}

	await sendCommand('stop-all');
	console.log('STATUS: ALL_STOPPED');
}

async function cmdShutdown() {
	if (!(await isDaemonRunning())) {
		console.log('STATUS: NOT_RUNNING');
		return;
	}

	try {
		await sendCommand('shutdown');
	} catch {
		// Expected — daemon exits during shutdown
	}
	console.log('STATUS: SHUTDOWN');
}

function exposeProject(projectRoot, port) {
	const slug = projectSlug(projectRoot);
	const output = execFileSync('tailscale', [
		'serve', '--bg', '--set-path', '/' + slug, `http://localhost:${port}`,
	], { encoding: 'utf-8' });
	addExposed(slug, projectRoot, port);
	return { slug, output: output.trim() };
}

async function cmdExpose() {
	await ensureDaemon();
	const list = await sendCommand('list');

	if (flags.has('--all')) {
		if (!Array.isArray(list) || list.length === 0) {
			console.log('STATUS: NO_PROJECTS');
			console.log('No running dashboards to expose.');
			return;
		}
		let failed = false;
		for (const entry of list) {
			try {
				const { slug } = exposeProject(entry.projectRoot, entry.port);
				console.log(`EXPOSED: /${slug} → localhost:${entry.port}`);
			} catch (err) {
				console.log(`FAILED: ${entry.projectRoot} — ${err.message}`);
				failed = true;
			}
		}
		console.log(failed ? 'STATUS: PARTIAL' : 'STATUS: ALL_EXPOSED');
		return;
	}

	const projectRoot = resolve(positional[0] || process.cwd());
	const entry = Array.isArray(list) ? list.find((e) => e.projectRoot === projectRoot) : null;

	if (!entry) {
		console.log('STATUS: SERVER_NOT_RUNNING');
		console.log('Run `flow open` first to start the dashboard.');
		return;
	}

	try {
		const { slug, output } = exposeProject(projectRoot, entry.port);
		console.log('STATUS: EXPOSED');
		console.log(`SLUG: /${slug}`);
		console.log(`TAILSCALE_OUTPUT: ${output}`);
		try {
			const status = execFileSync('tailscale', ['serve', 'status'], { encoding: 'utf-8' });
			console.log('SERVE_STATUS:');
			console.log(status);
		} catch { /* ignore */ }
	} catch (err) {
		console.log('STATUS: FAILED');
		console.log(`ERROR: ${err.message}`);
	}
}

async function cmdUnexpose() {
	if (flags.has('--all')) {
		const exposed = loadExposed();
		const paths = Object.keys(exposed);
		if (paths.length === 0) {
			console.log('STATUS: NOTHING_EXPOSED');
			return;
		}
		let failed = false;
		for (const subpath of paths) {
			try {
				execFileSync('tailscale', ['serve', '--set-path', subpath, 'off'], { encoding: 'utf-8' });
				console.log(`REMOVED: ${subpath}`);
			} catch (err) {
				console.log(`FAILED: ${subpath} — ${err.message}`);
				failed = true;
			}
		}
		saveExposed({});
		console.log(failed ? 'STATUS: PARTIAL' : 'STATUS: ALL_UNEXPOSED');
		return;
	}

	const projectRoot = resolve(positional[0] || process.cwd());
	const slug = projectSlug(projectRoot);

	try {
		execFileSync('tailscale', ['serve', '--set-path', '/' + slug, 'off'], { encoding: 'utf-8' });
		removeExposed(slug);
		console.log('STATUS: UNEXPOSED');
		console.log(`SLUG: /${slug}`);
	} catch (err) {
		console.log('STATUS: FAILED');
		console.log(`ERROR: ${err.message}`);
	}
}

function showUsage() {
	console.log(`Usage: flow <command> [options]

Commands:
  open [path]         Start/open a project dashboard (default: cwd)
  list                List running dashboards
  stop [path]         Stop a project dashboard (default: cwd)
  stop-all            Stop all dashboards
  shutdown            Stop daemon and all dashboards
  expose [path]       Expose project via Tailscale (subpath per project)
  expose --all        Expose all running dashboards via Tailscale
  unexpose [path]     Remove Tailscale exposure for a project
  unexpose --all      Remove all Flow Tailscale exposures

Options:
  --no-browser        Don't open browser (for open command)
  --expose            Expose via Tailscale after opening (for open command)`);
}

// ─── Main ────────────────────────────────────────────────────────────

function getVersion() {
	try {
		const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf-8'));
		return pkg.version;
	} catch {
		return 'unknown';
	}
}

async function main() {
	if (flags.has('--version') || flags.has('-v')) {
		console.log(getVersion());
		return;
	}

	switch (command) {
		case 'open':
			return await cmdOpen();
		case 'list':
			return await cmdList();
		case 'stop':
			return await cmdStop();
		case 'stop-all':
			return await cmdStopAll();
		case 'shutdown':
			return await cmdShutdown();
		case 'expose':
			return await cmdExpose();
		case 'unexpose':
			return await cmdUnexpose();
		default:
			showUsage();
			process.exit(command ? 1 : 0);
	}
}

main().catch((err) => {
	console.error(`Error: ${err.message}`);
	process.exit(1);
});
