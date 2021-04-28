# Engine

So far you learned how to create `beeorm.ValidatedRegistry` that holds
information about all database connections and entities. Now it's time to learn
how to create and use a heart of BeeORM - object called `beeorm.Engine`.

## Creating engine

Engine is created using `CreateEngine()` method in `beeorm.ValidatedRegistry`:

```go{12}
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

Engine is used in actions that are executing real connections to databases.
All these actions are thread safe so probably you are asking yourself why
not to create engine once in your application and share it across all goroutines?
Answer is simple - you can enable logging for all queries executed in engine. 
That's why you should create separate engine in every http request goroutine
and go service application.

For instance if you are using [Gin Web Framework](https://gin-gonic.com/) you
should use middleware to create engine for every http request:

```go{20-21}
package main

import (
    "github.com/gin-gonic/gin"
    "github.com/latolukasz/beeorm"
)

const ServiceBeeOrmEngine = "beeorm.engine"

func main() {
    registry := beeorm.NewRegistry()
    registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/users")
    validatedRegistry, err := registry.Validate()
    if err != nil {
        panic(err)
    }
    
    router := gin.New()
    router.Use(func(c *gin.Context) {
		engine := validatedRegistry.CreateEngine()
		c.Set(ServiceBeeOrmEngine, engine)
	})
}  
```

::: tip
Creating `beeorm.Engine` is very fast, it uses only one memory allocation.
So you can create it in every http request (as showed above). If you
want to avoid this extra memory and time in requests where engine is not needed
you may change above code to create engine only when requested.
:::

Now when you know how to create engine it's time to use it and
execute [MySQL schema update](/guide/schema_update.html).
