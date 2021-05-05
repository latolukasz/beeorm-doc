# Async consumer

Many operations in BeeORM, that we will explain later on next pages, require
some background asynchronous tasks to be executed. To use these features you must
run at least one goroutine or go program that is executing `beeorm.AsynConsumer`:

## Running async consumer

```go{13-14}
package main

import "github.com/latolukasz/beeorm"

func main() {
   registry := beeorm.NewRegistry()
   registry.RegisterEnum("colors", "red", "blue", "yellow")
   validatedRegistry, err := registry.Validate()
    if err != nil {
        panic(err)
    }
    engine := validatedRegistry.CreateEngine()
    consumer := beeorm.NewAsyncConsumer(engine)
    consumer.Digest(context.Background()) // code is blocked here
}

```

::: tip
In above example `context.Background()` is used. In production 
environment you should consider using 
`context.WithCancel(context.Background())` together with `os.Signal` to be sure
that `beeorm.AsynConsumer` is closed gracefully.
:::

## Heart beat

TODO

## Disabling loop

`consumer.Digest()` method is waiting for new events in special [redis streams](https://redis.io/topics/streams-intro)
in a blocking mode. It means go execution stops on this line until you will kill application. 
You can disable blocking mode with `consumer.DisableLoop()` method. Consumer reads all events 
in redis streams and if there are no new events this `Digest()` will exit:

```go{2}
consumer := beeorm.NewAsyncConsumer(engine)
consumer.DisableLoop()
consumer.Digest(context.Background())
fmt.Println("executed")
```

## Setting script execution limits

TODO

## Handling errors

TODO

## Log logger

TODO

