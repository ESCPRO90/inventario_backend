# Script para probar el módulo de inventario
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
    
    # 1. Resumen del inventario
    Write-Host "`n📊 RESUMEN DEL INVENTARIO" -ForegroundColor Cyan
    Write-Host "========================" -ForegroundColor Cyan
    try {
        $resumen = Invoke-RestMethod -Uri "$baseUrl/inventario/resumen" `
            -Method Get `
            -Headers $headers
        
        $r = $resumen.data.resumen
        Write-Host "✅ Productos diferentes: $($r.productos_diferentes)" -ForegroundColor White
        Write-Host "✅ Lotes totales: $($r.lotes_totales)" -ForegroundColor White
        Write-Host "✅ Unidades totales: $($r.unidades_totales)" -ForegroundColor White
        Write-Host "💰 Valor compra: `$$($r.valor_compra)" -ForegroundColor Green
        Write-Host "💰 Valor venta: `$$($r.valor_venta)" -ForegroundColor Green
        Write-Host "📈 Margen potencial: `$$($r.margen_potencial)" -ForegroundColor Yellow
        Write-Host "⚠️  Productos con stock bajo: $($r.productos_stock_bajo)" -ForegroundColor $(if ($r.productos_stock_bajo -gt 0) { "Red" } else { "Green" })
        Write-Host "⏰ Lotes por vencer: $($r.lotes_por_vencer)" -ForegroundColor $(if ($r.lotes_por_vencer -gt 0) { "Red" } else { "Green" })
    } catch {
        Write-Host "❌ Error al obtener resumen: $_" -ForegroundColor Red
    }
    
    # 2. Productos con stock crítico
    Write-Host "`n⚠️  PRODUCTOS CON STOCK CRÍTICO" -ForegroundColor Yellow
    Write-Host "==============================" -ForegroundColor Yellow
    try {
        $stockCritico = Invoke-RestMethod -Uri "$baseUrl/inventario/stock-critico" `
            -Method Get `
            -Headers $headers
        
        if ($stockCritico.data.total -gt 0) {
            Write-Host "$($stockCritico.data.mensaje)" -ForegroundColor Red
            foreach ($prod in $stockCritico.data.productos | Select-Object -First 5) {
                Write-Host "   🔴 $($prod.codigo) - $($prod.descripcion)" -ForegroundColor White
                Write-Host "      Stock: $($prod.stock_actual)/$($prod.stock_minimo) | Faltan: $($prod.unidades_faltantes) unidades" -ForegroundColor Gray
            }
        } else {
            Write-Host "✅ $($stockCritico.data.mensaje)" -ForegroundColor Green
        }
    } catch {
        Write-Host "❌ Error: $_" -ForegroundColor Red
    }
    
    # 3. Productos próximos a vencer
    Write-Host "`n⏰ PRODUCTOS PRÓXIMOS A VENCER (30 días)" -ForegroundColor Yellow
    Write-Host "======================================" -ForegroundColor Yellow
    try {
        $porVencer = Invoke-RestMethod -Uri "$baseUrl/inventario/proximos-vencer?dias=30" `
            -Method Get `
            -Headers $headers
        
        if ($porVencer.data.total -gt 0) {
            Write-Host "$($porVencer.data.mensaje)" -ForegroundColor Red
            foreach ($prod in $porVencer.data.productos | Select-Object -First 5) {
                Write-Host "   ⚠️  $($prod.producto_codigo) - Lote: $($prod.lote)" -ForegroundColor White
                Write-Host "      Vence: $($prod.fecha_vencimiento) ($($prod.dias_para_vencer) días) | Cantidad: $($prod.cantidad_actual) | Valor: `$$($prod.valor_en_riesgo)" -ForegroundColor Gray
            }
        } else {
            Write-Host "✅ $($porVencer.data.mensaje)" -ForegroundColor Green
        }
    } catch {
        Write-Host "❌ Error: $_" -ForegroundColor Red
    }
    
    # 4. Inventario por categorías
    Write-Host "`n📦 INVENTARIO POR CATEGORÍAS" -ForegroundColor Cyan
    Write-Host "===========================" -ForegroundColor Cyan
    try {
        $categorias = Invoke-RestMethod -Uri "$baseUrl/inventario/por-categorias" `
            -Method Get `
            -Headers $headers
        
        foreach ($cat in $categorias.data.categorias) {
            Write-Host "📁 $($cat.categoria):" -ForegroundColor Yellow
            Write-Host "   Productos: $($cat.productos) | Unidades: $($cat.unidades) | Valor: `$$($cat.valor_total)" -ForegroundColor White
        }
    } catch {
        Write-Host "❌ Error: $_" -ForegroundColor Red
    }
    
    # 5. Valorización total
    Write-Host "`n💰 VALORIZACIÓN DEL INVENTARIO" -ForegroundColor Green
    Write-Host "=============================" -ForegroundColor Green
    try {
        $valorizacion = Invoke-RestMethod -Uri "$baseUrl/inventario/valorizacion" `
            -Method Get `
            -Headers $headers
        
        $total = $valorizacion.data.total
        Write-Host "📊 TOTAL GENERAL:" -ForegroundColor Yellow
        Write-Host "   Productos: $($total.productos)" -ForegroundColor White
        Write-Host "   Unidades: $($total.unidades)" -ForegroundColor White
        Write-Host "   Costo total: `$$($total.costo_total)" -ForegroundColor White
        Write-Host "   Valor venta: `$$($total.valor_venta)" -ForegroundColor Green
        Write-Host "   Margen: `$$($total.margen) ($(([math]::Round($total.margen / $total.costo_total * 100, 2)))%)" -ForegroundColor Yellow
    } catch {
        Write-Host "❌ Error: $_" -ForegroundColor Red
    }
    
    # 6. Análisis de rotación
    Write-Host "`n🔄 ANÁLISIS DE ROTACIÓN (últimos 30 días)" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    try {
        $rotacion = Invoke-RestMethod -Uri "$baseUrl/inventario/rotacion?dias=30" `
            -Method Get `
            -Headers $headers
        
        $resumen = $rotacion.data.resumen
        Write-Host "🟢 Alta rotación (≤1 mes): $($resumen.alta_rotacion) productos" -ForegroundColor Green
        Write-Host "🟡 Media rotación (1-3 meses): $($resumen.media_rotacion) productos" -ForegroundColor Yellow
        Write-Host "🟠 Baja rotación (>3 meses): $($resumen.baja_rotacion) productos" -ForegroundColor Red
        Write-Host "⚫ Sin movimiento: $($resumen.sin_movimiento) productos" -ForegroundColor Gray
    } catch {
        Write-Host "❌ Error: $_" -ForegroundColor Red
    }
    
    Write-Host "`n✅ Análisis de inventario completado!" -ForegroundColor Green
    
} else {
    Write-Host "❌ Error en login" -ForegroundColor Red
}