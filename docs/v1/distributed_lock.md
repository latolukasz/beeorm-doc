## Distributed Lock

In some cases, you may need a mechanism to control access to a shared resource from multiple services. While it is easy to limit access to a resource within a single Go application using [sync.Mutex](https://tour.golang.org/concurrency/9), doing so across multiple instances of an application can be more challenging. BeeORM's `Locker` feature can help you create a shared, distributed lock to solve this problem. Behind the scenes, Locker uses Redis, so as long as all your application instances have access to the same Redis instance, you can use Locker to implement a distributed lock:

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
Be sure to use defer `locker.Unlock()` whenever you obtain a lock. Failing to do so will cause the distributed lock to remain in place until its Time to Live (TTL) expires.
:::

In the example above, we request a lock with the name `lock-name` that will expire after 30 seconds. The third argument to `locker.TryLock()`, `waitTimeout`, is set to 0, which means that `locker.TryLock()` will not wait for the lock and will return immediately with obtained set to false if the lock is not available.

Here is an example that demonstrates how to instruct the locker to wait up to 5 seconds for the lock to become available:

<code-group>
<code-block title="code">
```go{6}
redisPool := engine.GetRedis()
locker := redisPool.GetLocker()

func testLock(name string) {
    fmt.Printf("GETTING LOCK %s\n", name)
    lock, obtained := locker.Obtain("test_lock", time.Minute, time.Second * 5)
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

You can also check when an obtained lock will expire and extend it if needed:

<code-group>
<code-block title="code">
```go{5,7,9,10}
redisPool := engine.GetRedis()
lock, obtained := redisPool.GetLocker().ObtainLock("test", time.Second * 5, 0)
if obtained {
    defer lock.Release()
    fmt.Printf("GOT LOCK FOR %d SECONDS\n", lock.TTL().Seconds())
    sleep(time.Second)
    fmt.Printf("WILL EXPIRE IN %d SECONDS\n", lock.TTL().Seconds())
    sleep(time.Second)
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
