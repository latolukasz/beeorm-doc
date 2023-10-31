# CRUD

In the previous sections, you learned how to configure BeeORM and update the MySQL schema. Now it's time to perform CRUD (Create, Read, Update, and Delete) actions using BeeORM.

The following examples build upon the following code base:

```go
package main

import "github.com/latolukasz/beeorm/v3"

type CategoryEntity struct {
	uint64      `orm:"localCahe;redisCache"`
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
	beeorm.ORM `orm:"redisCache"`
	ID       uint32
	Name     string `orm:"required;length=100"`
	Category *beeorm.Reference[CategoryEntity] `orm:"required"`
	Brand    *beeorm.Reference[BrandEntity] 
}

func main() {
    registry := beeorm.NewRegistry()
    registry.RegisterMySQL("user:password@tcp(localhost:3306)/db", beeorm.DefaultPoolCode, nil) 
    registry.RegisterRedis("localhost:6379", 0, beeorm.DefaultPoolCode, nil)
    registry.RegisterEntity(&CategoryEntity{}, &BrandEntity{}, &ImageEntity{}, &ProductEntity{}) 
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
image2 := NewEntity[ImageEntity](c)
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

TODO

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

## Multiple CRUD operations

TODO

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
