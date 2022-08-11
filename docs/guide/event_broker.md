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

registry.RegisterRedis("localhost:6379", "", 0)
registry.RegisterRedisStream("stream-a", "default", []string{"read-group-a", "read-group-ab"})
registry.RegisterRedisStream("stream-b", "default", []string{"read-group-ab"})

registry.RegisterRedis("192.168.1.20:6379", "", 3, "second")
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
validatedRegistry, deferF, err := registry.Validate()
fmt.Print(err) // "stream with name stream-a aleady exists"
```
:::
   
## Publishing  events

Now we are ready to publish our first event:

```go{3-4}
engine := validatedRegistry.CreateEngine()

eventBroker := engine.GetEventBroker()
eventBroker.Publish("stream-a", "hello")
```

That's it. Our first event is published to `stream-a` stream.

In next example we will send event as a struct into `stream-b` stream:

```go{9}
engine := validatedRegistry.CreateEngine()

type testStructEvent struct {
    Color string
    Price  float32
}

eventBroker := engine.GetEventBroker()
eventBroker.Publish("stream-b", testStructEvent{Color: "red", Price: 12.34})
```

If you need to publish more than one event use `EventFlusher`:

```go{3-6}
engine := validatedRegistry.CreateEngine()

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

## Consuming events

Now, when we have few events pushed to our streams it's time
to consume them. First you need to create `EventsConsumer` object
that will be used later to read events:

```go
eventConsumer := engine.GetEventBroker().Consumer("read-group-ab")
```

Our event consumer is connected to redis consumer group `read-group-ab`. 
According to our [streams configuration](/guide/event_broker.html#registering-streams)
`read-group-ab` reads events from two streams: `stream-a` and `stream-b`.

Now we can start consuming our events:

<code-group>
<code-block title="code">
```go{10}
eventBroker := engine.GetEventBroker()

// publishing two events
flusher := eventBroker.NewFlusher()
flusher.Publish("stream-a", "a")
flusher.Publish("stream-b", "b")
flusher.Flush()

eventConsumer := eventBroker.Consumer("read-group-ab")
eventConsumer.Consume(context.Background(), 5, func(events []Event) {
    fmt.Printf("GOT %d EVENTS\n", len(events))
    var val string
    for _, event := range events {
        event.Unserialize(&val)
        fmt.Printf("EVENT %s WITH ID %d FROM STREAM %s\n", val, event.ID(), event.Stream())
    }
})
fmt.Println("FINISHED")
```
</code-block>

<code-block title="bash">
```
GOT 2 EVENTS
EVENT a WITH ID 1518951480106-0 FROM STREAM stream-a
EVENT b WITH ID 1518951480106-1 FROM STREAM stream-b
```
</code-block>
</code-group>

`eventConsumer.Consume()` requires as a first argument
limit of events that should be read from streams in every iteration. In above example
we allow max `5` events, that's why we received `2`. Now let's see how it works 
when this limit is set to `1` (see difference in bash tab): 

<code-group>
<code-block title="code">
```go{1}
eventConsumer.Consume(context.Background(), 1, func(events []Event) {
    fmt.Printf("GOT %d EVENTS\n", len(events))
    var val string
    for _, event := range events {
        event.Unserialize(&val)
        fmt.Printf("EVENT %s WITH ID %d FROM STREAM %s\n", val, event.ID(), event.Stream())
    }
})
fmt.Println("FINISHED")
```
</code-block>

<code-block title="bash">
```
GOT 1 EVENTS
EVENT a WITH ID 1518951480106-0 FROM STREAM stream-a
GOT 1 EVENTS
EVENT b WITH ID 1518951480106-1 FROM STREAM stream-b
```
</code-block>
</code-group>

Did you notice that above examples never print `FINISHED` to console?
It's because by default `eventConsumer.Consume()` works in blocking mode - it waits
for new events to come. You can disable this mode with `eventConsumer.DisableLoop()` 
method. In non-blocking mode consumer reads all events from streams and finish: 


<code-group>
<code-block title="code">
```go{1}
eventConsumer.DisableLoop()
eventConsumer.Consume(context.Background(), 10, func(events []beeorm.Event) {
    fmt.Printf("GOT %d EVENTS\n", len(events))
})
fmt.Println("FINISHED")
```
</code-block>

<code-block title="bash">
```
GOT 2 EVENTS
FINISHED
```
</code-block>
</code-group>

## Consumers scaling

By default, you can run only one `EventsConsumer.Consume()` at the same time.
BeeORM creates consumer with name `consumer-1`.
With this approach all events are consumed in the same order events
are published (first in - first out). `Consume()` method returns false if you
are trying to run consumer that is already running. 

```go
go func() {
    eventConsumer := eventBroker.Consumer("read-group-ab")
    running := eventConsumer.Consume(context.Background(), 5, func(events []Event) {}) // true
}()
go func() {
    eventConsumer := eventBroker.Consumer("read-group-ab")
    running := eventConsumer.Consume(context.Background(), 5, func(events []Event) {}) // false
}()
```

Behind the scene BeeORM creates [redis lock](/guide/redis_operations.html#distributed-lock)
to prevent running two consumers at the same time. If consumer is working in blocking 
mode (default approach) and developer flushed redis and removed redis lock then `Consume()`
will stop and return false.

In many scenarios you may need to run more than one consumer at once. 
BeeORM provides `EventsConsumer.ConsumeMany(ctx context.Context, nr, count int, handler EventConsumerHandler) bool` method that require one additional paramater
`nr` - unique number of consumer:

```go
go func() {
    eventConsumer := eventBroker.Consumer("read-group-ab")
    running := eventConsumer.ConsumeMany(context.Background(), 1, 5, func(events []Event) {}) // true
}()
go func() {
    eventConsumer := eventBroker.Consumer("read-group-ab")
    running := eventConsumer.ConsumeMany(context.Background(), 2, 5, func(events []Event) {}) // true
}()
````

In above example we successfully run two consumers: `consumer-1` and `consumer-2`.

Upscaling is easy - simply run another `Consumer()` with higher number (`3` in our example).
Problem starts when you want to downscale your consumers. In above example we are running two consumers.
Now imagine we want to run only one `consumer-1`. Of course first you should stop `consumer-2`.
But there is a chance `consumer-2` has still some `pending` events that are not [acknowledged](https://redis.io/commands/XACK).
You must move these events to another active consumer. In our case we should move events from
`consumer-2` to `consumer-1`. You can do it with `EventsConsumer.Claim()` method:

```go{2}
eventConsumer := eventBroker.Consumer("read-group-ab")
eventConsumer.Claim(2, 1)
````

## Event metadata

`Publish()` method accepts optional parameters `meta` which can be used
to assign metadata to event. Simply provide meta string key followed by meta string value.
Below example demonstrates one scenario when it's useful to use meta:

```go{14,15,20}
eventBroker := engine.GetEventBroker()

type Event_V1 struct {
    Color  string
    Price  float32
}

type Event_V2 struct {
    Color    string
    Price    float32
    Discount int
}

eventBroker.Publish("stream-a", Event_V1{Color: "red", Price: 12.23}, "version", "1")
eventBroker.Publish("stream-a", Event_V2{Color: "blue", Price: 120.50}, "version", "2")

eventConsumer := eventBroker.Consumer("read-group-a")
eventConsumer.Consume(context.Background(), 5, func(events []Event) {
    for _, event := range events {
        switch event.Tag("version") {
            case "1":
                val := &Event_V1{}
                event.Unserialize(val)
            case "2":
                val := &Event_V2{}
                event.Unserialize(val)
        } 
    }
})
```

You can also publish and consume events that have only `meta` values and 
body is omitted (set to `nil`). No data serialisation is needed, that's why 
publishing and consuming such events is a bit faster, but you can
use only simple key-value string values:

```go{2}
eventBroker := engine.GetEventBroker()
eventBroker.Publish("stream-page-views", nil, "url", "/about-us/", "ip", "232.12.24.11")

eventConsumer.Consume(context.Background(), 100, func(events []Event) {
    for _, event := range events {
        event.Tag("url") // "/about-us/"
        event.Tag("ip") // "232.12.24.11"
        event.Tag("missing-key") // ""
    }
})
```

## Garbage collector

All acknowledged events are not removed from stream. You should
check that all consumer groups connected to stream acknowledged this event and then
this event should be removed from stream with [XDEL](https://redis.io/commands/xdel). 
Lucky you BeeORM does it for you. Simply run at least one [background consumer](/guide/background_consumer.html)
and this consumer will automatically remove all acknowledged events from every registered stream.
So if you see that your streams length is growing and all events are acknowledged it means you forgot
to run [background consumer](/guide/background_consumer.html).
