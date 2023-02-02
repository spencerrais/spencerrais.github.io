---
title: Airflow in Docker for Local Development 
author: Spencer Raisanen
datetime: 2023-01-31T15:42:51Z
slug: docker-airflow-local
featured: true
draft: false
tags:
  - Airflow
  - Docker
description:
  "Get started with Airflow in Docker for local development."
---

> A quick intro to Airflow in Docker for non-production local development.

## Table of contents

## Intro

In this article I'll go through the steps of starting up a development version
of Airflow inside of Docker.

## Why Containerize 

First off, why would we want to containerize Docker? 

I think the most important reason is that we can gain familiarity with software
that has a plethora of configuration options for which we might not have all
the context to understand completely when starting out. One major bonus is that
we can gain this familiarity without needing to pollute up our filesystem. I
am sure most of us have had a frustrating experience or two with a polluted
filesystem due to us not being familiar enough with a piece of software we were
experimenting with.

## Airflow Components 

As the previous paragraph suggests, Airflow is not a simple piece of software
and has many different ways that it can be
[configured](https://airflow.apache.org/docs/apache-airflow/stable/configurations-ref.html)
and used. This will become apparent when one looks at the docker compose file
which is downloaded from Airflow.

Airflow does however only need a few components for it to work correctly for
development work and be useful. It will require an executor, a metadata
database, and a webserver to be explicitly marked out by us.

For local development and starting out both the 
[Airflow Team](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/executor/index.html#executor-types)
and I recommend utilizing the LocalExecutor for running Airflow. Unfortunately
for a lot of beginners, how to do this is not gathered very well in any
particular resource that I have found. That being said, I hope this will be
a good resource.

## Setting up Airflow in Docker

To begin, we will need to have Docker Engine and Docker Compose installed on our 
machines. Next we can create a directory, switch into it, and create three new 
directories titled 'dags', 'logs', and 'plugins'. Inside this directory we will
need to create a .env file which holds a user id and group id in the format
Airflow expects. We can create this with the following bash line.
```bash
echo -e "AIRFLOW_UID=$(id -u)\nAIRFLOW_GID=0" > .env
```

The next step involves downloading a provided docker compose file from Airflow
and modifying it so that we are ready for single machine development. The 
file we download via running the following.
```bash
curl -LfO 'https://airflow.apache.org/docs/apache-airflow/2.5.1/docker-compose.yaml'
```

This file looks rather intimidating when looking at it, but there are only a 
few things we need to do in order to get us to a place where we can effectively use 
Airflow locally via Docker.

1. Remove the unnecessary services in their entirety:
    - airflow-worker
    - airflow-triggerer
    - flower
    - redis
2. Change the 'AIRFLOW__CORE__EXECUTOR' to 'LocalExecutor'
3. Delete the 'redis' line and sub-line inside of 'x-airflow-common'
4. Delete the two environment variables in 'x-airflow-common' that mention celery
5. (optional) Set the load examples environment variable to 'false'

Once the docker compose file is completed we simply need to run a few commands
in order to start our local Airflow development instance.
```bash
docker compose build
```
```bash
docker compose up airflow-init
```
```bash
docker compose up -d
```
After these commands are run the Airflow webserver will be available at 
'localhost:8080' after the webserver is ready. This might take some time and 
it may appear that the webserver isn't working, but it will eventually.

Provided that nothing has changed in the docker compose file, the airflow webserver 
will be accessible via using 'airflow' for both user and password fields.

You should now have Airflow in Docker for local development!

To shut down the docker containers and remove the images and volumes you can simply use 
```bash
docker down -v --rmi all
```
