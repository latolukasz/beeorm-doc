# Local Cache

In this section, you will learn how to use the local cache to store data in the application's memory.

First, we need to configure the data pools and engine. In this example, we will create two pools: `default`, which can hold up to 1000 elements, and `test`, which can hold up to 100 elements:

```go
registry := beeorm.NewRegistry()
registry.RegisterLocalCache(1000)
registry.RegisterLocalCache(100, "test")
validatedRegistry, err := registry.Validate()
if err != nil {
    panic(err)
}
engine := validatedRegistry.CreateEngine()
```

## Accessing the Local Cache Data Pool

Now we are ready to use the local cache data pool to execute queries. This pool also provides a few useful methods:

```go
cache := engine.GetLocalCache()
config := cache.GetPoolConfig()
config.GetCode() // "default"
config.GetLimit() // 1000

cache = engine.GetLocalCache("test")
config = cache.GetPoolConfig()
config.GetCode() // "test"
config.GetLimit() // 100
```

## Retrieving a Single Value

Use the `Get()` method to retrieve a single value from the local cache:

```go{2}
cache := engine.GetLocalCache()
value, found := cache.Get("test-key")
if found {
    fmt.Printf("Found: %v\n", value)
} else {
    fmt.Println("Not found")
}
```

## Retrieving Multiple Values

Use the `MGet()` method to retrieve multiple values from the local cache:

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

## Storing a Single Value

Use the `Set()` method to store a single value in the local cache:

```go{2,4}
cache := engine.GetLocalCache()
cache.Set("test-key", "my value")
cache = engine.GetLocalCache("test")
cache.Set("another-key", SomeStruct{Field: "hello"})
```

## Storing Multiple Values

Use the `MSet()` method to store multiple values in the local cache:

```go{2,4}
cache := engine.GetLocalCache()
cache.MSet("key-1", "ValueForKey1", "key-2", "ValueForKey2")
```

## Getter with Setter

The local cache has a very useful method called `GetSet()` that simplifies the process of retrieving and storing values.

Instead of writing code like this:

```go
val, found := cache.Get("key")
if !found {
    val = ... // calculate value
    cache.Set("key", val)
}
return val
```

You can use `GetSet()` like this:

```go
// cache value for 30 seconds
val := cache.GetSet("key", time.Second * 30, func() {
    return ... // calculate value
})
```

As shown in the example above, you can also specify a Time to Live (TTL) for the value. In this case, the value will be cached for 30 seconds before it is evicted.

## Removing Stored Values

Use the `Remove()` method to remove one or more values from the local cache:

```go
cache.Remove("key1", "key2")
```


## Clearing the Cache

Use the `Clear()` method to remove all values from the local cache:

```go
cache.Clear()
```
