/** Narrow compatibility boundary for the SQL dialect already used by Prescore.
 * Values always remain driver parameters. This is not a general SQLite parser.
 */
export function postgresQuery(input: string, parameterCount: number): string {
  let index = 0;
  const tokens = input.match(/'(?:''|[^'])*'|"(?:""|[^"])*"|`[^`]*`|--[^\n]*|\/\*[\s\S]*?\*\/|[A-Za-z_][A-Za-z_0-9]*|\?|\s+|./g) ?? [];
  let alias = false;
  const converted = tokens.map(token => {
    if (/^\s+$/.test(token)) return token;
    if (token.startsWith('--') || token.startsWith('/*')) return token;
    if (token === '?') { alias = false; return `$${++index}`; }
    if (token.startsWith('`')) { alias = false; return `"${token.slice(1,-1)}"`; }
    if (alias && /^[a-zA-Z_]\w*$/.test(token)) { alias = false; return `"${token}"`; }
    alias = token.toUpperCase() === 'AS';
    return token;
  }).join('').trim().replace(/;$/, '');
  if (index !== parameterCount) throw new Error('SQL_PARAMETER_COUNT_MISMATCH');
  if (/^INSERT\s+OR\s+IGNORE\s+/i.test(converted)) {
    return converted.replace(/^INSERT\s+OR\s+IGNORE\s+/i, 'INSERT ') + ' ON CONFLICT DO NOTHING';
  }
  if (/^INSERT\s+OR\s+REPLACE\s+/i.test(converted)) {
    const match = converted.match(/^INSERT\s+OR\s+REPLACE\s+INTO\s+(agent_applications|deals)\s*\(([^)]+)\)/i);
    if (!match) throw new Error('SQL_REPLACE_NOT_REGISTERED');
    const columns = match[2].split(',').map(v => v.trim());
    if (!columns.includes('id') || columns.some(v => !/^[a-z_]+$/.test(v))) throw new Error('SQL_REPLACE_COLUMNS_INVALID');
    return converted.replace(/^INSERT\s+OR\s+REPLACE\s+/i, 'INSERT ') +
      ' ON CONFLICT (id) DO UPDATE SET ' + columns.filter(v => v !== 'id').map(v => `"${v}" = EXCLUDED."${v}"`).join(', ');
  }
  return converted;
}

export interface QueryExecutor {
  query(sql: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
}
export interface TransactionPool extends QueryExecutor {
  connect(): Promise<QueryExecutor & { release(): void }>;
}
export type TableCatalog = Array<{table: string; columns: string[]}>;

export class PortableStatement {
  readonly database: PortableDatabase;
  readonly sql: string;
  readonly values: unknown[];
  constructor(database: PortableDatabase, sql: string, values: unknown[] = []) {
    this.database = database; this.sql = sql; this.values = values;
  }
  bind(...values: unknown[]) { return new PortableStatement(this.database, this.sql, values); }
  async first<T = unknown>(): Promise<T | null> { return (await this.all<T>()).results[0] ?? null; }
  async all<T = unknown>(): Promise<{results: T[]}> {
    const result = await this.database.execute(this, this.database.pool);
    return {results: result.rows as T[]};
  }
  async run() {
    const r = await this.database.execute(this, this.database.pool);
    return {success: true, meta: {changes: r.rowCount ?? 0}};
  }
}

export class PortableDatabase {
  readonly pool: TransactionPool;
  readonly catalog: TableCatalog;
  constructor(pool: TransactionPool, catalog: TableCatalog) { this.pool = pool; this.catalog = catalog; }
  prepare(sql: string) { return new PortableStatement(this, sql); }
  async execute(statement: PortableStatement, connection: QueryExecutor) {
    if (statement.database !== this) throw new Error('SQL_FOREIGN_STATEMENT');
    // Old route initialization becomes a schema assertion, never request-time DDL.
    const create = statement.sql.match(/^\s*CREATE TABLE IF NOT EXISTS\s+([a-z_]+)/i);
    const alter = statement.sql.match(/^\s*ALTER TABLE\s+([a-z_]+)\s+ADD COLUMN\s+([a-z_]+)/i);
    if (create || alter) {
      const table = this.catalog.find(t => t.table === (create ?? alter)![1]);
      if (!table || (alter && !table.columns.includes(alter[2]))) throw new Error('DATABASE_MIGRATION_REQUIRED');
      const r = await connection.query('SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1', [table.table]);
      if (table.columns.some(c => !r.rows.some(row => row.column_name === c))) throw new Error('DATABASE_MIGRATION_REQUIRED');
      return {rows: [], rowCount: 0};
    }
    const index = statement.sql.match(/^\s*CREATE INDEX IF NOT EXISTS\s+([a-z_]+)\s+ON\s+([a-z_]+)\s*\(([a-z_, ]+)\)\s*;?$/i);
    if (index) {
      const table = this.catalog.find(t => t.table === index[2]);
      if (!table || index[3].split(',').some(c => !table.columns.includes(c.trim()))) throw new Error('DATABASE_MIGRATION_REQUIRED');
      const r = await connection.query('SELECT indexname FROM pg_indexes WHERE schemaname=current_schema() AND tablename=$1 AND indexname=$2', [table.table, index[1]]);
      if (!r.rows.length) throw new Error('DATABASE_MIGRATION_REQUIRED');
      return {rows: [], rowCount: 0};
    }
    if (/^\s*(CREATE|ALTER|DROP|TRUNCATE|PRAGMA)\b/i.test(statement.sql)) throw new Error('REQUEST_DDL_FORBIDDEN');
    return connection.query(postgresQuery(statement.sql, statement.values.length), statement.values);
  }
  async batch(statements: PortableStatement[]) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const results = [];
      for (const statement of statements) { const r = await this.execute(statement, client); results.push({results: r.rows}); }
      await client.query('COMMIT');
      return results;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
}
