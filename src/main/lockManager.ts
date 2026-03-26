/**
 * Lock Manager — File locking for shared folder collaboration.
 *
 * When a .typ file is opened, a .filename.typ.lock file is created next to it.
 * Other vswrite instances (or the same user on another machine via Dropbox etc.)
 * see the lock and can choose to open read-only.
 *
 * Lock files contain: user, machine, timestamp, pid.
 * A heartbeat updates the timestamp every 30s.
 * Locks older than 2 minutes are considered stale (crashed app).
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const HEARTBEAT_INTERVAL = 30_000; // 30 seconds
const STALE_THRESHOLD = 120_000;   // 2 minutes

export interface LockInfo {
  user: string;
  machine: string;
  pid: number;
  timestamp: number;
  app: string;
}

let currentLockPath: string | null = null;
let heartbeatTimer: NodeJS.Timeout | null = null;

/**
 * Returns the .lock file path for a given file.
 */
function lockPathFor(filePath: string): string {
  const dir = path.dirname(filePath);
  const name = path.basename(filePath);
  return path.join(dir, `.${name}.lock`);
}

/**
 * Creates a lock info object for the current user/machine.
 */
function createLockInfo(): LockInfo {
  return {
    user: os.userInfo().username || os.hostname(),
    machine: os.hostname(),
    pid: process.pid,
    timestamp: Date.now(),
    app: 'vswrite-desktop',
  };
}

/**
 * Reads an existing lock file. Returns null if not found or unparseable.
 */
function readLock(lockPath: string): LockInfo | null {
  try {
    if (!fs.existsSync(lockPath)) return null;
    const raw = fs.readFileSync(lockPath, 'utf-8');
    return JSON.parse(raw) as LockInfo;
  } catch {
    return null;
  }
}

/**
 * Checks if a lock is stale (timestamp older than STALE_THRESHOLD).
 */
function isStale(lock: LockInfo): boolean {
  return Date.now() - lock.timestamp > STALE_THRESHOLD;
}

/**
 * Checks if a lock belongs to this process (same PID + machine).
 */
function isOwnLock(lock: LockInfo): boolean {
  return lock.pid === process.pid && lock.machine === os.hostname();
}

/**
 * Checks if a file is locked by someone else.
 * Returns the lock info if locked by another user/process, null if free.
 */
export function checkLock(filePath: string): LockInfo | null {
  const lockPath = lockPathFor(filePath);
  const lock = readLock(lockPath);

  if (!lock) return null;
  if (isStale(lock)) return null;
  if (isOwnLock(lock)) return null;

  return lock;
}

/**
 * Acquires a lock on the file. Creates the .lock file and starts the heartbeat.
 * Call releaseLock() when done.
 */
export function acquireLock(filePath: string): void {
  // Release any previous lock first
  releaseLock();

  const lockPath = lockPathFor(filePath);
  const info = createLockInfo();

  try {
    fs.writeFileSync(lockPath, JSON.stringify(info, null, 2), 'utf-8');
    currentLockPath = lockPath;

    // Start heartbeat
    heartbeatTimer = setInterval(() => {
      if (currentLockPath) {
        try {
          const updated = createLockInfo();
          fs.writeFileSync(currentLockPath, JSON.stringify(updated, null, 2), 'utf-8');
        } catch {
          // Lock file may have been deleted externally — stop heartbeat
          stopHeartbeat();
        }
      }
    }, HEARTBEAT_INTERVAL);
  } catch (err) {
    console.warn('[vswrite] Could not create lock file:', err);
  }
}

/**
 * Releases the current lock (deletes the .lock file and stops heartbeat).
 */
export function releaseLock(): void {
  stopHeartbeat();

  if (currentLockPath) {
    try {
      if (fs.existsSync(currentLockPath)) {
        fs.unlinkSync(currentLockPath);
      }
    } catch {
      // Ignore — file may already be gone
    }
    currentLockPath = null;
  }
}

/**
 * Returns the path of the current lock file, or null if none.
 */
export function getCurrentLockPath(): string | null {
  return currentLockPath;
}

function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}
