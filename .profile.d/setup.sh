#!/bin/bash
echo "Starting setup.sh script"

# Determine the script's directory and project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

# Check for .env.local in the project root
ENV_FILE="$PROJECT_ROOT/.env.local"
if [ ! -f "$ENV_FILE" ]; then
    echo "Error: .env.local file not found in $PROJECT_ROOT"
    exit 1
fi

echo "Loading environment variables from $ENV_FILE"
set -a
source "$ENV_FILE"
set +a

# Debug: Print SSH-related environment variables
echo "SSH_TUNNEL_FORWARD: $SSH_TUNNEL_FORWARD"
echo "SSH_TUNNEL_PORT: $SSH_TUNNEL_PORT"
echo "SSH_TUNNEL_TARGET: $SSH_TUNNEL_TARGET"

# Check if required variables are set
if [ -z "$SSH_TUNNEL_FORWARD" ] || [ -z "$SSH_TUNNEL_PORT" ] || [ -z "$SSH_TUNNEL_TARGET" ]; then
    echo "Error: One or more required SSH tunnel variables are not set in .env.local"
    exit 1
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

echo "$PRIVATE_SSH_KEY" > ~/.ssh/id_rsa
chmod 600 ~/.ssh/id_rsa

# Function to start the SSH tunnel
start_tunnel() {
    echo "Starting SSH tunnel with: -L $SSH_TUNNEL_FORWARD"
    ssh -N -L "$SSH_TUNNEL_FORWARD" -i ~/.ssh/id_rsa -o StrictHostKeyChecking=no -p "$SSH_TUNNEL_PORT" "$SSH_TUNNEL_TARGET" &
    local tunnel_pid=$!
    echo $tunnel_pid > ~/ssh_tunnel.pid
    echo "Tunnel started. PID: $tunnel_pid"
    
    # Wait a moment to ensure the tunnel is established
    sleep 5
    
    # Check if the tunnel process is still running
    if kill -0 $tunnel_pid 2>/dev/null; then
        echo "Tunnel successfully established."
        return 0
    else
        echo "Failed to establish tunnel."
        return 1
    fi
}

# Function to restart the tunnel
restart_tunnel() {
    if [ -f ~/ssh_tunnel.pid ]; then
        kill $(cat ~/ssh_tunnel.pid) 2>/dev/null
    fi
    start_tunnel
}

# Start the initial tunnel
if start_tunnel; then
    echo "Initial tunnel setup completed. PID: $(cat ~/ssh_tunnel.pid)"
    
    # Start the tunnel restart mechanism in the background
    (
        while true; do
            sleep 300  # Sleep for 5 minutes (300 seconds)
            echo "Restarting SSH tunnel..."
            restart_tunnel
        done
    ) &
    
    # Save the PID of the background process
    echo $! > ~/tunnel_manager.pid
    echo "Tunnel restart mechanism initiated in background. Manager PID: $(cat ~/tunnel_manager.pid)"
else
    echo "Failed to set up initial tunnel. Exiting."
    exit 1
fi

echo "setup.sh script completed"
