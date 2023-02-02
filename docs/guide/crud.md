# CRUD

In the previous sections, you learned how to configure BeeORM and update the MySQL schema. Now it's time to perform CRUD (Create, Read, Update, and Delete) actions using BeeORM.

The following examples build upon the following code base:

```go
package main

import "github.com/latolukasz/beeorm/v2"

type CategoryEntity struct {
	beeorm.ORM  `orm:"redisCache"`
	Code        string `orm:"required;length=10;unique=code"`
	Name        string `orm:"required;length=100"`
	FakeDelete  bool
}

type ImageEntity struct {
	beeorm.ORM `orm:"redisCache"`
	Url string `orm:"required"`
}

type BrandEntity struct {
	beeorm.ORM `orm:"redisCache"`
	Name string `orm:"required;length=100"`
	Logo *ImageEntity
}

type ProductEntity struct {
	beeorm.ORM `orm:"redisCache"`
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

Every time a new entity is saved to MySQL, BeeORM automatically sets the inserted primary key value in the ID field of the entity. Each entity provides a `GetID()` method that is useful if you pass the `beeorm.Entity` type in your code:

```go
categoryCars := &CategoryEntity{Code: "cars", Name: "Cars"}
categoryCars.GetID() // 0
engine.Flush(categoryCars)
categoryCars.GetID() // 1
```

If needed, you can define the ID for new entities by setting the ID field with `SetID()` before flushing the entity:

```go{1}
categoryCars := &CategoryEntity{Code: "cars", Name: "Cars"}
categoryCars.SetID(10)
engine.Flush(categoryCars)
categoryCars.GetID() // 10
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

### On duplicate key update

MySQL has a useful feature called [INSERT ON DUPLICATE KEY UPDATE](https://dev.mysql.com/doc/refman/8.0/en/insert-on-duplicate.html) that allows you to update an existing entity if it has a duplicate key in the database. BeeORM fully supports this feature and allows you to use it through the SetOnDuplicateKeyUpdate() method of an entity.

For example, consider the following code:

```go{3}
 // let's assume we have category in database with `Code` = cars and `ID` = 10:
category := &CategoryEntity{Code: "cars", Name: "Cars V2"}
category.SetOnDuplicateKeyUpdate(beeorm.Bind{"Name": "Cars V3"})
engine.Flush(categoryCars) // no panic
category.GetID() // 10
category.Name // "Cars V3"
```

In some cases, you may not want to update any fields if the entity you are trying to insert has a duplicate key in the database. In this case, you can simply provide `nil` as the bind parameter when calling the `SetOnDuplicateKeyUpdate()` method.

For example, consider the following code:

```go{3}
// Let's assume we have a category in the database with Code = "cars" and ID = 10:
category := &CategoryEntity{Code: "cars", Name: "Cars"}
category.SetOnDuplicateKeyUpdate(nil)
engine.Flush(category) // No panic
fmt.Println(category.GetID()) // 10
```

As you can see, the Flush() method does not panic and the ID field of the category entity is set to 10. The ON DUPLICATE KEY UPDATE clause ensures that no fields are updated if a duplicate key is detected.

### Flushing References

BeeORM automatically flushes all new entities (entities with an ID of 0) that are assigned as references in a flushed entity. For example:

```go
categoryCars := &CategoryEntity{Code: "cars", Name: "Cars"}
categoryDogs := &CategoryEntity{Code: "dogs", Name: "Dogs"}
bmw1 := &ProductEntity{Name: "BMW 1", Category: categoryCars}
fordFocus := &ProductEntity{Name: "Ford focus", Category: categoryCars}
cockerSpaniel := &ProductEntity{Name: "Cocker spaniel", Category: categoryDogs}
engine.Flush(bmw1, fordFocus) // we are flushing only products
bmw1.Category.GetID() // 1
fordFocus.Category.GetID() // 1
cockerSpaniel.Category.GetID() // 2
categoryCars.GetID() // 1
categoryDogs.GetID() // 2
```


Sometimes you may need to define a referenced entity, but you only know its `ID` value. In this case, you can assign it as a new entity with the `ID` set to the correct value:

```go{2}
category := &CategoryEntity{}
category.SetID(7)
product := &ProductEntity{Name: "Ford focus", Category: category}
engine.Flush()
```

Note that the CategoryEntity with an ID of 7 will not be inserted into the database, as it is being referenced rather than created as a new entity.

## Dirty State

An entity is considered "dirty" if it has changes that need to be applied to the corresponding MySQL table. Examples of dirty states include:

 * A new entity that needs to be inserted into the MySQL table.
 * An entity that needs to be deleted.
 * An entity that needs to be edited in the MySQL table because at least one column value has changed.

You can check the dirty state of an entity using the `IsDirty()` method. The `GetDirtyBind()` method returns a map with the fields that need to be inserted or updated.

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

You can flush entities that are not dirty, but BeeORM will simply skip these entities and no queries will be sent to MySQL. This means that you can run the `Flush()` method as many times as you want, and BeeORM will only update the database and cache when it is necessary.

```go
// we don't know what changes were made to the category inside the `DoSmthWithCactegory` method: 
some_package.DoSmthWithCactegory(category)
// but we ask BeeORM to save any changes that were made:
engine.Flush(category)
```

## Loading Entities

There are several ways to load entities from the database when you know the primary key. 

You can use the `engine.Load()` method:

```go{2}
product := &ProductEntity{}
product.SetID(1)// provide ID
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
products[0].GetID() // 1
products[1].GetID() // 2
```

If an entity is not found, it will be returned as `nil`:

```go
// we have only products with IDs 1 and 2 in the table
var products []*ProductEntity{}
engine.LoadByIDs([]uint64{1, 2, 3}, &products)
len(products) == 3 // true
products[0].GetID() // 1
products[1].GetID() // 2
products[2] == nil // true
```

### Loaded State

Every entity stores internally the data that is stored in the corresponding MySQL table. This allows BeeORM to track changes and determine if an entity is "dirty" and needs to be flushed (saved) to the database. This data is stored in the entity every time a new entity is flushed or loaded from the database. You can use the `entity.IsLoaded()` method to determine if an entity has this data and can track changes:

```go
category := &CategoryEntity{Code: "cars", Name: "Cars"}
category.SetID(22)
category.IsLoaded() // false, entity needs to be inserted in MySQL table
engine.FLush(category)
category.IsLoaded() // true, entity data is saved in database

product := &ProductEntity{}
product.IsLoaded() // false
engine.LoadByID(1, product)
product.IsLoaded() // true, entity data is loaded from database

product2 := &ProductEntity{}
product2.SetID(2)
product2.IsLoaded() // false
product.Load(product2)
product2.IsLoaded() // true
```

The `entity.IsLoaded()` and `entity.Load()` methods are particularly useful when working with references:

```go{3-5}
product := &ProductEntity{}
engine.LoadByID(1, product)
product.Category.Loaded() // false
engine.Load(product.Category)
product.Category.Loaded() // true
```

## Loading References

Often when loading an entity, you also need data from the connected referenced entities. For example, on a product page, you might need to display the product title, its category, brand, and brand logo. One way to do this is as follows:

```go
product := &ProductEntity{}
engine.LoadByID(1, product)
product.Name // returns "Ford focus"
product.Category.GetID() // returns 1
product.Brand.GetID() // returns 1
product.Category.Name // returns an empty string because the entity data is not Loaded
product.Brand.Name // returns an empty string because the entity data is not Loaded
product.Brand.Logo // returns nil because the entity data is not Loaded
engine.Load(product.Category)
engine.Load(product.Brand)
product.Category.Name // returns "Cars"
product.Brand.Name // returns "Ford"
product.Brand.Logo.GetID() // returns 1
product.Brand.Logo.Name // returns an empty string because the entity data is not Loaded
engine.Load(product.Brand.Logo)
product.Brand.Logo.Url // returns "/images/ford.png"
```

Is it possible to make this code simpler and faster? Every method used to load entities, such as `Load()`, `LoadByID()`, and `LoadByIDs()`, accepts optional references parameters that can be used to instruct BeeORM to load specific references together with the entity:

```go{2}
product := &ProductEntity{}
engine.LoadByID(1, product, "Category", "Brand/Logo")
product.Name // "Ford focus"
product.Category.Name // "Cars"
product.Brand.Name // "Ford"
product.Brand.Logo.Url // "/images/ford.png"
```

As you can see, the code above is not only simpler, but it also produces fewer requests to MySQL and Redis. Notice how queries are generated when you use the references feature to load multiple entities at once:

```go{2}
var products []*ProductEntity{}
engine.LoadByIDs(uint64{1, 2, 3}, &products, "Category", "Brand/Logo")
```

This code generates only three queries to Redis, making it a very efficient way to load multiple entities with their references. Isn't that cool?

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

If the entity has a  [FakeDelete field](/guide/entity_fields.html#fake-delete), the above methods will work differently. Instead of deleting rows from the table, a special update query will be executed:

```go{3}
category := &CategoryEntity{}
engine.LoadByID(3, category)
engine.Delete(category)
```

This will update the FakeDelete field for the CategoryEntity with an ID of 3 in the table, rather than deleting the row.

To force an entity with a `FakeDelete` field to be deleted from the MySQL table, use the `engine.ForceDelete()` method:

```go{3}
category := &CategoryEntity{}
engine.LoadByID(3, category)
engine.ForceDelete(category)
```

This will delete the `CategoryEntity` with an ID of 3 from the table, even if it has a `FakeDelete` field.

## Using the Flusher

The `beeorm.Flusher` is a useful tool in BeeORM when you need to add, update, and delete multiple entities at the same time. It allows you to "track" entities and provides flush methods that update all tracked dirty entities at once.

Here's an example of using the `Flusher`:

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

Once you have finished tracking the entities you want to update or delete, you can execute the updates and deletions by calling the `Flush()` method on the `Flusher` object:

```go
flusher.Flush()
```

This will execute all of the necessary queries to update or delete the tracked entities in the database. For example, if you tracked an entity to be inserted, updated, and deleted, the `Flush()` method will execute the appropriate INSERT, UPDATE, and DELETE queries.


The `beeorm.Flusher` provides several methods for flushing tracked entities to the database. These methods include:

 * `FlushWithCheck()`, which returns a `*beeorm.DuplicatedKeyError` or `*beeorm.ForeignKeyError` if an error occurs during the flush.
 * `FlushWithFullCheck()`, which returns an error instead of panicking if an error occurs during the flush.


```go
// returns *beeorm.DuplicatedKeyError or *beeorm.ForeignKeyError
err := flusher.FlushWithCheck()
```

```go
// returns error instead of panicing 
err := flusher.FlushWithFullCheck()
```

The `beeorm.Flusher` allows you to track entities for updates and deletions, but it does remove them from the tracker after they are flushed to the database.

For example:

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

This code will insert the category entity into the database, then update it with a new name. However, after the `flusher.Clear()` method is called, any further updates to the category entity will not be tracked and will not be applied to the database when the `Flush()` method is called.

## Clearing Entity Cache

In BeeORM, you can use the `beeorm.ClearCacheByIDs()` method to manually clear cached entity data. This can be useful if you need to update the cache after making changes to an entity in the database.

Here's an example of how to use the `ClearCacheByIDs()` method:

```go{2}
var categoryEntity CategoryEntity
engine.ClearCacheByIDs(categoryEntity, 7, 13, 33)
```

This will clear the cache for the specified entities with the IDs 7, 13, and 33 of the CategoryEntity type. After calling this method, the next time these entities are loaded from the database, the cache will be updated with the latest data from the database.

