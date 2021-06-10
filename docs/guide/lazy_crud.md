# Lazy CRUD

So far you have learned how to work with [CRUD](/guide/crud.html) actions. 
We are always trying to optimise our code in a way every CRUD operation is as
fast as possible and use minimum number of memory and allocations. 
In some scenarios you may require even better performance, for instance in 
scripts that operates on huge amount of data. BeeORM provides special
feature called *lazy* that helps you get top performance.

## Lazy search

Try to imagine this hypothetical scenario - you need to iterate over all users stored 
in MySQL table and print their emails. Using standard CRUD actions code may you like this:

```go
package main

import "github.com/latolukasz/beeorm"

type UserEntity struct {
	beeorm.ORM
	ID   uint
    FisrtName string `beeorm:"required"`
    LastName string `beeorm:"required"`
    Email string `beeorm:"required"`
}

func main() {
    registry := beeorm.NewRegistry()
    registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/users")
    registry.RegisterEntity(&UserEntity{})
    validatedRegistry, err := registry.Validate(context.Background())
    if err != nil {
        panic(err)
    }
    engine := validatedRegistry.CreateEngine(context.Background())
    
    users := make([]*UserEntity, 0)
    where := beeorm.NewWhere("ID > ? ORDER BY ID")
    pager := beeorm.NewPager(1, 1000)
    lastID := 0
    for {
        where.SetParameter(1, lastID)
        engine.Search(where, pager, &users)
        for _, user := range users {
            fmt.Printf("User with ID %d: %s\n", user.ID, user.Email)
            lastID = user.ID
        }
        if len(users) < pager.GetPageSize() {
            break
        }
	}
}  
```

