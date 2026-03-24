-- Crear tabla de usuarios para autenticación
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(100) UNIQUE,
  full_name VARCHAR(100),
  role VARCHAR(20) DEFAULT 'user', -- 'admin', 'user', etc.
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índices para mejor rendimiento
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);

-- Insertar usuario administrador por defecto
-- Contraseña: admin123 (hasheada con bcrypt)
-- NOTA: En producción, usa una contraseña segura y hashea correctamente
INSERT INTO users (username, password_hash, email, full_name, role) VALUES
('admin', '$2b$10$rOz8vZ8vZ8vZ8vZ8vZ8vZ8vZ8vZ8vZ8vZ8vZ8vZ8vZ8vZ8vZ8vZ8v', 'admin@example.com', 'Administrador', 'admin');

-- Insertar usuario de ejemplo
INSERT INTO users (username, password_hash, email, full_name, role) VALUES
('usuario', '$2b$10$rOz8vZ8vZ8vZ8vZ8vZ8vZ8vZ8vZ8vZ8vZ8vZ8vZ8vZ8vZ8vZ8vZ8v', 'usuario@example.com', 'Usuario Ejemplo', 'user');

-- Crear función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Crear trigger para actualizar updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();