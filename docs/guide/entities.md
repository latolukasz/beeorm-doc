# Entities

In this section you will learn how to define golang structs that
are used to represent data stored in database. In BeeORM we call these 
structs **Entity**.

## The simplest Entity

Entity is a struct that follows 3 rules:
 * first field is an anonymous with type of `beeorm.ORM`
 * second field has a name **ID** with type any of `uint`, `uint8`, `uin16`, `uint32`, `uint64`
 * everywhere in code struct must be used as a reference

```go
import "github.com/latolukasz/beeorm"

type SimpleEntity struct {
	beeorm.ORM
	ID   uint
}
```

## Registering Entity

Every entity must be registered in `beeomr.Registry`:

```go
var simpleEntity *SimpleEntity

registry := beeorm.NewRegistry()
registry.RegisterEntity(simpleEntity) 
```

As you can see you must pass reference to actual variable, not a string 
with name of entity. Thanks to this approach if entity was removed from your
code you will see compilation error in above code.
