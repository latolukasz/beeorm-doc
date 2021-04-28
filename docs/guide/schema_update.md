# Schema update

One of the most important benefit using ORM is possibility to generate and 
update database schema based on data structure in your code.
In BeeORM this data structure are of course registered entities.
Our ORM provides two ways to generate or update MySQL schema:

## Generate all MySQL alters

This approach is recommended one. BeeORM is comparing current MySQL
schema in all MySQL databases used by all registered entities 
and returns detailed information that can be used to update database schema:

```go{21}
package main

import "github.com/latolukasz/beeorm"

type CategoryEntity struct {
	beeorm.ORM `beeorm:"mysql=products"`
	ID   uint
    Name string `beeorm:"required"`
}

func main() {
    registry := beeorm.NewRegistry()
    registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/products", "products")
    registry.RegisterEntity(&CategoryEntity{})
    validatedRegistry, err := registry.Validate()
    if err != nil {
        panic(err)
    }
    engine := validatedRegistry.CreateEngine()
    
    alters := engine.GetAlters()
    for _, alter := range alters {
      alter.SQL // "CREATE TABLE `CategoryEntity` ..."
      alter.Pool // "products"
      alter.Safe // true
	}
}  
```

`Safe` field is `false` when one of these conditions is met:
 * table needs to be dropped and is not empty
 * at least one column needs to be removed or changed and table is not empty

As you can see `Safe` equal `true` means - "executing this query you will not lose any data".

You can easily execute all alters:

```go
for _, alter := range alters {
  alter.Exec()
}
```

::: tip
Always run all alters in exact order. Starting from first one, then second one
and so on. Very often previous alter is required in next one, for example first
we need to create index on column and only then we can run query that defines 
foreign key.
:::

::: warning
BeeORM is creating `DROP table ...` queries for all tables that exists in registered
MySQL database that are NOT mapped as entity. This os one of reasons why you should always
check all generated alters before executing them.
:::

## Updating entity schema

You can also use entity `beeorm.TableSchema` object to update it's database schema:

```go{2}
tableSchema := validatedRegistry.GetTableSchemaForEntity(&CategoryEntity{})
alters, has := tableSchema.GetSchemaChanges(engine)
if has {
    for _, alter := range  {
      alter.SQL // "CREATE TABLE `CategoryEntity` ..."
      alter.Pool // "products"
      alter.Safe // true
      alter.Exec()
    }
}
```

If you need to execute all alters you can use short version:
```go{2-3}
tableSchema := validatedRegistry.GetTableSchemaForEntity(&CategoryEntity{})
tableSchema.UpdateSchema(engine) // executes all alters
tableSchema.UpdateSchemaAndTruncateTable(engine) // truncates table and executes all alters
```

`beeorm.TableSchema` provides many useful methods used to manage entity table:

```go
tableSchema := validatedRegistry.GetTableSchemaForEntity(&CategoryEntity{})
tableSchema.DropTable(engine) // drops whole table
tableSchema.TruncateTable(engine) // truncates table
```
