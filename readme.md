# steps

Requirements:

  - Redis

  ```
    $ nohup ./redis-server 2>&1 > redis.log &
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

Modules, how to run them:

  - Client simulator

  ```

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
  node collector.js standalone

  Wed, 18 Feb 2015 09:35:10 GMT [collector] setting channels: [ 'channel1', 'channel2' ]
  Wed, 18 Feb 2015 09:35:10 GMT [collector] setting outputs streams: [ 'output0.log', 'output1.log', 'output2.log', 'output3.log' ]
  Wed, 18 Feb 2015 09:35:10 GMT [collector] listening 9999
  channel1 test0
  channel1 test1

  ```

  From redis when bootstrapped:

  ```
  1424252110.319491 [0 127.0.0.1:50827] "MULTI"
  1424252110.320662 [0 127.0.0.1:50827] "lpush" "channel1" "test0"
  ...
  1424252110.321084 [0 127.0.0.1:50827] "EXEC"
  ```


  - Mappers (placeholders)

