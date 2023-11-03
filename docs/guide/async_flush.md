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
    registry.RegisterEntity(CategoryEntity{}) 
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


## Understanding Cache Updates

To ensure smooth operation of your application and prevent unexpected issues, it is crucial to have a solid grasp of how asynchronous cache flushing works in BeeORM. When you execute the `FlushLazy()` function, BeeORM updates entity data in the cache. This data is added to both Redis (when the entity uses the `redisCache` tag) and the local cache (when the `localCache` tag is used). SQL queries are executed at a later stage, typically a few milliseconds after the `FlushLazy()` call, thanks to the `ConsumeAsyncFlushEvents()` function. This is the reason why not all BeeORM functions that retrieve entities from the database return updated data immediately after the execution of `FlushLazy()`.

Let's take a closer look at an example to help you understand how this process works:

```go{2,6}
type CategoryEntity struct {
	ID   uint64 `orm:"redisCache"` // utilizes cache
	Name string `orm:"required;unique=Name"`
}
type UserEntity struct {
	ID   uint64 // no cache
	Name string `orm:"required;unique=Name"`
}

category := beeorm.NewEntity[CategoryEntity](c) // ID 1
category.Name = "cars"
user := beeorm.NewEntity[UserEntity](c) // ID 1
categoryCars.Name = "Tom"
c.FlushAsync()

// The following code is executed in another thread just after the previous code
// but before ConsumeAsyncFlushEvents() consumes events:

// Returns valid data because it's saved in Redis
category := beeorm.GetByID[CategoryEntity](c, 1)
categories := beeorm.GetByIDs[CategoryEntity](c, 1)
category := beeorm.GetByUniqueIndex[CategoryEntity](c, "Name", "cars")
// Returns nil because UserEntity does not use any cache
user := beeorm.GetByID[UserEntity](c, 1)
users := beeorm.GetByIDs[UserEntity](c, 1)
// Returns valid data because unique indexes are always cached in Redis
user := beeorm.GetByUniqueIndex[UserEntity](c, "Name", "Tom")

// Returns nil because search functions never use cache
category = SearchOne[CategoryEntity](c, beeorm.NewWhere("Name = ?", "cars"))
user = SearchOne[UserEntity](c, beeorm.NewWhere("Name = ?", "Tom"))
```

Below, you'll find a list of functions that return updated entity data when `FlushLazy()` is executed:

* [GetByID](/guide/crud.html#getting-entity-by-id) when the entity uses cache
* [GetByIDs](/guide/crud.html#getting-entities-by-id) when the entity uses cache
* [GetByUniqueIndex](/guide/crud.html#getting-entities-by-unique-key) always
* [GetByReference](/guide/crud.html#getting-entities-by-reference) when the reference field has the `cached` tag
* [GetAll](/guide/crud.html#getting-all-entities) when the ID field has the `cached` tag

Please note that all [search functions](/guide/search.html) do not return updated entity data until `ConsumeAsyncFlushEvents()` processes the SQL queries.

## Handling Errors in Async Flush Consumption

The `ConsumeAsyncFlushEvents()` function plays a crucial role in processing SQL queries by reading them from a Redis set and executing them one by one. When an SQL query generates an error, BeeORM undertakes the task of determining whether the error is temporary or not.

In cases of temporary errors, the `ConsumeAsyncFlushEvents()` function will return an error, and it is the responsibility of the developer to report this error, address the underlying issue, and then re-run `ConsumeAsyncFlushEvents`. Here's an example of how to handle temporary errors:

```go
for {
    err := beeorm.ConsumeAsyncFlushEvents(c, true)
    if err != nil {
        // ... report the error in your error log
        time.Sleep(time.Second * 10)
    }
}
```

Temporary errors are typically characterized by issues such as:

* Error 1045: Access denied
* Error 1040: Too many connections
* Error 1213: Deadlock found when trying to get lock; try restarting the transaction
* Error 1031: Disk full, waiting for someone to free some space

As seen above, these errors should either be resolved by the developer (e.g., disk full) or re-executed (e.g., deadlock found).

On the other hand, non-temporary errors are skipped, and they are moved to a special Redis errors list, which retains all problematic SQL queries along with their corresponding errors. Non-temporary errors are typically issues that cannot be fixed by simply re-executing the query. Instead, the developer must manually address and execute these queries and remove them from the list.

Here are examples of non-temporary errors:

* Error 1022: Can't write; duplicate key in table
* Error 1049: Unknown database
* Error 1051: Unknown table
* Error 1054: Unknown column
* Error 1064: Syntax error

To manage non-temporary errors, developers can use the [ReadAsyncFlushEvents()](/guide/async_flush.html#reading-async-flush-events) function, which is described in the next section. This function allows developers to manually address and execute problematic queries and remove them from the Redis errors list.

## Async flush consumer lock

The `ReadAsyncFlushEvents` function employs a [distributed lock](/guide/distributed_lock.html) mechanism to ensure that only one instance of the function can run at a given time. This is essential to prevent the duplication of SQL query execution. Attempting to run this function simultaneously from two separate instances will result in the `redislock.ErrNotObtained` error being returned in one of the instances, signaling that the lock could not be obtained.

## Managing Async Flush Events

With `ReadAsyncFlushEvents()`, you can efficiently monitor the status of pending SQL queries that await processing by the `ConsumeAsyncFlushEvents()` function. You can read these queries and, when necessary, remove them from the Redis list. Here's how you can use it:

```go
for _, eventList := range beeorm.ReadAsyncFlushEvents(c) {
    eventList.EventsCount() // Number of pending SQL queries to be executed
    for _, event := range eventList.Events(100) { // Retrieve the 100 oldest events
        event.SQL // MySQL query, for example, "INSERT INTO TableName(ID, Name) VALUES(?,?)"
        event.QueryAttributes // Query attributes, for example, ["2341234", "Cars"]
    }
    eventList.TrimEvents(10) // Remove the 10 oldest SQL queries from the list
}
```

This function not only allows you to inspect pending SQL queries but also provides a way to manage them effectively. You can similarly check the status of SQL queries that were skipped due to non-temporary errors, read these queries, and remove them from the Redis list using the same function:

```go
for _, eventList := range beeorm.ReadAsyncFlushEvents(c) {
    eventList.ErrorsCount() // Number of problematic SQL queries that were skipped and moved to the errors list
    for _, event := range eventList.Errors(100) { // Retrieve the 100 oldest SQL queries from the error list
        event.SQL // MySQL query, for example, "INSERT INTO TableName(ID, Name) VALUES(?,?)"
        event.QueryAttributes // Query attributes, for example, ["2341234", "Cars"]
        event.Error // Query error, for example, "Unknown column Name"
    }
    eventList.TrimErrors(10) // Remove the 10 oldest SQL queries from the errors list
}
```

With these functions, you have the tools needed to efficiently manage and monitor the status of SQL queries in your BeeORM application, whether they are pending execution or have encountered non-temporary errors.

## Dividing Async Events

By default, all asynchronous SQL queries are sent to the "default" Redis pool name. However, if your entity utilizes a different Redis pool for caching entity data, this specific Redis pool will be used instead. Let's illustrate this with an example:

```go{5}
type CategoryEntity struct {
	ID uint64
}
type BrandEntity struct {
	ID uint64 `orm:"redisCache=brands"`
}
```

In the example above, all asynchronous SQL queries for `BrandEntity` are directed to the "brands" Redis pool, while those for `CategoryEntity` go to the "default" Redis pool.

By default, all events are consolidated into a single Redis set within a Redis pool. To optimize performance when using `ReadAsyncFlushEvents()`, you can employ a special tag, `split_async_flush`, to instruct BeeORM to utilize a separate Redis pool for a particular entity:

```go
type CategoryEntity struct {
	ID uint64 `orm:"split_async_flush"`
}
```

In this case, all instances of `CategoryEntity` entities are directed to their own dedicated Redis list. This configuration improves the performance of `ReadAsyncFlushEvents()` by breaking down SQL queries into multiple lists, allowing for faster and parallel execution.

You can also group events from different entities into one Redis list by providing `split_async_flush=[GROUP NAME]` tag:

```go
type CategoryEntity struct {
	ID uint64 `orm:"split_async_flush=settings"`
}
type BrandEntity struct {
	ID uint64 `orm:"split_async_flush=settings"`
}
```