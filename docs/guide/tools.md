# Tools

BeeORM provides `tools` library with many useful features:

```go
import "github.com/latolukasz/beeorm/tools"
```

## Escape SQL param

As described in [Executing modification queries](/guide/mysql_queries.html#executing-modification-queries)
section you may need to escape `string` parameters in your SQL multi-statement query. Tools library
provides `EscapeSQLParam` function that do exactly this:

```go{3-4}
import "github.com/latolukasz/beeorm/tools"

query := "UPDATE Cities SET Name =" + tools.EscapeSQLParam(name1) + ";"
query (= "UPDATE Cities SET Name =" + tools.EscapeSQLParam(name2) + ";"
engine.GetMysql().Exec(query)
```

## Redis server statistics

`GetRedisStatistics` function provides detailed statistics for every
registered redis server:

```go{18}
package main

import (
    "github.com/latolukasz/beeorm"
    "github.com/latolukasz/beeorm/tools"
)

func main() {
   registry := beeorm.NewRegistry()
   registry.RegisterRedis("localhost:6379", 0)
   validatedRegistry, deferF, err := registry.Validate(context.Background())
    if err != nil {
        panic(err)
    }
    defer deferF()
    engine := validatedRegistry.CreateEngine(context.Background())
    
    for _, statistics := range tools.GetRedisStatistics(engine) {
        statistics.RedisPool // "default"
        statistics.Info["used_memory_startup"] // 7637663
        statistics.Info["redis_version"] // "6.2.4"
    }
}
```
Field `Info` holds values responded from redis
[INFO](https://redis.io/commands/info) command.

## Redis streams statistics

`GetRedisStreamsStatistics` function provides detailed statistics for every
registered [redis stream](/guide/event_broker.html#registering-streams):

```go{19}
package main

import (
    "github.com/latolukasz/beeorm"
    "github.com/latolukasz/beeorm/tools"
)

func main() {
   registry := beeorm.NewRegistry()
   registry.RegisterRedis("localhost:6379", 0)
   registry.RegisterRedisStream("test-stream", "default", []string{"test-group"})
   validatedRegistry, deferF, err := registry.Validate(context.Background())
    if err != nil {
        panic(err)
    }
    defer deferF()
    engine := validatedRegistry.CreateEngine(context.Background())
    
    for _, statistics := range tools.GetRedisStreamsStatistics(engine) {
        statistics.Stream // "test-stream"
        statistics.RedisPool // "default"
        statistics.Len // 0
        for _, groupStatistics := range statistics.Groups {
            groupStatistics.Group // "test-group"
            groupStatistics.Pending // 0
        }
    }
}
```

`GetRedisStreamsStatistics` returns slice of `RedisStreamStatistics` that provides 
these fields:

 * `Stream` - stream name
 * `RedisPool` - redis data pool name
 * `Len` - channel length (how many events this stream holds)
 * `OldestEventSeconds` - time in seconds how long oldest event in stream
is waiting to be consumed by all connected consumer groups
 * `Groups` - slice with `RedisStreamGroupStatistics` that provides statistics
   for every consumer group. Provides these fields:
    * `Group` - name of consumer group
    * `Pending` - number of pending events in this consumer group
    * `LastDeliveredID` - id of last delivered event
    * `LastDeliveredDuration` - time (`time.Duration`) when last event was consumed 
    * `LowerID` - id of oldest event waiting to be consumed by this group
    * `LowerDuration` -  time (`time.Duration`) how long oldest event in stream
      is waiting to be consumed by this consumer groups
    * `SpeedEvents` - number of events consumed by this group today
    * `SpeedMilliseconds` - average time to consume one event today
    * `DBQueriesPerEvent` - average number of MySQL queries used to consume one event today
    * `DBQueriesMillisecondsPerEvent` - average time of MySQL queries used to consume one event today
    * `RedisQueriesPerEvent` - average number of redis queries used to consume one event today
    * `RedisQueriesMillisecondsPerEvent` - average time of redis queries used to consume one event today  
    * `SpeedHistory` - slice with `RedisStreamGroupSpeedStatistics` with max 7 rows. Each row contains `SpeedEvents`,
    `SpeedMilliseconds`,`DBQueriesPerEvent`,`DBQueriesMillisecondsPerEvent`,`RedisQueriesPerEvent`,
      `RedisQueriesMillisecondsPerEvent`. First row holds statistic from yesterday, second row from day before
      yesterday and so on. Long story short - this slice contains statistics from last 7 days so you can
      see how events are consumed over time.
    * `Consumers` - slice of `RedisStreamConsumerStatistics` that holds statistics for every active consumer
    running for this consumer group. Provides these fields:
      * `Name` - consumer name
      * `Pending` - number of pending events

## Redis search statistics

`GetRedisSearchStatistics` function provides detailed statistics for every
registered redis search index:

```go{19}
package main

import (
    "github.com/latolukasz/beeorm"
    "github.com/latolukasz/beeorm/tools"
)

func main() {
   registry := beeorm.NewRegistry()
   registry.RegisterRedis("localhost:6379", 0)
   registry.RegisterRedisSearchIndex(&orm.RedisSearchIndex{Name: "my-index", RedisPool: "default"})
   validatedRegistry, deferF, err := registry.Validate(context.Background())
    if err != nil {
        panic(err)
    }
    defer deferF()
    engine := validatedRegistry.CreateEngine(context.Background())
    
    for _, statistics := range tools.GetRedisSearchStatistics(engine) {
        statistics.Index.Name // "my-index"
        statistics.RedisPool // "default"
        for _, indexVersion := range statistics.Versions {
            indexVersion.Curret // true
            indexVersion.Info.NumRecords // 0
        }
    }
}
```

`GetRedisSearchStatistics` returns slice of `RedisSearchStatistics` that provides
these fields:

 * `Index` - redis search index definition (`bee.RedisSearchIndex`)
 * `Versions` - slice of `RedisSearchStatisticsIndexVersion` that provides 
statistics for each redis index version. Provides these fields:
   * `Current` - true, if this version is in use
   * `Info` - index version statistics returned from [FT.INFO](https://oss.redislabs.com/redisearch/Commands/#ftinfo)
    command
