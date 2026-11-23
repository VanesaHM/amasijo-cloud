<#
  Despliega Amasijo Cloud en AWS (PowerShell, Windows).
  Uso:  .\deploy.ps1                 -> build + deploy + subir frontend
        .\deploy.ps1 -SoloFrontend   -> solo regenera config.js y sube el frontend
#>
param(
  [string]$StackName = "amasijo-cloud",
  [string]$Region = "us-east-1",
  [switch]$SoloFrontend
)

$ErrorActionPreference = "Stop"
$infra = $PSScriptRoot
$frontend = Join-Path (Split-Path $infra -Parent) "frontend"

function Test-Exit($paso) {
  if ($LASTEXITCODE -ne 0) { throw "Fallo el paso '$paso' (codigo $LASTEXITCODE). Revisa el mensaje de arriba." }
}

function Get-Output($key) {
  $v = aws cloudformation describe-stacks --stack-name $StackName --region $Region `
    --query "Stacks[0].Outputs[?OutputKey=='$key'].OutputValue" --output text
  Test-Exit "leer salida $key"
  return $v
}

if (-not $SoloFrontend) {
  Push-Location $infra
  try {
    sam validate --lint;                                  Test-Exit "sam validate"
    sam build --template-file template.yaml;              Test-Exit "sam build"
    sam deploy --stack-name $StackName --region $Region;  Test-Exit "sam deploy"
  } finally {
    Pop-Location
  }
}

$apiUrl = Get-Output "ApiUrl"
$bucket = Get-Output "FrontendBucketName"
$distId = Get-Output "DistributionId"
$siteUrl = Get-Output "SiteUrl"
$instanceId = Get-Output "TestInstanceId"

if (-not $apiUrl -or -not $bucket) { throw "No se pudieron leer las salidas del stack $StackName" }

# Generar config.js con la URL real de la API
$config = "window.APP_CONFIG = {`n  API_URL: '$apiUrl',`n};`n"
[System.IO.File]::WriteAllText((Join-Path $frontend "config.js"), $config, (New-Object System.Text.UTF8Encoding($false)))

# Subir el frontend a S3 y limpiar la cache de CloudFront
aws s3 sync $frontend "s3://$bucket" --delete --region $Region; Test-Exit "s3 sync"
aws cloudfront create-invalidation --distribution-id $distId --paths "/*" | Out-Null; Test-Exit "cloudfront invalidation"

Write-Host ""
Write-Host "Listo." -ForegroundColor Green
Write-Host "Sitio: $siteUrl"
Write-Host "API:   $apiUrl"
Write-Host ""
Write-Host "Recuerda apagar la EC2 de pruebas:" -ForegroundColor Yellow
Write-Host "  aws ec2 stop-instances --instance-ids $instanceId --region $Region"