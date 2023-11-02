# Async flush

In the [previous chapter](/guide/crud.html), you learned how to add, update, and delete entities using the `Flush()` method of the `beeorm.Context`. 
`Flush()` executes both MySQL and cache (Redis, local cache) queries. Redis operations usually take a few milliseconds, and local cache changes are almost instantaneous. 
However, SQL queries can take a significant amount of time, typically more than 100 milliseconds. In high-traffic applications, SQL queries 
often become a performance bottleneck.

To address this issue, BeeORM provides a powerful feature that allows you to run all SQL queries asynchronously. 
All you need to do is use the `FlushAsync()` method instead of `Flush() `and run the `ConsumeAsyncFlushEvents()` 
function in a separate thread or application.

See the example below:

```go{23}
package main

import "github.com/latolukasz/beeorm/v3"

type CategoryEntity struct {
	ID          uint64      `orm:"localCahe;redisCache"`
	Name        string `orm:"required;length=100"`
}

func main() {
    registry := beeorm.NewRegistry()
    registry.RegisterMySQL("user:password@tcp(localhost:3306)/db", beeorm.DefaultPoolCode, nil) 
    registry.RegisterRedis("localhost:6379", 0, beeorm.DefaultPoolCode, nil)
    registry.RegisterEntity(&CategoryEntity{}) 
    engine, err := registry.Validate()
    if err != nil {
        panic(err)
    }
    c := engine.NewContext(context.Background())
    
    categoryCars := beeorm.NewEntity[CategoryEntity](c)
    categoryCars.Name = "Cars"
    err := c.FlushAsync()
}  
```

In the example above, the `FlushAsync()` method pushes the `INSERT INTO ...` SQL query into a special Redis list and adds entity data into Redis or local cache.

## Consuming async queries

When you use `FlushLazy()` to commit your changes, it's essential to execute the `ConsumeAsyncFlushEvents` function in your application, 
as demonstrated below:

```go
err := beeorm.ConsumeAsyncFlushEvents(c, true)
```

This function operates in two modes: blocking and non-blocking. By setting the second argument as true, the function halts the code's execution and awaits new SQL queries that have been 
pushed to the Redis list via `FlushAsync()`, subsequently executing them.

To halt its execution, it's necessary to cancel the context used in creating `beeorm.Context`:

```go
 ctx, close := context.WithCancel()
 c := engine.NewContext(ctx)
 go func() {
    err := beeorm.ConsumeAsyncFlushEvents(c, true)
 }()
 close() // this will stop execution of ConsumeAsyncFlushEvents
```

On the other hand, when the second argument is set as false, `ConsumeAsyncFlushEvents()` processes all SQL queries stored in the Redis list and then stops. 
Consequently, this function should be run in non-blocking mode during the application's start to execute any queries from the 
Redis list that were not executed during the last run. 
Conversely, it should be executed in blocking mode to process all incoming new SQL queries.

These modes serve different purposes: non-blocking to clear pending queries and blocking to 
handle real-time, incoming queries.

## Async flush consumer errors

`ConsumeAsyncFlushEvents()` function reads all SQL queries from Redis set and execute them one by one.
In case SQL query generate error BeeORM tries to decide if this error is temporary or not.
For temporary errors `ConsumeAsyncFlushEvents()` function returns error and developer should report this error, 
fix the problem and rerun `ConsumeAsyncFlushEvents`:

```go
for {
    err := beeorm.ConsumeAsyncFlushEvents(c, true)
    if err != nil {
        // ... report error in your error log
        time.Sleep(time.Second * 10)
    }
}
```

Examples of temporary errors:
    
* Error 1045: Access denied
* Error 1040: Too many connections
* Error 1213: Deadlock found when trying to get lock, try restarting transaction
* Error 1031: Disk full, waiting for someone to free some space

As you see above errors should be fixed by developer (disc full) or should be executed again (Deadlock found).

All non-temporary errors are skipped and moved to special Redis errors list which holds all SQL problematic SQL queries 
and corresponding error. 

Example of non-temporary errors:

* Error 1022: Can't write; duplicate key in table
* Error 1049: Unknown database
* Error 1051: Unknown table=
* Error 1054: Unknown column
* Error 1064: Syntax error

As you can see rerunning these SQL queries won't fix thw issue. Developer should read these queries from
Redis errors list, try to execute them and remove this them from this list. You can use ``

Below example 

## grouping async events

TODO custom_async_group






