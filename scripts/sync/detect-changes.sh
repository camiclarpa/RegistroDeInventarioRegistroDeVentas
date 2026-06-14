#!/bin/bash
# ============================================
# DETECCIÓN DE CAMBIOS EN ESQUEMA DE BD
# ============================================

SCHEMA_HASH_FILE="/opt/SIGH_MOTOS/scripts/sync/.schema_hash"
CURRENT_HASH=$(docker exec sigc_db pg_dump -U postgres --schema-only sigc_motos 2>/dev/null | md5sum | cut -d' ' -f1)

if [ -f "$SCHEMA_HASH_FILE" ]; then
    OLD_HASH=$(cat "$SCHEMA_HASH_FILE")
    if [ "$CURRENT_HASH" != "$OLD_HASH" ]; then
        echo "CHANGED"
        echo "$CURRENT_HASH" > "$SCHEMA_HASH_FILE"
    else
        echo "SYNCED"
    fi
else
    echo "$CURRENT_HASH" > "$SCHEMA_HASH_FILE"
    echo "INIT"
fi
