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
When you try to load this entity using functions like 
[GetByID()](/guide/crud.html#getting-entities-by-id), 
[GetByIDs()](/guide/crud.html#getting-entities-by-id), 
[GetByUniqueIndex()](/guide/crud.html#getting-entities-by-unique-key), 
[GetByReference()](/guide/crud.html#getting-entities-by-reference), or 
[GetAll()](/guide/crud.html#getting-all-entities), the data is loaded from the cache, improving performance.

## Consuming async queries

When you flush your changes using `FlushLazy()` you must run special function `ConsumeAsyncFlushEvents` in
your application as showed below:

```go
err := beeorm.ConsumeAsyncFlushEvents(c, true)
```
 Above function can be run in two modes - blocking and non-blocking mode. If you
set true as seconds argument this function block execution of your code and waits for new
SQL queries pushed to Redis list by `FlushAsync()` and execute them. 
 
To break its execution you must cancel `context` used to create `beeorm.Context`:

```go
 ctx, close := context.WithCancel()
 c := engine.NewContext(ctx)
 go func() {
    err := beeorm.ConsumeAsyncFlushEvents(c, true)
    if err != nil {
        panic(err)
    }
 }()
 // simewhere in your code:
 close() // this will stop execution of ConsumeAsyncFlushEvents
```

When you use false as second argument `ConsumeAsyncFlushEvents()` runs until all SQL queries stored in Redis list
are executes and stops. That's why you should run this function in non-blocking when your application
starts ( to execute all queries from Redis list tha were not executed from last application run) and
in blocking mode to execute all new SQL queries that are coming.






