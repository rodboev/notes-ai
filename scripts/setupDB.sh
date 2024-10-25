#!/bin/bash
echo "Starting setupDB.sh script"

# Use %USERPROFILE% instead of ~ for Windows
USERPROFILE="${USERPROFILE//\\//}"

# ODBC and FreeTDS Setup
export ODBCSYSINI="$USERPROFILE/.apt/etc"
export ODBCINI="$USERPROFILE/.apt/etc/odbc.ini"
export FREETDSCONF="$USERPROFILE/.apt/etc/freetds/freetds.conf"
export LD_LIBRARY_PATH="$USERPROFILE/.apt/usr/lib/x86_64-linux-gnu:$USERPROFILE/.apt/usr/lib/x86_64-linux-gnu/odbc:$LD_LIBRARY_PATH"

mkdir -p "$USERPROFILE/.apt/etc/freetds"
echo "[global]
tds version = 7.4
" > "$USERPROFILE/.apt/etc/freetds/freetds.conf"

mkdir -p "$ODBCSYSINI"
cat > "$ODBCSYSINI/odbcinst.ini" << EOL
[FreeTDS]
Description = FreeTDS Driver
Driver = $USERPROFILE/.apt/usr/lib/x86_64-linux-gnu/odbc/libtdsodbc.so
Setup = $USERPROFILE/.apt/usr/lib/x86_64-linux-gnu/odbc/libtdsS.so
EOL

cat > "$ODBCINI" << EOL
[MSSQL]
Driver = FreeTDS
Server = 127.0.0.1
Port = 1433
Database = ${SQL_DATABASE}
EOL

# Add FreeTDS bin to PATH
export PATH="$PATH:$USERPROFILE/.apt/usr/bin"

# Check if folders and files exist
echo "Checking if required folders and files exist:"

folders_to_check=(
    "$USERPROFILE/.apt/etc/freetds"
    "$ODBCSYSINI"
)

files_to_check=(
    "$USERPROFILE/.apt/etc/freetds/freetds.conf"
    "$ODBCSYSINI/odbcinst.ini"
    "$ODBCINI"
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
    else
        echo "❌ File does not exist: $file"
    fi
done

echo "setupDB.sh script completed"
