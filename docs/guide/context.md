# Context

In this section, we will explore the fundamental element of BeeORM: the `beeorm.Context` object, and discover how to create and effectively employ it.

In the previous chapter, you gained insight into creating the `Engine` object, an essential component for accessing data pools and managing registered entities. 
The `beeorm.Context` plays a pivotal role in all BeeORM methods, typically serving as the initial argument, facilitating data retrieval and modification in your databases, which forms the cornerstone of every ORM's functionality.

## Creating the Context

To instantiate a `beeorm.Context` object, you should invoke the `NewContext()` method on a `beeorm.Engine` object. 
Here's a comprehensive example illustrating how to create a `beeorm.Context`:

```go{15}
package main

import (
	"context"
    "github.com/latolukasz/beeorm/v3"
)

func main() {
    registry := beeorm.NewRegistry()
    // ... register data pools and entities
    engine, err := registry.Validate()
    if err != nil {
        panic(err)
    }
    c := engine.NewContext(context.Background())
}  
```

## Context Query Debug

You have the option to activate debug mode for each `Context` in order to observe all the queries executed for MySQL, Redis, and the local cache.

```go
// all queries
context.EnableQueryDebug()
// only queries to MySQL
context.EnableQueryDebugCustom(true, false, false)
// only queries to MySQL and Redis
engine.EnableQueryDebugCustom(true, true, false)
```

Here is an example of how the debug output looks:

![An image](/query_debug_1.png)

Every query is displayed in two lines. The first line (with a white background) contains the following fields:

* BeeORM logo
* query source (MySQL, redis, local cache)
* data pool name
* operation
* query time in milliseconds

The length of the white bar is correlated with the query time. If a query takes more time, the bar is longer and more red. This helps you to identify slow queries. The full query is displayed on the second line.

## Context Meta Data

You can use `beeorm.Context` to store extra parameters using `SetMetadata` and `GetMetaData` methods:

```go
context.SetMetaData("source": "cron_A")
context.GetMetaData() // {"source": "cron_A"}
```

## Context clone

When working with BeeORM, it's essential to adhere to a golden rule: never share the same instance of `beeorm.Context` among goroutines. 
If you intend to run your code in a goroutine, you should create a new `beeorm.Context` from the `Engine`, as demonstrated in the following example:

```go{5}
    c := engine.NewContext(context.Background())
    c.SetMetaData("admin_user_id", 34)
    c.EnableQueryDebug()
    go func() {
        c2 := engine.NewContext(context.Background())
        c2.GetMetaData() // empty
    }()
```

However, there is a caveat to this approach. As observed, the new `Context` (c2) lacks metadata, and the debug mode is not enabled.

To address this issue, the Context provides a specialized method called `Clone()`, which generates a new instance of the `Context` containing a copy of the metadata and inherits the metadata and debug mode is the same as in cloned Context:

```go{5}
    c := engine.NewContext(context.Background())
    c.SetMetaData("admin_user_id", "34")
    c.EnableQueryDebug()
    go func() {
        c2 := engine.Clone()
        c2.GetMetaData() // {"admin_user_id", "34"}
    }()
```

Alternatively, you can clone a `Context` and provide a new context.Context as an argument using the `CloneWithContext()` method:
```go{3}
    c := engine.NewContext(context.Background())
    go func() {
        c2 := engine.CloneWithContext(context.WithDeadline(c.Ctx(), time.Now().Add(time.Second * 5)))
    }()
```