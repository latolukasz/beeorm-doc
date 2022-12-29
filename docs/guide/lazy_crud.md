# Lazy Flush

By default, calling `engine.Lazy()` executes all queries to MySQL and Redis immediately. However, in many scenarios it may be more efficient to run queries asynchronously, in a separate thread, so that your code can continue without waiting for the query to be executed in the database.

To support this use case, BeeORM provides the `FlushLazy()` method, which adds queries to a special [Redis stream](https://redis.io/docs/data-types/streams/) called `orm-lazy-channel`, from which they can be processed asynchronously by a [BackgroundConsumer](/guide/background_consumer.html).

Here is an example of how `FlushLazy()` can be used:

<code-group>
<code-block title="code">
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
</code-block>

<code-block title="queries">
```sql
REDIS XAdd orm-lazy-channel event
REDIS XAdd orm-lazy-channel event
REDIS XAdd orm-lazy-channel event
```
</code-block>
</code-group>

This example adds three events to the `orm-lazy-channel` stream. You can check the statistics of this stream using the following code:
```go
statisticsStream := engine.GetEventBroker().GetStreamStatistics(beeorm.LazyChannelName)
statisticsStream.Len // number of events in the stream, both processed and waiting to be processed by the stream group
statisticsStream.OldestEventSeconds // how old (in seconds) is the oldest query that needs to be executed

statisticsConsumer := engine.GetEventBroker().GetStreamGroupStatistics(beeorm.LazyChannelName, beeorm.BackgroundConsumerGroupName)
statisticsConsumer.Lag // shows how many lazy queries are still in the stream waiting to be executed (works only with Redis 7)
statisticsConsumer.Pending // shows how many lazy queries are currently being processed by `BackgroundConsumer`
statisticsConsumer.LowerDuration // how old is the oldest query waiting in the stream to be executed
```

More information about stream statistics can be found on the [stream statistics page](/guide/event_broker.html#stream-statistics).

:::tip
If you notice that queries are not being executed, it may be because you forgot to run the [background consumer](/guide/background_consumer.html) in your application.
:::

:::warning
Keep in mind that `FlushLazy()` does not set the ID in a new entity. If you need the ID in your code, you must use `Flush()` instead, or enable [UUID](/guide/uuid.html#enabling-uuid) for the entity (recommended).
```go
user := ProductEntity{Name: "Shoe"}
engine.FlushLazy(user)
// bug, user.ID is still zero
c.Redirect(http.StatusTemporaryRedirect, fmt.Sprintf(""https://mysite.com/product/%d/", user.ID)) 
```
:::

## Defining the Lazy Queries Pool Name

By default, BeeORM creates a stream in the `default` [Redis data pool](/guide/data_pools.html#redis-server-pool). You can specify a different pool name by registering the stream `beeorm.LazyChannelName` together with the `beeorm.BackgroundConsumerGroupName` consumer group name and your Redis pool name, as shown in the following example:

<code-group>
<code-block title="code">
```go{3}
registry := beeorm.NewRegistry()
registry.RegisterRedis("192.123.11.12:6379", "", 0, "lazy")
registry.RegisterRedisStream(beeorm.LazyChannelName, "lazy", []string{beeorm.BackgroundConsumerGroupName})
```
</code-block>

<code-block title="yaml">
```yml{4,5}
lazy:
    redis: 192.123.11.12:6379
    streams:
        orm-lazy-channel:
          - orm-async-consumer
```
</code-block>
</code-group>

## Lazy Flush Error Resolver

Using `FlushLazy()` can be tricky, as you need to ensure that your data is validated and the query can be executed in MySQL before calling the method. If a query in the lazy stream is invalid, the `BackgroundConsumer` may panic while trying to execute it, blocking the stream until the invalid query is removed. For example:

```go
user := User{Email: "user@mail.com"}
engine.FlushLazy()
```

Now consider that the `Email` column in the User table has a unique index, and there is already a user with the email `user@mail.com`. In this scenario, the` BackgroundConsumer` will panic with the following error:

```go
//panics with error "Error 1062 (23000): Duplicate entry 'user@mail.com' for key 'Email'"
beeorm.NewBackgroundConsumer(engine).Digest(ctx)
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

However, in real life you may end up in a situation where one query in the lazy stream is invalid and the `BackgroundConsumer` panics. To deal with these situations, BeeORM provides the `RegisterLazyFlushQueryErrorResolver` method. This method allows you to register special functions that will be executed (in the order they were registered) when a query executed by the `BackgroundConsumer` fails. These functions allow you to handle the error and decide whether the query should be removed from the lazy stream or whether the `BackgroundConsumer` should continue trying to execute it.

To solve the scenario described above, you can register the following two functions:

```go
backgroundConsumer := beeorm.NewBackgroundConsumer(engine)

backgroundConsumer.RegisterLazyFlushQueryErrorResolver(func(_ Engine, _ *DB, sql string, queryError *mysql.MySQLError) error {
   errorLogService.LogEror("lazy flush query [%s] faild with error %s", queryError.Error())
   return queryError
})

backgroundConsumer.RegisterLazyFlushQueryErrorResolver(func(_ Engine, _ *DB, sql string, queryError *mysql.MySQLError) error {
   errorLogService.LogEror("lazy flush query [%s] faild with error %s", queryError.Error())
   if queryError.Number == 1062 { //Duplicate entry
     return nil
   }
   return queryError
})
```

The first function logs all failed queries in an error log, so the developer can review these queries to identify the source of the problem in the application code and potentially execute some queries manually to fix the data in the database. This function returns the error, so the `BackgroundConsumer` will execute the next registered function.

The second function checks if the MySQL error code is `1062`. If it is, it returns `ni`l, instructing the `BackgroundConsumer` to remove the query from the stream and continue. From now on, all queries that throw a MySQL error code `1062` will be automatically skipped and logged in the error log.

## Scenarios where lazy flush is not supported

There are two scenarios where using `FlushLazy()` will result in a panic.

The first is when you are flushing an entity with the on duplicate key update](/guide/crud.html#saving-new-entities) option

```go
category := &CategoryEntity{Code: "cars", Name: "Cars V2"}
category.SetOnDuplicateKeyUpdate(beeorm.Bind{"Name": "Cars V3"})
//panics with "lazy flush on duplicate key is not supported" error
engine.FlushLazy(categoryCars) 
```

The second is when you are flushing an entity with one-to-one references that need to be inserted into the database:

```go
category := &CategoryEntity{Code: "cars", Name: "Cars"}
product := &ProductEntity{Name: "BMW 1", Category: category}
//panics with "lazy flush for unsaved references is not supported" error
engine.FlushLazy(product)
```
