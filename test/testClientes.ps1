# Script para probar el módulo de clientes
$baseUrl = "http://localhost:3001/api"

Write-Host "🔑 Obteniendo token de autenticación..." -ForegroundColor Yellow

# Login
$loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" `
    -Method Post `
    -ContentType "application/json" `
    -Body '{"username":"admin","password":"admin123"}'

if ($loginResponse.success) {
    $token = $loginResponse.data.token
    Write-Host "✅ Token obtenido exitosamente" -ForegroundColor Green
    
    $headers = @{
        "Authorization" = "Bearer $token"
    }
    
    # 1. Resumen de clientes
    Write-Host "`n📊 RESUMEN DE CLIENTES" -ForegroundColor Cyan
    Write-Host "=====================" -ForegroundColor Cyan
    try {
        $resumen = Invoke-RestMethod -Uri "$baseUrl/clientes/resumen" `
            -Method Get `
            -Headers $headers
        
        Write-Host "`nClientes por tipo:" -ForegroundColor Yellow
        foreach ($tipo in $resumen.data.tipos_clientes) {
            Write-Host "  $($tipo.tipo): $($tipo.total) ($($tipo.con_credito) con crédito)" -ForegroundColor White
        }
        
        Write-Host "`nTop 5 clientes por facturación:" -ForegroundColor Yellow
        foreach ($cliente in $resumen.data.top_clientes | Select-Object -First 5) {
            Write-Host "  🏥 $($cliente.nombre)" -ForegroundColor White
            Write-Host "     Facturas: $($cliente.total_facturas) | Total: `$$($cliente.total_facturado)" -ForegroundColor Gray
        }
    } catch {
        Write-Host "❌ Error al obtener resumen: $_" -ForegroundColor Red
    }
    
    # 2. Listar clientes
    Write-Host "`n📋 LISTADO DE CLIENTES" -ForegroundColor Cyan
    Write-Host "===================" -ForegroundColor Cyan
    try {
        $clientes = Invoke-RestMethod -Uri "$baseUrl/clientes?limite=5" `
            -Method Get `
            -Headers $headers
        
        Write-Host "Total de clientes: $($clientes.data.paginacion.total)" -ForegroundColor Yellow
        foreach ($cliente in $clientes.data.clientes) {
            $tipoIcon = switch ($cliente.tipo) {
                "hospital" { "🏥" }
                "clinica" { "🏨" }
                "medico" { "👨‍⚕️" }
                default { "🏢" }
            }
            Write-Host "`n$tipoIcon $($cliente.codigo) - $($cliente.nombre)" -ForegroundColor White
            Write-Host "   Tipo: $($cliente.tipo) | NIT: $($cliente.nit)" -ForegroundColor Gray
            if ($cliente.credito_activo) {
                Write-Host "   💳 Crédito activo: `$$($cliente.limite_credito)" -ForegroundColor Green
            }
        }
    } catch {
        Write-Host "❌ Error al listar clientes: $_" -ForegroundColor Red
    }
    
    # 3. Buscar clientes
    Write-Host "`n🔍 BÚSQUEDA DE CLIENTES" -ForegroundColor Cyan
    Write-Host "=====================" -ForegroundColor Cyan
    try {
        $busqueda = Invoke-RestMethod -Uri "$baseUrl/clientes/buscar?q=hosp" `
            -Method Get `
            -Headers $headers
        
        Write-Host "Resultados para 'hosp':" -ForegroundColor Yellow
        foreach ($cliente in $busqueda.data.clientes) {
            Write-Host "  - $($cliente.codigo): $($cliente.nombre)" -ForegroundColor White
        }
    } catch {
        Write-Host "❌ Error en búsqueda: $_" -ForegroundColor Red
    }
    
    # 4. Crear un cliente de prueba
    Write-Host "`n➕ CREANDO CLIENTE DE PRUEBA" -ForegroundColor Cyan
    Write-Host "=========================" -ForegroundColor Cyan
    $nuevoCliente = @{
        codigo = "TEST-$(Get-Random -Maximum 9999)"
        nombre = "Cliente de Prueba $(Get-Date -Format 'HH:mm')"
        tipo = "clinica"
        nit = "0614-$(Get-Random -Minimum 100000 -Maximum 999999)-001-1"
        direccion = "Dirección de prueba"
        telefono = "2222-3333"
        email = "prueba@ejemplo.com"
        contacto = "Persona de Contacto"
        credito_activo = $true
        limite_credito = 10000.00
    } | ConvertTo-Json
    
    try {
        $clienteCreado = Invoke-RestMethod -Uri "$baseUrl/clientes" `
            -Method Post `
            -Headers $headers `
            -ContentType "application/json" `
            -Body $nuevoCliente
        
        if ($clienteCreado.success) {
            Write-Host "✅ Cliente creado exitosamente!" -ForegroundColor Green
            Write-Host "   ID: $($clienteCreado.data.cliente.id)" -ForegroundColor White
            Write-Host "   Código: $($clienteCreado.data.cliente.codigo)" -ForegroundColor White
            $clienteId = $clienteCreado.data.cliente.id
            
            # 5. Ver detalles del cliente
            Write-Host "`n📄 DETALLES DEL CLIENTE" -ForegroundColor Cyan
            Write-Host "===================" -ForegroundColor Cyan
            
            $detalles = Invoke-RestMethod -Uri "$baseUrl/clientes/$clienteId`?incluir_estado_cuenta=true&incluir_estadisticas=true" `
                -Method Get `
                -Headers $headers
            
            $c = $detalles.data.cliente
            Write-Host "Cliente: $($c.nombre)" -ForegroundColor Yellow
            Write-Host "Código: $($c.codigo) | Tipo: $($c.tipo)" -ForegroundColor White
            Write-Host "NIT: $($c.nit) | Teléfono: $($c.telefono)" -ForegroundColor White
            
            if ($c.estado_cuenta) {
                Write-Host "`nEstado de cuenta:" -ForegroundColor Yellow
                Write-Host "  Crédito disponible: `$$($c.estado_cuenta.credito_disponible)" -ForegroundColor Green
                Write-Host "  Facturas pendientes: $($c.estado_cuenta.resumen.facturas_pendientes)" -ForegroundColor White
            }
        }
    } catch {
        Write-Host "❌ Error al crear cliente: $_" -ForegroundColor Red
    }
    
    Write-Host "`n✅ Pruebas completadas!" -ForegroundColor Green
    
} else {
    Write-Host "❌ Error en login" -ForegroundColor Red
}