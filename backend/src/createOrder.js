import { randomUUID } from 'node:crypto';
import { validarPedido } from './validate.js';
import { json, log, emitMetric } from './http.js';
import { getDb } from './db.js';

export const handler = async (event, deps = {}) => {
  const tableName = deps.tableName ?? process.env.TABLE_NAME;

  let body;
  try {
    body = JSON.parse(event.body ?? '');
  } catch {
    log('WARN', 'JSON invalido en la peticion');
    return json(400, { error: 'JSON invalido' });
  }

  const resultado = validarPedido(body);
  if (!resultado.ok) {
    log('WARN', 'Pedido rechazado por validacion', { errores: resultado.errores });
    return json(400, { error: 'Datos invalidos', detalles: resultado.errores });
  }

  const pedido = {
    pedidoId: randomUUID(),
    ...resultado.pedido,
    estado: 'RECIBIDO',
    creadoEn: new Date().toISOString(),
  };

  try {
    const db = deps.db ?? (await getDb());
    const { PutCommand } = deps.db
      ? { PutCommand: class { constructor(input) { this.input = input; } } }
      : await import('@aws-sdk/lib-dynamodb');
    await db.send(new PutCommand({ TableName: tableName, Item: pedido }));
  } catch (err) {
    log('ERROR', 'Fallo al guardar en DynamoDB', { error: err.name });
    return json(500, { error: 'No se pudo guardar el pedido' });
  }

  log('INFO', 'Pedido creado', { pedidoId: pedido.pedidoId });
  emitMetric('PedidosCreados');
  return json(201, pedido);
};
