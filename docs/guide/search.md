# Searching for Entities

In the previous section, you learned how to load entities from a database using their primary keys. In this section, we will cover how to search and load entities using other criteria. This can be useful when you want to find specific entities that meet certain conditions or when you want to retrieve a list of entities that match a certain search query. We will explore different techniques for searching and loading entities using various filters and search parameters.

## Using the Pager Object

It is a good practice to limit the number of rows returned in a search query using the `LIMIT` condition in SQL. The BeeORM library provides a special object called the `Pager` to help define the proper SQL syntax for pagination in your queries.

Here is an example of how to use the Pager object:

```go
// load first 100 rows
pager := beeorm.NewPager(1, 100) // LIMIT 0, 100
pager.GetPageSize() // 100
pager.GetCurrentPage() // 1

// load next 100 rows (page nr 2)
pager = beeorm.NewPager(2, 100) // LIMIT 100, 100
pager.GetPageSize() // 100
pager.GetCurrentPage() // 2

pager.IncrementPage() // LIMIT 200, 100
pager.GetCurrentPage() // 3
```

## Using the Where Object

Every SQL search query requires specific search conditions to be defined. The `beeorm.Where` object can be used to define these conditions in a convenient and flexible way.

Here is an example of how to use the `Where` object:

```go
// WHERE Email = "bee@beeorm.io" AND Age >= 18
where := beeorm.NewWhere("Email = ? AND Age >= ?", "bee@beeorm.io", 18)
where.String() // returns: "Email = ? AND Age >= ?"
where.GetParameters() // returns: []interface{}{"bee@beeorm.io", 18}

// update the first parameter
where.SetParameter(1, "lion@beeorm.io")
where.GetParameters() // returns: []interface{}{"lion@beeorm.io", 18}

// update all parameters
where.SetParameters("elephant@beeorm.io", 20)
where.GetParameters() // returns: []interface{}{"elephant@beeorm.io", 20}

// append additional conditions
where.Append("AND Age <= ?", 60)
where.String() // returns: "Email = ? AND Age >= ? AND Age <= ?"
where.GetParameters() // returns: []interface{}{"elephant@beeorm.io", 20, 60}
```

You can also use the `Where` object to define the `ORDER BY` clause in a query:

```go
// WHERE 1 ORDER BY Age
where := beeorm.NewWhere("1 ORDER BY Age")
// WHERE Age > 10 ORDER BY Age
where := beeorm.NewWhere("Age > ? ORDER BY Age", 10)
```
If you pass a slice as an argument to `beeorm.Where`, it will automatically convert it into the `SQL IN (?,?,...)` syntax, which can simplify your code. For example:

```go
where := beeorm.NewWhere("Age IN ?", []int{18, 20, 30})
where.String() // WHERE Age IN (?,?,?)
where.GetParameters() // []interface{}{18, 20, 30}
```

If Entity has [FakeDelete](/guide/entity_fields.html#fake-delete) field BeeORM adds
 `WHERE FakeDelete = 0` in your query. You can remove this condition with `ShowFakeDeleted()` method:

```go{3}
where := beeorm.NewWhere("Age >= >", [18)
where.String() // WHERE Age >= ?
where.ShowFakeDeleted()
where.String() // WHERE Age >= ? AND FakeDelete = 0
```

## Searching for Entities

The `engine.Search()` method is used to search for entities using a SQL query condition. It requires a `beeorm.Where` object, a `beeorm.Pager` object, and a reference to a slice of entities.

Here is an example of how to use the `engine.Search()` method:

<code-group>
<code-block title="code">
```go{25}
package main

import "github.com/latolukasz/beeorm"

type UserEntity struct {
    beeorm.ORM
    ID         uint
    FirstName  string `orm:"required"`
    LastName   string `orm:"required"`
    Email      string `orm:"required"`
    Supervisor *UserEntity
}

func main() {
    registry := beeorm.NewRegistry()
    registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/users")
    registry.RegisterEntity(&UserEntity{})
    validatedRegistry, err := registry.Validate()
    if err != nil {
        panic(err)
    }
    engine := validatedRegistry.CreateEngine()

    var users []*UserEntity
    engine.Search(beeorm.NewWhere("Age >= ?", 18), beeorm.NewPager(1, 100), &users)
    len(users) // 100
    users[0].Email // "bee@beeorm.io"
}
```
</code-block>

<code-block title="sql">
```sql
SELECT `ID`,`FirstName`,`LastName`,`Email`,`Supervisor` FROM `UserEntity` WHERE Age >= 18 LIMIT 0,100
```
</code-block>
</code-group>


The Pager object is optional. If you provide nil, BeeORM will still limit the results to **50 000** rows.

<code-group>
<code-block title="code">
```go
engine.Search(beeorm.NewWhere("1 ORDER BY ID DESC"), nil, &users)
```
</code-block>

<code-block title="sql">
```sql
SELECT `ID`,`FirstName`,`LastName`,`Email`,`Supervisor` FROM `UserEntity` WHERE 1 ORDER BY ID DESC LIMIT 0,50000
```
</code-block>
</code-group>

You can also provide optional parameters to define which references should be loaded. You can read more about this feature on the [CRUD/loading references](/guide/crud.html#loading-references) page.

<code-group>
<code-block title="code">
```go
engine.Search(beeorm.NewWhere("1"), beeorm.NewPager(1, 10), &users, "Supervisor")
```
</code-block>

<code-block title="sql">
```sql
SELECT `ID`,`FirstName`,`LastName`,`Email`,`Supervisor` FROM `UserEntity` WHERE 1 LIMIT 0,10
// loading supervisors
SELECT `ID`,`FirstName`,`LastName`,`Email`,`Supervisor` FROM `UserEntity` WHERE ID IN (7,10)
```
</code-block>
</code-group>

If you need the total number of found rows, you can use the `engine.SearchWithCount()` method, which works exactly the same as `engine.Search()`, with the only difference being that it returns the total number of found rows as an int.

<code-group>
<code-block title="code">
```go
total := engine.SearchWithCount(beeorm.NewWhere("FirstName = ?", "Adam"), beeorm.NewPager(1, 10), &users)
```
</code-block>

<code-block title="sql">
```sql
SELECT `ID`,`FirstName`,`LastName`,`Email`,`Supervisor` FROM `UserEntity` WHERE FirstName = "Adam" LIMIT 0,10
SELECT COUNT(1) FROM `UserEntity` WHERE FirstName = "Adam"
```
</code-block>
</code-group>

## Searching for a Single Entity

If you need to search for a single entity, you can use the `engine.SearchOne()` method:

<code-group>
<code-block title="code">
```go{2}
user := &UserEntity{}
found := engine.SearchOne(beeorm.NewWhere("Email = ?", "bee@beeorm.io"), user)
if found {
  fmt.Printf("Found user with ID %d and Email\n", user.ID, user.Email)
}

//with references
found = engine.SearchOne(beeorm.NewWhere("ID > ? ORDER BY Age DESC", 12), user, "Supervisor")
```
</code-block>

<code-block title="sql">
```sql
SELECT `ID`,`FirstName`,`LastName`,`Email`,`Supervisor` FROM `UserEntity` WHERE Email = "bee@beeorm.io" LIMIT 1
SELECT `ID`,`FirstName`,`LastName`,`Email`,`Supervisor` FROM `UserEntity` WHERE ID > 12 ORDER BY Age DESC LIMIT 1

```
</code-block>
</code-group>

::: tip
This method always adds `LIMIT 1` to the SQL query, so if your query selects more than one row from the database, only the first row will be returned.
:::

## Searching for Primary Keys

You can use the `engine.SearchIDs()` method to search for the primary keys of an entity:

<code-group>
<code-block title="code">
```go{2}
var user *UserEntity
ids := engine.SearchIDs(beeorm.NewWhere("Age >= ?", 18), beeorm.NewPager(1, 10), user)
for _, id := range ids {
    fmt.Printf("ID: %d\n", id)
}
```
</code-block>

<code-block title="sql">
```sql
SELECT `ID` FROM `UserEntity` WHERE FirstName = "Adam" LIMIT 0,10
```
</code-block>
</code-group>

