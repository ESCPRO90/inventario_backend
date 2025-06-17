                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    # Script para probar el módulo de entradas
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
    
    # 1. Generar número de entrada
    Write-Host "`n📋 Generando número de entrada..." -ForegroundColor Yellow
    try {
        $numeroResponse = Invoke-RestMethod -Uri "$baseUrl/entradas/generar-numero" `
            -Method Get `
            -Headers $headers
        
        $numeroEntrada = $numeroResponse.data.numero_entrada
        Write-Host "✅ Número generado: $numeroEntrada" -ForegroundColor Green
    } catch {
        Write-Host "❌ Error al generar número: $_" -ForegroundColor Red
    }
    
    # 2. Validar entrada antes de crear
    Write-Host "`n🔍 Validando entrada de prueba..." -ForegroundColor Yellow
    $entradaPrueba = @{
        proveedor_id = 1
        detalles = @(
            @{
                producto_id = 1
                cantidad = 10
                precio_unitario = 850.00
                lote = "TEST-$(Get-Date -Format 'yyyyMMdd')-001"
                fecha_vencimiento = (Get-Date).AddYears(2).ToString("yyyy-MM-dd")
            }
        )
    } | ConvertTo-Json -Depth 10
    
    try {
        $validacion = Invoke-RestMethod -Uri "$baseUrl/entradas/validar" `
            -Method Post `
            -Headers $headers `
            -ContentType "application/json" `
            -Body $entradaPrueba
        
        if ($validacion.data.validaciones.proveedor_valido -and $validacion.data.validaciones.productos_validos) {
            Write-Host "✅ Validación exitosa" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Hay problemas con la validación" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "❌ Error en validación: $_" -ForegroundColor Red
    }
    
    # 3. Crear entrada
    Write-Host "`n📥 Creando entrada de inventario..." -ForegroundColor Yellow
    $nuevaEntrada = @{
        proveedor_id = 1
        tipo_documento = "factura"
        numero_documento = "TEST-FAC-$(Get-Date -Format 'yyyyMMdd')"
        fecha = (Get-Date).ToString("yyyy-MM-dd")
        observaciones = "Entrada de prueba creada por script PowerShell"
        detalles = @(
            @{
                producto_id = 1
                cantidad = 5
                precio_unitario = 850.00
                lote = "TEST-$(Get-Date -Format 'yyyyMMdd')-001"
                fecha_vencimiento = (Get-Date).AddYears(2).ToString("yyyy-MM-dd")
            },
            @{
                producto_id = 2
                cantidad = 10
                precio_unitario = 180.00
                lote = "TEST-$(Get-Date -Format 'yyyyMMdd')-002"
                fecha_vencimiento = (Get-Date).AddMonths(18).ToString("yyyy-MM-dd")
            }
        )
    } | ConvertTo-Json -Depth 10
    
    try {
        $entradaCreada = Invoke-RestMethod -Uri "$baseUrl/entradas" `
            -Method Post `
            -Headers $headers `
            -ContentType "application/json" `
            -Body $nuevaEntrada
        
        if ($entradaCreada.success) {
            Write-Host "✅ Entrada creada exitosamente!" -ForegroundColor Green
            Write-Host "   Número: $($entradaCreada.data.entrada.numero_entrada)" -ForegroundColor White
            Write-Host "   Total: `$$($entradaCreada.data.entrada.total)" -ForegroundColor White
            $entradaId = $entradaCreada.data.entrada.id
        }
    } catch {
        Write-Host "❌ Error al crear entrada: $_" -ForegroundColor Red
    }
    
    # 4. Listar entradas recientes
    Write-Host "`n📋 Listando entradas recientes..." -ForegroundColor Yellow
    try {
        $recientes = Invoke-RestMethod -Uri "$baseUrl/entradas/recientes?limite=5" `
            -Method Get `
            -Headers $headers
        
        Write-Host "✅ Últimas $($recientes.data.total) entradas:" -ForegroundColor Green
        foreach ($entrada in $recientes.data.entradas) {
            Write-Host "   - $($entrada.numero_entrada) | $($entrada.fecha) | $($entrada.proveedor_nombre) | Total: `$$($entrada.total)" -ForegroundColor White
        }
    } catch {
        Write-Host "❌ Error al listar entradas: $_" -ForegroundColor Red
    }
    
    # 5. Obtener estadísticas
    Write-Host "`n📊 Obteniendo estadísticas..." -ForegroundColor Yellow
    try {
        $stats = Invoke-RestMethod -Uri "$baseUrl/entradas/estadisticas" `
            -Method Get `
            -Headers $headers
        
        Write-Host "✅ Estadísticas generales:" -ForegroundColor Green
        Write-Host "   Total entradas: $($stats.data.estadisticas.total_entradas)" -ForegroundColor White
        Write-Host "   Total proveedores: $($stats.data.estadisticas.total_proveedores)" -ForegroundColor White
        Write-Host "   Monto total: `$$($stats.data.estadisticas.monto_total)" -ForegroundColor White
        Write-Host "   Productos diferentes: $($stats.data.estadisticas.productos_diferentes)" -ForegroundColor White
        Write-Host "   Unidades totales: $($stats.data.estadisticas.unidades_totales)" -ForegroundColor White
    } catch {
        Write-Host "❌ Error al obtener estadísticas: $_" -ForegroundColor Red
    }
    
    Write-Host "`n✅ Pruebas completadas!" -ForegroundColor Green
    
} else {
    Write-Host "❌ Error en login" -ForegroundColor Red
}