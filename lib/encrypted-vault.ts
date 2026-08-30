'use client';

import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';

const DB_NAME = 'ren-local-vault';
const STORE_NAME = 'encrypted-sqlite';
const RECORD_KEY = 'primary';
const ITERATIONS = 250_000;

type EncryptedRecord = {
  version: 1;
  salt: ArrayBuffer;
  iv: ArrayBuffer;
  ciphertext: ArrayBuffer;
};

export type VaultSnapshot = {
  balance: number;
  deposits: number;
  carryForward: number;
  killed: boolean;
  journal: string[];
  audit: string[];
};

export type VaultHandle = {
  created: boolean;
  load: () => VaultSnapshot | null;
  save: (snapshot: VaultSnapshot) => Promise<void>;
  close: () => void;
};

let sqlPromise: Promise<SqlJsStatic> | null = null;

function getSql() {
  sqlPromise ??= initSqlJs({ locateFile: () => '/sql-wasm.wasm' });
  return sqlPromise;
}

function openIndexedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open the local vault store.'));
  });
}

async function getRecord(): Promise<EncryptedRecord | undefined> {
  const database = await openIndexedDb();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(RECORD_KEY);
    request.onsuccess = () => resolve(request.result as EncryptedRecord | undefined);
    request.onerror = () => reject(request.error ?? new Error('Unable to read the encrypted vault.'));
    transaction.oncomplete = () => database.close();
  });
}

async function putRecord(record: EncryptedRecord) {
  const database = await openIndexedDb();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(record, RECORD_KEY);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error('Unable to persist the encrypted vault.')); };
  });
}

async function deriveKey(passphrase: string, salt: BufferSource) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function initializeSchema(db: Database) {
  db.run(`CREATE TABLE IF NOT EXISTS account (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    balance REAL NOT NULL,
    deposits REAL NOT NULL,
    carry_forward REAL NOT NULL,
    killed INTEGER NOT NULL CHECK (killed IN (0, 1)),
    updated_at TEXT NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS journal (
    id INTEGER PRIMARY KEY,
    entry TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_journal_created_at ON journal(created_at DESC)');
  db.run('CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at DESC)');
  db.run('PRAGMA optimize');
}

function queryStrings(db: Database, table: 'journal' | 'audit_log', column: 'entry' | 'message') {
  const result = db.exec(`SELECT ${column} FROM ${table} ORDER BY id ASC`);
  return result[0]?.values.map((row) => String(row[0])) ?? [];
}

export async function openEncryptedVault(passphrase: string): Promise<VaultHandle> {
  if (passphrase.length < 8) throw new Error('Use a passphrase with at least 8 characters.');
  const [SQL, record] = await Promise.all([getSql(), getRecord()]);
  const created = !record;
  const salt = record ? new Uint8Array(record.salt) : crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(passphrase, salt);
  let db: Database;

  if (record) {
    try {
      const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(record.iv) }, key, record.ciphertext);
      db = new SQL.Database(new Uint8Array(plaintext));
    } catch {
      throw new Error('Incorrect passphrase or damaged local vault.');
    }
  } else {
    db = new SQL.Database();
  }
  initializeSchema(db);

  async function persist() {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const bytes = db.export();
    const plaintext = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(plaintext).set(bytes);
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
    await putRecord({ version: 1, salt: salt.buffer.slice(0), iv: iv.buffer.slice(0), ciphertext });
  }

  return {
    created,
    load() {
      const account = db.exec('SELECT balance, deposits, carry_forward, killed FROM account WHERE id = 1');
      if (!account[0]?.values[0]) return null;
      const [balance, deposits, carryForward, killed] = account[0].values[0];
      return {
        balance: Number(balance),
        deposits: Number(deposits),
        carryForward: Number(carryForward),
        killed: Boolean(killed),
        journal: queryStrings(db, 'journal', 'entry'),
        audit: queryStrings(db, 'audit_log', 'message'),
      };
    },
    async save(snapshot) {
      const now = new Date().toISOString();
      db.run('BEGIN IMMEDIATE');
      try {
        db.run(
          `INSERT INTO account (id, balance, deposits, carry_forward, killed, updated_at)
           VALUES (1, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET balance=excluded.balance, deposits=excluded.deposits,
           carry_forward=excluded.carry_forward, killed=excluded.killed, updated_at=excluded.updated_at`,
          [snapshot.balance, snapshot.deposits, snapshot.carryForward, snapshot.killed ? 1 : 0, now],
        );
        db.run('DELETE FROM journal');
        const journalStatement = db.prepare('INSERT INTO journal (entry, created_at) VALUES (?, ?)');
        snapshot.journal.forEach((entry, index) => journalStatement.run([entry, `${now}-${index}`]));
        journalStatement.free();
        db.run('DELETE FROM audit_log');
        const auditStatement = db.prepare('INSERT INTO audit_log (message, created_at) VALUES (?, ?)');
        snapshot.audit.forEach((message, index) => auditStatement.run([message, `${now}-${index}`]));
        auditStatement.free();
        db.run('COMMIT');
      } catch (error) {
        db.run('ROLLBACK');
        throw error;
      }
      await persist();
    },
    close() { db.close(); },
  };
}

export async function localVaultExists() {
  return Boolean(await getRecord());
}
