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

```go{2}
registry := beeorm.NewRegistry()
registry.RegisterEntity(&beeorm.NewRegistry()) 
```

As you can see you must pass reference to actual variable, not a string 
with name of entity. Thanks to this approach if entity was removed from your
code you will see compilation error in above code.

## Defining data pools

### Mysql pool

By default Entity is connected to `default` [data pool](/guide/datapools.html#mysql-pool).
You can define different pool with special setting **mysql=pool_name** put in tag `beeorm` 
for `beeorm.ORM` field:

```go{6}
package main

import "github.com/latolukasz/beeorm"

type OrderEntity struct {
	beeorm.ORM `beeorm:"mysql=sales"`
	ID   uint
}

func main() {
    registry := beeorm.NewRegistry()
    registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/sales", "sales") 
    registry.RegisterEntity(&OrderEntity{}) 
}  
```
