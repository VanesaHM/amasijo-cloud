import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarPedido, hoyColombia } from '../src/validate.js';
import { handler as crear } from '../src/createOrder.js';
import { handler as listar } from '../src/listOrders.js';

// Fecha de entrega valida: hoy (hora de Colombia) + 3 dias, calculada para que el test no caduque.
function fechaFutura(dias) {
  const d = new Date(`${hoyColombia()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

const valido = () => ({
  cliente: 'Ana',
  producto: 'Torta de chocolate',
  cantidad: 2,
  fechaEntrega: fechaFutura(3),
  notas: 'sin nueces',
});

test('validarPedido acepta un pedido correcto', () => {
  const r = validarPedido(valido());
  assert.equal(r.ok, true);
  assert.equal(r.pedido.cliente, 'Ana');
});

test('validarPedido acepta entregas hoy y dentro del limite de 60 dias', () => {
  assert.equal(validarPedido({ ...valido(), fechaEntrega: fechaFutura(0) }).ok, true);
  assert.equal(validarPedido({ ...valido(), fechaEntrega: fechaFutura(60) }).ok, true);
});

test('validarPedido rechaza datos invalidos', () => {
  assert.equal(validarPedido({ ...valido(), cliente: 'A' }).ok, false);
  assert.equal(validarPedido({ ...valido(), producto: 'Pizza' }).ok, false);
  assert.equal(validarPedido({ ...valido(), cantidad: 0 }).ok, false);
  assert.equal(validarPedido({ ...valido(), cantidad: 2.5 }).ok, false);
  assert.equal(validarPedido({ ...valido(), cantidad: '2' }).ok, false);
  assert.equal(validarPedido({ ...valido(), notas: 'x'.repeat(201) }).ok, false);
  assert.equal(validarPedido(null).ok, false);
});

test('validarPedido rechaza fechas de entrega invalidas', () => {
  assert.equal(validarPedido({ ...valido(), fechaEntrega: fechaFutura(-1) }).ok, false);
  assert.equal(validarPedido({ ...valido(), fechaEntrega: fechaFutura(61) }).ok, false);
  assert.equal(validarPedido({ ...valido(), fechaEntrega: '2026-02-30' }).ok, false);
  assert.equal(validarPedido({ ...valido(), fechaEntrega: '10/12/2026' }).ok, false);
  assert.equal(validarPedido({ ...valido(), fechaEntrega: undefined }).ok, false);
});

test('crear devuelve 201 y guarda en la base de datos', async () => {
  let enviado;
  const db = { send: async (cmd) => { enviado = cmd.input; return {}; } };
  const res = await crear({ body: JSON.stringify(valido()) }, { db, tableName: 'T' });
  assert.equal(res.statusCode, 201);
  assert.equal(enviado.TableName, 'T');
  assert.equal(enviado.Item.estado, 'RECIBIDO');
  assert.ok(enviado.Item.pedidoId);
  assert.ok(enviado.Item.fechaEntrega);
});

test('crear devuelve 400 con JSON roto o datos invalidos', async () => {
  const db = { send: async () => assert.fail('no debe llamar a la BD') };
  const a = await crear({ body: '{no es json' }, { db, tableName: 'T' });
  assert.equal(a.statusCode, 400);
  const b = await crear({ body: JSON.stringify({ ...valido(), cantidad: 99 }) }, { db, tableName: 'T' });
  assert.equal(b.statusCode, 400);
});

test('crear devuelve 500 si DynamoDB falla', async () => {
  const db = { send: async () => { throw new Error('boom'); } };
  const res = await crear({ body: JSON.stringify(valido()) }, { db, tableName: 'T' });
  assert.equal(res.statusCode, 500);
});

test('listar ordena por fecha de creacion descendente', async () => {
  const db = {
    send: async () => ({
      Items: [
        { pedidoId: '1', creadoEn: '2026-11-01T00:00:00.000Z' },
        { pedidoId: '2', creadoEn: '2026-11-03T00:00:00.000Z' },
        { pedidoId: '3', creadoEn: '2026-11-02T00:00:00.000Z' },
      ],
    }),
  };
  const res = await listar({}, { db, tableName: 'T' });
  assert.equal(res.statusCode, 200);
  const ids = JSON.parse(res.body).pedidos.map((p) => p.pedidoId);
  assert.deepEqual(ids, ['2', '3', '1']);
});
