#!/bin/bash

echo "🐛 MODO DEBUG: Compilando con output detallado..."
echo ""

mkdir -p build-logs
LOGFILE="build-logs/$(date +%Y%m%d_%H%M%S).log"

npm run build 2>&1 | tee "$LOGFILE"

echo ""
echo "📋 Log guardado en: $LOGFILE"
echo ""
echo "Para ver el log:"
echo "  cat $LOGFILE"
