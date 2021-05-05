# Background consumer

Many operations in BeeORM, that we will explain later on next pages, require
some background asynchronous tasks to be executed. To use these features you must
run at least one goroutine or go program that is executing `beeorm.BackgroundConsumer`:

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
    consumer := beeorm.NewBackgroundConsumer(engine)
    consumer.Digest(context.Background()) // code is blocked here
}

```

::: tip
In above example `context.Background()` is used. In production 
environment you should consider using 
`context.WithCancel(context.Background())` together with `os.Signal` to be sure
that `beeorm.BackgroundConsumer` is closed gracefully.
:::

Background consumer
TODO describe methods from consumers
