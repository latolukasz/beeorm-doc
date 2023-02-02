# Flusher Cache Setters

In previous sections you have learned how to use [Flusher](/guide/crud.html#using-the-flusher) to 
execute many MySQL and cache queries at once. Flusher is always trying to minimize number of queries to
MySQL and Redis. In some scenarios you want to run additional queries to cache when `Flusher` is executed.

Look at below example:

```go
type CategoryEntity struct {
	beeorm.ORM `orm:"redisCache"` // entity is cached in Redis
}

flusher := engine.NewFlusher()
category := &CategoryEntity{Name: "Cars"}
flusher.Track(category)
flusher.Flush()

// we want to remove key in redis which holds total number of categories
engine.GetRedis().Del("total_categories")
```

Above code works correctly. But look at the queries executed to MySQL and Redis:

```sql
INSERT INTO CategoryEntity(Name) VALUES("Cars");
```

```redis
DEL hdkfusd:3 // entity data in cache
DEL total_categories
```

As you can see two queries to redis are executed. One when `flusher.Flush()` is executed, another one
when `engine.GetRedis().Del("total_categories")` is executed.

That's why `Flusher` provides two methods - `GetLocalCacheSetter()` and `GetRedisCacheSetter()` which allows you define Redis and local cache queries that should be
run when `flusher.Flush()` is executed.

Below you can see how we can improve our example:

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

```redis
DEL hdkfusd:3 total_categories
```

As you can see only one request is send to Redis - both keys are removed at once.

You can use flush cache setters to group many changes in cached and execute them in the most optimal way.
For example:

```go
flusher := engine.NewFlusher()
flusher.GetLocalCacheSetter().Del("key1", "key2")
flusher.GetLocalCacheSetter().Set("key3", "value")
flusher.GetRedisCacheSetter().Set("key4", "value", time.Minute)
flusher.GetRedisCacheSetter().Del("key5")
flusher.Flush()
```

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