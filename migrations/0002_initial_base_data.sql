-- Migration: Initial data

-- --------------------------------
-- Admin user & role initial data
-- --------------------------------

-- Insert a default admin user with a temporary password 'pass12345', change this after first login
INSERT INTO users (email, password_hash, name, created_at, updated_at)
VALUES ('admin@xeopub.com', '$2a$12$Nxa2dwJEPDSlhd6AocP8n.I0wu7tFqGE7/WU1R6bMR2osp9o.UGci', 'Admin User', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Insert a default admin role with full access to all features and settings
INSERT INTO roles (name, description, permissions) VALUES ('admin', 'Administrator role with full access to all features and settings', '["*"]'), ('editor', 'Editor role with limited access to content management', '["*"]');

-- Assign 'admin' role to the default admin user
INSERT INTO user_roles (user_id, role_id)
SELECT users.id, roles.id
FROM users, roles
WHERE users.email = 'admin@xeopub.com' AND roles.name = 'admin';
