# The Engine

In this section, you will learn how to create and utilize the central component of BeeORM: the `beeorm.Engine` object. You may recall that the `beeorm.ValidatedRegistry` holds information about all the database connections and entities in your system. The `beeorm.Engine` uses this information to manage and execute database operations. With the `beeorm.Engine`, you can easily connect to your databases, create and modify entities, and query your data. Let's dive in and see how to use this powerful tool.

## Creating the Engine

To create an `beeorm.Engine` object, you can call the `CreateEngine()` method on a `beeorm.ValidatedRegistry` object. Here is an example of how to create an `beeorm.Engine` in Go:

```go{13}
package main

import "github.com/latolukasz/beeorm"

func main() {
    registry := beeorm.NewRegistry()
    registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/users")
    validatedRegistry, err := registry.Validate()
    if err != nil {
        panic(err)
    }
    engine := validatedRegistry.CreateEngine()
}  
```

## Request Cache

If you are building an `HTTP API`, it may be beneficial to enable a temporary cache for entity data loaded during a single HTTP request. You can do this by calling the `EnableRequestCache()` method on the `beeorm.Engine` object:

```go
engine.EnableRequestCache()
```

This can help improve performance by reducing the number of database queries needed to fulfill a request. However, keep in mind that using a request cache can increase memory usage and may not be suitable for all applications.
