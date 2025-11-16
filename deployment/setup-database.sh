#!/bin/bash
# Database Setup Script for DigitalOcean Ubuntu Server
# This script installs MySQL and sets up the Pricewise database

set -e  # Exit on error

echo "🚀 Starting MySQL Database Setup for Pricewise..."

# Update system packages
echo "📦 Updating system packages..."
apt-get update -y

# Install MySQL Server
echo "📦 Installing MySQL Server..."
DEBIAN_FRONTEND=noninteractive apt-get install -y mysql-server

# Start MySQL service
echo "🔄 Starting MySQL service..."
systemctl start mysql
systemctl enable mysql

# Secure MySQL installation (non-interactive)
echo "🔒 Securing MySQL installation..."
mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'temp_root_password';" || true
mysql -u root -ptemp_root_password -e "DELETE FROM mysql.user WHERE User='';" || true
mysql -u root -ptemp_root_password -e "DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');" || true
mysql -u root -ptemp_root_password -e "DROP DATABASE IF EXISTS test;" || true
mysql -u root -ptemp_root_password -e "DELETE FROM mysql.db WHERE Db='test' OR Db='test\\_%';" || true
mysql -u root -ptemp_root_password -e "FLUSH PRIVILEGES;" || true

# Create database and user
echo "📊 Creating Pricewise database..."
read -p "Enter MySQL root password (or press Enter to use 'temp_root_password'): " ROOT_PASSWORD
ROOT_PASSWORD=${ROOT_PASSWORD:-temp_root_password}

read -p "Enter database name (default: pricewise): " DB_NAME
DB_NAME=${DB_NAME:-pricewise}

read -p "Enter database user (default: pricewise_user): " DB_USER
DB_USER=${DB_USER:-pricewise_user}

read -sp "Enter database password for $DB_USER: " DB_PASSWORD
echo ""

# Create database
mysql -u root -p"$ROOT_PASSWORD" <<EOF
CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';
FLUSH PRIVILEGES;
EOF

echo "✅ Database and user created successfully!"

# Import schema
echo "📋 Importing database schema..."
if [ -f "backend/database/schema.sql" ]; then
    mysql -u root -p"$ROOT_PASSWORD" $DB_NAME < backend/database/schema.sql
    echo "✅ Schema imported successfully!"
else
    echo "⚠️ Schema file not found at backend/database/schema.sql"
    echo "Please run this script from the project root directory"
fi

# Save credentials to a secure file (optional)
echo "💾 Saving database credentials..."
cat > /root/pricewise-db-credentials.txt <<EOF
Database Name: $DB_NAME
Database User: $DB_USER
Database Password: $DB_PASSWORD
Database Host: localhost
Database Port: 3306
EOF
chmod 600 /root/pricewise-db-credentials.txt

echo ""
echo "✅ Database setup complete!"
echo "📝 Credentials saved to /root/pricewise-db-credentials.txt"
echo ""
echo "Next steps:"
echo "1. Update backend/.env with these database credentials"
echo "2. Set ENABLE_DATABASE=true in backend/.env"
echo "3. Deploy the backend service"

