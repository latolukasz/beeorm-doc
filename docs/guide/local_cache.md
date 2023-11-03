# Local Cache

In this section, you will learn how to use the local cache to store data in the application's memory.

First, we need to configure the data pools and engine. In this example, we will create two pools: `default`, 
without any limit, and `test`, which can hold up to 100 elements:

```go
registry := beeorm.NewRegistry()
registry.RegisterLocalCache(beeorm.DefaultPoolCode, 0)
registry.RegisterLocalCache("test", 100)
registry.RegisterLocalCache(100, "test")
engine, err := registry.Validate()
if err != nil {
    panic(err)
}
c := engine.NewContext(context.Background())
```

## Accessing the Local Cache Data Pool

Now we are ready to use the local cache data pool to execute queries. This pool also provides a few useful methods:

```go
cache := engine.LocalCache(beeorm.DefaultPoolCode) // or c.Engine().LocalCache(beeorm.DefaultPoolCode)
config := cache.GetConfig()
config.GetCode() // "default"
config.GetLimit() // 1000

cache = engine.LocalCache("test")
config = cache.GetConfig()
config.GetCode() // "test"
config.GetLimit() // 100
```

## Retrieving a Single Value

Use the `Get()` method to retrieve a single value from the local cache:

```go{2}
cache := engine.LocalCache(beeorm.DefaultPoolCode)
value, found := cache.Get(c, "test-key")
if found {
    fmt.Printf("Found: %v\n", value)
} else {
    fmt.Println("Not found")
}
```

## Storing a Value

Use the `Set()` method to store a single value in the local cache:

```go{2,4}
cache := engine.LocalCache(beeorm.DefaultPoolCode)
cache.Set(c, "test-key", "my value")
cache = engine.LocalCache("test")
cache.Set(c, "another-key", &SomeStruct{Field: "hello"})
```

## Removing Stored Values

Use the `Remove()` method to remove one or more values from the local cache:

```go
cache.Remove(c, "key1")
```

## Clearing the Cache

Use the `Clear()` method to remove all values from the local cache:

```go
cache.Clear(c)
```
