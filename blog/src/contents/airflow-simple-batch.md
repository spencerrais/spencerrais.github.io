---
title: Simple Batch Data Pipeline in Airflow 
author: Spencer Raisanen
datetime: 2023-02-01T15:42:51Z
slug: airflow-simple-batch
featured: false
draft: false
tags:
  - Airflow
  - Data Pipeline
  - Batch 
description:
  "Get started with Airflow in Docker for local development."
---

> Create a simple batch data pipeline in Airflow

## Table of Contents

## Intro
Using the docker compose we set up in [this post](/posts/docker-airflow-local) 
for non-production local development we can start experimenting with Airflow.
The best way to get started is to simply experiment with some things after 
reading some of the 
[documentation](https://airflow.apache.org/docs/apache-airflow/stable/tutorial/index.html)
and having a basic grasp of how things work.

## Basic Ideas
When working in Airflow it is easiest for debugging purposes to compartmentalize
the tasks that are being run. Inside a common data pipeline we generally have 
just a few possible components:
- Extract: Pull the data from a source such as an API, database, file, etc.
- Transform: Manipulate the data as desired
- Load: Push the data downstream

Something important to note is that it is not recommended to pass much data between 
tasks in production without doing additional configuration. The additional
configuration involves adding
in a custom XCOM, the Airflow component used to pass data between tasks, or using 
intermediary storage. Intermediary storage would change this task to be more like 
an ELT task than an ETL task.
For the purposes of this demonstration we will be using
the default XCOM to pass data between our tasks as it is a small amount of data
and we are mostly looking to gain an understanding of how Airflow works.

## DAG overview
For this dag we will perform the following tasks:
- Extract: pull data from an API 
- Transform: sort the data by a field
- Load: push the data to a file

## Initialization
First, create a folder called output and add the following volume to your docker compose 
configuration file where the 'dags', 'logs' and 'plugins' volumes are created.
```yaml
    - ${AIRFLOW_PROJ_DIR:-.}/output:/opt/airflow/output
```
Also create a file that will hold the DAG inside 
the dags folder, I'll call mine 'simple_batch.py'.
Once that is done we can get started with creating the DAG and the relevant tasks.

## Creating a DAG 
Creating a DAG is the same thing as writing Python, so there shouldn't be anything 
too unfamiliar, besides the Airflow library, with the process. In an ideal 
environment one would write general python functions that can be imported and used
with *args and **kwargs so that these functions can be thoroughly vetted and optimized, but 
for introductory purposes we will put these general functions directly inside
of our dag file.

### Imports and File Setup
Given that we want to output to a file we will need to define where the file 
lives so that we can write to it. The path comes from the volume we mounted for 
our output folder. Inside this DAG only a few Airflow functions 
are needed, along with datetime and requests for calling an API in our Extract phase.

```python
from airflow import DAG
from airflow.operators.python_operator import PythonOperator
import datetime as dt
import requests

filename = '/opt/airflow/output/output.txt'
```
### Python Functions 
Following the initial declaration we will define our initial functions with an 
input of 'ti' which stands for task instance and allows us to push and pull from
the XCOMs being utilized.

```python
def extract_py(ti):
    """
    Call an API
    Turn the response into a JSON object and select all items under the 'data' name
    Push the list that results to the extract XCOM
    """
    data = requests.get('https://api.coincap.io/v2/assets').json()['data']
    ti.xcom_push(key='extract', value=data)


def transform_py(ti):
    """
    Pull the data from the extract XCOM 
    sort the list of dicts by the 'changePercent24Hr' field descending
    Push the list that results to the transform XCOM
    """
    data = ti.xcom_pull(key='extract', task_ids='extract')
    for item in data:
        item['changePercent24Hr'] = float(item['changePercent24Hr'])
    data_sorted = sorted(
        data, key=lambda x: x['changePercent24Hr'], reverse=True)
    ti.xcom_push(key='transform', value=data_sorted)


def load_py(ti, **kwargs):
    """
    Receive our filename from **kwargs
    Pull the data from the transform XCOM 
    Write the data, along with an execution_timestamp to the file
    """
    filename = kwargs['filename']
    data_sorted = ti.xcom_pull(key='transform', task_ids='transform')
    execution_timestamp = dt.datetime.now()
    with open(filename, 'a') as f:
        f.write(f"{data_sorted}\nrun: {execution_timestamp}\n")
```
### DAG Creation
Next we want to define the default arguments we will use for our DAG. There 
are many different options to select from, and I have only selected a few
that are relevant to our purposes.
```python
default_args = {
    "depends_on_past": False,
    "email": ["example@simple-batch.com"],
    "email_on_failure": False,
    "email_on_retry": False,
    "retries": 1,
    "retry_delay": dt.timedelta(seconds=1),
    'execution_timeout': dt.timedelta(seconds=30)
    # 'queue': 'bash_queue',
    # 'pool': 'backfill',
    # 'priority_weight': 10,
    # 'end_date': datetime(2016, 1, 1),
    # 'wait_for_downstream': False,
    # 'sla': timedelta(hours=2),
    # 'on_failure_callback': some_function,
    # 'on_success_callback': some_other_function,
    # 'on_retry_callback': another_function,
    # 'sla_miss_callback': yet_another_function,
    # 'trigger_rule': 'all_success'
}
```
Finally, we start to define our DAG and the tasks which it will involve.
As the tasks are all python functions they will all utilize the PythonOperator.
```python
with DAG(
    "simple-batch",
    default_args=default_args,
    description="Simple Batch ETL data pipeline",
    schedule=dt.timedelta(minutes=1),
    start_date=dt.datetime(2023, 1, 1),
    catchup=False,
    tags=["batch", "simple"],
) as dag:

    extract = PythonOperator(
        task_id='extract',
        python_callable=extract_py
    )

    transform = PythonOperator(
        task_id='transform',
        python_callable=transform_py
    )

    load = PythonOperator(
        task_id='load',
        python_callable=load_py,
        op_kwargs={'filename': filename}
    )
```
Finally we define the order in which the tasks are to be completed. 
This DAG has a direct flow where each task will wait until the previous is completed.
```python
    extract >> transform >> load
```
When we run this DAG we should see the 'output.txt' getting populated in our local
folder! There it is. A simple batch ETL pipeline in a local development version
of Airflow set up in Docker! 
## Note
Note that we don't actually need to use PythonOperators.
As a matter of fact, everything we completed could have been done using Airflow's 
BashOperators which enable us to set bash commands to run.
Like everything in programming there is no single correct way to
go about things, but leaving it in Python is probably the best way in which others
can easily come up to speed.

Code for this example can be found [here](https://github.com/spencerrais/blog_examples/tree/main/batch-data-pipeline-with-airflow).
