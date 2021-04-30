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

type ImageEntity struct {
	beeorm.ORM `beeorm:"redisCache"`
	ID   uint
	Url string `beeorm:"required"`
}

type BrandEntity struct {
	beeorm.ORM `beeorm:"redisCache"`
	ID   uint
	Name string `beeorm:"required;length=100"`
	Logo *ImageEntity
}

type ProductEntity struct {
	beeorm.ORM `beeorm:"redisCache"`
	ID       uint
	Name     string `beeorm:"required;length=100"`
	Category *CategoryEntity `beeorm:"required"`
	Brand    *BrandEntity
}

func main() {
    registry := beeorm.NewRegistry()
    registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/db") 
    registry.RegisterRedis("localhost:6379", 0)
    registry.RegisterEntity(&CategoryEntity{}, &BrandEntity{}, &ImageEntity{}, &ProductEntity{}) 
    validatedRegistry, err := registry.Validate()
    if err != nil {
        panic(err)
    }
    engine := validatedRegistry.CreateEngine()
}  
```

## Saving new entities

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
categoryCars := &CategoryEntity{Code: "cars", Name: "Cars"}
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

### On duplicate key update

MySQL has amazing feature [INSERT ON DUPLICATE KEY](https://dev.mysql.com/doc/refman/8.0/en/insert-on-duplicate.html)
that is fully supported in BeeORM. In above example we got `*beeorm.DuplicatedKeyError` 
because we are trying to store two `CategoryEntity` with the same code. Use `SetOnDuplicateKeyUpdate()` method
to define correct duplicate key statement:

<code-group>
<code-block title="code">
```go{3}
 // let's assume we have category in database with `Code` = cars and `ID` = 10:
category := &CategoryEntity{Code: "cars", Name: "Cars V2"}
category.SetOnDuplicateKeyUpdate(beeorm.Bind{"Name": "Cars V3"})
engine.Flush(categoryCars) // no panic
category.ID // 10
category.Name // "Cars V3"
```
</code-block>

<code-block title="sql">
```sql
INSERT INTO `CategoryEntity`(`Code`, `Name`) VALUES(?, ?) ON DUPLICATE KEY UPDATE `Name` = ?
```
</code-block>
</code-group>

As you can see `Flush()` run correct query and set `ID` to 10. Is some cases you don't need to
update any field if inserted entity has duplicated key. In this case simply provide nil as bind:

<code-group>
<code-block title="code">
```go{3}
 // let's assume we have category in database with `Code` = cars and `ID` = 10:
category := &CategoryEntity{Code: "cars", Name: "Cars"}
category.SetOnDuplicateKeyUpdate(nil)
engine.Flush(categoryCars) // no panic
category.ID // 10
```
</code-block>

<code-block title="sql">
```sql
INSERT INTO `CategoryEntity`(`Code`, `Name`) VALUES(?, ?) ON DUPLICATE KEY UPDATE `ID` = `ID`
```
</code-block>
</code-group>

### Flushing references

BeeORM automatically flush all new entities (entity with ID equal to 0) assigned in flushed
entity as reference. Look at this example:

<code-group>
<code-block title="code">
```go
categoryCars := &CategoryEntity{Code: "cars", Name: "Cars"}
categoryDogs := &CategoryEntity{Code: "dogs", Name: "Dogs"}
bwm1 := &ProductEntity{Name: "BMW 1", Category: categoryCars}
fordFocus := &ProductEntity{Name: "Ford focus", Category: categoryCars}
cockeSpaniel := &ProductEntity{Name: "Cocker spaniel", Category: categoryDogs}
engine.Flush(bwm1, fordFocus) // we are flushing only products
bwm1.Category.ID // 1
fordFocus.Category.ID // 1
cockeSpaniel.Category.ID // 2
categoryCars.ID // 1
categoryDogs.ID // 2
```
</code-block>

<code-block title="sql">
```sql
INSERT INTO `CategoryEntity`(`Code`, `Name`) VALUES(?, ?),(?,?)
INSERT INTO `ProductEntity`(`Name`, `Category`) VALUES(?, ?)(?,?)
```
</code-block>
</code-group>

Sometimes you need to define referenced entity, and you know only it's `ID` value.
You can assign it as a new entity that has field `ID` set to correct value:

<code-group>
<code-block title="code">
```go{1}
product := &ProductEntity{Name: "Ford focus", Category: &CategoryEntity{ID: 7}}
engine.Flush()
```
</code-block>

<code-block title="sql">
```sql
INSERT INTO `ProductEntity`(`Name`, `Category`) VALUES(?, 7)
```
</code-block>
</code-group>

## Dirty state

Entity is called dirty if has changes that needs to applied in MySQL table:
 * new entity that needs to be inserted to MySQL table
 * entity that needs to be deleted
 * entity that needs to be edited in MySQL table because at least one column value is
different
   
You can check dirty state using `IsDirty()` method. Another method `GetDirtyBind()` 
returns additional map with fields that needs to inserted/updated:

```go{2-3}
category := &CategoryEntity{Code: "cars", Name: "Cars"}
category.IsDirty() // true, entity needs to be inserted in MySQL table
bind, isDirty := category.GetDirtyBind() // isDirty = true
fmt.Printf("%v", bind) // {"Code: "cars", "Name": "Cars"}

engine.Flush(category)

category.IsDirty() // false
category.Code = "vehicles"
category.IsDirty() // true
bind, isDirty := category.GetDirtyBind() // isDirty = true
fmt.Printf("%v", bind) // {"Code: "vehicles"}
category.Code = "cars" // setting back to oryginal value
bind, isDirty := category.GetDirtyBind() // isDirty = false
```

You can flush entities that are not dirty, but BeeORM is simply skip these
entities and no queries are sent to MySQL. Knowing that you can run `Flush()` 
methods as many times you want and BeeORM will update database and cache only
when it's needed:

```go
// we don't know what is changed in category inside `DoSmthWithCactegory` method: 
some_package.DoSmthWithCactegory(category)
// but we ask BeeORM to save changes if any:
engine.Flush(category)
```

## Loading entities

There are many ways to load entities from database when we know primary key.
You can use `engine.Load()` method:

<code-group>
<code-block title="code">
```go{2}
product := &ProductEntity{ID: 1} // provide ID
found := engine.Load(product) // true
```
</code-block>

<code-block title="queries hit">
```sql
[HIT] REDIS GET cacheKeyForProduct1
```
</code-block>

<code-block title="queries miss">
```sql
[MISS] REDIS GET cacheKeyForProduct1
SELECT `ID`, `Name`, `Category` FROM `Products` WHERE `ID` = 1 
REDIS SET cacheKeyForProduct1 "entity data"
```
</code-block>
</code-group>

Another way is to use `engine.LoadByID()`:

<code-group>
<code-block title="code">
```go{2}
product := &ProductEntity{}
found := engine.LoadByID(1, product) // true
```
</code-block>

<code-block title="queries hit">
```sql
[HIT] REDIS GET cacheKeyForProduct1
```
</code-block>

<code-block title="queries miss">
```sql
[MISS] REDIS GET cacheKeyForProduct1
SELECT `ID`, `Name`, `Category` FROM `Products` WHERE `ID` = 1 
REDIS SET cacheKeyForProduct1 "entity data"
```
</code-block>
</code-group>

In case you need to load more than one entity use `engine.LoadByIDs()`:

<code-group>
<code-block title="code">
```go{2}
var products []*ProductEntity{}
missing := engine.LoadByIDs([]uint64{1, 2}, &products)
len(products) == 2 // true
products[0].ID // 1
products[1].ID // 2
```
</code-block>

<code-block title="queries hit">
```sql
[HIT,HIT] REDIS MGET cacheKeyForProducts1 cacheKeyForProducts2
```
</code-block>

<code-block title="queries miss">
```sql
[MISS,MISS] REDIS MGET cacheKeyForProducts1 cacheKeyForProducts2
SELECT `ID`, `Name`, `Category` FROM `Products` WHERE `ID` IN (1, 2) 
REDIS MSET cacheKeyForProducts1 "entity1 data" cacheKeyForProducts2 "entity2 data"
```
</code-block>
</code-group>

This method returns false if at least one entity is not found in database and 
value in slice for this entity is `nil`:

```go
// we have only product in table with ID 1 and 2
var products []*ProductEntity{}
missing := engine.LoadByIDs([]uint64{1, 2, 3}, &products) // missing = true
len(products) == 3 // true
products[0].ID // 1
products[1].ID // 2
products[2] == nil // true
```

### Loaded state

Every entity store internally data that is stored MySQL table. Thanks to that
BeeORM knows when entity is dirty and needs to be flushed. This data is stored 
every time new entity is flushed (saved) or loaded from database. You can use
`entity.IsLoaded()` method to determinate if entity has this data and ca track 
changes or not:

```go{2,4,7,9,12,14}
category := &CategoryEntity{Code: "cars", Name: "Cars"}
category.IsLoaded() // false, entity needs to be inserted in MySQL table
engine.FLush(category)
category.IsLoaded() // true, entity data is saved in database

produt := &ProductEntity{}
produt.IsLoaded() // false
engine.LoadByID(1, produt)
produt.IsLoaded() // true, entity data is loaded from database

produt2 := &ProductEntity{ID: 2}
produt2.IsLoaded() // false
produt.Load(produt2)
produt2.IsLoaded() // true
```

`entity.IsLoaded()` and `entity.Load()` are very useful when you
need to work with references:

```go{3-5}
produt := &ProductEntity{}
engine.LoadByID(1, produt)
produt.Category.Loaded() // false
engine.Load(produt.Category)
produt.Category.Loaded() // true
```

## Loading references

TODO

## Updating entities

TODO

## Deleting entities

TODO

## Flusher

TODO
