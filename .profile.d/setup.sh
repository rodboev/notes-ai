#!/bin/bash
set -e  # Exit immediately if a command exits with a non-zero status
# set -x  # Print commands and their arguments as they are executed

echo "Starting setup.sh script"

# Determine the script's directory and project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Check for .env in the project root
ENV_FILE="$PROJECT_ROOT/.env"

# Function to convert \n to newlines
convert_newlines() {
    echo -e "${1//\\n/\\n}"
}

# Function to load variables from .env file
load_env_file() {
    echo "Loading environment variables from $ENV_FILE"
    # Use a while loop to read the file line by line
    while IFS= read -r line || [[ -n "$line" ]]; do
        # Skip comments and empty lines
        if [[ $line =~ ^#.*$ ]] || [[ -z $line ]]; then
            continue
        fi
        # Extract variable name and value
        var_name="${line%%=*}"
        var_value="${line#*=}"
        # Remove surrounding quotes if present
        var_value="${var_value%\"}"
        var_value="${var_value#\"}"
        # Convert \n to newlines and export the variable
        export "$var_name"="$(convert_newlines "$var_value")"
    done < "$ENV_FILE"
}

# Load variables from .env if it exists, otherwise use local environment
if [ -f "$ENV_FILE" ]; then
    load_env_file
else
    echo "No .env file found. Using local environment variables."
fi

# Function to check if a variable is set and print its value
check_and_print_variable() {
    if [ -z "${!1}" ]; then
        echo "Warning: $1 is not set"
    else
        if [[ "$1" == *"KEY"* ]]; then
            echo "$1=${!1:0:10}..."
        else
            echo "$1=${!1}"
        fi
    fi
}

# ODBC and FreeTDS Setup
export ODBCSYSINI=~/.apt/etc
export ODBCINI=~/.apt/etc/odbc.ini
export FREETDSCONF=~/.apt/etc/freetds/freetds.conf
export LD_LIBRARY_PATH=~/.apt/usr/lib/x86_64-linux-gnu:~/.apt/usr/lib/x86_64-linux-gnu/odbc:$LD_LIBRARY_PATH

# Check and print all required variables
echo "Checking and printing variables:"
check_and_print_variable "SSH_TUNNEL_FORWARD"
check_and_print_variable "SSH_TUNNEL_PORT"
check_and_print_variable "SSH_TUNNEL_TARGET"
check_and_print_variable "PRIVATE_SSH_KEY"
check_and_print_variable "SQL_DATABASE"
check_and_print_variable "ODBCSYSINI"
check_and_print_variable "ODBCINI"
check_and_print_variable "FREETDSCONF"
check_and_print_variable "LD_LIBRARY_PATH"

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

# Function to kill existing SSH tunnels
kill_existing_tunnels() {
    echo "Attempting to kill existing SSH tunnels..."
    pkill -f "ssh -N -L $SSH_TUNNEL_FORWARD"
    sleep 1  # Wait a bit for the processes to terminate
    
    # Check if port is still in use
    if lsof -i :1433 > /dev/null 2>&1; then
        echo "Port 1433 is still in use. Attempting to force close..."
        fuser -k 1433/tcp
        sleep 1
    fi
    
    # Double-check and forcefully kill any remaining processes
    if lsof -i :1433 > /dev/null 2>&1; then
        echo "Port 1433 is still in use. Forcefully terminating processes..."
        lsof -i :1433 | awk 'NR!=1 {print $2}' | xargs kill -9
        sleep 1
    fi
}

# Function to start the SSH tunnel
start_tunnel() {
    local attempt=1
    local max_attempts=3

    # Kill existing tunnels before the first attempt
    kill_existing_tunnels

    while [ $attempt -le $max_attempts ]; do
        echo "Attempt $attempt to start SSH tunnel..."
        
        # Start the SSH tunnel in the background and redirect output to a log file
        ssh -v -N -L $SSH_TUNNEL_FORWARD -i ~/.ssh/id_rsa -o StrictHostKeyChecking=no -p $SSH_TUNNEL_PORT $SSH_TUNNEL_TARGET > ~/ssh_tunnel.log 2>&1 &
        local tunnel_pid=$!
        echo $tunnel_pid > ~/ssh_tunnel.pid
        echo "Tunnel started. PID: $tunnel_pid"
        
        # Wait a moment to allow the tunnel to establish
        sleep 1
        
        # Check if the tunnel process is still running and port is in use
        if kill -0 $tunnel_pid 2>/dev/null && lsof -i :1433 > /dev/null 2>&1; then
            echo "Tunnel successfully established."
            echo "Tunnel log output:"
            tail -n 20 ~/ssh_tunnel.log
            return 0
        else
            echo "Failed to establish tunnel or bind to port."
            echo "Tunnel log output:"
            tail -n 20 ~/ssh_tunnel.log
            if [ $attempt -lt $max_attempts ]; then
                echo "Killing existing tunnels and retrying..."
                kill_existing_tunnels
            fi
        fi

        attempt=$((attempt+1))
    done

    echo "Failed to establish tunnel after $max_attempts attempts."
    return 1
}

# Function to restart the tunnel
restart_tunnel() {
    if [ -f ~/ssh_tunnel.pid ]; then
        kill $(cat ~/ssh_tunnel.pid) 2>/dev/null
    fi
    kill_existing_tunnels
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
