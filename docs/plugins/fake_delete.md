# Fake Delete


By default, when you [delete Entities]((/guide/crud.html#deleting-entities)), the corresponding rows are removed from the MySQL table, which is usually the expected behavior.

However, in some scenarios, you may need to keep the rows in the table for various reasons:

Foreign keys: The Primary Key of the deleted row is used as a reference in another table with a Foreign Key constraint.
You need access to the removed rows to check the history of changes or restore lost data.
Usually, developers add a special column, such as Archived, and set it to true instead of deleting the row. However, in this case, all queries that return data must contain `Archived = false`. Another solution is to move the deleted row to a separate table. However, this can be complex, as changes in the source table's schema require corresponding modifications to the table that holds the archived data, or the creation of a new table altogether.

Fortunately, this BeeORM plugin provides a simple solution to this problem. It performs "the magic" of soft deleting the rows for you.

## Enabling Plugin

```go
package main

import {
    "github.com/latolukasz/beeorm/v2"
    "github.com/latolukasz/beeorm/v2/plugins/fake_delete"
}

func main() {
    registry := beeorm.NewRegistry()
    registry.RegisterPlugin(fake_delete.Init(nil)) 
} 
```

## Enabling Fake Delete for Entity

To enable "Fake Delete" option in an entity, you simply need to add a `bool` field called `FakeDelete` in your entity structure. For instance:

```go{4}
type PersonEntity struct {
	beeorm.ORM  `orm:"uuid"`
	Name string `orm:"required"`
	FakeDelete bool
}
```

If you prefer to use a different name for the `FakeDelete` field, you can set it using the plugin option `FieldName`. For example:

```go{1,8}
registry.RegisterPlugin(fake_delete.Init(FieldName: "Deleted")) 

type PersonEntity struct {
	beeorm.ORM  `orm:"uuid"`
	FisrtName string `orm:"required"`
	LastName string `orm:"required"`
	Email string `orm:"required;unique=Email"`
	Deleted bool
}
```

When you call `engine.Delete(person)` on an entity, by default, the corresponding row will be removed from the MySQL table. However, when you have enabled the "Fake Delete" option, the plugin will update the row by setting the value of the `FakeDelete` column to the ID of the entity, instead of deleting the row.

For example:

```go
person := &PersonEntity{}
engine.LoadByID(7, person)
engine.Delete(person) // UPDATE `PersonEntity` SET `FakeDelete` = `ID`
```

The value of `FakeDelete` column is set to 7 in the above example, which is the ID of the entity that is being deleted.

The plugin adds `FakeDelete` columns to every entity index, both unique and non-unique. This extra column ensures that every SQL query which uses these indexes runs fast, even if `AND FakeDelete = 0` is added to the query. Additionally, the extra column in a unique index allows you to add a new row with the same column values used in removed (updated with FakeDelete = ID) rows, as shown in the following example:

```go
newPerson := &PersonEntity{Email: "john@myweb.com"}
// works as expected, we don't have any row with this email with FakeDelete = 0
engine.Flush(newPerson) 

nduplicatedPerson := &PersonEntity{Email: "john@myweb.com"}
// below code panics as expected because Email is already in use
engine.Flush(newPerson) 
```

The example works because PersonEntity table has `UNIQUE KEY Email (Email, FakeDelete)` unique index.

You can also fake delete an entity by setting the value of the `FakeDelete` field to `true`, like this:

```go
person := &PersonEntity{}
engine.LoadByID(7, person)
person.FakeDelete = true
engine.FLush(person) // UPDATE `PersonEntity` SET `FakeDelete` = `ID`
```

## Forcing delete

You can force BeeORM to delete a row from a table using the `ForceDelete()` method:

Using the Engine:

```go{3-4}
person := &PersonEntity{}
engine.LoadByID(7, person)
fake_delete.ForceDelete(person) // marking entity as forced to dele
engine.Delete(person) // this will remove row from table
```

Using the Flusher:

```go{4-6}
person := &PersonEntity{}
engine.LoadByID(7, person)
flusher := engine.NewFlusher()
fake_delete.ForceDelete(person) // marking entity as forced to dele
flusher.Delete(person)
flusher.Flush() // this will remove row from table
```

By default, when you delete an entity, BeeORM marks it as "fake deleted" by setting the `FakeDelete` field to the entity's ID. However, in some cases, you may want to delete the row from the table completely, even if it has foreign key constraints or you need to keep a record of the deleted data. In such cases, you can use the `ForceDelete()` method to instruct BeeORM to remove the row from the table.

Please note that forcing a delete will remove the row permanently, and it cannot be undone. Therefore, use this method with caution and only when it is necessary to remove the row completely.

## Searching

This plugin adds an extra condition "AND FakeDelete = 0" to all SQL queries used in [entity search](/guide/search.html) methods.

```go
var rows []*PersonEntity

// WHERE 1 AND `FakeDelete` = 0 LIMIT 0, 100
engine.Search(beeorm.NewWhere("1"), beeorm.NewPager(1, 100), &rows)
// WHERE `Email` = "john@myweb.com" AND `FakeDelete` = 0 LIMIT 0, 1
engine.SearchOne(beeorm.NewWhere("Email = ?", "john@myweb.com"), &PersonEntity{})
```

In some scenarios, you may want to search for all rows, including deleted ones. In that case, you can use the special text **\`FakeDelete\`** in your WHERE query, and this plugin will not add the extra condition:

```go
// only deleted rows
// WHERE 1 AND `FakeDelete` > 0 LIMIT 0, 100
engine.Search(beeorm.NewWhere("1 AND `FakeDelete` > 0"), beeorm.NewPager(1, 100), &rows)

// all rows
// WHERE 1 AND `FakeDelete` >= 0 LIMIT 0, 100
engine.Search(beeorm.NewWhere("1 AND `FakeDelete` >= 0"), beeorm.NewPager(1, 100), &rows)
```

All methods that used ID to [load entity](/guide/crud.html#loading-entities) do not add "AND FakeDelete = 0"
condition:

Note that all methods that use ID to [load](/guide/crud.html#loading-entities) an entity do not add the "AND FakeDelete = 0" condition:

```go
// WHERE ID = 1
engine.LoadByID(1, &personEntity)
```