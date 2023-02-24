---
title: Docker dbt In Dockerized-Airflow
author: Spencer Raisanen
datetime: 2023-02-23T15:42:51Z
slug: airflow-simple-docker-operator
featured: true
draft: false
tags:
  - Airflow
  - Docker
  - Docker Operator
  - dbt
description:
  "Use Docker Operator for dbt Inside of Dockerized Airflow"
---

> Run dbt in a Docker Container from within a Airflow instance running in Docker.

Docker Containers are powerful because they allow the developer to ensure that
the required components for the use purpose is met in a manner that is
OS-agnostic. This naturally guides a developer towards a software architecture
consisting of microservices that can be switched out relatively easily. One
could easily build Docker Containers that actually contain the DAG code and
then truly just rely on Airflow for orchestration and tracking of runs. In this
post a demonstration of how to run a Transform tool, dbt, inside of Docker will
be shown.


## Table of Contents

## Intro
Using the docker compose set up in [this post](/posts/airflow-simple-batch-sql)
, the network will be expanded to include a proxy that allows for an externally
built docker container to communicate with the docker compose network. The 
external docker container will be a python container that contains all the 
packages needed to run dbt on the data warehouse, PostgreSQL, for this project.
The necessary dbt configuration and files will be linked to the proxy. Airflow 
will run the cli commands via the Docker Operator.

## Why dbt 
While dbt is certainly overkill for this sample project, it does lend itself to
easy formatting of data warehouses and, with a bit of planning, specified data
as a single source of truth. dbt stands for data build tool and concerns
itself solely with the transformation end of the ELT data engineering process
wherein data is transformed at the data warehouse level. It allows for
templating, testing, version control, CI/CD, and easy documentation creation.
How to use dbt itself won't be covered in this post, but some basic examples
will be shown.

## Adding the Proxy
The proxy we will be using is a tool called socat, which is described as "a relay 
for bidirectional data transfers between two independent data channels" by [Red Hat](https://www.redhat.com/sysadmin/getting-started-socat).
This is exactly what is needed as the command must pass to the container which
contains the packages for running dbt and the commands from dbt concerning data
transformation must pass to the data warehouse. The volumes used are the
folders that contain the Docker daemon as well as those that the dbt project
relies upon. Note that there is no direct connection to the dbt container made
here. The proxy is added to the docker compose file as shown here.
```yaml
  docker-proxy:
    image: alpine/socat
    command: "TCP4-LISTEN:2375,fork,reuseaddr UNIX-CONNECT:/var/run/docker.sock"
    ports:
      - "2376:2375"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - /home/spencer/dbt/dbt_blog_ex:/home/spencer/dbt/dbt_blog_ex
      - /home/spencer/.dbt:/home/spencer/.dbt
    depends_on:
      - postgres
    links:
      - postgres
```
Note that one needs to add 'apache-airflow-providers-docker' to the pip requirements
for the Airflow instance. That can be added via the .env file as well as the docker 
compose file.

## dbt Init 
Setting up dbt is pretty simple, once the proper version of dbt for your warehouse
has been installed on your machine, a simple 'dbt init' will create a dbt project.
One can set up their profile config, located in '~/.dbt' most likely, with 
the necessary configuration for their data warehouse. However, the host should
be 'host.docker.internal' if the connection is being made to a data warehouse 
inside the docker compose file.

## dbt Container 
The created container can be a simple copy of the dbt team's [shared container](https://github.com/dbt-labs/dbt-core/blob/main/docker/Dockerfile).
The README contains clear instructions on how to build the Dockerfile.

## Airflow 

Within Airflow a typical DAG workflow can be followed with the usage of the 
DockerOperator. Nothing unusual happens in the DAG, but the container name must 
be specified and all necessary files are mounted. The command argument is where 
the bash command to run dbt is input.

```python
import datetime as dt
from airflow import DAG
from airflow.operators.docker_operator import DockerOperator
from docker.types import Mount

default_args = {
    "owner": 'airflow',
    "depends_on_past": False,
    "email": ["example@simple-dbt.com"],
    "email_on_failure": False,
    "email_on_retry": False,
    "retries": 1,
    "retry_delay": dt.timedelta(seconds=1),
    'execution_timeout': dt.timedelta(seconds=60)
}

with DAG(
    'docker_operator_demo',
    default_args=default_args,
    description="DockerOperator to run dbt",
    schedule=dt.timedelta(minutes=5),
    start_date=dt.datetime(2023, 1, 1),
    catchup=False,
    tags=["dbt"],
) as dag:

    dbt_run = DockerOperator(
        task_id='docker_command_dbt_run',
        image='dbt_docker',
        container_name='dbt_run',
        api_version='auto',
        auto_remove=True,
        command="bash -c 'dbt run'",
        docker_url="tcp://docker-proxy:2375",
        network_mode="bridge",
        mounts=[Mount(
            source="/home/spencer/dbt/dbt_blog_ex", target="/usr/app", type="bind"),
            Mount(
            source="/home/spencer/.dbt", target="/root/.dbt", type="bind")],
        mount_tmp_dir=False
    )

    dbt_run
```
## Conclusion
An easy way to run Docker within Docker has been demonstrated. One can copy in 
all the relevant files they need into the proxy and then mount the files inside 
their relevant Docker Containers and further remove overarching project requirements 
from single DAGS. In fact this is how Kubernetes and Airflow tend to work together.
However, this setup requires less DevOps work to get to the experimentation phase
as Kubernetes setup can be quite complex.


Code for this example can be found [here](https://github.com/spencerrais/blog_examples/tree/main/airflow-simple-dbt).

Ideas for the proxy came via this [external blog](https://medium.com/@tdonizeti/how-to-run-dbt-core-from-an-airflow-pipeline-using-the-dockeroperator-e48cf215e9f6)
