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

## Handling errors

By default, all events consumed in `Consume()` are automatically
[acknowledged](https://redis.io/commands/XACK) when function `Consume()` 
is executed. It works fine and provides top performance (all events are acknowledged 
at one with one request to redis) but problems starts when one event is broken and your
code `Consume()` panics. See below example:


<code-group>
<code-block title="code">
```go{15-17}
eventBroker := engine.GetEventBroker()
flusher := eventBroker.NewFlusher()
flusher.Publish("stream-a", "a")
flusher.Publish("stream-a", "b")
flusher.Publish("stream-a", "c")
flusher.Publish("stream-a", "4")
flusher.Flush()

eventConsumer := eventBroker.Consumer("read-group-a")
eventConsumer.DisableLoop()
eventConsumer.Consume(5, func(events []Event) {
    var val string
    for _, event := range events {
        event.Unserialize(&val)
        if val == "c" {
            panic("broken event c")
        }
        fmt.Printf("EVENT %s\n", val)
    }
})
fmt.Println("FINISHED")
```
</code-block>

<code-block title="bash">
```
EVENT a
EVENT b
panic: runtime error: broken event c
```
</code-block>
</code-group>

As you can see in above example (check `bash` tab) 
event `a` and `b` was consumed and then whole code panics.
Because `Consume()` function is not finished non of the vents was
actually acknowledged (removed) in stream that's why whne you consumer 
code again you wull get the same events:

<code-group>
<code-block title="code">
```go
eventConsumer.Consume(5, func(events []Event) {
    var val string
    for _, event := range events {
        event.Unserialize(&val)
        if val == "c" {
            panic("broken event c")
        }
        fmt.Printf("EVENT %s\n", val)
    }
})
fmt.Println("FINISHED")
```
</code-block>

<code-block title="bash">
```
EVENT a
EVENT b
panic: runtime error: broken event c
```
</code-block>
</code-group>

Check `bash` tab above. Again we got event `a` and `b`. 
If our application restarts automatically then we ended in loop
and our stream will grow when new events are pushed because our code
always panics when event `c` is consumed. 

We have few options to deal with this problem. Event has special method `Ack()` 
that is acknowledging event in stream immediately. Let's see what happened when we 
used it:

<code-group>
<code-block title="code">
```go{5}
eventConsumer.Consume(5, func(events []Event) {
    var val string
    for _, event := range events {
        event.Unserialize(&val)
        event.Ack()
        if val == "c" {
            panic("broken event c")
        }
        fmt.Printf("EVENT %s\n", val)
    }
})
fmt.Println("FINISHED")
```
</code-block>

<code-block title="bash">
```
EVENT a
EVENT b
panic: runtime error: broken event c
```
</code-block>
</code-group>

When we run our code again:
```
panic: runtime error: broken event c
```

Well, it's a bit better - event `a` and `b` were acknowledged before
that's why when we run our code again first event we got is `c`.
Problem is not solved yet - our consumer is still blocked, 
stream is growing and consumer is a bit
slower because running `event.Ack()` for every event generates request to redis.

Now it's time to deal with our broken event:

<code-group>
<code-block title="code">
```go{5-9}
eventConsumer.Consume(5, func(events []Event) {
    var val string
    for _, event := range events {
        func() {
            defer func() {
                if rec := recover(); rec != nil {
                     fmt.Printf("GOT ERROR %v\n", rec)
                }
            }()
            event.Unserialize(&val)
            if val == "c" {
                panic("broken event c")
            }
            fmt.Printf("EVENT %s\n", val)
        }()
    }
})
fmt.Println("FINISHED")
```
</code-block>

<code-block title="bash">
```
EVENT a
EVENT b
GOT ERROR broken event c
EVENT d
FINISHED
```
</code-block>
</code-group>

Now all events are consumed, stream is empty. Of course in real life
you should not remove broken event but send them to special log where 
you should investigate what is wrong. Above code works but is quite complicated
and hard to read. Lucky you BeeORM provides a better way to handle broken events
in consumers - you can register special function with `SetErrorHandler()`.
Above code can be then converted into:

<code-group>
<code-block title="code">
```go{1-5}
consumer.SetErrorHandler(func(err error, event Event) {
    var val interface{}
    event.Unserialize(&val)
    fmt.Printf("GOT ERROR %s IN EVENT %d: %v\n", err.Error(), event.ID(), val)
})
eventConsumer.Consume(5, func(events []Event) {
    var val string
    for _, event := range events {
        event.Unserialize(&val)
        if val == "c" {
            panic("broken event c")
        }
        fmt.Printf("EVENT %s\n", val)
    }
})
fmt.Println("FINISHED")
```
</code-block>

<code-block title="bash">
```
EVENT a
EVENT b
GOT ERROR broken event c IN EVENT 1518951480106-0: c
EVENT d
FINISHED
```
</code-block>
</code-group>

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
eventConsumer.Consume(5, func(events []Event) {
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
body is omitted (set to `nil). No data serialisation is needed, that's why 
publishing and consuming such events is a bit faster, but you can
use only simple key-value string values:

```go{2}
eventBroker := engine.GetEventBroker()
eventBroker.Publish("stream-page-views", nil, "url", "/about-us/", "ip", "232.12.24.11")

eventConsumer.Consume(100, func(events []Event) {
    for _, event := range events {
        event.Tag("url") // "/about-us/"
        event.Tag("ip") // "232.12.24.11"
        event.Tag("missing-key") // ""
    }
})
```
