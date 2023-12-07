# CRUD

In the previous sections, you learned how to configure BeeORM and update the MySQL schema. Now it's time to perform CRUD (Create, Read, Update, and Delete) actions using BeeORM.

The following examples build upon the following code base:

```go
package main

import "github.com/latolukasz/beeorm/v3"

type CategoryEntity struct {
	ID          uint64      `orm:"localCahe;redisCache"`
	Code        string `orm:"required;length=10;unique=code"`
	Name        string `orm:"required;length=100"`
}

type ImageEntity struct {
	ID  uint64 `orm:"redisCache"`
	Url string `orm:"required"`
}

type BrandEntity struct {
	ID   uint64 `orm:"redisCache"`
	Name string `orm:"required;length=100"`
	Logo *beeorm.Reference[ImageEntity]
}

type ProductEntity struct {
	ID       uint64 `orm:"redisCache"`
	Name     string `orm:"required;length=100"`
	Category *beeorm.Reference[CategoryEntity] `orm:"required"`
	Brand    *beeorm.Reference[BrandEntity] 
}

func main() {
    registry := beeorm.NewRegistry()
    registry.RegisterMySQL("user:password@tcp(localhost:3306)/db", beeorm.DefaultPoolCode, nil) 
    registry.RegisterRedis("localhost:6379", 0, beeorm.DefaultPoolCode, nil)
    registry.RegisterEntity(CategoryEntity{}, BrandEntity{}, ImageEntity{}, ProductEntity{}) 
    engine, err := registry.Validate()
    if err != nil {
        panic(err)
    }
    c := engine.NewContext(context.Background())
}  
```

## Saving New Entities

To insert a new entity into database you need to create new instance with `NewEntity()` function and run `beeorm.Context` method
`Flush()`. See below example:

```go
categoryCars := beeorm.NewEntity[CategoryEntity](c)
categoryCars.Code = "cars"
categoryCars.Name = "Cars"
err := c.Flush()
```

When method `Flush()` of `beeorm.Context` is executed all entities created with `NewEntity()` with this `beeorm.Context` function are
inserted into MySQL and cache is updated. Below example demonstrates how to insert into MySQL multiple entities at once:

```go
image1 := beeorm.NewEntity[ImageEntity](c)
image1.Url = "image1.png"
image2 := beeorm.NewEntity[ImageEntity](c)
image2.Url = "image2.png"
err := c.Flush() // two rows are inserted into MySQL table
```

### Setting reference value

Here's an example of how to set up a one-to-one reference

```go{5}
image := beeorm.NewEntity[ImageEntity](c)
image.Url = "image1.png"
brandVolvo := beeorm.NewEntity[BrandEntity](c)
brandVolvo.Name = "Volvo"
brandVolvo.Logo = *beeorm.Reference[ImageEntity]{ID: image.ID}
err := c.Flush()
```

## Unique indexes

In many scenarios, entities maintain [unique indexes](https://dev.mysql.com/doc/refman/8.0/en/create-index.html#create-index-unique) to ensure the uniqueness of specific entity fields within your database. 
As an example, consider the `Code` field of the `CategoryEntity`. 
BeeORM leverages [Redis sets](https://redis.io/docs/data-types/sets/) to store information about the utilized values of these unique keys and validate the entity when it is flushed, 
as demonstrated in the following example:

```go
categoryCars := beeorm.NewEntity[CategoryEntity](c)
categoryCars.Code = "cars"
err := c.Flush() // nil, row is inserted to MySQL table

anotherCategory:= beeorm.NewEntity[CategoryEntity](c)
categoryCars.Code = "cars"
// returns beeorm.DuplicatedKeyBindError{Index: "code", ID: 84984747727443, Columns: ["Code"]}
err = c.Flush() 
```

Every time an entity is added, updated, or deleted, the values in the Redis set that stores information about the unique key are updated. 
However, there is one issue with this approach - in certain cases, you may need to clear the Redis data. In such cases, BeeORM is unable to validate unique values when `Flush()` is executed. 
Instead of receiving a `beeorm.DuplicatedKeyBindError`, the `Flush()` function returns a `mysql.MySQLError` error with code 1062. This indicates that you need to refill the Redis set with the correct data. 
BeeORM provides a special function for this purpose:

```go
beeorm.LoadUniqueKeys(c, false) // set true to enable debug mode
```
It is considered a good practice to run the above function every time your application starts. 
When Redis is not flushed, this function executes in a matter of milliseconds. However, if Redis data has been flushed, 
it will run until all the data is loaded from MySQL into the Redis set. Be sure to run this function every time Redis data is flushed.

You might wonder why BeeORM chose to use Redis for checking the uniqueness of unique keys instead of relying solely on 
MySQL Unique Key constraints. This unique approach offers two valuable features, 
which are explained in the following sections: the ability to [retrieve records from cache by their unique keys](/guide/crud.html#getting-entities-by-unique-key)
and support for [asynchronous flushing](/guide/async_flush.html).

## Getting Entity by ID

There are several ways to get entities from the database when you know the primary key. 

You can use the `GetByID()` method:

```go
product := beeorm.GetByID[ProductEntity](c, 27749843747733)
```

## Getting Entities by ID

If you need to get more than one entity, you can use `GetByIDs()`:

```go
iterator := beeorm.GetByIDs[ProductEntity](c, 324343544424, 34545654434, 7434354434)
iterator.Len() == 3 // true
for iterator.Next() {
    product := iterator.Entity()
}
```

## Getting Entities by Unique Key

If entity holds unique index you can get entity by index name:

```go
category := beeorm.GetByUniqueIndex[CategoryEntity](c, "code", "cars")
```

## Getting Entities by Reference

You can easily get entities by one-one reference name:

```go
iterator := beeorm.GetByReference[ProductEntity](c, "Category", 9934828848843)
for iterator.Next() {
    product := iterator.Entity()
}
```

In the example above, a MySQL query `SELECT * FROM ProductEntity WHERE Category = 9934828848843` is executed. 
If you find yourself using this query frequently, it is strongly recommended to include a special tag `cached`, near the reference field. 
This tag instructs BeeORM to cache the query results in the local cache or, if local cache is not enabled for the returned entity, in Redis. 
Importantly, the cache is automatically updated whenever entities are added, updated, or deleted. 
All you need to do is add the `cached` tag as follows:

```go{3}
type ProductEntity struct {
	ID       uint64 `orm:"localCache"`
	Category *beeorm.Reference[CategoryEntity] `orm:"required;cached"`
	...
}

// data is loaded from local cache only without any MySQL query to DB
iterator := beeorm.GetByReference[ProductEntity](c, "Category", 9934828848843)
```

## Getting All Entities

You can get all entities from a table also:

```go
iterator := beeorm.GetAll[ProductEntity](c)
for iterator.Next() {
    product := iterator.Entity()
}
```

The example above performs a MySQL query `SELECT * FROM ProductEntity`. 
To circumvent the need for MySQL queries and load entities from a cache instead, 
you can simply include the `cached` tag near the ID field:

```go{2}
type ProductEntity struct {
	ID       uint64 `orm:"localCache;cached"`
	...
}
```

## Updating Entities

When updating an entity, the process involves retrieving it from the database and then modifying its fields. Two methods can be employed to achieve this:

### Method 1: Creating a Copy of the Entity

In this approach, you begin by obtaining the entity from the database and then create a modified copy using the `EditEntity()` function. Subsequently, you adjust the fields of the copy before applying the changes with the `Flush()` method. The following example illustrates the process:

```go{2}
product := beeorm.GetByID[ProductEntity](c, 27749843747733)
newVersionOfProduct := beeorm.EditEntity(c, product)
newVersionOfProduct.Name = "New name"
c.Flush()
```

It is essential to note that after executing `Flush()`, if you intend to edit the same entity again, you must rerun the `EditEntity()` function, as demonstrated in the corrected approach below:

```go
product := beeorm.GetByID[ProductEntity](c, 27749843747733)
newVersionOfProduct := beeorm.EditEntity(c, product)
newVersionOfProduct.Name = "New name"
c.Flush() // Executes UPDATE ProductEntity SET Name = "New name"

newVersionOfProduct = beeorm.EditEntity(c, newVersionOfProduct)
newVersionOfProduct.Name = "Another name"
c.Flush() // Executes UPDATE ProductEntity SET Name = "Another name"
```

This ensures the proper handling of entity updates. However, it's worth noting that this approach may lead to high memory usage due to the allocation of memory for all entity fields, even if only a few fields are updated.

### Method 2: Using EditEntityField

An alternative method involves using the `EditEntityField()` function to define new values for specific entity fields. Afterward, the `Flush()` method is employed to execute all changes and apply the new values to the entity and its cache. The example below illustrates this approach:

```go
product := beeorm.GetByID[ProductEntity](c, 27749843747733)
err := beeorm.EditEntityField(c, product, "Name",  "New name")
if err != nil {
    return err
}
err := beeorm.EditEntityField(c, product, "Price",  123.12)
if err != nil {
    return err
}

c.Flush()  // Executes UPDATE ProductEntity SET Name = "New name", Price = "123.12"
```

It's important to remember that until the `Flush()` method is executed, the entity field retains its old value, as demonstrated in the following example:

```go
fmt.Println(product.Name) // "Old value"
beeorm.EditEntityField(c, product, "Name",  "New value")
product.Name // "Old value"
c.Flush()
product.Name // "New value"
```

This method provides a more memory-efficient approach when updating specific fields of an entity.

## Deleting Entities

Deleting entity is very simple. See below example:

```go
product := beeorm.GetByID[ProductEntity](c, 27749843747733)
beeorm.DeleteEntity(c, entity)
c.Flush()
```
## Multiple CRUD operations

When you find yourself needing to perform numerous CRUD operations concurrently, it is highly advisable to execute them in a single 
batch by invoking the `Flush()` method. BeeORM efficiently consolidates all SQL queries into a single 
transaction and bundles all Redis operations into Redis pipelines. 
This approach ensures that the execution of all database operations is both rapid and atomic.

Let's illustrate this with an example:

```go
categoryCars := beeorm.NewEntity[CategoryEntity](c)
categoryCars.Code = "cars"
categoryCars.Name = "Cars"

image := beeorm.NewEntity[ImageEntity](c)
image.Url = "image1.png"

brandBMW := beeorm.NewEntity[BrandEntity](c)
brandBMW.Name = "BMW"
brandBMW.Logo = *beeorm.Reference[ImageEntity]{ID: image.ID}

oldProduct := beeorm.GetByID[ProductEntity](c, 27749843747733)
newProduct := beeorm.EditEntity(c, oldProduct)
newProduct.Category = *beeorm.Reference[CategoryEntity]{ID: categoryCars.ID}

oldImage := beeorm.GetByID[ImageEntity](c, 277498837423)
beeorm.DelteEntity(c, oldImage)

err := c.Flush()
```

## Cloning entities

Sometimes you may need to create a copy of an entity, make some changes to it, and save it as a new row in the database. You can easily do this using the `beeorm.Clone()` function:

```go{2}
product := beeorm.GetByID[ProductEntity](c, 27749843747733)
newProduct := beeorm.Clone(c, product)
Name.Name = "New name"
engine.Flush()
```

This will create a copy of the category entity, assign a new value to its Name field, and save it as a new row in the database. The original category entity will remain unchanged.
