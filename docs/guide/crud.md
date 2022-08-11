# CRUD

On previous pages you have learned how to configure BeeORM and update MySQL schema.
Now it's time to play with [CRUD](https://en.wikipedia.org/wiki/Create,_read,_update_and_delete)
actions.

All examples here are build on top of this code:

```go
package main

import "github.com/latolukasz/beeorm"

type CategoryEntity struct {
	beeorm.ORM  `orm:"redisCache"`
	ID          uint
	Code        string `orm:"required;length=10;unique=code"`
	Name        string `orm:"required;length=100"`
	FakeDelete  bool
}

type ImageEntity struct {
	beeorm.ORM `orm:"redisCache"`
	ID   uint
	Url string `orm:"required"`
}

type BrandEntity struct {
	beeorm.ORM `orm:"redisCache"`
	ID   uint
	Name string `orm:"required;length=100"`
	Logo *ImageEntity
}

type ProductEntity struct {
	beeorm.ORM `orm:"redisCache"`
	ID       uint
	Name     string `orm:"required;length=100"`
	Category *CategoryEntity `orm:"required"`
	Brand    *BrandEntity
}

func main() {
    registry := beeorm.NewRegistry()
    registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/db") 
    registry.RegisterRedis("localhost:6379", 0)
    registry.RegisterEntity(&CategoryEntity{}, &BrandEntity{}, &ImageEntity{}, &ProductEntity{}) 
    validatedRegistry, deferF, err := registry.Validate()
    if err != nil {
        panic(err)
    }
    defer deferF()
    engine := validatedRegistry.CreateEngine()
}  
```

## Saving new entities

There are many ways to store an entity in a new database.
The Simplest way is to use `engine.Flush()` method:

<code-group>
<code-block title="code">
```go{2}
category := &CategoryEntity{Code: "cars", Name: "Cars"}
engine.Flush(category)
```
</code-block>

<code-block title="sql">
```queries
INSERT INTO `CategoryEntity`(`Code`, `Name`) VALUES(?, ?)
REDIS DELETE CacheForCategory1
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
```queries
INSERT INTO `CategoryEntity`(`Code`, `Name`) VALUES(?, ?),(?, ?)
INSERT INTO `ProductEntity`(`Name`, `Category`) VALUES(?, ?)
REDIS DELETE CacheForCategory1, CacheForCategory2, CacheForProduct1
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

Every time new entity is saved in MySQL, BeeORM automatically sets inserted
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
```queries
INSERT INTO `CategoryEntity`(`ID`, `Code`, `Name`) VALUES(10, ?, ?)
REDIS DELETE CacheForCategory10
```
</code-block>
</code-group>

As you can see `Flush()` method is not returning any error. 
BeeORM will panic instead. Probably most go developers reading this 
got a heart attack. Internet is full of articles where developers 
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
```queries
INSERT INTO `CategoryEntity`(`Code`, `Name`) VALUES(?, ?),(?, ?)
REDIS DELETE CacheForCategory1, CacheForCategory2
```
</code-block>
</code-group>

`engine.FlushWithCheck()` return only one of two errors:
 * `*beeorm.DuplicatedKeyError` - duplicated value in one of MySQL unique indexes
 * `*beeorm.ForeignKeyError` - invalid value in one of MySQL foreign indexes

Any other error (for instance unavailable MySQL server) will cause panic.

### On duplicate key update

MySQL has an amazing feature [INSERT ON DUPLICATE KEY](https://dev.mysql.com/doc/refman/8.0/en/insert-on-duplicate.html)
that is fully supported in BeeORM. In above example, we got `*beeorm.DuplicatedKeyError` 
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

<code-block title="queries">
```sql
INSERT INTO `CategoryEntity`(`Code`, `Name`) VALUES(?, ?) ON DUPLICATE KEY UPDATE `Name` = ?
REDIS DELETE CacheForCategory10
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
```queries
INSERT INTO `CategoryEntity`(`Code`, `Name`) VALUES(?, ?) ON DUPLICATE KEY UPDATE `ID` = `ID`
REDIS DELETE CacheForCategory10
```
</code-block>
</code-group>

### Flushing references

BeeORM automatically flushes all new entities (entities with ID equal to 0) assigned in flushed
entity as reference. Look at this example:

<code-group>
<code-block title="code">
```go
categoryCars := &CategoryEntity{Code: "cars", Name: "Cars"}
categoryDogs := &CategoryEntity{Code: "dogs", Name: "Dogs"}
bmw1 := &ProductEntity{Name: "BMW 1", Category: categoryCars}
fordFocus := &ProductEntity{Name: "Ford focus", Category: categoryCars}
cockerSpaniel := &ProductEntity{Name: "Cocker spaniel", Category: categoryDogs}
engine.Flush(bmw1, fordFocus) // we are flushing only products
bmw1.Category.ID // 1
fordFocus.Category.ID // 1
cockerSpaniel.Category.ID // 2
categoryCars.ID // 1
categoryDogs.ID // 2
```
</code-block>

<code-block title="sql">
```queries
INSERT INTO `CategoryEntity`(`Code`, `Name`) VALUES(?, ?),(?,?)
INSERT INTO `ProductEntity`(`Name`, `Category`) VALUES(?, ?)(?,?)
REDIS DELETE CacheForCategory1, CacheForCategory2, CacheForProduct1, CacheForProduct2
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
```queries
INSERT INTO `ProductEntity`(`Name`, `Category`) VALUES(?, 7)
REDIS DELETE CacheForProduct1
```
</code-block>
</code-group>

## Dirty state

Entity is called dirty if it has changes that need to be applied in MySQL table:
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
engine.LoadByIDs([]uint64{1, 2}, &products)
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

Missing entities are returned as nil:

```go
// we have only product in table with ID 1 and 2
var products []*ProductEntity{}
engine.LoadByIDs([]uint64{1, 2, 3}, &products)
len(products) == 3 // true
products[0].ID // 1
products[1].ID // 2
products[2] == nil // true
```

### Loaded state

Every entity store internally data that is stored in MySQL table. Thanks to that
BeeORM knows when entity is dirty and needs to be flushed. This data is stored 
every time new entity is flushed (saved) or loaded from database. You can use
`entity.IsLoaded()` method to determine if entity has this data and can track 
changes or not:

```go{2,4,7,9,12,14}
category := &CategoryEntity{Code: "cars", Name: "Cars"}
category.IsLoaded() // false, entity needs to be inserted in MySQL table
engine.FLush(category)
category.IsLoaded() // true, entity data is saved in database

product := &ProductEntity{}
product.IsLoaded() // false
engine.LoadByID(1, product)
product.IsLoaded() // true, entity data is loaded from database

product2 := &ProductEntity{ID: 2}
product2.IsLoaded() // false
product.Load(product2)
product2.IsLoaded() // true
```

`entity.IsLoaded()` and `entity.Load()` are very useful when you
need to work with references:

```go{3-5}
product := &ProductEntity{}
engine.LoadByID(1, product)
product.Category.Loaded() // false
engine.Load(product.Category)
product.Category.Loaded() // true
```

## Loading references

Very often when you are loading entity you also need data from
connected referenced entities. For example on product page you need
to display product title, it's category, brand and brand logo.
You can do it this way:

<code-group>
<code-block title="code">
```go
product := &ProductEntity{}
engine.LoadByID(1, product)
product.Name // "Ford focus"
product.Category.ID // 1
product.Brand.ID // 1
product.Category.Name // "" because entity data is not Loaded
product.Brand.Name // "" because entity data is not Loaded
product.Brand.Logo // nil because entity data is not Loaded
engine.Load(product.Category)
engine.Load(product.Brand)
product.Category.Name // "Cars"
product.Brand.Name // "Ford"
product.Brand.Logo.ID // 1
product.Brand.Logo.Name // "" because entity data is not Loaded
engine.Load(product.Brand.Logo)
product.Brand.Logo.Url // "/images/ford.png"
```
</code-block>

<code-block title="queries hit">
```sql
[HIT] REDIS GET cacheKeyForProduct1
[HIT] REDIS GET cacheKeyForCategory1
[HIT] REDIS GET cacheKeyForBrand1
[HIT] REDIS GET cacheKeyForImage1
```
</code-block>

<code-block title="queries miss">
```sql
[MISS] REDIS GET cacheKeyForProduct1
SELECT `ID`, `Name`, `Category`, `Brand` FROM `ProductEntity` WHERE `ID`= 1 
REDIS SET cacheKeyForProduct1 "entity data"
[MISS] REDIS GET cacheKeyForCategory1
SELECT `ID`, `Name` FROM `CategoryEntity` WHERE `ID`= 1 
REDIS SET cacheKeyForCategory1 "entity data"
[MISS] REDIS GET cacheKeyForBrand1
SELECT `ID`, `Name` FROM `BrandEntity` WHERE `ID`= 1 
REDIS SET cacheKeyForBrand1 "entity data"
[MISS] REDIS GET cacheKeyForImage1
SELECT `ID`, `Url` FROM `ImageEntity` WHERE `ID`= 1 
REDIS SET cacheKeyForImage1 "entity data"
```
</code-block>
</code-group>

What if we can make this code much simpler and faster?
Every method used to load entities like `Load()`, `LoadByID`, `LoadByIDs` accepts
optional parameters `references` than can be used to inform BeeORM that specific 
references should be loaded together with entity:

<code-group>
<code-block title="code">
```go{2}
product := &ProductEntity{}
engine.LoadByID(1, product, "Category", "Brand/Logo")
product.Name // "Ford focus"
product.Category.Name // "Cars"
product.Brand.Name // "Ford"
product.Brand.Logo.Url // "/images/ford.png"
```
</code-block>

<code-block title="queries hit">
```sql
[HIT] REDIS GET cacheKeyForProduct1
[HIT] REDIS MGET cacheKeyForCategory1 cacheKeyForBrand1
[HIT] REDIS GET cacheKeyForImage1
```
</code-block>

<code-block title="queries miss">
```sql
[MISS] REDIS GET cacheKeyForProduct1
SELECT `ID`, `Name`, `Category`, `Brand` FROM `ProductEntity` WHERE `ID`= 1 
REDIS SET cacheKeyForProduct1 "entity data"
[MISS] REDIS MGET cacheKeyForCategory1 cacheKeyForBrand1
SELECT `ID`, `Name` FROM `CategoryEntity` WHERE `ID`= 1 
SELECT `ID`, `Name` FROM `BrandEntity` WHERE `ID`= 1 
REDIS MSET cacheKeyForCategory1 "entity data" cacheKeyForBrand1 "entity data"
[MISS] REDIS GET cacheKeyForImage1
SELECT `ID`, `Url` FROM `ImageEntity` WHERE `ID`= 1 
REDIS SET cacheKeyForImage1 "entity data"
```
</code-block>
</code-group>

As you can see above code is not even much simpler but also produces fewer
requests to MySQL and Redis. Look how queries are generated when you use this feature
to load many entities at once:

<code-group>
<code-block title="code">
```go{2}
var products []*ProductEntity{}
engine.LoadByIDs(uint64{1, 2, 3}, &products, "Category", "Brand/Logo")
```
</code-block>

<code-block title="queries hit">
```sql
[HIT] REDIS MGET cacheKeyForProduct1 cacheKeyForProduct2 cacheKeyForProduct3
[HIT] REDIS MGET cacheKeyForCategory1 cacheKeyForCategory2 cacheKeyForCategory3 cacheKeyForBrand1 cacheKeyForBrand2 cacheKeyForBrand3
[HIT] REDIS MGET cacheKeyForImage1 cacheKeyForImage2 cacheKeyForImage3
```
</code-block>


<code-block title="queries miss">
```sql
[MISS] REDIS MGET cacheKeyForProduct1 cacheKeyForProduct2 cacheKeyForProduct3
SELECT `ID`, `Name`, `Category`, `Brand` FROM `ProductEntity` WHERE `ID` IN (1, 2, 3) 
REDIS MSET cacheKeyForProduct1 "entity data" cacheKeyForProduct2 "entity data" cacheKeyForProduct3 "entity data"
[MISS] REDIS MGET cacheKeyForCategory1 cacheKeyForCategory2 cacheKeyForCategory4 cacheKeyForBrand1 cacheKeyForBrand2 cacheKeyForBrand3
SELECT `ID`, `Name` FROM `CategoryEntity` WHERE `ID` IN (1, 2, 3) 
SELECT `ID`, `Name` FROM `BrandEntity` WHERE `ID` IN (1, 2, 3) 
REDIS MSET cacheKeyForCategory1 "entity data" cacheKeyForCategory2 "entity data" cacheKeyForCategory3 "entity data" cacheKeyForBrand1 "entity data" cacheKeyForBrand2 "entity data" cacheKeyForBrand3 "entity data"
[MISS] REDIS MGET cacheKeyForImage1 cacheKeyForImage2 cacheKeyForImage3
SELECT `ID`, `Url` FROM `ImageEntity` WHERE `ID` IN (1, 2, 3) 
REDIS MSET cacheKeyForImage1 "entity data" cacheKeyForImage2 "entity data" cacheKeyForImage3 "entity data"
```
</code-block>
</code-group>

This code produces only three queries to redis. Pretty cool right?

## Updating entities

Updating entity is very easy. All you need to do is to run `entity.Flush()` method 
on loaded entity:

<code-group>
<code-block title="code">
```go{4}
product := &ProductEntity{}
engine.LoadByID(1, product)
product.Name = "New name"
engine.Flush(product)
```
</code-block>

<code-block title="queries">
```sql
[HIT] REDIS GET cacheKeyForProduct1
UPDATE `ProductEntity` SET `Name` = ? WHERE `ID` = 1
REDIS DELETE cacheKeyForProduct1
```
</code-block>
</code-group>

If you need to update more than one entity use `entity.FlushMany()`:

<code-group>
<code-block title="code">
```go{8}
var products []*ProductEntity
engine.LoadByIDs(int64{1, 2}, &products)
category := &CategoryEntity{}
engine.LoadByID(1, &category)
products[0].Name = "New name"
products[1].Name = "Another name"
category.Name = "New name"
engine.FlushMany(category, products[0], products[1])
```
</code-block>

<code-block title="queries">
```sql
[HIT] REDIS MGET cacheKeyForCategory1 cacheKeyForProduct1 cacheKeyForProduct2
UPDATE `CategoryEntity` SET `Name` = ? WHERE `ID` = 1
UPDATE `ProductEntity` SET `Name` = ? WHERE `ID` = 1
UPDATE `ProductEntity` SET `Name` = ? WHERE `ID` = 2
REDIS DELETE cacheKeyForCategory1 cacheKeyForProduct1 cacheKeyForProduct2
```
</code-block>
</code-group>

## Deleting entities

Entity is deleted from MySQL table with `engine.Delete()` method:

<code-group>
<code-block title="code">
```go{3}
product := &ProductEntity{}
engine.LoadByID(1, product)
engine.Delete(product)
```
</code-block>

<code-block title="queries">
```sql
[HIT] REDIS GET cacheKeyForProduct1
DELETE FROM `ProductEntity` WHERE `ID` = 1
REDIS SET cacheKeyForProduct1 "nil"
```
</code-block>
</code-group>

Use `engine.DeleteMany()` to delete many entities at once:

<code-group>
<code-block title="code">
```go{3}
var products []*ProductEntity
engine.LoadByIDs(int64{1, 2}, &products)
engine.DeleteMany(products...)
```
</code-block>

<code-block title="queries">
```sql
[HIT] REDIS MGET cacheKeyForProduct1 cacheKeyForProduct1
DELETE FROM `ProductEntity` WHERE `ID` IN (1, 2)
REDIS MSET cacheKeyForProduct1 "nil" cacheKeyForProduct2 "nil"
```
</code-block>
</code-group>

If entity has  [FakeDelete field](/guide/entity_fields.html#fake-delete)
then above methods work differently. Instead of deleting rows from table special update 
query is executed:

<code-group>
<code-block title="code">
```go{3}
category := &CategoryEntity{}
engine.LoadByID(3, category)
engine.Delete(category)
```
</code-block>

<code-block title="queries">
```sql
[HIT] REDIS GET cacheKeyForCategory3
UPDATE `CategoryEntity` SET `FakeDelete` = 3 WHERE `ID` = 3
REDIS DELETE cacheKeyForCategory3
```
</code-block>
</code-group>

To force entity that has `FakeDelete` field to be deleted from MySQL table
use `engine.ForceDelete` or `engine.ForceDeleteMany`:

<code-group>
<code-block title="code">
```go{3}
category := &CategoryEntity{}
engine.LoadByID(3, category)
engine.ForceDelete(category)
```
</code-block>

<code-block title="queries">
```sql
[HIT] REDIS GET cacheKeyForCategory3
DELETE FROM `CategoryEntity` WHERE `ID` = 3
REDIS SET cacheKeyForCategory3 "nil"
```
</code-block>
</code-group>

## Flusher

BeeORM provides special object `beeorm.Flusher` that is very useful when
you need to add, update and delete many entities at the same time. This object
allows you to "track" entities and provides flush methods that update all tracked 
dirty entities at once:

<code-group>
<code-block title="code">
```go{1,5,9,12,15}
flusher := engine.NewFlusher()

category := &CategoryEntity{Name: "New category"}
brand := &BrandEntity{Name: "New brand"}
flusher.Track(category, brand)
product := &ProductEntity{}
engine.LoadByID(1, product)
product.Name = "New Name"
flusher.Track(product)
categoryToDelete := &CategoryEntity{}
engine.LoadByID(10, categoryToDelete)
flusher.Delete(categoryToDelete)
categoryToDeleteFromTable := &CategoryEntity{}
engine.LoadByID(11, categoryToDeleteFromTable)
flusher.ForceDelete(categoryToDeleteFromTable)
```
</code-block>

<code-block title="queries">
```sql
[HIT] REDIS GET cacheKeyForProduct1
[HIT] REDIS GET cacheKeyForCategory10
[HIT] REDIS GET cacheKeyForCategory11
```
</code-block>
</code-group>

Great, we are tracing all entities, now it's time to execute
updates in database:

<code-group>
<code-block title="code">
```go
flusher.Flush()
```
</code-block>

<code-block title="queries">
```sql
INSERT INTO `CategoryEntity`(`Code`, `Name`) VALUES(?, ?)
INSERT INTO `BrandEntity`(`Code`, `Name`) VALUES(?, ?)
UPDATE `ProductEntity` SET `Name` = ? WHERE `ID` = 1
UPDATE `CategoryEntity` SET `FakeDelete` = 10 WHERE `ID` = 10
DELETE FROM `CategoryEntity` WHERE `ID` = 11
REDIS DELETE cacheKeyForCategory1 cacheKeyForCategory2 cacheKeyForCategory11 cacheKeyForCategory12 cacheKeyForProduct1
```
</code-block>
</code-group>

Flusher also provides methods that flush that return error: 

```go
// returns *beeorm.DuplicatedKeyError or *beeorm.ForeignKeyError
err := flusher.FlushWithCheck()
```

```go
// returns error instead of panicing 
err := flusher.FlushWithFullCheck()
```

You can use `beeorm.Flusher` to execute all MySQL queries in one transaction.
BeeORM automatically run MySQL `ROLLBACK` query before panic():

<code-group>
<code-block title="code">
```go
flusher.FlushInTransaction()
```
</code-block>

<code-block title="queries">
```sql
START TRANSACTION
INSERT INTO `CategoryEntity`(`Code`, `Name`) VALUES(?, ?)
INSERT INTO `BrandEntity`(`Code`, `Name`) VALUES(?, ?)
UPDATE `ProductEntity` SET `Name` = ? WHERE `ID` = 1
UPDATE `CategoryEntity` SET `FakeDelete` = 10 WHERE `ID` = 10
DELETE FROM `CategoryEntity` WHERE `ID` = 11
COMMIT
REDIS DELETE cacheKeyForCategory1 cacheKeyForCategory2 cacheKeyForCategory11 cacheKeyForCategory12 cacheKeyForProduct1
```
</code-block>
</code-group>

In case you expect `*beeorm.DuplicatedKeyError` or `*beeorm.ForeignKeyError` error use
`flusher.FlushInTransactionWithCheck()` method:

<code-group>
<code-block title="code">
```go
flusher.FlushInTransactionWithCheck()
```
</code-block>

<code-block title="queries">
```sql
START TRANSACTION
INSERT INTO `CategoryEntity`(`Code`, `Name`) VALUES(?, ?)
INSERT INTO `BrandEntity`(`Code`, `Name`) VALUES(?, ?)
UPDATE `ProductEntity` SET `Name` = ? WHERE `ID` = 1
UPDATE `CategoryEntity` SET `FakeDelete` = 10 WHERE `ID` = 10
DELETE FROM `CategoryEntity` WHERE `ID` = 11
COMMIT
REDIS DELETE cacheKeyForCategory1 cacheKeyForCategory2 cacheKeyForCategory11 cacheKeyForCategory12 cacheKeyForProduct1
```
</code-block>
</code-group>

Flushing entities in `beeorm.Flusher` doesn't remove entities and all of them are
still tracked for new changes. To un-track all entities use `flusher.Clear()` method:

```go{7}
category := &CategoryEntity{Name: "New category"}
flusher := engine.NewFlusher()
flusher.Track(category)
flusher.Flush() // insert category into MySQL table
category.Name = "New name"
flusher.Flush() // updates category in MySQL table
flusher.Clear()
category.Name = "Another name"
flusher.Flush() // does nothing, category is not tracked
```

## Clearing entity cache

Sometimes you may need to manually clear entity data in cache.
Simply use `beeorm.ClearCacheByIDs()` method:

```go{2}
var categoryEntity CategoryEntity
engine.ClearCacheByIDs(categoryEntity, 7, 13, 33)
```
