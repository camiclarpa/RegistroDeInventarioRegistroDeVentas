#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
#  SIGC-Motos — Create Admin User Script
#  Ruta: /opt/SIGH_MOTOS  |  Uso: bash create_admin_user.sh
# ═══════════════════════════════════════════════════════════════════════
set -euo pipefail

PROJECT_DIR="/opt/SIGH_MOTOS"
cd "$PROJECT_DIR"
echo "📁 Directorio de trabajo: $(pwd)"

# Cargar variables de entorno
source .env.production

# ─── PASO 1: Generar o obtener UUID del rol ADMIN ──────────────────────
echo ""
echo "┌──────────────────────────────────────────────────┐"
echo "│  PASO 1 — Obtener/Crear rol ADMIN                │"
echo "└──────────────────────────────────────────────────┘"

ROLE_ID=$(docker exec -it sigc_db psql -U $POSTGRES_USER -d $POSTGRES_DB -t -c "SELECT id FROM roles WHERE name='ADMIN';" | tr -d '[:space:]')

if [ -z "$ROLE_ID" ]; then
    echo "  → Rol 'ADMIN' no existe. Creándolo..."
    ROLE_ID=$(docker exec -it sigc_db psql -U $POSTGRES_USER -d $POSTGRES_DB -t -c "SELECT gen_random_uuid();" | tr -d '[:space:]')
    docker exec -i sigc_db psql -U $POSTGRES_USER -d $POSTGRES_DB << EOF
INSERT INTO roles (id, name, description)
VALUES ('$ROLE_ID', 'ADMIN', 'Administrador del sistema');
EOF
    echo "  ✓ Rol 'ADMIN' creado con ID: $ROLE_ID"
else
    echo "  ✓ Rol 'ADMIN' ya existe con ID: $ROLE_ID"
fi

# ─── PASO 2: Generar hash bcrypt para contraseña ───────────────────────
echo ""
echo "┌──────────────────────────────────────────────────┐"
echo "│  PASO 2 — Generar hash de contraseña             │"
echo "└──────────────────────────────────────────────────┘"

PASSWORD="Admin2026!"
HASH=$(docker exec -it sigc_app node -e "console.log(require('bcryptjs').hashSync('$PASSWORD', 10))")
echo "  ✓ Hash generado: ${HASH:0:20}..."

# ─── PASO 3: Insertar o actualizar usuario admin ───────────────────────
echo ""
echo "┌──────────────────────────────────────────────────┐"
echo "│  PASO 3 — Crear/Actualizar usuario admin         │"
echo "└──────────────────────────────────────────────────┘"

EMAIL="admin@sigcmotos.co"
NAME="Administrador"

# Verificar si el usuario ya existe
USER_EXISTS=$(docker exec -it sigc_db psql -U $POSTGRES_USER -d $POSTGRES_DB -t -c "SELECT COUNT(*) FROM users WHERE email='$EMAIL';" | tr -d '[:space:]')

if [ "$USER_EXISTS" -gt 0 ]; then
    echo "  → Usuario '$EMAIL' ya existe. Actualizando contraseña..."
    docker exec -i sigc_db psql -U $POSTGRES_USER -d $POSTGRES_DB << EOF
UPDATE users 
SET password='$HASH', "roleId"='$ROLE_ID', "isActive"=true, "updatedAt"=NOW()
WHERE email='$EMAIL';
EOF
    echo "  ✓ Usuario actualizado."
else
    echo "  → Usuario '$EMAIL' no existe. Creándolo..."
    docker exec -i sigc_db psql -U $POSTGRES_USER -d $POSTGRES_DB << EOF
INSERT INTO users (id, email, password, name, "roleId", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), '$EMAIL', '$HASH', '$NAME', '$ROLE_ID', true, NOW(), NOW());
EOF
    echo "  ✓ Usuario creado."
fi

# ─── PASO 4: Verificar que el usuario se creó correctamente ────────────
echo ""
echo "┌──────────────────────────────────────────────────┐"
echo "│  PASO 4 — Verificar usuario creado               │"
echo "└──────────────────────────────────────────────────┘"

docker exec -it sigc_db psql -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT id, email, name, \"roleId\", \"isActive\" FROM users WHERE email='$EMAIL';"

echo ""
echo "════════════════════════════════════════════════════"
echo "  ✅ ADMIN USER CREATED SUCCESSFULLY!"
echo "════════════════════════════════════════════════════"
echo ""
echo "🔐 You can now log in with:"
echo "   Email:    $EMAIL"
echo "   Password: $PASSWORD"
echo ""
echo "⚠️  IMPORTANT: Change this password immediately after first login!"
echo "════════════════════════════════════════════════════"
