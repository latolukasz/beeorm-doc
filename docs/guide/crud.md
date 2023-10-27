# CRUD

In the previous sections, you learned how to configure BeeORM and update the MySQL schema. Now it's time to perform CRUD (Create, Read, Update, and Delete) actions using BeeORM.

The following examples build upon the following code base:

```go
package main

import "github.com/latolukasz/beeorm/v2"

type CategoryEntity struct {
	beeorm.ORM  `orm:"redisCache"`
	ID          uint16
	Code        string `orm:"required;length=10;unique=code"`
	Name        string `orm:"required;length=100"`
}

type ImageEntity struct {
	beeorm.ORM `orm:"redisCache"`
	ID  uint64
	Url string `orm:"required"`
}

type BrandEntity struct {
	beeorm.ORM `orm:"redisCache"`
	ID   uint16
	Name string `orm:"required;length=100"`
	Logo *ImageEntity
}

type ProductEntity struct {
	beeorm.ORM `orm:"redisCache"`
	ID       uint32
	Name     string `orm:"required;length=100"`
	Category *CategoryEntity `orm:"required"`
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

## Saving New Entities

There are various ways to store a new entity in a database using BeeORM. The simplest method is to use the `engine.Flush()` method, which inserts the entity into the database and updates its ID field with the primary key value:

```go{2}
category := &CategoryEntity{Code: "cars", Name: "Cars"}
engine.Flush(category)
```

You can save multiple entities at once:

```go{4}
categoryCars := &CategoryEntity{Code: "cars", Name: "Cars"}
categoryBikes := &CategoryEntity{Code: "bikes", Name: "Bikes"}
product := &ProductEntity{Name: "BMW 1", Category: categoryCars}
engine.Flush(categoryCars, categoryBikes, product)
```

::: tip
Note that `Flush()` only generates two SQL queries, as BeeORM's query optimizer groups all queries to MySQL and Redis to minimize the number of queries. It is always more efficient to use `FlushMany()` to save multiple entities at once, rather than calling `Flush()` multiple times.
:::

Every time a new entity is saved to MySQL, BeeORM automatically sets the inserted primary key value in the ID field of the entity:

```go
categoryCars := &CategoryEntity{Code: "cars", Name: "Cars"}
categoryCars.ID // 0
engine.Flush(categoryCars)
categoryCars.ID // 1
```

If needed, you can define the ID for new entities by setting the ID before flushing the entity:

```go{1}
categoryCars := &CategoryEntity{ID: 10, Code: "cars", Name: "Cars"}
engine.Flush(categoryCars)
categoryCars.ID // 10
```

By default, the `Flush()` method of BeeORM does not return any errors. Instead, it will panic if an error occurs. This approach is preferred in actions that connect to external services such as databases, as it ensures that any issues are immediately addressed. However, in some cases, you may want to handle specific errors that may occur when saving an entity. For example, you may want to catch errors related to duplicate or invalid values in MySQL indexes.

To handle these specific errors, you can use the `engine.FlushWithCheck()` method, which returns either a `*beeorm.DuplicatedKeyError` or a `*beeorm.ForeignKeyError` in case of a duplicate or invalid value in a MySQL index, respectively. Any other errors, such as an unavailable MySQL server, will still cause a panic.

Here is an example of using `engine.FlushWithCheck()` to handle specific errors:

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

## Getting Entities by ID

There are several ways to load entities from the database when you know the primary key. 

You can use the `engine.Load()` method:

```go{1}
product := &ProductEntity{ID: 1}
found := engine.Load(product) // true
```

Another option is to use `engine.LoadByID()`:

```go{2}
product := &ProductEntity{}
found := engine.LoadByID(1, product) // true
```

If you need to load more than one entity, you can use `engine.LoadByIDs()`:

```go{2}
var products []*ProductEntity{}
engine.LoadByIDs([]uint64{1, 2}, &products)
len(products) == 2 // true
products[0].ID // 1
products[1].ID // 2
```

If an entity is not found, it will be returned as `nil`:

```go
// we have only products with IDs 1 and 2 in the table
var products []*ProductEntity{}
engine.LoadByIDs([]uint64{1, 2, 3}, &products)
len(products) == 3 // true
products[0].ID // 1
products[1].ID // 2
products[2] == nil // true
```

## Getting Entities by Unique Key

TODO

## Getting Entities by Reference

TODO


## Getting All Entities

TODO

## Updating entities

Updating entities with BeeORM is straightforward. You can update entity by calling the `Flush()` method on the entities.

```go{4}
product := &ProductEntity{}
engine.LoadByID(1, product)
product.Name = "New name"
engine.Flush(product)
```

To update an entity, you first need to load it from the database using a method like `LoadByID()`. Then, you can modify the entity's properties and call `Flush()` to persist the changes to the database. BeeORM will automatically generate the necessary `SQL UPDATE` statement and execute it against the database, as well as invalidate any relevant cache entries to ensure that the updated data is reflected in future queries.

It's important to note that you can only update entities that are already loaded and have their data stored internally. If you try to update an entity that has not been loaded, BeeORM will return an error.

In the example provided, the code loads two ProductEntity instances and a CategoryEntity instance from the database, then modifies the Name property of each entity and calls `Flush()` to update all three entities in a single batch. This results in three `UPDATE` statements being executed against the database, and the relevant cache entries being invalidated to ensure that the updated data is reflected in future queries.

## Deleting Entities

In BeORM, entities can be deleted from a MySQL table using the `engine.Delete()` method. For example:

```go{3}
product := &ProductEntity{}
engine.LoadByID(1, product)
engine.Delete(product)
```

This will delete the `ProductEntity` with an ID of 1 from the table.

To delete multiple entities at once:

```go
engine.Delete(product1, product1, product3)
```

This will delete all ProductEntity objects with an ID of 1 or 2 from the table.

## Cloning entities

Sometimes you may need to create a copy of an entity, make some changes to it, and save it as a new row in the database. You can easily do this using the `entity.Clone()` method:

```go{3}
category := &CategoryEntity{}
engine.LoadByID(1, category)
newCategory := category.Clone(*CategoryEntity)
newCategory.Name = "New name"
engine.Flush(newCategory)
```

This will create a copy of the category entity, assign a new value to its Name field, and save it as a new row in the database. The original category entity will remain unchanged.
