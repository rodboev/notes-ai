#!/bin/bash
echo "Starting setup.sh script"

# Load environment variables from .env.local file
if [ -f .env.local ]; then
    export $(grep -v '^#' .env.local | xargs)
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

# Function to start the SSH tunnel
start_tunnel() {
    ssh -N -L $SSH_TUNNEL_FORWARD -i /app/.ssh/id_rsa -o StrictHostKeyChecking=no -p $SSH_TUNNEL_PORT $SSH_TUNNEL_TARGET &
    echo $! > /app/ssh_tunnel.pid
    echo "Tunnel started. PID: $(cat /app/ssh_tunnel.pid)"
}

# Function to restart the tunnel
restart_tunnel() {
    if [ -f /app/ssh_tunnel.pid ]; then
        kill $(cat /app/ssh_tunnel.pid) 2>/dev/null
    fi
    start_tunnel
}

# Start the initial tunnel and the restart mechanism in the background
(
    start_tunnel
    while true; do
        sleep 300  # Sleep for 5 minutes (300 seconds)
        echo "Restarting SSH tunnel..."
        restart_tunnel
    done
) &

# Save the PID of the background process
echo $! > /app/tunnel_manager.pid

echo "Tunnel setup initiated in background. Manager PID: $(cat /app/tunnel_manager.pid)"
echo "setup.sh script completed"
