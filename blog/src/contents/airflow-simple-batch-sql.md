---
title: Push Data from Airflow to Postgres
author: Spencer Raisanen
datetime: 2023-02-20T18:16:37Z
slug: airflow-simple-batch-sql
featured: true
draft: false
tags:
  - Airflow
  - Data Pipeline
  - Batch 
  - SQL
description:
  "Get started with using Dockerized-Airflow and PostgreSQL"
---

> Create a simple batch data pipeline in Dockerized-Airflow that pushes to a Postgres database

This article describes how to run data pipelines through Airflow which push 
data downstream to whichever option we want to use to persist data. This
could be something such as PostgreSQL, MySQL, S3, Redshift, etc. In this case
we will be using PostgreSQL as it is the standard Open-Source RDBMS.

## Table of Contents

## Intro
Using the docker compose set up in [this post](/posts/airflow-simple-batch),
some slight adjustments can be made to push to a proper database. For example's
sake, lets add another database on top of the Postgres container which will
live separately from the Airflow database that Airflow uses. If this was
something one was looking to productionize it would be worth analyzing
how much concurrent activity is expected over all of the databases living on the
same Postgres instance. Since this example is simply experimenting with small amounts
of data and few readers and writers, concurrent usage is not a concern.

## Adjusting the Docker Compose
The output folder is no longer necessary, so comment out or delete
the line of our docker compose file where the output volume was created.
```yaml
    #- ${AIRFLOW_PROJ_DIR:-.}/output:/opt/airflow/output
```
Next, the new database can be created. One could wait until the
container is created and then utilize the psql cli tool, psycopg2, or some
other tool which allows the necessary SQL to run. Another way is to mount a bash
script which will run upon container creation and create the database, user,
and table for the data. The process is pretty simple; first create a folder
called 'sql', then place a 'initdb.sh' file inside with the script for creating
the database and table, and finally modify the docker compose file with a new
volume under the postgres container as follows.
```yaml
      - ./sql:/docker-entrypoint-initdb.d/
```
This setup also enables us to add additional SQL scripts as desired, but will
only be run once the PostgreSQL container is created. Additional scripts will 
have to be run in a different manner after the container has been initialized.

## New Database Initialization
Setting up the new database and necessary table is a simple manner for a 
bash script.

In the following script, the DATA_DB_* variables variables are defined by the
user, and the POSTGRES_* ones come from the container itself.
```bash
#!/bin/bash
set -e
export PGPASSWORD=$POSTGRES_PASSWORD;
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE USER $DATA_DB_USER WITH PASSWORD '$DATA_DB_PASS';
  CREATE DATABASE $DATA_DB_NAME;
  GRANT ALL PRIVILEGES ON DATABASE $DATA_DB_NAME TO $DATA_DB_USER;
  \connect $DATA_DB_NAME $DATA_DB_USER
  BEGIN;
    CREATE TABLE IF NOT EXISTS assets (
      id VARCHAR(50) NOT NULL,
      rank INT NOT NULL,
      symbol VARCHAR(5) NOT NULL,
      name VARCHAR(50) NOT NULL,
      supply FLOAT8 NOT NULL,
      max_supply FLOAT8, 
      market_cap_usd FLOAT8 NOT NULL,
      volume_usd_24hr FLOAT8 NOT NULL,
      price_usd FLOAT8 NOT NULL,
      change_pct_24hr FLOAT8 NOT NULL,
      vwap_24hr FLOAT8,
      explorer FLOAT8 NOT NULL,
      execution_ts TIMESTAMPTZ,
      PRIMARY KEY (execution_ts, id)
	);
  COMMIT;
EOSQL
```
It is generally a good ides to create a .env file which prevents accidental
leakage of sensitive data provided .env is not distributed.

## Airflow Connection to New Database
Connecting to a database can be done via the Airflow Webserver in a GUI
fashion, but can also be done via the docker compose file. This is done in the
section where the other databases are configured. 
```bash
    AIRFLOW_CONN_DATA_DB: ${AIRFLOW_CONN_DATA_DB}
```
The connection can be configured in the .env file.
```bash 
AIRFLOW_CONN_DATA_DB=postgresql+psycopg2://${DATA_DB_USER}:${DATA_DB_PASS}@postgres:${POSTGRES_LOCAL_PORT}/${DATA_DB_NAME}
```
Note that the connection is known inside of Airflow as 'data_db', and will not 
be broadcast inside of the GUI.

## DAG
The DAG to use for this task is almost identical to the one in the previous task,
with only the changing of the load task. The PostgresHook is used to connect
to the new database and psycopg2 is used for SQL execution. 
The executemany function is used due to the load task performing a bulk insert.

```python
from airflow.providers.postgres.hooks.postgres import PostgresHook
def load_py(ti, **kwargs):
    data_sorted = ti.xcom_pull(key='transform', task_ids='transform')
    hook = PostgresHook(postgres_conn_id='data_db')
    conn = hook.get_conn()
    cursor = conn.cursor()
    cols = ('id', 'rank', 'symbol', 'name', 'supply', 'max_supply', 'market_cap_usd',
            'volume_usd_24hr', 'price_usd', 'change_pct_24hr', 'vwap_24hr', 'explorer', 'execution_ts')
    vals = ','.join(['%s'] * len(cols))
    rows = [tuple(d.values()) for d in data_sorted]
    insert_query = f"INSERT INTO assets ({','.join(cols)}) VALUES ({vals})"
    cursor.executemany(insert_query, rows)
    conn.commit()
```

Code for this example can be found [here](https://github.com/spencerrais/blog_examples/tree/main/airflow-simple-batch-sql).
