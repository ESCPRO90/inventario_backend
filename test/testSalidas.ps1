# Test de Salidas - Versión Corregida
# Configuración base
$baseUrl = "http://localhost:3000"
$headers = @{"Content-Type" = "application/json"}

Write-Host "🔧 INICIANDO TESTS DE SALIDAS" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

# 1. OBTENER TOKEN DE AUTENTICACIÓN
Write-Host "`n🔑 Obteniendo token de autenticación..." -ForegroundColor Yellow

$loginData = @{
    email = "admin@inventario.com"
    password = "admin123"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method POST -Body $loginData -Headers $headers
    if ($loginResponse.success) {
        $token = $loginResponse.data.token
        $headers["Authorization"] = "Bearer $token"
        Write-Host "✅ Token obtenido exitosamente" -ForegroundColor Green
    } else {
        Write-Host "❌ Error al obtener token: $($loginResponse.message)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Error de conexión al hacer login: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 2. VERIFICAR RUTAS DISPONIBLES
Write-Host "`n🔍 Verificando rutas disponibles..." -ForegroundColor Yellow

try {
    # Probar diferentes posibles rutas
    $possibleRoutes = @("/api/salidas", "/salidas", "/api/salida")
    $workingRoute = $null
    
    foreach ($route in $possibleRoutes) {
        try {
            $testResponse = Invoke-RestMethod -Uri "$baseUrl$route" -Method GET -Headers $headers
            $workingRoute = $route
            Write-Host "✅ Ruta encontrada: $route" -ForegroundColor Green
            break
        } catch {
            Write-Host "❌ Ruta no disponible: $route" -ForegroundColor Red
        }
    }
    
    if (-not $workingRoute) {
        Write-Host "❌ Ninguna ruta de salidas disponible. Verifica tu servidor." -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Error verificando rutas: $($_.Exception.Message)" -ForegroundColor Red
}

# 3. LISTAR SALIDAS EXISTENTES
Write-Host "`n📋 LISTANDO SALIDAS EXISTENTES" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan

try {
    $salidasResponse = Invoke-RestMethod -Uri "$baseUrl$workingRoute" -Method GET -Headers $headers
    
    if ($salidasResponse.success) {
        Write-Host "✅ Salidas obtenidas exitosamente" -ForegroundColor Green
        Write-Host "Total de salidas: $($salidasResponse.data.total)" -ForegroundColor White
        
        if ($salidasResponse.data.datos -and $salidasResponse.data.datos.Count -gt 0) {
            Write-Host "Primeras salidas:" -ForegroundColor White
            $salidasResponse.data.datos | Select-Object -First 3 | ForEach-Object {
                Write-Host "- ID: $($_.id), Tipo: $($_.tipo_salida), Estado: $($_.estado)" -ForegroundColor Gray
            }
        } else {
            Write-Host "⚠️ No hay salidas registradas" -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ Error al listar salidas: $($salidasResponse.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error al listar salidas: $($_.Exception.Message)" -ForegroundColor Red
}

# 4. OBTENER PRODUCTOS DISPONIBLES PRIMERO
Write-Host "`n📦 VERIFICANDO PRODUCTOS DISPONIBLES" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

try {
    $productosResponse = Invoke-RestMethod -Uri "$baseUrl/api/productos?limite=5&solo_con_stock=true" -Method GET -Headers $headers
    
    if ($productosResponse.success -and $productosResponse.data.datos.Count -gt 0) {
        $producto = $productosResponse.data.datos[0]
        Write-Host "✅ Producto disponible encontrado:" -ForegroundColor Green
        Write-Host "- ID: $($producto.id), Nombre: $($producto.nombre), Stock: $($producto.stock)" -ForegroundColor White
    } else {
        Write-Host "❌ No hay productos con stock disponible" -ForegroundColor Red
        Write-Host "💡 Creando producto de prueba..." -ForegroundColor Yellow
        
        # Crear producto de prueba
        $nuevoProducto = @{
            nombre = "Producto Test $(Get-Date -Format 'HHmmss')"
            descripcion = "Producto creado para test de salidas"
            precio = 10.00
            stock = 100
            categoria_id = 1
        } | ConvertTo-Json
        
        $productoCreado = Invoke-RestMethod -Uri "$baseUrl/api/productos" -Method POST -Body $nuevoProducto -Headers $headers
        
        if ($productoCreado.success) {
            $producto = $productoCreado.data
            Write-Host "✅ Producto de prueba creado: ID $($producto.id)" -ForegroundColor Green
        } else {
            Write-Host "❌ No se pudo crear producto de prueba" -ForegroundColor Red
            exit 1
        }
    }
} catch {
    Write-Host "❌ Error verificando productos: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 5. CREAR SALIDA DE PRUEBA
Write-Host "`n📤 CREANDO SALIDA DE CONSIGNACIÓN" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

$nuevaSalida = @{
    tipo_salida = "consignacion"
    observaciones = "Salida de prueba creada desde test - $(Get-Date)"
    detalles = @(
        @{
            producto_id = $producto.id
            cantidad = 2
            precio_unitario = $producto.precio
        }
    )
} | ConvertTo-Json -Depth 3

try {
    $salidaResponse = Invoke-RestMethod -Uri "$baseUrl$workingRoute" -Method POST -Body $nuevaSalida -Headers $headers
    
    if ($salidaResponse.success) {
        $salidaId = $salidaResponse.data.id
        Write-Host "✅ Salida creada exitosamente" -ForegroundColor Green
        Write-Host "- ID: $salidaId" -ForegroundColor White
        Write-Host "- Tipo: $($salidaResponse.data.tipo_salida)" -ForegroundColor White
        Write-Host "- Estado: $($salidaResponse.data.estado)" -ForegroundColor White
    } else {
        Write-Host "❌ Error al crear salida: $($salidaResponse.message)" -ForegroundColor Red
        if ($salidaResponse.errores) {
            $salidaResponse.errores | ForEach-Object {
                Write-Host "  - $($_.msg)" -ForegroundColor Red
            }
        }
        exit 1
    }
} catch {
    Write-Host "❌ Error al crear salida: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $errorContent = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($errorContent)
        $errorText = $reader.ReadToEnd()
        Write-Host "Detalles del error: $errorText" -ForegroundColor Red
    }
    exit 1
}

# 6. OBTENER SALIDA CREADA
Write-Host "`n🔍 OBTENIENDO SALIDA CREADA" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan

try {
    $salidaDetalleResponse = Invoke-RestMethod -Uri "$baseUrl$workingRoute/$salidaId" -Method GET -Headers $headers
    
    if ($salidaDetalleResponse.success) {
        Write-Host "✅ Salida obtenida exitosamente" -ForegroundColor Green
        $salida = $salidaDetalleResponse.data
        Write-Host "- ID: $($salida.id)" -ForegroundColor White
        Write-Host "- Tipo: $($salida.tipo_salida)" -ForegroundColor White
        Write-Host "- Estado: $($salida.estado)" -ForegroundColor White
        Write-Host "- Fecha: $($salida.fecha)" -ForegroundColor White
        
        if ($salida.detalles -and $salida.detalles.Count -gt 0) {
            Write-Host "- Productos en la salida:" -ForegroundColor White
            $salida.detalles | ForEach-Object {
                Write-Host "  * Producto ID: $($_.producto_id), Cantidad: $($_.cantidad)" -ForegroundColor Gray
            }
        }
    } else {
        Write-Host "❌ Error al obtener salida: $($salidaDetalleResponse.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error al obtener salida: $($_.Exception.Message)" -ForegroundColor Red
}

# 7. COMPLETAR SALIDA
Write-Host "`n✅ COMPLETANDO SALIDA" -ForegroundColor Cyan
Write-Host "=====================" -ForegroundColor Cyan

try {
    $completarResponse = Invoke-RestMethod -Uri "$baseUrl$workingRoute/$salidaId/completar" -Method PATCH -Headers $headers
    
    if ($completarResponse.success) {
        Write-Host "✅ Salida completada exitosamente" -ForegroundColor Green
        Write-Host "- Estado actual: $($completarResponse.data.estado)" -ForegroundColor White
    } else {
        Write-Host "❌ Error al completar salida: $($completarResponse.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error al completar salida: $($_.Exception.Message)" -ForegroundColor Red
}

# 8. ESTADÍSTICAS DE SALIDAS
Write-Host "`n📊 ESTADÍSTICAS DE SALIDAS" -ForegroundColor Cyan
Write-Host "===========================" -ForegroundColor Cyan

try {
    $estadisticasResponse = Invoke-RestMethod -Uri "$baseUrl$workingRoute/estadisticas" -Method GET -Headers $headers
    
    if ($estadisticasResponse.success) {
        Write-Host "✅ Estadísticas obtenidas" -ForegroundColor Green
        $stats = $estadisticasResponse.data
        
        if ($stats.resumen) {
            Write-Host "Total salidas: $($stats.resumen.total_salidas)" -ForegroundColor White
            Write-Host "Ventas directas: $($stats.resumen.ventas_directas)" -ForegroundColor White
            Write-Host "Consignaciones: $($stats.resumen.consignaciones)" -ForegroundColor White
            Write-Host "Envíos a maletas: $($stats.resumen.envios_maletas)" -ForegroundColor White
            Write-Host "Valor total: $($stats.resumen.valor_total)" -ForegroundColor Green
        }
    } else {
        Write-Host "❌ Error al obtener estadísticas: $($estadisticasResponse.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error al obtener estadísticas: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🎉 TESTS COMPLETADOS!" -ForegroundColor Green
Write-Host "=====================" -ForegroundColor Green
Write-Host "✅ Tests de salidas ejecutados exitosamente" -ForegroundColor Green
Write-Host "💡 Revisa los logs arriba para ver los resultados detallados" -ForegroundColor Yellow