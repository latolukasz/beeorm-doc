# Redis operations

BeeORM provides its own Redis client used to execute
all [redis commands](https://redis.io/commands). 

First we need to define redis data pool and engine.
In our example we will use two pools - one with name `default` and
second one with name `test`. First pool uses redis database with index `0`, 
seconds pool uses database with index `3`:

```go
registry := beeorm.NewRegistry()
registry.RegisterRedis("localhost:6379", 0)
registry.RegisterRedis("localhost:6379", 3, "test")
validatedRegistry, err := registry.Validate(context.Background())
if err != nil {
    panic(err)
}
engine := validatedRegistry.CreateEngine(context.Background())
```

## Redis data pool


Now we are ready to get Redis data pool that is used to execute all operations.
This pool also provides few useful methods:

```go
redisPool := engine.GetRedis()
config := redisPool.GetPoolConfig()
config.GetCode() // "default"
config.GetDatabase() // 0
config.GetAddress() // "localhost:6379"
```

## Standard redis operations

Using BeeORM redis data pool you can execute all [redis commands](https://redis.io/commands)
except [SELECT](https://redis.io/commands/select) because we are defining redis database number
for every redis data pool.

```go
redisPool := engine.GetRedis()
redisPool.Set("my-key", "some-value", 30) // cache for 30 seconds
value, has := redisPool.Get("my-key")
pushed := redisPool.LPUsh("another-key", "value-1", "value-2")

testPool := engine.GetRedis("test")
testPool.FlushDB() // flush redis DB 3
```

## Rate limiter

BeeORM redis client provides method `RateLimit` used for rate limiting based on Redis.
Fo instance when you want to limit login attempts to max 5 tries in one minute:

```go{3}
user := // data sent from web login form
resourceKey := "logoin_attempt_" + user.Email
if !engine.GetRedis().RateLimit(resourceKey, time.Minute, 5) {
    return errors.New("login attemps limit exceeded")
}
```
