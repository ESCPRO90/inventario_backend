# Test de diagnóstico completo
$baseUrl = "http://localhost:3001"

Write-Host "🔍 DIAGNÓSTICO COMPLETO DEL SERVIDOR" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

# 1. VERIFICAR QUE EL SERVIDOR ESTÉ CORRIENDO
Write-Host "`n🌐 TEST 1: Verificando conectividad básica..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri $baseUrl -Method GET -TimeoutSec 10
    Write-Host "✅ Servidor respondiendo en puerto 3000" -ForegroundColor Green
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor White
} catch {
    Write-Host "❌ Servidor NO responde en puerto 3000" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "💡 Verifica que el servidor esté ejecutándose: npm run dev" -ForegroundColor Yellow
    exit 1
}

# 2. VERIFICAR RUTAS DISPONIBLES
Write-Host "`n🛣️ TEST 2: Verificando rutas disponibles..." -ForegroundColor Yellow

$rutasPosibles = @(
    "/",
    "/api",
    "/api/auth",
    "/api/auth/login",
    "/auth/login",
    "/login"
)

foreach ($ruta in $rutasPosibles) {
    try {
        $testResponse = Invoke-WebRequest -Uri "$baseUrl$ruta" -Method GET -TimeoutSec 5
        Write-Host "✅ $ruta - Status: $($testResponse.StatusCode)" -ForegroundColor Green
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq 404) {
            Write-Host "❌ $ruta - 404 Not Found" -ForegroundColor Red
        } elseif ($statusCode -eq 405) {
            Write-Host "⚠️ $ruta - 405 Method Not Allowed (existe pero no acepta GET)" -ForegroundColor Yellow
        } else {
            Write-Host "❌ $ruta - Error: $statusCode" -ForegroundColor Red
        }
    }
}

# 3. PROBAR LOGIN CON DIFERENTES FORMATOS
Write-Host "`n🔑 TEST 3: Probando diferentes formatos de login..." -ForegroundColor Yellow

$loginFormats = @(
    @{
        url = "$baseUrl/api/auth/login"
        data = @{ email = "admin@inventario.com"; password = "admin123" }
        description = "Formato 1: /api/auth/login con email/password"
    },
    @{
        url = "$baseUrl/auth/login"
        data = @{ email = "admin@inventario.com"; password = "admin123" }
        description = "Formato 2: /auth/login con email/password"
    },
    @{
        url = "$baseUrl/api/login"
        data = @{ email = "admin@inventario.com"; password = "admin123" }
        description = "Formato 3: /api/login con email/password"
    },
    @{
        url = "$baseUrl/api/auth/login"
        data = @{ usuario = "admin@inventario.com"; password = "admin123" }
        description = "Formato 4: /api/auth/login con usuario/password"
    },
    @{
        url = "$baseUrl/api/auth/login"
        data = @{ username = "admin"; password = "admin123" }
        description = "Formato 5: /api/auth/login con username/password"
    }
)

foreach ($format in $loginFormats) {
    Write-Host "`n🧪 Probando: $($format.description)" -ForegroundColor Cyan
    
    $headers = @{
        "Content-Type" = "application/json"
        "Accept" = "application/json"
    }
    
    $body = $format.data | ConvertTo-Json -Depth 3
    
    try {
        $loginResponse = Invoke-RestMethod -Uri $format.url -Method POST -Body $body -Headers $headers -TimeoutSec 10
        
        if ($loginResponse.success) {
            Write-Host "✅ LOGIN EXITOSO!" -ForegroundColor Green
            Write-Host "Token: $($loginResponse.data.token.Substring(0,20))..." -ForegroundColor White
            Write-Host "Usuario: $($loginResponse.data.usuario.nombre)" -ForegroundColor White
            
            # Guardar credenciales exitosas para tests posteriores
            $global:workingAuth = @{
                url = $format.url
                headers = @{
                    "Content-Type" = "application/json"
                    "Authorization" = "Bearer $($loginResponse.data.token)"
                }
            }
            break
        } else {
            Write-Host "❌ Login falló: $($loginResponse.message)" -ForegroundColor Red
        }
        
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "❌ Error $statusCode" -ForegroundColor Red
        
        # Intentar obtener detalles del error
        try {
            $errorStream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($errorStream)
            $errorBody = $reader.ReadToEnd()
            $errorJson = $errorBody | ConvertFrom-Json
            Write-Host "Detalle: $($errorJson.message)" -ForegroundColor Red
            
            if ($errorJson.errores) {
                $errorJson.errores | ForEach-Object {
                    Write-Host "- $($_.msg)" -ForegroundColor Red
                }
            }
        } catch {
            Write-Host "Detalles: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

# 4. SI NO HAY LOGIN EXITOSO, VERIFICAR BASE DE DATOS
if (-not $global:workingAuth) {
    Write-Host "`n🗄️ TEST 4: El login falló en todos los formatos" -ForegroundColor Red
    Write-Host "Posibles problemas:" -ForegroundColor Yellow
    Write-Host "1. ❌ Usuario no existe en la base de datos" -ForegroundColor Yellow
    Write-Host "2. ❌ Contraseña incorrecta" -ForegroundColor Yellow
    Write-Host "3. ❌ Ruta de login incorrecta" -ForegroundColor Yellow
    Write-Host "4. ❌ Problema de validación en el servidor" -ForegroundColor Yellow
    Write-Host "5. ❌ Base de datos no conectada" -ForegroundColor Yellow
    
    Write-Host "`n💡 ACCIONES SUGERIDAS:" -ForegroundColor Cyan
    Write-Host "1. Verificar logs del servidor Node.js" -ForegroundColor White
    Write-Host "2. Verificar conexión a base de datos" -ForegroundColor White
    Write-Host "3. Verificar que exista un usuario admin" -ForegroundColor White
    Write-Host "4. Revisar archivo de rutas de autenticación" -ForegroundColor White
    
    exit 1
}

# 5. SI EL LOGIN FUNCIONÓ, PROBAR RUTAS DE SALIDAS
Write-Host "`n📦 TEST 5: Probando rutas de salidas..." -ForegroundColor Yellow

$rutasSalidas = @("/api/salidas", "/salidas", "/api/salida")

foreach ($ruta in $rutasSalidas) {
    try {
        $salidasResponse = Invoke-RestMethod -Uri "$baseUrl$ruta" -Method GET -Headers $global:workingAuth.headers -TimeoutSec 10
        
        if ($salidasResponse.success) {
            Write-Host "✅ $ruta - Funcionando correctamente" -ForegroundColor Green
            Write-Host "Total salidas: $($salidasResponse.data.total)" -ForegroundColor White
            $global:workingSalidasRoute = $ruta
        } else {
            Write-Host "❌ $ruta - Error: $($salidasResponse.message)" -ForegroundColor Red
        }
        
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "❌ $ruta - Error $statusCode" -ForegroundColor Red
    }
}

# 6. RESUMEN FINAL
Write-Host "`n📋 RESUMEN DEL DIAGNÓSTICO" -ForegroundColor Cyan
Write-Host "==========================" -ForegroundColor Cyan

if ($global:workingAuth) {
    Write-Host "✅ Autenticación: FUNCIONANDO" -ForegroundColor Green
    Write-Host "URL login: $($global:workingAuth.url)" -ForegroundColor White
} else {
    Write-Host "❌ Autenticación: FALLANDO" -ForegroundColor Red
}

if ($global:workingSalidasRoute) {
    Write-Host "✅ Rutas salidas: FUNCIONANDO" -ForegroundColor Green
    Write-Host "URL salidas: $baseUrl$($global:workingSalidasRoute)" -ForegroundColor White
} else {
    Write-Host "❌ Rutas salidas: NO ENCONTRADAS" -ForegroundColor Red
}

Write-Host "`n🎯 PRÓXIMOS PASOS:" -ForegroundColor Yellow
if ($global:workingAuth -and $global:workingSalidasRoute) {
    Write-Host "✅ Todo funcionando - Puedes ejecutar tests completos" -ForegroundColor Green
} else {
    Write-Host "🔧 Revisa logs del servidor y configuración de rutas" -ForegroundColor Yellow
    Write-Host "🔧 Verifica que la base de datos esté conectada" -ForegroundColor Yellow
    Write-Host "🔧 Confirma que exista un usuario de prueba" -ForegroundColor Yellow
}

Write-Host "`n🏁 Diagnóstico completado" -ForegroundColor Green