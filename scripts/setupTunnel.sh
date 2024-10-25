#!/bin/bash
echo "Starting setupTunnel.sh script"
set -e  # Exit immediately if a command exits with a non-zero status
# set -x  # Print commands and their arguments as they are executed

# Only run in local Windows environment
if [[ "$OSTYPE" != "msys"* && "$OSTYPE" != "cygwin"* && "$OSTYPE" != "win"* ]] && [[ -z "$WINDIR" ]]; then
    echo "Detected non-Windows environment. Skipping tunnel setup."
    exit 0
fi

# Detect the operating system
if [[ "$OSTYPE" == "msys"* || "$OSTYPE" == "cygwin"* || "$OSTYPE" == "win"* ]] || [[ -n "$WINDIR" ]]; then
    IS_WINDOWS=true
    echo "Detected Windows environment"
else
    IS_WINDOWS=false
    echo "Detected Unix environment"
fi

# Determine the script's directory and project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Check for .env and .env.local in the project root
ENV_FILE="$PROJECT_ROOT/.env"
ENV_LOCAL_FILE="$PROJECT_ROOT/.env.local"

# Function to convert \n to newlines and remove surrounding quotes
convert_newlines_and_remove_quotes() {
    local value="$1"
    # Remove surrounding quotes if present
    value="${value%\"}"
    value="${value#\"}"
    # Convert \n to newlines
    echo -e "${value//\\n/\\n}"
}

# Function to load variables from a file
load_env_file() {
    local file="$1"
    echo "Loading environment variables from $file"
    # Use a while loop to read the file line by line
    while IFS= read -r line || [[ -n "$line" ]]; do
        # Skip comments and empty lines
        if [[ $line =~ ^#.*$ ]] || [[ -z $line ]]; then
            continue
        fi
        # Extract variable name and value
        var_name="${line%%=*}"
        var_value="${line#*=}"
        # Convert \n to newlines, remove quotes, and export the variable
        export "$var_name"="$(convert_newlines_and_remove_quotes "$var_value")"
    done < "$file"
}

# Load variables from .env if it exists
if [ -f "$ENV_FILE" ]; then
    load_env_file "$ENV_FILE"
else
    echo "No .env file found."
fi

# Load variables from .env.local if it exists (overriding .env)
if [ -f "$ENV_LOCAL_FILE" ]; then
    load_env_file "$ENV_LOCAL_FILE"
else
    echo "No .env.local file found."
fi

# If neither .env nor .env.local exist, use local environment variables
if [ ! -f "$ENV_FILE" ] && [ ! -f "$ENV_LOCAL_FILE" ]; then
    echo "No .env or .env.local files found. Using local environment variables."
    # Convert \n to newlines and remove quotes for all existing environment variables
    while IFS='=' read -r name value ; do
        if [[ $name == *_* ]]; then  # Only process variables with underscores (to avoid system vars)
            export "$name"="$(convert_newlines_and_remove_quotes "$value")"
        fi
    done < <(env)
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

# SSH Tunnel Setup
echo "Setting up SSH tunnel..."

check_and_print_variable "SSH_TUNNEL_FORWARD"
check_and_print_variable "SSH_TUNNEL_PORT"
check_and_print_variable "SSH_TUNNEL_TARGET"
check_and_print_variable "PRIVATE_SSH_KEY"

mkdir -p ~/.ssh
chmod 700 ~/.ssh

echo "$PRIVATE_SSH_KEY" > ~/.ssh/id_rsa
chmod 600 ~/.ssh/id_rsa

# Print the contents of the private key (first few lines for security)
echo "First 3 lines of ~/.ssh/id_rsa:"
head -n 3 ~/.ssh/id_rsa

# Function to check if the tunnel is running
is_tunnel_running() {
    if [ -f ~/ssh_tunnel.pid ]; then
        local pid=$(cat ~/ssh_tunnel.pid)
        if $IS_WINDOWS; then
            tasklist //FI "PID eq $pid" //NH | findstr $pid > /dev/null && \
            netstat -ano | findstr :1433 | findstr LISTENING > /dev/null
        else
            ps -p $pid > /dev/null && lsof -i :1433 -t > /dev/null
        fi
        return $?
    else
        return 1
    fi
}

# Function to kill existing SSH tunnels on Windows
kill_existing_tunnels_windows() {
    echo "Killing existing tunnels..."
    port_1433_pids=($(netstat -ano | findstr :1433 | findstr LISTENING | awk '{print $NF}' | sort -u))
    for pid in "${port_1433_pids[@]}"; do
        taskkill //F //PID $pid > /dev/null 2>&1
    done

    ssh_pids=($(tasklist //FI "IMAGENAME eq ssh.exe" //FO CSV //NH | findstr /I "ssh.exe" | awk -F'","' '{print $2}' 2> /dev/null))
    for pid in "${ssh_pids[@]}"; do
        taskkill //F //PID $pid > /dev/null 2>&1
    done
    sleep 1
}

# Start tunnel for local development
start_local_tunnel() {
    kill_existing_tunnels_windows
    
    echo "Starting SSH tunnel..."
    ssh -N -L $SSH_TUNNEL_FORWARD -i ~/.ssh/id_rsa -o StrictHostKeyChecking=no -p $SSH_TUNNEL_PORT $SSH_TUNNEL_TARGET &
    TUNNEL_PID=$!
    echo $TUNNEL_PID > ~/ssh_tunnel.pid
    
    echo "Tunnel started with PID: $TUNNEL_PID"
    sleep 2
    
    if netstat -ano | findstr :1433 | findstr LISTENING > /dev/null; then
        echo "Tunnel successfully established"
        return 0
    else
        echo "Failed to establish tunnel"
        return 1
    fi
}

# Start the tunnel
start_local_tunnel

echo "Finished setupTunnel.sh script"
