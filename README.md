# 🥐 Amasijo Cloud — Proyecto Cloud Integral (UdeA 2026)

Aplicación web para registrar pedidos de una panadería y pastelería local, desplegada en AWS con infraestructura como código (AWS SAM).

## Arquitectura

```
Usuario ──HTTPS──> CloudFront ──(OAC)──> S3 privado (frontend estático)
   │
   └─ fetch() ──> API Gateway (HTTP API) ──> Lambda crear-pedido ──┐
                                        └─> Lambda listar-pedidos ─┴─> DynamoDB

CloudWatch: logs + métricas + dashboard + alarmas (SNS)
VPC 10.0.0.0/16 + subred pública + Internet Gateway + EC2 de pruebas (apagada)
IAM: un rol por Lambda con un único permiso sobre la tabla
```

## Estructura del repositorio

| Carpeta | Contenido |
|---|---|
| `frontend/` | HTML, CSS y JS (sin frameworks) |
| `backend/` | Lambdas en Node.js 22 + pruebas unitarias |
| `infra/` | `template.yaml` (SAM/CloudFormation), `samconfig.toml`, `deploy.ps1` |
| `docs/` | Capturas, diagrama y documento técnico (se agregan al final) |

## Datos del pedido

| Campo | Regla |
|---|---|
| `cliente` | Texto, 2 a 60 caracteres |
| `producto` | Uno de la lista (pan de bono, almojábanas, buñuelos, pan artesanal, tortas) |
| `cantidad` | Entero de 1 a 20 |
| `fechaEntrega` | `AAAA-MM-DD`, desde hoy (hora de Colombia) hasta 60 días |
| `notas` | Opcional, máximo 200 caracteres |

## Requisitos previos (Windows)

Verifica en PowerShell que todo responde:

```powershell
git --version
node --version      # 22 o superior
aws --version       # AWS CLI v2
sam --version       # AWS SAM CLI
```

Configura las credenciales de un **usuario IAM** (no uses la cuenta root):

```powershell
aws configure       # Access key, secret, región us-east-1, formato json
aws sts get-caller-identity
```

## Despliegue

```powershell
cd infra
.\deploy.ps1
```

El script valida la plantilla, compila, despliega (te mostrará el change set y pedirá confirmación), genera `frontend/config.js` con la URL real de la API, sube el frontend a S3 e invalida la caché de CloudFront. Al final imprime la URL del sitio.

Para alarmas por correo, edita `infra/samconfig.toml` y agrega `parameter_overrides = "AlertEmail=tu@correo.com"` (luego confirma la suscripción en el correo que te llegue).

### Apagar la EC2 (obligatorio para cuidar costos)

```powershell
aws ec2 stop-instances --instance-ids <TestInstanceId> --region us-east-1
```

## Pruebas del backend

```powershell
cd backend
npm test
```

## Probar la API a mano

```powershell
$api = "<ApiUrl>"
$fecha = (Get-Date).AddDays(2).ToString("yyyy-MM-dd")
$body = @{ cliente="Ana"; producto="Torta de chocolate"; cantidad=1; fechaEntrega=$fecha; notas="sin nueces" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$api/pedidos" -ContentType "application/json; charset=utf-8" -Body ([Text.Encoding]::UTF8.GetBytes($body))
Invoke-RestMethod -Uri "$api/pedidos"
```

## Eliminar todo al terminar el curso

```powershell
aws s3 rm s3://<FrontendBucketName> --recursive
sam delete --stack-name amasijo-cloud --region us-east-1
```

## Buenas prácticas aplicadas

- **Seguridad:** bucket S3 privado (solo CloudFront vía OAC), roles IAM por función con permiso único, security group de la EC2 sin reglas de entrada, validación en el servidor, HTTPS forzado, CORS restringido al dominio del sitio, cifrado en reposo (S3 y DynamoDB).
- **Costos:** Lambda en arm64 con 128 MB, DynamoDB bajo demanda, HTTP API (más barata que REST API), retención de logs de 7 días, throttling en la API, CloudFront PriceClass_100.
- **Observabilidad:** logs JSON estructurados, métrica personalizada `PedidosCreados` (EMF, namespace `Amasijo`), dashboard, alarmas de errores en Lambda y 5xx en API.
