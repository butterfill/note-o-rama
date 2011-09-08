#! /bin/bash

./push.sh

curl -X POST http://steve:newstar@localhost:5984/_replicator/    \
       -H 'Content-Type: application/json'                           \
       -d '{ "source":"nrama-production", "target": "http://steve:newstar@noteorama.iriscouch.com/nrama"}'
