# CRUD

On previous pages you have learned how to configure BeeORM and update MySQL schema.
Now it's time to play with [CRUD](https://en.wikipedia.org/wiki/Create,_read,_update_and_delete)
actions.

All examples here are build on top of this code:

```go
package main

import "github.com/latolukasz/beeorm"

type CategoryEntity struct {
	beeorm.ORM `beeorm:"redisCache"`
	ID   uint
	Code string `beeorm:"required;length=10;unique=code"`
	Name string `beeorm:"required;length=100"`
}

type ProductEntity struct {
	beeorm.ORM `beeorm:"redisCache"`
	ID   uint
	Name string `beeorm:"required;length=100"`
	Category *CategoryEntity `beeorm:"required"`
}

func main() {
    registry := beeorm.NewRegistry()
    registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/db") 
    registry.RegisterRedis("localhost:6379", 0)
    registry.RegisterEntity(&CategoryEntity{}, &ProductEntity{}) 
    validatedRegistry, err := registry.Validate()
    if err != nil {
        panic(err)
    }
    engine := validatedRegistry.CreateEngine()
}  
```

## Saving new entity

There are many ways to store entity new database.
The Simplest way is to use `engine.Flush()` method:

<code-group>
<code-block title="code">
```go{2}
category := &CategoryEntity{Code: "cars", Name: "Cars"}
engine.Flush(category)
```
</code-block>

<code-block title="sql">
```sql
INSERT INTO `CategoryEntity`(`Code`, `Name`) VALUES(?, ?)
```
</code-block>
</code-group>

You can save more than one entity at once using `engine.FlushMany()` method:

<code-group>
<code-block title="code">
```go{4}
categoryCars := &CategoryEntity{Code: "cars", Name: "Cars"}
categoryBikes := &CategoryEntity{Code: "bikes", Name: "Bikes"}
product := &ProductEntity{Name: "BMW 1", Category: categoryCars}
engine.FlushMany(categoryCars, categoryBikes, product)
```
</code-block>

<code-block title="sql">
```sql
INSERT INTO `CategoryEntity`(`Code`, `Name`) VALUES(?, ?),(?, ?)
INSERT INTO `ProductEntity`(`Name`, `Category`) VALUES(?, ?)
```
</code-block>
</code-group>

::: tip
As you can see in above example `FlushMany()` executed only two SQL queries.
Both categories were added to MySQL using only one INSERT query. BeeORM query
optimizer is always trying to group all queries to MySQL and Redis to minimize 
number of queries. That's why if you need to save more than one entity at once
always use `FlushMany()` instead of running Flush()` many times.
:::

Every time new entity is saved in MySQL BeeORM automatically set inserted
primary key in `ID` field. Each entity provides getter `GetID()` that is 
useful if you pass type `beeorm.Entity` in your code:

```go
func printID(entity beeorm.Entity) uint64 {
   fmt.Printf("ID: %d\n", entity.GetID())
}

categoryCars := &CategoryEntity{Code: "cars", Name: "Cars"}
categoryCars.ID // 0
engine.Flush(categoryCars)
categoryCars.ID // 1
printID(categoryCars) // "ID: 1"
```

If needed you can define ID for new entities:

<code-group>
<code-block title="code">
```go{1}
categoryCars := &CategoryEntity{ID: 10, Code: "cars", Name: "Cars"}
engine.Flush(categoryCars)
categoryCars.ID // 10
```
</code-block>

<code-block title="sql">
```sql
INSERT INTO `CategoryEntity`(`ID`, `Code`, `Name`) VALUES(10, ?, ?)
```
</code-block>
</code-group>

As you can see `Flush()` method is not returning any error. 
BeeORM will panic instead. Probably most go developers reading this 
got heart attack. Internet is full of articles where developers 
are debating (fighting:)) which approach is better. 
BeeORM is used in many projects by many developers. After many
emotional discussions everyone agreed that `panicing` is a right approach
in all actions that connect to external service as database.

There are some situations where developer is expecting to get specific errors when
entity is flushed. In this case you can use `engine.FlushWithCheck()` method:

<code-group>
<code-block title="code">
```go{3}
categoryCars := &CategoryEntity{ Code: "cars", Name: "Cars"}
categoryCarsDuplicated := &CategoryEntity{ Code: "cars", Name: "Cars"}
err := engine.FlushWithCheck(categoryCars, categoryCarsDuplicated)
if err != nil {
    duplicatedError, is := err.(*beeorm.DuplicatedKeyError)
    if is {
       duplicatedError.Message // "Duplicate entry 'cars' for key 'code'"
       duplicatedError.Index // "code" 
    } else {
        foreignKeyError := err.(*beeorm.ForeignKeyError)
        duplicatedError.Message // "foreign key error in key `XXX`"
        duplicatedError.Constraint // "XXX"
    }
}
```
</code-block>

<code-block title="sql">
```sql
INSERT INTO `CategoryEntity`(`Code`, `Name`) VALUES(?, ?),(?, ?)
```
</code-block>
</code-group>

`engine.FlushWithCheck()` return only one of two errors:
 * `*beeorm.DuplicatedKeyError` - duplicated value in one of MySQL unique indexes
 * `*beeorm.ForeignKeyError` - invalid value in one of MySQL foreign indexes

Any other error (for instance unavailable MySQL server) will cause panic.

## Entity state

TODO
