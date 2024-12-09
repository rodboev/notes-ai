#!/bin/bash
echo "Starting testDB.sh script"

# Load environment variables
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Function to process environment file
process_env_file() {
    local env_file="$1"
    if [ -f "$env_file" ]; then
        echo "Loading $env_file..."
        while IFS= read -r line || [ -n "$line" ]; do
            # Skip comments and empty lines
            [[ $line =~ ^#.*$ ]] || [ -z "$line" ] && continue
            
            # Split into key and value
            key=$(echo "$line" | cut -d'=' -f1)
            value=$(echo "$line" | cut -d'=' -f2-)
            
            # Remove surrounding quotes if they exist
            value=$(echo "$value" | sed -E 's/^["\x27](.*)["\x27]$/\1/')
            
            # Convert \n to actual newlines for SSH keys
            if [[ $key == *"KEY"* ]]; then
                value=$(echo "$value" | sed 's/\\n/\n/g')
            fi
            
            # Export the processed variable
            export "$key=$value"
        done < "$env_file"
    fi
}

# Load .env and .env.local
process_env_file "$PROJECT_ROOT/.env"
process_env_file "$PROJECT_ROOT/.env.local"

# Debug: Print environment variables (password masked)
echo "Environment variables:"
echo "SSH_TUNNEL_SERVER: ${SSH_TUNNEL_SERVER:-'not set'}"
echo "SSH_TUNNEL_PORT: ${SSH_TUNNEL_PORT:-'not set'}"
echo "SQL_DATABASE: ${SQL_DATABASE:-'not set'}"
echo "SQL_USERNAME: ${SQL_USERNAME:-'not set'}"
echo "SQL_PASSWORD: ${SQL_PASSWORD:+'is set'}"

# Validate required environment variables
if [ -z "$SQL_DATABASE" ] || [ -z "$SQL_USERNAME" ] || [ -z "$SQL_PASSWORD" ]; then
    echo "❌ Error: Required environment variables are not set"
    echo "Please ensure SQL_DATABASE, SQL_USERNAME, and SQL_PASSWORD are set"
    exit 1
fi

# Test SQL connection if sqlcmd is available
if command -v sqlcmd &> /dev/null; then
    echo "Testing SQL connection with sqlcmd..."
    if sqlcmd -S "${SSH_TUNNEL_SERVER},${SSH_TUNNEL_PORT}" -U "${SQL_USERNAME}" -P "${SQL_PASSWORD}" -d "${SQL_DATABASE}" \
        -Q "SELECT TOP 1 * FROM Notes ORDER BY NoteDate DESC"; then
        echo "✅ SQL connection test successful"
    else
        echo "❌ SQL connection test failed"
        exit 1
    fi
else
    echo "⚠️ sqlcmd not found - skipping connection test"
fi

echo "testDB.sh script completed"