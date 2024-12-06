#!/bin/bash
echo "Starting setupDB.sh script"

# Determine if we're on Windows or Linux
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    IS_WINDOWS=true
    CONFIG_DIR="$USERPROFILE/freetds"
    DRIVER_PATH="C:/Windows/System32/libsybdb-5.dll"
else
    IS_WINDOWS=false
    CONFIG_DIR="/app/.apt/etc"
    DRIVER_PATH="/app/.apt/usr/lib/x86_64-linux-gnu/odbc/libtdsodbc.so"
fi

# Create config directories
mkdir -p "$CONFIG_DIR/freetds"

# Create freetds.conf
cat > "$CONFIG_DIR/freetds/freetds.conf" << EOL
[global]
        tds version = 7.4
        client charset = UTF-8
        text size = 64512

[PestPac]
        host = 70.19.53.6
        port = 1022
        tds version = 7.4
        database = ${SQL_DATABASE}
EOL

# Create odbcinst.ini
cat > "$CONFIG_DIR/odbcinst.ini" << EOL
[FreeTDS]
Description = FreeTDS Driver
Driver = ${DRIVER_PATH}
Setup = ${DRIVER_PATH}
UsageCount = 1
EOL

# Create odbc.ini
cat > "$CONFIG_DIR/odbc.ini" << EOL
[ODBC Data Sources]
PestPac6681=FreeTDS

[PestPac6681]
Driver = FreeTDS
Description = PestPac SQL Connection
Servername = 70.19.53.6
Port = 1022
Database = ${SQL_DATABASE}
TDS_Version = 7.4
EOL

# Set environment variables
if [ "$IS_WINDOWS" = true ]; then
    export ODBCINI="$CONFIG_DIR/odbc.ini"
    export ODBCINSTINI="$CONFIG_DIR/odbcinst.ini"
    export FREETDSCONF="$CONFIG_DIR/freetds/freetds.conf"
else
    export ODBCSYSINI="$CONFIG_DIR"
    export ODBCINI="$CONFIG_DIR/odbc.ini"
    export FREETDSCONF="$CONFIG_DIR/freetds/freetds.conf"
    export LD_LIBRARY_PATH="/app/.apt/usr/lib/x86_64-linux-gnu:/app/.apt/usr/lib/x86_64-linux-gnu/odbc:$LD_LIBRARY_PATH"
fi

# Check if folders and files exist
echo "Checking if required folders and files exist:"

folders_to_check=(
    "$CONFIG_DIR/freetds"
)

files_to_check=(
    "$CONFIG_DIR/freetds/freetds.conf"
    "$CONFIG_DIR/odbcinst.ini"
    "$CONFIG_DIR/odbc.ini"
)

for folder in "${folders_to_check[@]}"; do
    if [ -d "$folder" ]; then
        echo "✅ Folder exists: $folder"
    else
        echo "❌ Folder does not exist: $folder"
    fi
done

for file in "${files_to_check[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ File exists: $file"
        echo "Contents of $file:"
        cat "$file"
        echo "-------------------"
    else
        echo "❌ File does not exist: $file"
    fi
done

# Test SQL connection
if command -v sqlcmd &> /dev/null; then
    echo "Testing SQL connection with sqlcmd..."
    sqlcmd -S "70.19.53.6,1022" -U "${SQL_USERNAME}" -P "${SQL_PASSWORD}" -d "${SQL_DATABASE}" \
        -Q "SELECT TOP 5 * FROM Notes ORDER BY NoteDate DESC"
fi

echo "setupDB.sh script completed"