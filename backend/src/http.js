// Utilidades de respuesta HTTP. Los encabezados CORS los gestiona API Gateway
// (ver CorsConfiguration en infra/template.yaml).

export function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  };
}

// Registro estructurado en JSON: facil de consultar con CloudWatch Logs Insights.
export function log(level, message, extra = {}) {
  console.log(JSON.stringify({ level, message, ...extra }));
}

// Metrica personalizada con Embedded Metric Format (EMF).
// CloudWatch la extrae de los logs sin llamadas adicionales a la API (sin costo extra de PutMetricData).
export function emitMetric(name, value = 1, service = 'crear-pedido') {
  console.log(
    JSON.stringify({
      _aws: {
        Timestamp: Date.now(),
        CloudWatchMetrics: [
          {
            Namespace: 'Amasijo',
            Dimensions: [['Servicio']],
            Metrics: [{ Name: name, Unit: 'Count' }],
          },
        ],
      },
      Servicio: service,
      [name]: value,
    })
  );
}
