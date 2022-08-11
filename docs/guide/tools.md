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
query = "UPDATE Cities SET Name =" + tools.EscapeSQLParam(name2) + ";"
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
   validatedRegistry, deferF, err := registry.Validate()
    if err != nil {
        panic(err)
    }
    defer deferF()
    engine := validatedRegistry.CreateEngine()
    
    for _, statistics := range tools.GetRedisStatistics(engine) {
        statistics.RedisPool // "default"
        statistics.Info["used_memory_startup"] // 7637663
        statistics.Info["redis_version"] // "6.2.4"
    }
}
```
Field `Info` holds values responded from redis
[INFO](https://redis.io/commands/info) command.

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
   validatedRegistry, deferF, err := registry.Validate()
    if err != nil {
        panic(err)
    }
    defer deferF()
    engine := validatedRegistry.CreateEngine()
    
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
