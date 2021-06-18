# Local cache

In this section you will learn how to use local cache.
Local means that data is stored in application memory.
First we need to configure data pools and engine. In our example
we will create two pools - one with name `default` that can hold max 1000 elements
and another with name `test` with max 100 elements:

```go
registry := beeorm.NewRegistry()
registry.RegisterLocalCache(1000)
registry.RegisterLocalCache(100, "test")
validatedRegistry, err := registry.Validate(context.Background())
if err != nil {
    panic(err)
}
engine := validatedRegistry.CreateEngine(context.Background())
```

## Local cache data pool

Now we are ready to get local cache data pool that is used to execute all queries.
This pool also provides few useful methods:

```go
db := engine.GetLocalCache()
config := db.GetPoolConfig()
config.GetCode() // "default"
config.GetLimit() // 1000
```

## Getting one value

Use ``Get()`` method to load one value from local cache:

```go{2}
cache := engine.GetLocalCache()
value, found := cache.Get("test-key")
if found {
    fmt.Printf("Found: %v\n", value)
} else {
    fmt.Println("Not found")
}
```

## Getting many values

Use ``MGet()`` method to load many values from local cache:

```go{2}
cache := engine.GetLocalCache("test")
values := cache.MGet("test-key-1", "test-key-2", "test-key-3")
for _, value := range values {
    if value != nil {
        fmt.Printf("Found: %v\n", value)
    } else {
        fmt.Println("Not found")
    }
}
```

## Setting one value

Use ``Set()`` method to add one value to local cache:

```go{2,4}
cache := engine.GetLocalCache()
cache.Set("test-key", "my value")
cache = engine.GetLocalCache("test")
cache.Set("another-key", SomeStruct{Field: "hello"})
```

## Setting many values

Use ``MSet()`` method to add one value to local cache:

```go{2,4}
cache := engine.GetLocalCache()
cache.MSet("key-1", "ValueForKey1", "key-2", "ValueForKey2")
```
