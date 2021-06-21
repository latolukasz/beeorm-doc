# Event broker

Redis introduced amazing feature called [Redis Streams](https://redis.io/topics/streams-intro)
that is following concept of **consumer groups**. Idea is simple yet very powerful:

 * basic functional block is a **stream** which can be described as an event holder,
 place where you send (publish) and store events. Each stream has a name.
 * next functional block is **consumer group** that has a name and reads (consumes) events from
one or more **streams**.
 * when all  **consumer groups** read an event from a **stream** then this event is removed from
stream.
   

## Registering streams and consumer groups

TODO 

<code-group>
<code-block title="code">
```go{4,5,8}
registry := beeorm.NewRegistry()

registry.RegisterRedis("localhost:6379", 0)
registry.RegisterRedisStream("stream-a", "default", []string{"read-group-a", "read-group-ab"})
registry.RegisterRedisStream("stream-b", "default", []string{"read-group-b"})

registry.RegisterRedis("192.168.1.20:6379", 3, "second")
registry.RegisterRedisStream("stream-c", "default", []string{"read-group-c"})
```
</code-block>

<code-block title="yaml">
```yml{3-8,11-13}
default:
    redis: localhost:6379:0
    streams:
        stream-a:
          - read-group-a
          - read-group-ab
        stream-b:
          - read-group-b
second:
    redis: 192.168.1.20:6379:3
    streams:
        stream-c:
          - read-group-c
```
</code-block>
</code-group>
   
   
