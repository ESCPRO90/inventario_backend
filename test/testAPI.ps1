# Script de prueba para la API en PowerShell

# URL base
$baseUrl = "http://localhost:3001/api"

Write-Host "🧪 Probando API de Inventario" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan

# 1. Probar conexión
Write-Host "`n1. Probando conexión..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001" -Method Get
    Write-Host "✅ Servidor activo: $($response.message)" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: El servidor no está respondiendo" -ForegroundColor Red
    Write-Host "Asegúrate de ejecutar 'npm run dev' primero" -ForegroundColor Yellow
    exit
}

# 2. Login
Write-Host "`n2. Probando login..." -ForegroundColor Yellow
$loginBody = @{
    username = "admin"
    password = "admin123"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" `
        -Method Post `
        -ContentType "application/json" `
        -Body $loginBody
    
    if ($loginResponse.success) {
        Write-Host "✅ Login exitoso!" -ForegroundColor Green
        $token = $loginResponse.data.token
        Write-Host "Token obtenido: $($token.Substring(0, 20))..." -ForegroundColor Gray
        
        # Guardar token para siguientes pruebas
        $headers = @{
            "Authorization" = "Bearer $token"
        }
    }
} catch {
    Write-Host "❌ Error en login: $_" -ForegroundColor Red
    exit
}

# 3. Obtener perfil
Write-Host "`n3. Obteniendo perfil..." -ForegroundColor Yellow
try {
    $perfilResponse = Invoke-RestMethod -Uri "$baseUrl/auth/perfil" `
        -Method Get `
        -Headers $headers
    
    Write-Host "✅ Perfil obtenido:" -ForegroundColor Green
    Write-Host "   Usuario: $($perfilResponse.data.usuario.username)" -ForegroundColor White
    Write-Host "   Nombre: $($perfilResponse.data.usuario.nombre_completo)" -ForegroundColor White
    Write-Host "   Rol: $($perfilResponse.data.usuario.rol)" -ForegroundColor White
} catch {
    Write-Host "❌ Error al obtener perfil: $_" -ForegroundColor Red
}

# 4. Listar usuarios (si es admin)
Write-Host "`n4. Listando usuarios..." -ForegroundColor Yellow
try {
    $usuariosResponse = Invoke-RestMethod -Uri "$baseUrl/auth/usuarios" `
        -Method Get `
        -Headers $headers
    
    Write-Host "✅ Usuarios en el sistema: $($usuariosResponse.data.total)" -ForegroundColor Green
    foreach ($usuario in $usuariosResponse.data.usuarios) {
        Write-Host "   - $($usuario.username) ($($usuario.rol))" -ForegroundColor White
    }
} catch {
    Write-Host "⚠️  No tienes permisos para listar usuarios (requiere rol admin)" -ForegroundColor Yellow
}

Write-Host "`n✅ Pruebas completadas!" -ForegroundColor Green
Write-Host "`nToken para usar en otras pruebas:" -ForegroundColor Cyan
Write-Host $token -ForegroundColor Gray