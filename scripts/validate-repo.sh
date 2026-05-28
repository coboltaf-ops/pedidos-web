#!/bin/bash
set -e

echo "════════════════════════════════════════"
echo "  🔍 VALIDACIÓN DEL REPOSITORIO"
echo "════════════════════════════════════════"
echo ""

echo "📦 Instalando dependencias..."
npm install > /dev/null 2>&1

echo "✓ Dependencias instaladas"
echo ""

echo "🔨 Compilando proyecto..."
if npm run build > /tmp/build-output.log 2>&1; then
  echo "✓ Build exitoso"
else
  echo "❌ Build falló!"
  echo ""
  tail -100 /tmp/build-output.log
  exit 1
fi
echo ""

echo "📝 Verificando código..."
if npm run lint > /tmp/lint-output.log 2>&1; then
  echo "✓ Lint pasó"
else
  echo "⚠️  Lint warnings (no crítico)"
  tail -20 /tmp/lint-output.log || true
fi
echo ""

echo "════════════════════════════════════════"
echo "  ✅ VALIDACIÓN COMPLETADA"
echo "════════════════════════════════════════"
