#!/bin/bash
echo "Starting setupTunnel.sh"

# Determine the script's directory and project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Check for .env and .env.local in the project root
ENV_FILE="$PROJECT_ROOT/.env"
ENV_LOCAL_FILE="$PROJECT_ROOT/.env.local"

# Function to convert \n to newlines and remove surrounding quotes
convert_newlines_and_remove_quotes() {
    local value="$1"
    value="${value%\"}"
    value="${value#\"}"
    echo -e "${value//\\n/\\n}"
}

# Function to load variables from a file - suppress successful exports
load_env_file() {
    local file="$1"
    echo "Loading environment variables from $file"
    while IFS= read -r line || [[ -n "$line" ]]; do
        # Skip comments, empty lines, and lines with only whitespace
        if [[ $line =~ ^#.*$ ]] || [[ -z "${line// }" ]]; then
            continue
        fi
        # Trim whitespace and check for malformed lines
        line=$(echo "$line" | xargs)
        if ! [[ $line =~ ^[A-Za-z_][A-Za-z0-9_]*=.*$ ]]; then
            echo "Warning: Malformed line in $file: $line"
            continue
        fi
        var_name="${line%%=*}"
        var_value="${line#*=}"
        export "$var_name"="$(convert_newlines_and_remove_quotes "$var_value")" 2>/dev/null
    done < "$file"
}

# Load variables from .env and .env.local if they exist
[ -f "$ENV_FILE" ] && load_env_file "$ENV_FILE"
[ -f "$ENV_LOCAL_FILE" ] && load_env_file "$ENV_LOCAL_FILE"

# If neither .env nor .env.local exist, use local environment variables
if [ ! -f "$ENV_FILE" ] && [ ! -f "$ENV_LOCAL_FILE" ]; then
    echo "No .env or .env.local files found. Using local environment variables."
    while IFS='=' read -r name value ; do
        [[ $name == *_* ]] && export "$name"="$(convert_newlines_and_remove_quotes "$value")"
    done < <(env)
fi

# Function to check if a variable is set and print its value
check_and_print_variable() {
    if [ -z "${!1}" ]; then
        echo "Warning: $1 is not set"
    elif [[ "$1" == *"KEY"* ]]; then
        echo "$1=${!1:0:10}..."
    else
        echo "$1=${!1}"
    fi
}

# SSH Tunnel Setup
echo "Setting up SSH tunnel..."

check_and_print_variable "SQL_PORT"
check_and_print_variable "SSH_TUNNEL_PORT"
check_and_print_variable "SSH_TUNNEL_TARGET"
check_and_print_variable "PRIVATE_SSH_KEY"

mkdir -p ~/.ssh && chmod 700 ~/.ssh

# Function to check if a port is in use
check_port() {
    local port=$1
    if [[ "$OSTYPE" == "msys"* || "$OSTYPE" == "cygwin"* ]]; then
        netstat -an | grep "LISTENING" | grep ":$port " > /dev/null
    else
        netstat -an | grep "LISTEN" | grep ":$port " > /dev/null
    fi
}

# Function to kill existing tunnels
kill_existing_tunnels() {
    echo "Checking for existing tunnels..."
    if [[ "$OSTYPE" == "msys"* || "$OSTYPE" == "cygwin"* ]]; then
        taskkill //F //FI "IMAGENAME eq ssh.exe" //FI "WINDOWTITLE eq SSH" 2>/dev/null || true
        for pid in $(netstat -ano | grep ":1022" | grep "LISTENING" | awk '{print $5}'); do
            taskkill //F //PID $pid 2>/dev/null || true
        done
    else
        pkill -f "ssh.*:1022" || true
    fi
}

# Function to verify SQL connection
verify_sql_connection() {
    local host=$1
    local port=$2
    local user=$3
    local pass=$4
    
    echo "Verifying SQL connection to $host:$port..."
    
    # Wait for port to be available
    local attempts=0
    while ! check_port $port && [ $attempts -lt 10 ]; do
        echo "Waiting for port $port to be available..."
        sleep 2
        ((attempts++))
    done
    
    if ! check_port $port; then
        echo "Port $port is not listening after waiting"
        return 1
    fi
    
    # Test SQL connection
    if command -v sqlcmd &> /dev/null; then
        if sqlcmd -S "$host,$port" -U "$user" -P "$pass" -Q "SELECT @@VERSION" -t 5 > /dev/null 2>&1; then
            echo "✅ SQL Server connection successful"
            return 0
        else
            echo "❌ Could not connect to SQL Server"
            return 1
        fi
    else
        echo "⚠️ sqlcmd not found - skipping SQL connection test"
        return 0
    fi
}

# Function to start the SQL connection
start_tunnel() {
    echo "Starting SQL connection..."
    kill_existing_tunnels
    
    echo "Connecting to SQL Server through tunnel at $SSH_TUNNEL_SERVER:$SSH_TUNNEL_PORT"
    
    # Verify SQL connection using environment variables
    if verify_sql_connection "$SSH_TUNNEL_SERVER" "$SSH_TUNNEL_PORT" "$SQL_USERNAME" "$SQL_PASSWORD"; then
        echo "✅ SQL connection successful through tunnel"
        return 0
    else
        echo "❌ Could not connect to SQL Server through tunnel"
        return 1
    fi
}

# Main script execution
(
    if start_tunnel; then
        while true; do
            sleep 300  # Check every 5 minutes
            echo "Checking tunnel status..."
            if ! check_port 1022; then
                echo "Tunnel appears down, restarting..."
                start_tunnel
            fi
        done
    else
        echo "❌ Initial tunnel setup failed"
        exit 1
    fi
) &

# Save the PID of the background process
echo $! > ~/tunnel_manager.pid
echo "Tunnel manager started. PID: $(cat ~/tunnel_manager.pid)"

echo "Finished setupTunnelWindows.sh script"
