# Lazy Flush

By default, calling `engine.Lazy()` executes all queries to MySQL and Redis immediately. However, in many scenarios it may be more efficient to run queries asynchronously, in a separate thread, so that your code can continue without waiting for the query to be executed in the database.

To support this use case, BeeORM provides the `FlushLazy()` method, which adds queries to a special [Redis stream](https://redis.io/docs/data-types/streams/) called `orm-lazy-flush-stream` (`beeorm.LazyFlushChannelName` constant), from which they can be processed asynchronously by a `beeorm.LazyFlushConsumer`.

Here is an example of how `FlushLazy()` can be used:

```go{3,10,14,2-}
// adding new entity
user := &UserEntity{FirstName: "Tom", LastName: "Bee", Email: "bee@beeorm.io"}
engine.FlushLazy(user) 

// updating entity
engine.LoadByID(1, user)
user.Name = "John"
engine.LoadByID(2, user2)
user.Name = "Ivona"
engine.FlushLazy(user, user2)

// deleting entity
engine.LoadByID(2, user)
engine.DeleteLazy(user)

// using Flusher
flusher := engine.NewFlusher()
flusher.Track(user, user2)
flusher.Delete(user3)
flusher.FlushLazy()
```

```redis
XAdd orm-lazy-flush-stream event
XAdd orm-lazy-flush-stream event
XAdd orm-lazy-flush-stream event
```

This example adds three events to the `orm-lazy-flush-stream` redis stream.


:::warning
Keep in mind that `FlushLazy()` does not set the ID in a new entity. If you need the ID in your code, you must use `Flush()` instead, or enable [UUID](/guide/uuid.html#enabling-uuid) for the entity (recommended).
```go
user := ProductEntity{Name: "Shoe"}
user.GetID() // returns zero
engine.FlushLazy(user)
user.GetID() // panics
```
:::

## Defining the Lazy Queries Pool Name

By default, BeeORM creates a stream in the `default` [Redis data pool](/guide/data_pools.html#redis-server-pool). You can specify a different pool name by registering the stream `beeorm.LazyChannelName` together with the `beeorm.BackgroundConsumerGroupName` consumer group name and your Redis pool name, as shown in the following example:

```go{3,4}
registry := beeorm.NewRegistry()
registry.RegisterRedis("192.123.11.12:6379", "", 0, "lazy")
registry.RegisterRedisStream(beeorm.LazyFlushChannelName, "lazy")
registry.RegisterRedisStreamConsumerGroups(beeorm.LazyFlushChannelName, beeorm.LazyFlushGroupName)
```

```yml{4,5}
lazy:
    redis: 192.123.11.12:6379
    streams:
        orm-lazy-flush-stream:
          - orm-lazy-flush-consumer
```

## Lazy flush consumer

To consume newly added events in the Redis stream and execute both MySQL and Redis queries, simply run a single instance of 
the `beeorm.LazyFlushConsumer` in your code.

```go
consumer := beeorm.NewLazyFlushConsumer(engine)
consumer.Digest(context.Background()) // code is blocked here, waiting for new events
```

In a real-world scenario, you should run the `LazyFlushConsumer` as follows:

```go{21-28}
package main

import "github.com/latolukasz/beeorm/v2"

func main() {
   registry := beeorm.NewRegistry()
   // ... register services in registry
   validatedRegistry, err := registry.Validate()
    if err != nil {
        panic(err)
    }
    
    waitGroup := &sync.WaitGroup{}
    
    ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM, syscall.SIGKILL)
    defer stop()
    go func() {
      waitGroup.Add(1)
      defer waitGroup.Done()
      engine := validatedRegistry.CreateEngine()
      consumer := beeorm.NewLazyFlushConsumer(engine)
      for {
			if !consumer.Digest(ctx) {
				time.Sleep(time.Second * 10)
				continue
			}
			return
		}
    }
    <-ctx.Done()
    fmt.Print("CLOSING...")
    stop()
    waitGroup.Wait()
    fmt.Println("[CLOSED]")
}
```

:::tip
It's important to properly terminate your application as shown above. The `LazyFlushConsumer` needs time to finish any active tasks before the application is closed.
:::

## Running more than one LazyFlushConsumer

It is important to note that only one instance of `LazyFlushConsumer` can be run in your application at a time. If you attempt to run a second instance, the `Digest(ctx)` method will return false, indicating that another script is already running. BeeORM uses a shared lock in Redis to ensure that only one `LazyFlushConsumer` is active at a time. If you are running your application in multiple binaries, you should retry the `Digest()` method after a short delay if it returns false, to ensure that one of the binaries is able to run it.

Here is an example of how you can handle this:

```go
for {
    if !consumer.Digest(ctx) {
        time.Sleep(time.Second * 10)
        continue
    }
    return
}
````

:::tip
If your application shares a Redis database with other applications, it's important to use Redis key namespaces to ensure that each application uses a unique `LazyFlushConsumer` lock. To do this, you can modify the Redis connection string as follows:

```go
registry.RegisterRedis("localhost:6379", "", 0, "application_keys_namespace")
```

This will help to prevent conflicts and ensure that each application can access its own `LazyFlushConsumer` lock without interference from other applications.
:::

:::warning
Don't forget to run at least one [StreamGarbageCollectorConsumer](/guide/event_broker.html#stream-garbage-collector-consumer) in your application.
:::

## Lazy Flush Error Resolver

Using `FlushLazy()` can be tricky, as you need to ensure that your data is validated and the query can be executed in MySQL before calling the method. If a query in the lazy stream is invalid, the `NewLazyFlushConsumer` may panic while trying to execute it, blocking the stream until the invalid query is removed. For example:

```go
user := User{Email: "user@mail.com"}
engine.FlushLazy()
```

Now consider that the `Email` column in the User table has a unique index, and there is already a user with the email `user@mail.com`. In this scenario, the` NewLazyFlushConsumer` will panic with the following error:

```go
//panics with error "Error 1062 (23000): Duplicate entry 'user@mail.com' for key 'Email'"
beeorm.NewLazyFlushConsumer(engine).Digest(ctx)
```

To prevent this issue, you should improve your code by checking if the email is already in use before calling `engine.FlushLazy()`:

```go
email := "user@mail.com"
if engine.SearchOne(beeorm.NewWhere("Email = ?", email), user) {
  return fmt.Errorf("email %s is already in use", email)
}
user := User{Email: email}
engine.FlushLazy()
```

However, in real life you may end up in a situation where one query in the lazy stream is invalid and the `LazyFlushConsumer` panics. To deal with these situations, BeeORM provides the `RegisterLazyFlushQueryErrorResolver` method. This method allows you to register special functions that will be executed (in the order they were registered) when a query executed by the `LazyFlushConsumer` fails. These functions allow you to handle the error and decide whether the query should be removed from the lazy stream or whether the `LazyFlushConsumer` should continue trying to execute it.

To solve the scenario described above, you can register the following two functions:

```go
consumer := beeorm.NewLazyFlushConsumer(engine)

consumer.RegisterLazyFlushQueryErrorResolver(func(_ beeorm.Engine, _ beeorm.EventEntityFlushQueryExecuted, queryError *mysql.MySQLError) error {
   errorLogService.LogEror("lazy flush query [%s] faild with error %s", queryError.Error())
   return queryError
})

consumer.RegisterLazyFlushQueryErrorResolver(func(_ beeorm.Engine, _ beeorm.EventEntityFlushQueryExecuted, queryError *mysql.MySQLError) error {
   errorLogService.LogEror("lazy flush query [%s] faild with error %s", queryError.Error())
   if queryError.Number == 1062 { //Duplicate entry
     return nil
   }
   return queryError
})
```

The first function logs all failed queries in an error log, so the developer can review these queries to identify the source of the problem in the application code and potentially execute some queries manually to fix the data in the database. This function returns the error, so the `LazyFlushConsumer` will execute the next registered function.

The second function checks if the MySQL error code is `1062`. If it is, it returns `nil`, instructing the `LazyFlushConsumer` to remove the query from the stream and continue. From now on, all queries that throw a MySQL error code `1062` will be automatically skipped and logged in the error log.
