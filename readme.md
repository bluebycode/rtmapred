# MapRed: collector phase

Requirements:

  - Redis

  ```
    $ nohup ./redis-server redis.conf 2>&1 > redis.log &
    $ tail -f redis.log

   |    `-._`-._        _.-'_.-'    |           http://redis.io
    `-._    `-._`-.__.-'_.-'    _.-'
   |`-._`-._    `-.__.-'    _.-'_.-'|
   |    `-._`-._        _.-'_.-'    |
    `-._    `-._`-.__.-'_.-'    _.-'
        `-._    `-.__.-'    _.-'
            `-._        _.-'
                `-.__.-'

  [21222] 18 Feb 10:31:51.651 # Server started, Redis version 2.8.8
  [21222] 18 Feb 10:32:25.770 * DB loaded from disk: 34.119 seconds
  [21222] 18 Feb 10:32:25.771 * The server is now ready to accept connections on port 6379

  $ redis
  $ 127.0.0.1:6379> MONITOR
  OK
  ```

Running all nodes of system on standalone mode (/src)

```
$ node feeder.js standalone 3
$ start
$ rps 100
```

```
$ node picker.js standalone
$ start
```

```
tail -f src/logs/*.log

==> logs/stream2.log <==
{"k":"1424941025976,ch2","v":"user=34272|token=b7a2307c78e24105577aae20646ced2fadd22e4d9c739fc07c8f99806d2244890185824ed2020b29f803ab250c50a5aac51242b6bf208437109f0534abfe11b9"}
{"k":"1424941026002,ch2","v":"user=82423|token=63455469e005f8d928f206518c6ca811dc9d166b00d529d9fad0f01d4b3761e47e3cd1d60365a749207101e3a0b16d3d24074454faf9da627ecfceb47cbbca2d"}
{"k":"1424941025842,ch1","v":"user=56609|token=6eccb901a30816c5503710c93ed419936fb4e4f460f80325e61a34574501af231f63432d20be16e24259096b644c5d316437e1dd8b35eb385253e4ffc84527d3"}
...
```



Modules, how to run them:


  - Generator of random events (feeder)

  Run the events' simulation which will generate random event, wrapping few of them on a batch

  ( LPUSH(ch) x m ) + PUB(ch) where m: event's batch size, ch: events' channel

  ```
  $ src> node feeder.js standalone <events-per-seconds>
  ```

  i.e

  ```
  $ node client.js standalone 20

  second: 0, req/sq: 0, average: 0 - 1 (0)
  second: 24, req/sq: 9, average: 9 - 2 (4.5)
  second: 25, req/sq: 18, average: 27 - 3 (9)
  second: 26, req/sq: 16, average: 43 - 4 (10.75)
  second: 27, req/sq: 24, average: 67 - 5 (13.4)
  ttl raised? : 3503 3500  or limit?:  71 1000
  release with 71
  second: 28, req/sq: 17, average: 84 - 6 (14)
  second: 29, req/sq: 23, average: 107 - 7 (15.285714285714286)
  ```
  * Embedded console

    | command     | description                  |
    | ------------|------------------------------|
    | start       | starts the node              |
    | rps <n>     | change phrequency of events  |
    | ------------|------------------------------|

  * Questions:

  - when batch data is sent?

  ```ttl raised? : 3503 3500  or limit?:  71 1000``

  Meaning: Time to live raised 3.5>3 secs
           Limit of rows not raised 71 current rows < 1000


  Receiving on redis:

  ```
  1424254201.026403 [0 127.0.0.1:51383] "MULTI"
  1424254201.026463 [0 127.0.0.1:51383] "lpush" "channel2" "..."
  1424254201.026480 [0 127.0.0.1:51383] "lpush" "channel2" "..."
  1424254201.026496 [0 127.0.0.1:51383] "lpush" "channel1" "..."
  1424254201.026513 [0 127.0.0.1:51383] "lpush" "channel2" "..."
  1424254201.026529 [0 127.0.0.1:51383] "lpush" "channel2" "..."
  1424254201.026546 [0 127.0.0.1:51383] "lpush" "channel2" "..."
  1424254201.026562 [0 127.0.0.1:51383] "lpush" "channel1" "..."
  1424254201.026579 [0 127.0.0.1:51383] "lpush" "channel1" "..."
  1424254201.026708 [0 127.0.0.1:51383] "EXEC"
  1424254202.758485 [0 127.0.0.1:51386] "publish" "channel1" "ready"
  ```

  - Collector standalone (test version)

  0) [testing purpose] Random rows will be injected on redis source.

    multi ->  lpush("channel1" "test0"),
              lpush("channel2" "test1"),
              ...
              EXEC

  1) Subscription of topics by redis (PUB/SUB).
  2) On reception of publish event on one of topics, collector fetchs the available data on channel stack.
  3) Each stack range would be fragmented on p partitions (one per stream linked).
  4) [testing purpose] outputs streams configured are just few output[X].log files.

  ```
  tail -f output1.log
  ```

  ```
  node picker.js standalone


  $ [Thu, 26 Feb 2015 09:18:59 GMT]  Received message on #ch1
  [Thu, 26 Feb 2015 09:18:59 GMT]  channel ch1 received event!
  [Thu, 26 Feb 2015 09:18:59 GMT]  arrange: ch1 4
  [Thu, 26 Feb 2015 09:18:59 GMT]  Received message on #ch2
  [Thu, 26 Feb 2015 09:18:59 GMT]  channel ch2 received event!
  [Thu, 26 Feb 2015 09:18:59 GMT]  arrange: ch2 4
  [Thu, 26 Feb 2015 09:18:59 GMT]  [ ch1 ] received 11072 rows.
  [Thu, 26 Feb 2015 09:19:00 GMT]  [ ch2 ] received 11288 rows.
  [Thu, 26 Feb 2015 09:19:00 GMT]  index: 0 length: 2768
  [Thu, 26 Feb 2015 09:19:00 GMT]  index: 3 length: 2768
  [Thu, 26 Feb 2015 09:19:00 GMT]  index: 2 length: 2822
  [Thu, 26 Feb 2015 09:19:00 GMT]  index: 3 length: 2822
  [Thu, 26 Feb 2015 09:19:00 GMT]  index: 1 length: 2768

  ```

  From redis when bootstrapped:

  ```
  1424252110.319491 [0 127.0.0.1:50827] "MULTI"
  1424252110.320662 [0 127.0.0.1:50827] "lpush" "ch1" "test0"
  ...
  1424252110.321084 [0 127.0.0.1:50827] "EXEC"
  ```


  - Mappers -- in progress
  - Reducers -- in progress

