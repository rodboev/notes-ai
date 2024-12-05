#!/bin/bash
echo "Starting setupDB.sh script"

# Determine the script's directory and project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Function to convert \n to newlines and remove surrounding quotes
convert_newlines_and_remove_quotes() {
    local value="$1"
    value="${value%\"}"
    value="${value#\"}"
    echo -e "${value//\\n/\\n}"
}

# Function to load variables from a file
load_env_file() {
    local file="$1"
    echo "Loading environment variables from $file"
    while IFS= read -r line || [[ -n "$line" ]]; do
        # Skip comments and empty lines
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

# Load environment variables
ENV_FILE="$PROJECT_ROOT/.env"
ENV_LOCAL_FILE="$PROJECT_ROOT/.env.local"

[ -f "$ENV_FILE" ] && load_env_file "$ENV_FILE"
[ -f "$ENV_LOCAL_FILE" ] && load_env_file "$ENV_LOCAL_FILE"

# Print connection details (without password)
echo "Connection details:"
echo "Server: 70.19.53.6"
echo "Port: 1022"
echo "Database: $SQL_DATABASE"
echo "Username: $SQL_USERNAME"

# Test connection using sqlcmd with more verbose output
if command -v sqlcmd &> /dev/null; then
    echo "Testing SQL connection..."
    
    # Create a temporary file for the query output
    TEMP_OUTPUT=$(mktemp)
    
    # Try the connection with full output
    if sqlcmd -S "70.19.53.6,1022" -U "${SQL_USERNAME}" -P "${SQL_PASSWORD}" -Q "SELECT @@VERSION" -t 30 2>&1 | tee "$TEMP_OUTPUT"; then
        echo "✅ SQL Server connection test successful"
        rm "$TEMP_OUTPUT"
    else
        echo "❌ SQL Server connection test failed"
        echo "Error output:"
        cat "$TEMP_OUTPUT"
        rm "$TEMP_OUTPUT"
        
        # Try telnet to test basic connectivity
        echo "Testing basic connectivity with telnet..."
        if command -v telnet &> /dev/null; then
            timeout 5 telnet 70.19.53.6 1022
        else
            echo "telnet not available for testing"
        fi
    fi
else
    echo "⚠️ sqlcmd not found - please install SQL Server Command Line Tools"
    exit 1
fi

echo "setupDB.sh script completed"
