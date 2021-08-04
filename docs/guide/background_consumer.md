# Background consumer

Many operations in BeeORM, that we will explain later on next pages, require
some background asynchronous tasks to be executed. To use these features you must
run at least one goroutine or go program that is executing `beeorm.BackgroundConsumer`:

```go{13-14}
package main

import "github.com/latolukasz/beeorm"

func main() {
   registry := beeorm.NewRegistry()
   // ... register services in registry
   validatedRegistry, deferF, err := registry.Validate(context.Background())
    if err != nil {
        panic(err)
    }
    defer deferF()
    engine := validatedRegistry.CreateEngine(context.Background())
    consumer := beeorm.NewBackgroundConsumer(engine)
    consumer.Digest() // code is blocked here
}

```

This script uses another BeeORM feature called `Event Consumer`. 
You will learn more about on [next pages](/guide/event_broker.html#consuming-events).
