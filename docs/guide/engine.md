# Engine

So far you have learned how to create `beeorm.ValidatedRegistry` that holds
information about all database connections and entities. Now it's time to learn
how to create and use a heart of BeeORM - object called `beeorm.Engine`.

## Creating engine

Engine is created using `CreateEngine(context.Background())` method in `beeorm.ValidatedRegistry`:

```go{13}
package main

import "github.com/latolukasz/beeorm"

func main() {
    registry := beeorm.NewRegistry()
    registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/users")
    validatedRegistry, deferF, err := registry.Validate()
    if err != nil {
        panic(err)
    }
    defer deferF()
    engine := validatedRegistry.CreateEngine()
}  
```

## Request cache

If you are developing http API it's a good practice to
enable temporary cache for all entity data loaded in one
http request. You can do it using `EnableRequestCache()` method:

```go
engine.EnableRequestCache()
```
