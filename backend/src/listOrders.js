import { json, log } from './http.js';
import { getDb } from './db.js';

const MAX_ITEMS = 50;

export const handler = async (_event, deps = {}) => {
  const tableName = deps.tableName ?? process.env.TABLE_NAME;

  try {
    const db = deps.db ?? (await getDb());
    const { ScanCommand } = deps.db
      ? { ScanCommand: class { constructor(input) { this.input = input; } } }
      : await import('@aws-sdk/lib-dynamodb');

    // Scan es aceptable para un volumen pequeño. Para mas datos se usaria
    // una clave de ordenamiento / GSI y Query.
    const { Items = [] } = await db.send(
      new ScanCommand({ TableName: tableName, Limit: 200 })
    );

    const pedidos = Items.sort((a, b) => b.creadoEn.localeCompare(a.creadoEn)).slice(
      0,
      MAX_ITEMS
    );

    log('INFO', 'Pedidos listados', { cantidad: pedidos.length });
    return json(200, { pedidos });
  } catch (err) {
    log('ERROR', 'Fallo al leer DynamoDB', { error: err.name });
    return json(500, { error: 'No se pudieron obtener los pedidos' });
  }
};
