#!/bin/bash

echo "Starting setup.sh script"

# ODBC Setup
mkdir -p $ODBCSYSINI

cat > "$ODBCSYSINI/odbcinst.ini" << EOL
[FreeTDS]
Description = FreeTDS Driver
Driver = /app/.apt/usr/lib/x86_64-linux-gnu/odbc/libtdsodbc.so
Setup = /app/.apt/usr/lib/x86_64-linux-gnu/odbc/libtdsS.so
EOL

cat > "$ODBCINI" << EOL
[MyMSSQLServer]
Driver = FreeTDS
Server = 127.0.0.1
Port = 1433
Database = ${SQL_DATABASE}
EOL

# Add FreeTDS bin to PATH
export PATH=$PATH:/app/.apt/usr/bin

# SSH Tunnel Setup
echo "Setting up SSH tunnel..."
mkdir -p /app/.ssh
chmod 700 /app/.ssh
echo "$SSH_PRIVATE_KEY" > /app/.ssh/id_rsa
chmod 600 /app/.ssh/id_rsa

# Start the SSH tunnel in the background
ssh -N -L 1433:172.19.1.71:1433 -i /app/.ssh/id_rsa -o StrictHostKeyChecking=no -p 1022 alex@70.19.53.6 &

if [ $? -ne 0 ]; then
  echo "Tunnel setup failed!"
  exit 1
fi

echo "Tunnel setup successful."

echo "setup.sh script completed"
