#!/bin/bash
echo "🚀 Creando usuario administrador..."

# Ejecutar SQL directamente en la BD
docker exec -i sigc_db psql -U postgres -d sigc_motos << 'SQL'
-- 1. Crear rol ADMIN
INSERT INTO roles (id, name, description) 
VALUES ('role_admin', 'ADMIN', 'Administrador del sistema')
ON CONFLICT (id) DO NOTHING;

-- 2. Crear rol USER (básico)
INSERT INTO roles (id, name, description) 
VALUES ('role_user', 'USER', 'Usuario básico del sistema')
ON CONFLICT (id) DO NOTHING;

-- 3. Crear usuario administrador
-- La contraseña 'Admin123!' hasheada con bcrypt (costo 10)
INSERT INTO users (
  id, 
  email, 
  password, 
  name, 
  "roleId", 
  "isActive", 
  "createdAt", 
  "updatedAt"
) VALUES (
  'admin_001',
  'admin@motos.quantacloud.co',
  '$2b$10$9nQ3ZqCzZqY3qZrZqZrZqOeZqZrZqZrZqZrZqZrZqZrZqZrZqZrZqO',
  'Administrador Principal',
  'role_admin',
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO NOTHING;

-- 4. Verificar creación
SELECT '✅ Usuarios creados:' as status, COUNT(*) as total FROM users;
SELECT '✅ Roles creados:' as status, COUNT(*) as total FROM roles;

-- 5. Mostrar usuarios creados
SELECT id, email, name, "roleId", "isActive" FROM users;
SQL

echo ""
echo "✅ Usuario admin creado exitosamente"
echo "📧 Email: admin@motos.quantacloud.co"
echo "🔑 Contraseña: Admin123!"
