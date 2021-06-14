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

Above code is correct and quite fast, but as said before we need to traverse 
big amount of data and every nanosecond matters. ``engine.Search()`` creates for every found
row new instance of UserEntity and fills its fields with 
data using [reflection](https://golang.org/pkg/reflect/). It takes some time of course and 
sometimes also requires memory allocations.
In our scenario we need only `ID` and `Email`, other fields like `FisrtName` and `LastName` are not
used in our code. BeeORM provides special search methods with suffix ``Lazy``. The difference is
that entity fields remind unfilled (except ID field). Thanks to that this method is faster that ``engine.Search()`` 
because there is no need to use reflection:


```go{1,8}
engine.SearchLazy(where, pager, &users)
for _, user := range users {
    user.IsLazy() // true
    user.Email // ""
    user.FirstName // ""
    user.LastName // ""
    user.Supervisor // nil
    fmt.Printf("User with ID %d: %s\n", user.ID, user.GetFieldLazy(engine, "Email").(string))
} 
```

You can check if entity is lazy with ``IsLazy()`` method. It returns true if entity was loaded
using lazy search methods. Such entity is in ``lazy`` mode. All fields are empty and you should 
never use them in your code. Use ``GetFieldLazy()`` method instead. This method returns raw data.

See table below to understand how entity fields are returned with this method:

| field type        | returned data         | comment         |
| ------------- |:-------------:|:-------------:|
| one-one reference      | uint64  | returns ID of referenced entity or `0` if nil  |
| uint8,uint16,uin32,uin64,uint      | uint64  |  |
| int8,int16,in32,in64,int      | int64  |  |
| bool      | bool  |  |
| float32,float64      | float64  |  |
| time.Time      | int64  | returns unix timestamp in seconds  |
| string      | string  |  |
| *uint8,*uint16,*uin32,*uin64,*uint      | uint64,nil  |  |
| *int8,*int16,*in32,*in64,*int      | int64,nil  |  |
| string  `beeorm:"enum=XXX"`     | int  | [index](/guide/validated_registry.html#getting-enum-settings) of value in Enum or 0 if empty |
| []byte      | []byte,nil  |  |

