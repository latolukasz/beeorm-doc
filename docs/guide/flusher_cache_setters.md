# Flusher Cache Setters

You have learned in the previous section how to use the [Flusher](/guide/crud.html#using-the-flusher) to execute multiple MySQL and cache queries in one go, with a goal to minimize the number of queries to MySQL and Redis. However, in certain scenarios, you may want to run additional cache queries when the Flusher is executed.

For instance, consider the following code:

```go
type CategoryEntity struct {
	beeorm.ORM `orm:"redisCache"` // entity is cached in Redis
	ID uint16
}

flusher := engine.NewFlusher()
category := &CategoryEntity{Name: "Cars"}
flusher.Track(category)
flusher.Flush()

// we want to remove key in redis which holds total number of categories
engine.GetRedis().Del("total_categories")
```

The code works as intended, but it results in two queries to Redis: one when `flusher.Flush()` is executed and another when `engine.GetRedis().Del("total_categories")` is executed.

```sql
INSERT INTO CategoryEntity(Name) VALUES("Cars");
```

```redis
DEL hdkfusd:3 // entity data in cache
DEL total_categories
```

To solve this problem, Flusher provides two methods - `GetLocalCacheSetter()` and `GetRedisCacheSetter()` - that allow you to define Redis and local cache queries that should be executed when `flusher.Flush()` is called.

Consider the following improved example:

```go{4}
flusher := engine.NewFlusher()
category := &CategoryEntity{Name: "Cars"}
flusher.Track(category)
flusger.GetRedisCacheSetter().Del("total_categories")
flusher.Flush()
```

```sql
INSERT INTO CategoryEntity(Name) VALUES("Cars");
```

This results in only one request to Redis:

```redis
DEL hdkfusd:3 total_categories
```

Using the `Flusher` cache setters allows you to group multiple changes to the cache and execute them in an optimal way. For example:

```go
flusher := engine.NewFlusher()
flusher.GetLocalCacheSetter().Del("key1", "key2")
flusher.GetLocalCacheSetter().Set("key3", "value")
flusher.GetRedisCacheSetter().Set("key4", "value", time.Minute)
flusher.GetRedisCacheSetter().Del("key5")
flusher.Flush()
```
This results in the following operations:

```local cache
DEL key1 key2
SET key3 value
```

```redis
PIPELINE START
SET key4 value EX 60
DEL key5
PIPELINE EXEC
```