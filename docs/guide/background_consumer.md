# Background Consumer

Many operations in BeeORM, which will be explained in later pages, require asynchronous tasks to be executed in the background. To use these features, you must run at least one goroutine or Go program that executes `beeorm.BackgroundConsumer`:

```go{21-28}
package main

import "github.com/latolukasz/beeorm"

func main() {
   registry := beeorm.NewRegistry()
   // ... register services in registry
   validatedRegistry, err := registry.Validate()
    if err != nil {
        panic(err)
    }
    
    waitGroup := &sync.WaitGroup{}
    
    ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM, syscall.SIGKILL)
    defer stop()
    go func() {
      waitGroup.Add(1)
      defer waitGroup.Done()
      engine := validatedRegistry.CreateEngine()
      consumer := beeorm.NewBackgroundConsumer(engine)
      for {
			if !consumer.Digest(ctx) {
				time.Sleep(time.Second * 10)
				continue
			}
			return
		}
    }
    <-ctx.Done()
    fmt.Print("CLOSING...")
    stop()
    waitGroup.Wait()
    fmt.Println("[CLOSED]")
}
```

:::tip
It's important to properly terminate your application as shown above. The `beeorm.BackgroundConsumer` needs time to finish any active tasks before the application is closed.
:::