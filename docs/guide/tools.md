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

```go{17}
package main

import (
    "github.com/latolukasz/beeorm"
    "github.com/latolukasz/beeorm/tools"
)

func main() {
   registry := beeorm.NewRegistry()
   registry.RegisterRedis("localhost:6379", 0)
   validatedRegistry, err := registry.Validate()
    if err != nil {
        panic(err)
    }
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
