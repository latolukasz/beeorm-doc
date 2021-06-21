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

## Distributed lock

In many scenarios you may need a mechanism that controls access to one resource
from many services. It's easy to limit access to resource within one go application
with [sync.Mutex](https://tour.golang.org/concurrency/9). Problem starts when you are running
more than one instance of your application. Lucky you BeeORM provides useful feature
called `Locker` that helps you create shared distributed lock. Behind a scene it's using
Redis so if all your application instances has access to the same redis you are ready to
write your first distributed lock:

<code-group>
<code-block title="code">
```go{2,6,11}
redisPool := engine.GetRedis()
locker := redisPool.GetLocker()

func testLock(name string) {
    fmt.Printf("GETTING LOCK %s\n", name)
    lock, obtained := locker.Obtain("test_lock", time.Minute, 0)
    if !obtained {
        fmt.Printf("UNABLE TO GET LOCK %s\n", name)
        return
    }
    defer lock.Release()
    fmt.Printf("GOT LOCK %s\n", name)
    sleep(time.Second * 2)
    fmt.Printf("RELEASING LOCK %s\n", name)
}
go testLock("A")
go testLock("B")
```
</code-block>

<code-block title="bash">
```
GETTING LOCK A
GETTING LOCK B
GOT LOCK A
UNABLE TO GET LOCK B
RELEASING LOCK A
```
</code-block>
</code-group>

:::warning
Always add `defer lock.Release()` when lock was obtained. Otherwise 
distributed lock is kept until its TTL is expired.
:::

In above example we asked for a lock with name *test_lock* that will expire after
1 minute. We used `0` as third `waitTimeout` argument. It means that `locker.Obtain` 
is not waiting for lock return immediately with `obtained` set to false.

In next example we will instruct locker to wait max 5 seconds:

<code-group>
<code-block title="code">
```go{6}
redisPool := engine.GetRedis()
locker := redisPool.GetLocker()

func testLock(name string) {
    fmt.Printf("GETTING LOCK %s\n", name)
    lock, obtained := locker.Obtain("test_lock", time.Minute, time.Seconds * 5)
    if obtained {
        defer lock.Release()
        fmt.Printf("GOT LOCK %s\n", name)
        sleep(time.Second * 2)
        fmt.Printf("RELEASING LOCK %s\n", name)
    }
}
go testLock("A")
go testLock("B")
```
</code-block>

<code-block title="bash">
```
GETTING LOCK A
GETTING LOCK B
GOT LOCK A
RELEASING LOCK A
GOT LOCK B
RELEASING LOCK B
```
</code-block>
</code-group>

You can also check when obtained lock will expire
and extend it if needed:

<code-group>
<code-block title="code">
```go{5,7,9,10}
redisPool := engine.GetRedis()
lock, obtained := redisPool.GetLocker().ObtainLock("test", time.Second * 5, 0)
if obtained {
    defer lock.Release()
    fmt.Printf("GOT LOCK FOR %d SECONDS\n", lock.TTL().Seconds())
    sleep(time.Seconds)
    fmt.Printf("WILL EXPIRE IN %d SECONDS\n", lock.TTL().Seconds())
    sleep(time.Seconds)
    fmt.Printf("WILL EXPIRE IN %d SECONDS\n", lock.TTL().Seconds())
    if !lock.Refresh(time.Second * 2) {
        fmt.Println("LOST LOCK")
        return
    }
    fmt.Printf("WILL EXPIRE IN %d SECONDS\n", lock.TTL().Seconds())  
}

```
</code-block>

<code-block title="bash">
```
GOT LOCK FOR 5 SECONDS
WILL EXPIRE IN 4 SECONDS
WILL EXPIRE IN 3 SECONDS
WILL EXPIRE IN 5 SECONDS
```
</code-block>
</code-group>
