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
validatedRegistry, deferF, err := registry.Validate()
if err != nil {
    panic(err)
}
defer deferF()
engine := validatedRegistry.CreateEngine()
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

## Getter with setter

Local cache has very useful method `GetSet()` that
simplify your code. 

Instead of:

```go
val, found := cache.Get("key")
if !found {
    val = ... // calculate value
    cache.Set("key")
}
return val
```

you can do it like this:

```go
// cache value for 30 seconds
val := cache.GetSet("key", time.Second * 30, func() {
    return ... // calculate value
})
```

As you can see in above example you can also define Time to Live (TTL). 
Our value will be cached for 30 second and after this period it's evicted.


## Hashes

Local cache provides methods used to get and set hashes, similar
to [redis hashes](https://redis.io/topics/data-types#hashes) concept:

```go{2,4,9,10}
cache := engine.GetLocalCache("test")
cache.HMSet("some-key", map[string]interface{}{"firstName": "Tom", "lastName": "Malcovic"})

values := cache.HMGet("some-key", "firstName", "lastName", "age")
values["firstName"] // "Tom"
values["lastName"] // "Malcovic"
values["age"] // nil

cache.HMSet("some-key", map[string]interface{}{"age": 18})
values = cache.HMGet("some-key", "firstName", "age", "age")
values["firstName"] // "Tom"
values["age"] // 18
```

## Removing values

Use ``Remove()`` method to remove values from local cache:

```go
cache.Remove("key1", "key2")
```


## Removing all values

Use ``Clear()`` method to remove all values from local cache:

```go
cache.Clear()
```
