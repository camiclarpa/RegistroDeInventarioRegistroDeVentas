#!/bin/bash
# Reporte rápido de métricas
METRICS_FILE="/tmp/sigc_metrics.json"
if [ -f "$METRICS_FILE" ]; then
    cat $METRICS_FILE | python3 -m json.tool 2>/dev/null || cat $METRICS_FILE
else
    echo "Generando métricas..."
    /opt/SIGH_MOTOS/scripts/monitor-advanced.sh
    cat $METRICS_FILE 2>/dev/null || echo "Métricas no disponibles"
fi
