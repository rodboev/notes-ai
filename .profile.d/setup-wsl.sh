#!/bin/bash

# set -e  # Exit immediately if a command exits with a non-zero status
# set -x  # Print commands and their arguments as they are executed

echo "Starting setup-wsl.sh script"

# Set up directories in the user's home directory
export CONFIG_DIR="$HOME/.liberty_config"
mkdir -p "$CONFIG_DIR/etc/freetds"
mkdir -p "$CONFIG_DIR/ssh"

# ODBC and FreeTDS Setup
export ODBCSYSINI="$CONFIG_DIR/etc"
export ODBCINI="$CONFIG_DIR/etc/odbc.ini"
export FREETDSCONF="$CONFIG_DIR/etc/freetds/freetds.conf"
export LD_LIBRARY_PATH="/usr/lib/x86_64-linux-gnu:/usr/lib/x86_64-linux-gnu/odbc:$LD_LIBRARY_PATH"

echo "[global]
tds version = 7.4
" > "$FREETDSCONF"

cat > "$ODBCSYSINI/odbcinst.ini" << EOL
[FreeTDS]
Description = FreeTDS Driver
Driver = /usr/lib/x86_64-linux-gnu/odbc/libtdsodbc.so
Setup = /usr/lib/x86_64-linux-gnu/odbc/libtdsS.so
EOL

cat > "$ODBCINI" << EOL
[MSSQL]
Driver = FreeTDS
Server = 127.0.0.1
Port = 1433
Database = ${SQL_DATABASE}
EOL

# SSH Tunnel Setup
echo "Setting up SSH tunnel..."
chmod 700 "$CONFIG_DIR/ssh"

# Check if required variables are set
if [ -z "$SSH_TUNNEL_FORWARD" ] || [ -z "$SSH_TUNNEL_PORT" ] || [ -z "$SSH_TUNNEL_TARGET" ] || [ -z "$SSH_PRIVATE_KEY" ]; then
    echo "Error: One or more required SSH variables are not set."
    echo "SSH_TUNNEL_FORWARD: $SSH_TUNNEL_FORWARD"
    echo "SSH_TUNNEL_PORT: $SSH_TUNNEL_PORT"
    echo "SSH_TUNNEL_TARGET: $SSH_TUNNEL_TARGET"
    echo "SSH_PRIVATE_KEY: $([ -n "$SSH_PRIVATE_KEY" ] && echo "Set" || echo "Not set")"
    exit 1
fi

echo "$SSH_PRIVATE_KEY" > "$CONFIG_DIR/ssh/id_rsa"
chmod 600 "$CONFIG_DIR/ssh/id_rsa"

# Debug: Print the values of the SSH-related variables
echo "SSH_TUNNEL_FORWARD: $SSH_TUNNEL_FORWARD"
echo "SSH_TUNNEL_PORT: $SSH_TUNNEL_PORT"
echo "SSH_TUNNEL_TARGET: $SSH_TUNNEL_TARGET"
echo "SSH_PRIVATE_KEY: $([ -n "$SSH_PRIVATE_KEY" ] && echo "Set" || echo "Not set")"

# Start the SSH tunnel in the background
ssh -f -N -L "$SSH_TUNNEL_FORWARD" -i "$CONFIG_DIR/ssh/id_rsa" -o StrictHostKeyChecking=no -p "$SSH_TUNNEL_PORT" "$SSH_TUNNEL_TARGET"

echo "Tunnel setup successful."
echo "setup-wsl.sh script completed"
