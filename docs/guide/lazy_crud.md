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
	ID         uint
    FisrtName  string `beeorm:"required"`
    LastName   string `beeorm:"required"`
    Email      string `beeorm:"required"`
    Age         uint8
    Supervisor *UserEntity
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
    email := user.GetFieldLazy(engine, "Email").(string)
    fmt.Printf("User with ID %d: %s\n", user.ID, email)
} 
```

You can check if entity is lazy with ``IsLazy()`` method. It returns true if entity was loaded
using lazy search methods. Such entity is in ``lazy`` mode. All fields are empty and you should 
never use them in your code. Use ``GetFieldLazy()`` method instead. This method returns raw data.

Below table demonstrates how entity field value is returned by this ``GetFieldLazy()`` method:

| field type        | returned data         | comment         |
| ------------- |:-------------:|:-------------:|
| one-one reference      | uint64  | returns ID of referenced entity or `0` if nil  |
| one-many reference      | []uint64  | returns IDs of referenced entities  |
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
| []string  `beeorm:"set=XXX"`     | []int  | slice of [indexes](/guide/validated_registry.html#getting-enum-settings) of values in Set  |
| *bool      | bool,nil  |  |
| *float32,*float64      | float64,nil  |  |
| *time.Time      | int64,nil  | returns unix timestamp in seconds or nil |
| other      | string  | value serialized with json.Marshal() |

You can use ``entity.Fill()`` method if you need to fill entity fields with data:

```go{1,5}
engine.SearchLazy(where, pager, &users)
for _, user := range users {
    if user.GetFieldLazy(engine, "Age").(uint64) > 18 {
        user.IsLazy() // true
        user.Fill(engine)
        user.IsLazy() // false
        fmt.Printf("Adult user with ID %d: %s\n", user.ID, user.Email)
    }
} 
```

Lazy entity is only read-only. You can't update or delete entities it.
You must first load entity with ``entity.Fill()``:

```go{4}
user.IsLazy() // true
engine.Flush(user) // panics

user.Fill(engine)
user.Email = "new@beeorm.io"
engine.Flush(user) // works
```

You can force references to be loaded when ``SearchLazy()`` is executed.
These references are also lazy. See above example:

```go{3}
engine.SearchLazy(where, pager, &users)
users[0].Supervisor // nil
user.GetFieldLazy(engine, "Supervisor") // ID of reference, for example uint64(9832)

engine.SearchLazy(where, pager, &users, "Supervisor")
users[0].Supervisor == nil // false
users[0].Supervisor.ID // 9832
users[0].Supervisor.IsLazy() // true
users[0].Supervisor.Email // ""

users[0].Supervisor.Fill(engine)
users[0].Supervisor.IsLazy() // false
users[0].Supervisor.Email // "supervisor@beeorm.io"
```

You can use ``engine.SearchWithCountLazy()`` to get number of found rows:

```go{1}
total:= engine.SearchWithCountLazy(where, pager, &users)
fmt.Printf("Found: %d\n", total)
for _, user := range users {
    fmt.Printf("user with Supervisor ID %d\n", user.GetFieldLazy(engine, "Supervisor"))
}
```

Use  ``engine.SearchOneLazy()`` to search for one entity:

```go{2,4}
var user *UserEntity
found := engine.SearchOneLazy(beeorm.NewWhere("Email = ?", "bee@beeorm.io"), user)
// with references
found = engine.SearchOneLazy(beeorm.NewWhere("FirstName = ?", "Tom"), user, "Supervisor")
```

## Lazy load

You can also load lazy entities with primary keys:

```go
var user *UserEntity
found := engine.LoadByIDLazy(1, user)
found = engine.LoadByIDLazy(1, user, "Supervisor")

var users []*UserEntity
engine.LoadByIDsLazy([]uint64{1, 2, 3}, &users)
engine.LoadByIDsLazy([]uint64{1, 2, 3}, &users, "Supervisor")
```

## Lazy flush

In many scenarios adding, editing and deleting entities can be executed asynchronously.
BeeORM provides ``engine.Flush`` methods with prefix ``Lazy`` which adds all SQL queries
into special redis stream. Then [background consumer](/guide/background_consumer.html) script
will read these queries from redis stream and execute them:

<code-group>
<code-block title="code">
```go{3,8,12}
// adding new entity
user := &UserEntity{FirstName: "Tom", LastName: "Bee", Email: "bee@beeorm.io"}
engine.FlushLazy(user) 

// updating entity
engine.LoadByID(1, user)
user.Name = "John"
engine.FlushLazy(user)

// deleting entity
engine.LoadByID(2, user)
engine.DeleteLazy(user)
```
</code-block>

<code-block title="queries">
```sql
REDIS XAdd orm-lazy-channel event
REDIS XAdd orm-lazy-channel event
REDIS XAdd orm-lazy-channel event
```
</code-block>
</code-group>

::: tip
As you can see all queries are added as events to redis stream called 
``orm-lazy-channel``. If length of this stream is high or is growing it means 
you forgot to run [background consumer](/guide/background_consumer.html) in your 
application.
:::

In case you need to flush more than one entity [Flusher](/guide/crud.html#flusher) you can use
``flusger.FLushLazy()`` method:

<code-group>
<code-block title="code">
```go{13}
flusher := engine.NewFlusher()

user := &UserEntity{FirstName: "Tom", LastName: "Bee", Email: "bee@beeorm.io"}
flusher.Track(user) 
var userToUpdate *UserEntity
engine.LoadByID(1, userToUpdate)
userToUpdate.Name = "John"
flusher.Track(userToUpdate)
var userToDelete *UserEntity
engine.LoadByID(2, userToDelete)
flusher.Delete(userToDelete)

flusher.FlushLazy()
```
</code-block>

<code-block title="queries">
```sql
REDIS XAdd orm-lazy-channel event event event
```
</code-block>
</code-group>
