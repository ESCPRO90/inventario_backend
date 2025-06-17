# Helper para facilitar las pruebas de API
param(
    [Parameter(Position=0)]
    [string]$Metodo = "GET",
    
    [Parameter(Position=1)]
    [string]$Ruta = "/",
    
    [Parameter(Position=2)]
    [string]$Body = ""
)

$baseUrl = "http://localhost:3001/api"

# Función para obtener token
function Get-AuthToken {
    Write-Host "🔑 Obteniendo token..." -ForegroundColor Yellow
    
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" `
        -Method Post `
        -ContentType "application/json" `
        -Body '{"username":"admin","password":"admin123"}'
    
    if ($loginResponse.success) {
        Write-Host "✅ Token obtenido" -ForegroundColor Green
        return $loginResponse.data.token
    } else {
        Write-Host "❌ Error al obtener token" -ForegroundColor Red
        return $null
    }
}

# Obtener o usar token existente
if (-not $global:apiToken) {
    $global:apiToken = Get-AuthToken
}

# Configurar headers
$headers = @{
    "Authorization" = "Bearer $global:apiToken"
}

# Construir URL completa
$fullUrl = "$baseUrl$Ruta"

Write-Host "`n📡 $Metodo $fullUrl" -ForegroundColor Cyan

# Ejecutar petición
try {
    $params = @{
        Uri = $fullUrl
        Method = $Metodo
        Headers = $headers
    }
    
    if ($Body -and $Metodo -in @("POST", "PUT", "PATCH")) {
        $params.ContentType = "application/json"
        $params.Body = $Body
    }
    
    $response = Invoke-RestMethod @params
    
    # Mostrar respuesta formateada
    $response | ConvertTo-Json -Depth 10
    
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "⚠️  Token expirado, obteniendo nuevo token..." -ForegroundColor Yellow
        $global:apiToken = Get-AuthToken
        
        # Reintentar
        $headers.Authorization = "Bearer $global:apiToken"
        $params.Headers = $headers
        $response = Invoke-RestMethod @params
        $response | ConvertTo-Json -Depth 10
    } else {
        Write-Host "❌ Error: $_" -ForegroundColor Red
    }
}

# Mostrar cómo usar curl.exe con el token
Write-Host "`n💡 Para usar con curl.exe:" -ForegroundColor Yellow
Write-Host "curl.exe -X $Metodo $fullUrl -H `"Authorization: Bearer $global:apiToken`"" -ForegroundColor Gray
if ($Body) {
    Write-Host " -H `"Content-Type: application/json`" -d '$Body'" -ForegroundColor Gray
}