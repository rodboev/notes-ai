#!/bin/bash

# Create odbcinst.ini
cat <<EOL > $HOME/.odbcinst.ini
[ODBC Drivers]
ODBC Driver 17 for SQL Server=Installed

[ODBC Driver 17 for SQL Server]
Description=Microsoft ODBC Driver 17 for SQL Server
Driver=/opt/microsoft/msodbcsql17/lib64/libmsodbcsql-17.7.so.2.1
EOL

# Create odbc.ini
cat <<EOL > $HOME/.odbc.ini
[DSN]
Description=My DSN
Driver=ODBC Driver 17 for SQL Server
Server=${SQL_SERVER},${SQL_PORT}
Database=${SQL_DATABASE}
Trace=No
EOL
