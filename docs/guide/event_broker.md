# Event broker

Redis introduced an amazing feature called [Redis Streams](https://redis.io/topics/streams-intro)
that is following the concept of **consumer groups**. The idea is simple yet very powerful:

 * basic functional block is a **stream** which can be described as an event holder,
 place where you send (publish) and store events. Each stream has a name.
 * next functional block is **consumer group** that has a name and reads (consumes) events from
one or more **streams**.
 * when all  **consumer groups** read an event from a **stream** then this event is removed from
stream.
   

## Registering streams

Good example is better than a thousand words. Let's define three streams:
 * `stream-a` located in `default` redis pool
 * `stream-b` located in `default` redis pool
 * `stream-c` located in `second` redis pool

and three consumer groups:

 * `read-group-a` that reads events from `stream-a` stream   
 * `read-group-ab` that reads events from `stream-a` and `stream-b` streams
 * `read-group-c` that reads events from `stream-c` stream

<code-group>
<code-block title="code">
```go{4,5,8}
registry := beeorm.NewRegistry()

registry.RegisterRedis("localhost:6379", 0)
registry.RegisterRedisStream("stream-a", "default", []string{"read-group-a", "read-group-ab"})
registry.RegisterRedisStream("stream-b", "default", []string{"read-group-ab"})

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
          - read-group-ab
second:
    redis: 192.168.1.20:6379:3
    streams:
        stream-c:
          - read-group-c
```
</code-block>
</code-group>

:::warning
Stream names must be unique even if streams are defined 
in separate redis pools. Below code returns error:
```go{3,5}
registry := beeorm.NewRegistry()
registry.RegisterRedis("localhost:6379", 0)
registry.RegisterRedisStream("stream-a", "default", []string{"read-group-a", "read-group-ab"})
registry.RegisterRedis("192.168.1.20:6379", 3, "second")
registry.RegisterRedisStream("stream-a", "default", []string{"read-group-c"})
validatedRegistry, err := registry.Validate(context.Background())
fmt.Print(err) // "stream with name stream-a aleady exists"
```
:::
   
## Publishing  events

Now we are ready to publish our first event:

```go{3-4}
engine := validatedRegistry.CreateEngine(context.Background())

eventBroker := engine.GetEventBroker()
eventBroker.Publish("stream-a", "hello")
```

That's it. Our first event is published to `stream-a` stream.

In next example we will send event as a struct into `stream-b` stream:

```go{9}
engine := validatedRegistry.CreateEngine(context.Background())

type testStructEvent struct {
    Color string
    Price  float32
}

eventBroker := engine.GetEventBroker()
eventBroker.Publish("stream-b", testStructEvent{Color: "red", Price: 12.34})
```

If you need to publish more than one event use `EventFlusher`:

```go{3-6}
engine := validatedRegistry.CreateEngine(context.Background())

eventFlusher := engine.GetEventBroker().NewFlusher()
eventFlusher.Publish("stream-a", "hello")
eventFlusher.Publish("stream-b", testStructEvent{Color: "red", Price: 12.34})
eventFlusher.Flush() // now both events are published to redis streams
```

:::tip
Always use `EventFlusher` when more than one event must be flushed.
BeeORM uses redis pipeline behind the scene that's why `EventFlusher.Flush()` 
is much faster than publishing event one by one.
:::

## Consuming  events

TODO
