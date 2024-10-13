#!/bin/bash
echo "Starting setup.sh script"

# Load environment variables from .env.local file
if [ -f .env.local ]; then
    export $(grep -v '^#' .env.local | xargs)
fi

# ODBC and FreeTDS Setup
export ODBCSYSINI=~/.apt/etc
export ODBCINI=~/.apt/etc/odbc.ini
export FREETDSCONF=~/.apt/etc/freetds/freetds.conf
export LD_LIBRARY_PATH=~/.apt/usr/lib/x86_64-linux-gnu:~/.apt/usr/lib/x86_64-linux-gnu/odbc:$LD_LIBRARY_PATH

mkdir -p ~/.apt/etc/freetds
echo "[global]
tds version = 7.4
" > ~/.apt/etc/freetds/freetds.conf

mkdir -p $ODBCSYSINI
cat > "$ODBCSYSINI/odbcinst.ini" << EOL
[FreeTDS]
Description = FreeTDS Driver
Driver = ~/.apt/usr/lib/x86_64-linux-gnu/odbc/libtdsodbc.so
Setup = ~/.apt/usr/lib/x86_64-linux-gnu/odbc/libtdsS.so
EOL

cat > "$ODBCINI" << EOL
[MSSQL]
Driver = FreeTDS
Server = 127.0.0.1
Port = 1433
Database = ${SQL_DATABASE}
EOL

# Add FreeTDS bin to PATH
export PATH=$PATH:~/.apt/usr/bin

# SSH Tunnel Setup
echo "Setting up SSH tunnel..."
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo "$SSH_PRIVATE_KEY" > ~/.ssh/id_rsa
chmod 600 ~/.ssh/id_rsa

# Function to start the SSH tunnel
start_tunnel() {
    ssh -N -L $SSH_TUNNEL_FORWARD -i ~/.ssh/id_rsa -o StrictHostKeyChecking=no -p $SSH_TUNNEL_PORT $SSH_TUNNEL_TARGET &
    echo $! > ~/ssh_tunnel.pid
    echo "Tunnel started. PID: $(cat ~/ssh_tunnel.pid)"
}

# Function to restart the tunnel
restart_tunnel() {
    if [ -f ~/ssh_tunnel.pid ]; then
        kill $(cat ~/ssh_tunnel.pid) 2>/dev/null
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
echo $! > ~/tunnel_manager.pid

echo "Tunnel setup initiated in background. Manager PID: $(cat ~/tunnel_manager.pid)"
echo "setup.sh script completed"
