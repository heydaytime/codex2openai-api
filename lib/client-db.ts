import initSqlJs, { Database, SqlJsStatic } from "sql.js";

export type StoredConversation = {
  id: string;
  title: string;
  model: string;
  createdAt: number;
  updatedAt: number;
};

export type StoredMessage = {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: number;
  seq: number;
};

type Store = {
  driverLabel: string;
  listConversations(): Promise<StoredConversation[]>;
  getMessages(conversationId: string): Promise<StoredMessage[]>;
  saveConversation(conversation: StoredConversation, messages: StoredMessage[]): Promise<void>;
  deleteConversation(conversationId: string): Promise<void>;
};

const DB_KEY = "codex-chat.sqlite";
let storePromise: Promise<Store> | null = null;

export function getStore() {
  storePromise ??= createSqliteStore().catch(() => createLocalStorageStore());
  return storePromise;
}

export function createConversation(model: string, id = crypto.randomUUID()): StoredConversation {
  const now = Date.now();
  return { id, title: "New conversation", model, createdAt: now, updatedAt: now };
}

export function renameConversation(conversation: StoredConversation, title: string): StoredConversation {
  return { ...conversation, title, updatedAt: Date.now() };
}

async function createSqliteStore(): Promise<Store> {
  const SQL = await initSqlJs({ locateFile: (file) => `/${file}` });
  const db = await loadDatabase(SQL);
  migrate(db);

  async function persist() {
    const bytes = db.export();
    await idbSet(DB_KEY, bytes);
  }

  return {
    driverLabel: "History is stored in browser SQLite on this machine",
    async listConversations() {
      const rows = db.exec("select id, title, model, created_at, updated_at from conversations order by updated_at desc")[0]?.values ?? [];
      return rows.map(conversationFromRow);
    },
    async getMessages(conversationId) {
      const statement = db.prepare("select id, conversation_id, role, content, created_at, seq from messages where conversation_id = ? order by seq asc, created_at asc");
      statement.bind([conversationId]);
      const messages: StoredMessage[] = [];
      while (statement.step()) messages.push(messageFromObject(statement.getAsObject()));
      statement.free();
      return messages;
    },
    async saveConversation(conversation, messages) {
      db.run("insert into conversations (id, title, model, created_at, updated_at) values (?, ?, ?, ?, ?) on conflict(id) do update set title = excluded.title, model = excluded.model, updated_at = excluded.updated_at", [conversation.id, conversation.title, conversation.model, conversation.createdAt, conversation.updatedAt]);
      db.run("delete from messages where conversation_id = ?", [conversation.id]);
      for (const message of messages) {
        db.run("insert into messages (id, conversation_id, role, content, created_at, seq) values (?, ?, ?, ?, ?, ?)", [message.id, conversation.id, message.role, message.content, message.createdAt, message.seq]);
      }
      await persist();
    },
    async deleteConversation(conversationId) {
      db.run("delete from conversations where id = ?", [conversationId]);
      await persist();
    },
  };
}

async function loadDatabase(SQL: SqlJsStatic): Promise<Database> {
  const bytes = await idbGet(DB_KEY);
  if (bytes) return new SQL.Database(bytes);
  return new SQL.Database();
}

function migrate(db: Database) {
  db.run(`
    create table if not exists conversations (
      id text primary key,
      title text not null,
      model text not null,
      created_at integer not null,
      updated_at integer not null
    );
    create table if not exists messages (
      id text primary key,
      conversation_id text not null references conversations(id) on delete cascade,
      role text not null,
      content text not null,
      created_at integer not null,
      seq integer not null
    );
    create index if not exists messages_conversation_idx on messages(conversation_id, seq);
  `);
}

function conversationFromRow(row: unknown[]): StoredConversation {
  return { id: String(row[0]), title: String(row[1]), model: String(row[2]), createdAt: Number(row[3]), updatedAt: Number(row[4]) };
}

function messageFromObject(row: Record<string, unknown>): StoredMessage {
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    role: row.role === "assistant" || row.role === "system" ? row.role : "user",
    content: String(row.content),
    createdAt: Number(row.created_at),
    seq: Number(row.seq),
  };
}

async function idbGet(key: string): Promise<Uint8Array | null> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("codex-chat", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction("files", "readonly");
      const get = transaction.objectStore("files").get(key);
      get.onerror = () => reject(get.error);
      get.onsuccess = () => resolve(get.result ? new Uint8Array(get.result as ArrayBuffer) : null);
    };
  });
}

async function idbSet(key: string, value: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("codex-chat", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction("files", "readwrite");
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();
      transaction.objectStore("files").put(value.buffer.slice(0), key);
    };
  });
}

async function createLocalStorageStore(): Promise<Store> {
  const read = () => JSON.parse(localStorage.getItem("codex-chat.fallback") ?? "{\"conversations\":[],\"messages\":{}}") as { conversations: StoredConversation[]; messages: Record<string, StoredMessage[]> };
  const write = (data: ReturnType<typeof read>) => localStorage.setItem("codex-chat.fallback", JSON.stringify(data));
  return {
    driverLabel: "History is stored in localStorage because SQLite could not start",
    async listConversations() {
      return read().conversations.sort((a, b) => b.updatedAt - a.updatedAt);
    },
    async getMessages(conversationId) {
      return read().messages[conversationId] ?? [];
    },
    async saveConversation(conversation, messages) {
      const data = read();
      data.conversations = [conversation, ...data.conversations.filter((item) => item.id !== conversation.id)];
      data.messages[conversation.id] = messages;
      write(data);
    },
    async deleteConversation(conversationId) {
      const data = read();
      data.conversations = data.conversations.filter((item) => item.id !== conversationId);
      delete data.messages[conversationId];
      write(data);
    },
  };
}
