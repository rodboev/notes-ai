#!/bin/bash
echo "Starting connect.sh"

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

# Function to verify SQL connection
verify_sql_connection() {
    local host=$1
    local port=$2
    local user=$3
    local pass=$4
    
    echo "Testing SQL connection to $host:$port..."
    
    # Test SQL connection directly without checking port
    if command -v sqlcmd &> /dev/null; then
        if sqlcmd -S "$host,$port" -U "$user" -P "$pass" -Q "SELECT @@VERSION" -t 5; then
            echo "✅ SQL Server connection successful"
            return 0
        else
            echo "❌ Could not connect to SQL Server"
            return 1
        fi
    else
        echo "⚠️ sqlcmd not found - please install SQL Server Command Line Tools"
        return 1
    fi
}

# Function to test connection
start_connection() {
    echo "Testing SQL connection..."
    
    echo "Connecting to SQL Server via tunnel at $SSH_TUNNEL_SERVER:$SSH_TUNNEL_PORT"
    
    # Try SQL connection
    if verify_sql_connection "$SSH_TUNNEL_SERVER" "$SSH_TUNNEL_PORT" "$SQL_USERNAME" "$SQL_PASSWORD"; then
        echo "✅ SQL connection successful"
        return 0
    else
        echo "❌ Could not connect to SQL Server"
        return 1
    fi
}

# Main script execution
if start_connection; then
    echo "Connection test successful"
    exit 0
else
    echo "Connection test failed"
    exit 1
fi

echo "Finished connect.sh script"
