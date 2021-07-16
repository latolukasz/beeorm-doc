# Engine

So far you learned how to create `beeorm.ValidatedRegistry` that holds
information about all database connections and entities. Now it's time to learn
how to create and use a heart of BeeORM - object called `beeorm.Engine`.

## Creating engine

Engine is created using `CreateEngine(context.Background())` method in `beeorm.ValidatedRegistry`:

```go{12}
package main

import "github.com/latolukasz/beeorm"

func main() {
    registry := beeorm.NewRegistry()
    registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/users")
    validatedRegistry, err := registry.Validate(context.Background())
    if err != nil {
        panic(err)
    }
    engine := validatedRegistry.CreateEngine(context.Background())
}  
```

## Cloning engine

Engine is designed to deliver the highest possible performance. 
It's not thread safe, you should use once unique instance in every goroutine.
Engine provides special method ``engine.Clone()`` that creates new `Engine` instance
that copies configuration (e.g. logging) from parent `Engine`. This new cloned instance
can be used then in goroutines:

```go{4,8}
engine := validatedRegistry.CreateEngine(context.Background())

go func() {
    subEngine := engine.Clone()
    subEngine.GetRedis().Get("my_key")
}()
go func() {
    subEngine := engine.Clone()
    subEngine.GetRedis().Get("my_key2")
}()
```

If parent goroutine does not require `Engine` you can create new engine
from `ValidatedRegistry` in new goroutines:

```go{4,8}
go func() {
    engine := validatedRegistry.CreateEngine(context.Background())
    engine.GetRedis().Get("my_key")
}()
go func() {
    engine := validatedRegistry.CreateEngine(context.Background())
    engine.GetRedis().Get("my_key2")
}()
```

Above code is also correct but try to imagine you want to enable debug in
all goroutines. With this code you need to do it in two places:

```go{3,8}
go func() {
    engine := validatedRegistry.CreateEngine(context.Background())
    engine.EnableQueryDebug()
    engine.GetRedis().Get("my_key")
}()
go func() {
    engine := validatedRegistry.CreateEngine(context.Background())
    engine.EnableQueryDebug()
    engine.GetRedis().Get("my_key2")
}()
```

We should always avoid code duplication that's why using engine.Clone() 
is a good practice:

```go{2}
engine := validatedRegistry.CreateEngine(context.Background())
engine.EnableQueryDebug()

go func() {
    subEngine := engine.Clone() // query debug is enabled in subEngine also
    subEngine.GetRedis().Get("my_key")
}()
go func() {
    subEngine := engine.Clone() // query debug is enabled in subEngine also
    subEngine.GetRedis().Get("my_key2")
}()
```

:::warning
Never forget to use different `Engine` instance in every goroutine.
Below code is invalid and may cause many issues:
```go
engine := validatedRegistry.CreateEngine(context.Background())

go func() {
    engine.GetRedis().Get("my_key")
}()
go func() {
    engine.GetRedis().Get("my_key2")
}()
```
:::

Now when you know how to create engine it's time to use it and
execute [MySQL schema update](/guide/schema_update.html).

## Request cache

If you are developing http API it's a good practice to
enable temporary cache for all entity data loaded in one
http request. You can do it using `EnableRequestCache()` method:

```go
engine.EnableRequestCache()
```
