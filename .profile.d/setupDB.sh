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

# ODBC and FreeTDS Setup
export ODBCSYSINI=~/.apt/etc
export ODBCINI=~/.apt/etc/odbc.ini
export FREETDSCONF=~/.apt/etc/freetds/freetds.conf
export LD_LIBRARY_PATH=~/.apt/usr/lib/x86_64-linux-gnu:~/.apt/usr/lib/x86_64-linux-gnu/odbc:$LD_LIBRARY_PATH

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