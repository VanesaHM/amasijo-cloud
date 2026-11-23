// - En Lambda (Node.js 22) el AWS SDK v3 ya viene incluido en el runtime.
// - Se crea una sola vez y se reutiliza entre invocaciones (warm start).
// - En los tests se inyecta un "db" falso y nunca se carga el SDK.

let cached;

export async function getDb() {
  if (!cached) {
    const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
    const { DynamoDBDocumentClient } = await import('@aws-sdk/lib-dynamodb');
    cached = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  }
  return cached;
}
