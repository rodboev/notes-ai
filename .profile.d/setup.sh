#!/bin/bash
set -e  # Exit immediately if a command exits with a non-zero status

echo "Starting setup.sh script"

# Check if required variables are set
if [ -z "$SSH_TUNNEL_FORWARD" ] || [ -z "$SSH_TUNNEL_PORT" ] || [ -z "$SSH_TUNNEL_TARGET" ] || [ -z "$SSH_PRIVATE_KEY" ]; then
    echo "Error: One or more required SSH variables are not set."
    echo "SSH_TUNNEL_FORWARD: $SSH_TUNNEL_FORWARD"
    echo "SSH_TUNNEL_PORT: $SSH_TUNNEL_PORT"
    echo "SSH_TUNNEL_TARGET: $SSH_TUNNEL_TARGET"
    echo "SSH_PRIVATE_KEY: $([ -n "$SSH_PRIVATE_KEY" ] && echo "Set" || echo "Not set")"
    exit 1
fi

# ODBC and FreeTDS Setup
export ODBCSYSINI=/app/.apt/etc
export ODBCINI=/app/.apt/etc/odbc.ini
export FREETDSCONF=/app/.apt/etc/freetds/freetds.conf
export LD_LIBRARY_PATH=/app/.apt/usr/lib/x86_64-linux-gnu:/app/.apt/usr/lib/x86_64-linux-gnu/odbc:$LD_LIBRARY_PATH

mkdir -p /app/.apt/etc/freetds
echo "[global]
tds version = 7.4
" > /app/.apt/etc/freetds/freetds.conf

mkdir -p $ODBCSYSINI
cat > "$ODBCSYSINI/odbcinst.ini" << EOL
[FreeTDS]
Description = FreeTDS Driver
Driver = /app/.apt/usr/lib/x86_64-linux-gnu/odbc/libtdsodbc.so
Setup = /app/.apt/usr/lib/x86_64-linux-gnu/odbc/libtdsS.so
EOL

cat > "$ODBCINI" << EOL
[MSSQL]
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

# Debug: Print the values of the SSH-related variables
echo "SSH_TUNNEL_FORWARD: $SSH_TUNNEL_FORWARD"
echo "SSH_TUNNEL_PORT: $SSH_TUNNEL_PORT"
echo "SSH_TUNNEL_TARGET: $SSH_TUNNEL_TARGET"
echo "SSH_PRIVATE_KEY: $([ -n "$SSH_PRIVATE_KEY" ] && echo "Set" || echo "Not set")"

# Start the SSH tunnel in the background
ssh -f -N -L $SSH_TUNNEL_FORWARD -i /app/.ssh/id_rsa -o StrictHostKeyChecking=no -p $SSH_TUNNEL_PORT $SSH_TUNNEL_TARGET

echo "Tunnel setup successful."
echo "setup.sh script completed"
