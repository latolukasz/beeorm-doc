# Event Broker

[Redis Streams](https://redis.io/topics/streams-intro) is a powerful event broker system that utilizes the concept of consumer groups to allow for the publishing and consumption of events in a distributed system. Here's how it works:

 * A stream is a basic functional block that acts as an event holder, where events can be published and stored. Each stream has a name.
 * A consumer group is another functional block that reads (consumes) events from one or more streams. It has a name and can consume events from multiple streams.
 * Once all the consumer groups in a stream have read an event, it is removed from the stream.

With Redis Streams, you can easily implement an event broker to publish and consume events in your distributed system. To do so, you will need to create a stream and one or more consumer groups, and then publish and consume events as needed.

## Registering Streams

It's easier to understand with an example, so let's define three streams:
 * `stream-a` located in `default` redis pool
 * `stream-b` located in `default` redis pool
 * `stream-c` located in `second` redis pool

and three consumer groups:

 * `read-group-a` that reads events from the `stream-a`   
 * `read-group-ab` that reads events from the `stream-a` and `stream-b`
 * `read-group-c` that reads events from  the `stream-c`

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

:::info
Stream names must be unique, even when they are defined in separate Redis pools.

The following code will return an error:
```go{3,5}
registry := beeorm.NewRegistry()
registry.RegisterRedis("localhost:6379", 0)
registry.RegisterRedisStream("stream-a", "default", []string{"read-group-a", "read-group-ab"})
registry.RegisterRedis("192.168.1.20:6379", 3, "second")
registry.RegisterRedisStream("stream-a", "default", []string{"read-group-c"})
validatedRegistry, err := registry.Validate()
fmt.Print(err) // "stream with name stream-a aleady exists"
```
:::
   
## Publishing  events

To publish your first event, you can use the following code:

```go{3-4}
engine := validatedRegistry.CreateEngine()

eventBroker := engine.GetEventBroker()
eventBroker.Publish("stream-a", "hello")
```

This will publish the event "hello" to the stream-a stream.

You can also publish a struct as an event, like this:

```go{9}
engine := validatedRegistry.CreateEngine()

type TestStructEvent struct {
    Color string
    Price  float32
}

eventBroker := engine.GetEventBroker()
eventBroker.Publish("stream-b", TestStructEvent{Color: "red", Price: 12.34})
```

If you need to publish more than one event, it is recommended to use the `EventFlusher`:

```go{3-6}
engine := validatedRegistry.CreateEngine()

eventFlusher := engine.GetEventBroker().NewFlusher()
eventFlusher.Publish("stream-a", "hello")
eventFlusher.Publish("stream-b", testStructEvent{Color: "red", Price: 12.34})
eventFlusher.Flush() // both events will be published to the Redis streams
```

:::tip
Using the `EventFlusher` is much faster than publishing events one by one, as it uses Redis pipelines behind the scenes.
:::

## Consuming events

To consume events, you will need to create an `EventsConsumer` object:

```go
eventConsumer := engine.GetEventBroker().Consumer("read-group-ab")
```

This eventConsumer is connected to the Redis consumer group `read-group-ab`, which is configured to read events from the streams `stream-a` and `stream-b` (as per the [streams configuration](/guide/event_broker.html#registering-streams)).

To start consuming events, you can use the following code:

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

The `eventConsumer.Consume()` function takes a parameter called limit, which specifies the maximum number of events that should be read from the streams in each iteration. In the example above, the limit is set to 5, so we received 2 events. If we set the limit to 1, we will see a difference in the output (as shown in the bash tab).

For example:

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

In the examples above, you may have noticed that the message "Consuming finished" is never printed to the console. This is because `eventConsumer.DisableBlockMode()` operates in blocking mode by default, meaning that it waits for new events to arrive. To disable this behavior, you can use the `eventConsumer.DisableLoop()` method. In non-blocking mode, the consumer reads all available events from the streams and then finishes.

For example:


<code-group>
<code-block title="code">
```go{1}
eventConsumer.DisableBlockMode()
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

## Scaling consumers

By default, you can only run one `EventsConsumer.Consume()` function at a time. BeeORM creates a consumer with the name `consumer-1`. In this approach, all events are consumed in the order they were published (first-in, first-out). If you try to run a consumer that is already running, the `Consume()` method will return false.

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

Behind the scenes, BeeORM creates a [Redis lock](/guide/redis_operations.html#distributed-lock) to prevent multiple consumers from running at the same time. If the consumer is working in blocking mode (the default behavior) and the developer flushes Redis and removes the Redis lock, the `Consume()` method will stop and return false.

In some cases, you may need to run more than one consumer at the same time. BeeORM provides the `EventsConsumer.ConsumeMany()` method, which takes an additional parameter nr – a unique number for the consumer:

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

Upscaling is easy - simply run another `Consumer()` with higher number (`3` in our example).
Problem starts when you want to downscale your consumers. In above example we are running two consumers.
Now imagine we want to run only one `consumer-1`. Of course first you should stop `consumer-2`.
But there is a chance `consumer-2` has still some `pending` events that are not [acknowledged](https://redis.io/commands/XACK).
You must move these events to another active consumer. In our case we should move events from
`consumer-2` to `consumer-1`. You can do it with `EventsConsumer.Claim()` method:

Scaling up consumers is easy – simply run another `Consumer()` with a higher number (e.g. 3 in our example). However, scaling down can be more challenging. For instance, if you are currently running two consumers (`consumer-1` and `consumer-2`) and want to reduce this number to one (`consumer-1`), you will need to stop `consumer-2` first. There is a chance that `consumer-2` still has some pending events that have not been [acknowledged](https://redis.io/commands/XACK). In this case, you must move these events to another active consumer (e.g. `consumer-1`). You can do this using the `EventsConsumer.Claim()` method:

```go{2}
eventConsumer := eventBroker.Consumer("read-group-ab")
eventConsumer.Claim(2, 1)
````

This will move all pending events from `consumer-2` to `consumer-1`. You can then stop `consumer-2` and continue processing events with `consumer-1`.

## Event metadata

You can assign metadata to events using the optional `meta` parameter in the `Publish()` method. Simply provide a string key and a string value for the metadata. For example:

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

You can also publish events with only metadata and an empty body. This can be useful if you want to publish simple key-value pairs without the need for data serialization. In this case, the body of the event can be set to nil. This can make publishing and consuming such events slightly faster, but keep in mind that you can only use simple string key-value pairs for the metadata.

Here is an example of how to publish and consume events with metadata and an empty body:

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

## Stream Garbage Collector

By default, acknowledged events are not removed from streams. You need to check that all consumer groups connected to the stream have acknowledged the event before it can be removed from the stream using the [XDEL](https://redis.io/commands/xdel) command. Fortunately, BeeORM takes care of this for you by running at least one [background consumer](/guide/background_consumer.html). This consumer will automatically remove all acknowledged events from every registered stream. If you notice that the length of your streams is increasing and all events are being acknowledged, it means you forgot to run a [background consumer](/guide/background_consumer.html).

## Stream Statistics

You can use `GetStreamsStatistics()` to retrieve the current Redis stream statistics. This method returns a slice of `*beeorm.RedisStreamStatistics` that contains useful information about the status of the stream:

```go
//statistics for all registered streams
allStreamsStatistics := engine.GetEventBroker().GetStreamsStatistics()
allStreamsStatistics[0].Stream // "stream-a"
allStreamsStatistics[1].Stream // "stream-b"
allStreamsStatistics[2].Stream // "stream-c"
// or only for some streams:
chosenStreamsStatistics := engine.GetEventBroker().GetStreamsStatistics("stream-a", "stream-b")
allStreamsStatistics[0].Stream // "stream-a"
allStreamsStatistics[1].Stream // "stream-b"
```

The `RedisStreamStatistics` type contains the following fields:

```go
RedisStreamStatistics {
	Stream             string // name of the stream
	RedisPool          string // redis pool name
	Len                uint64 // number of events in stream
	OldestEventSeconds int // how old (in seconds) in the oldest event in a stream
	Groups             []*beeorm.RedisStreamGroupStatistics // stream groups statistics
}
```

To get statistics for a specific stream, use the `GetStreamStatistics()` method:

```go
streamAStatistics := engine.GetEventBroker().GetStreamStatistics("stream-a")
```

To get stream group statistics, use the `GetStreamGroupStatistics()` method, which returns a `*beeorm.RedisStreamGroupStatistics` type:

```go
streamAGroupMyConsumerStatistics := engine.GetEventBroker().GetStreamGroupStatistics("stream-a", "my-consumer")
```

The `RedisStreamGroupStatistics` type contains the following fields:

```go
type RedisStreamGroupStatistics struct {
	Group                 string // group name
	Lag                   int64 // number of entries in the stream waiting to be delivered to the group's consumers
	Pending               uint64 // number of events still pending acknowledgement
	LastDeliveredID       string // ID of the last delivered event
	LastDeliveredDuration time.Duration // time of the last delivered event
	LowerID               string // ID of the oldest event in this group
	LowerDuration         time.Duration // time of the oldest event
	Consumers             []*RedisStreamConsumerStatistics // all consumer statistics
}

```

:::tip
It is important to check the value of `RedisStreamStatistics.OldestEventSeconds`. This value should be as low as possible (close to zero). If it is high and increasing, it means that your consumers are unable to process incoming events in a timely manner. One solution is to run another consumer or optimize the code used in the consumer.
:::
