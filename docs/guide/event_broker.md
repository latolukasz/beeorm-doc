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

## Consuming events

Now, when we have few events pushed to our streams it's time
to consume them. First you need to create `EventsConsumer` object
that later we will use to read events:

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
eventConsumer.Consume(5, func(events []Event) {
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
FINISHED
```
</code-block>
</code-group>

`eventConsumer.Consume()` requires as a firts argument
limit of events that should be read from streams in every iteration. In above example
we allow max `5` events, that's why we received `2`. Now let' see how it works 
when this limit is set to `1` (see difference in bash tab): 

<code-group>
<code-block title="code">
```go{1}
eventConsumer.Consume(1, func(events []Event) {
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

Did you notice that above examples never prints `FINISHED` to console?
It's because by default `eventConsumer.Consume()` works in blocking mode - it waits
for new events to come. You can disable this mode with `eventConsumer.DisableLoop()` 
method. In non-blocking mode consumer reads all events from streams and finish: 


<code-group>
<code-block title="code">
```go{1}
eventConsumer.DisableLoop()
eventConsumer.Consume(10, func(events []Event) {
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


## Consumer limits

By default, you can run only one `EventsConsumer.Consume()` at the same time.
With this approach all events are consumed in the same order events
are published (first in - first out):

```go{5}
eventConsumer := eventBroker.Consumer("read-group-ab")
go eventConsumer.Consume(5, func(events []Event) {})

// will panic with "consumer for group read-group-ab limit 1 reached" error
go eventConsumer.Consume(5, func(events []Event) {})
```

If you need to run more consumers simply use `SetLimit()` method:

```go{2}
eventConsumer := eventBroker.Consumer("read-group-ab")
eventConsumer.SetLimit(2) // allows to run up to 2 consumers
go eventConsumer.Consume(5, func(events []Event) {})
go eventConsumer.Consume(5, func(events []Event) {}) // works
go eventConsumer.Consume(5, func(events []Event) {}) // panics
```

## Handling consumer errors

* TODO ack and skip
* TODO error log

## Stream garbage collector

TODO
