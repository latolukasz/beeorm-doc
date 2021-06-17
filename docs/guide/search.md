# Search

On previous page you learned how to load entities from database using their primary keys.
In this section you will learn how to search and load entities.

## Pager

It's a good practice to always limit number of rows used in search with sql 
``LIMIT`` condition. BeeORM provides special object ``Pager`` used to define 
proper SQL syntax in your queries:

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

## Where

Every SQL search query requires search conditions. 
You can define them with ``beeorm.Where`` object:

```go
// WHERE Email = "bee@beeorm.io" AND Age >= 18
where := beeorm.NewWhere("Email = ? AND Age >= ?", "bee@beeorm.io", 18)
where.String() // "Email = ? AND Age >= ?"
where.GetParameters() // []interface{}{"bee@beeorm.io", 18}

where.SetParameter(1, "lion@beeorm.io")
where.GetParameters() // []interface{}{"lion@beeorm.io", 18}

where.SetParameters("elephant@beeorm.io", 20)
where.GetParameters() // []interface{}{"elephant@beeorm.io", 20}

where.Append("AND Age <= ?", 60)
where.String() // "Email = ? AND Age >= ? AND Age <= ?"
where.GetParameters() // []interface{}{"elephant@beeorm.io", 20, 60}
```

You should also use ``beeorm.Where`` to define ``ORDEBY BY`` in query:

```go
// WHERE 1 ORDER BY Age
where := beeorm.NewWhere("1 ORDER BY Age")
// WHERE 1 ORDER BY Age > 10
where := beeorm.NewWhere("Age > ? ORDER BY Age", 10)
```
When you pass slice as an argument ``beeorm.Where`` converts it into
sql ``IN (?,?...)`` syntax making your life a bit simper:

```go
where := beeorm.NewWhere("Age in ?", []int{18, 20, 30})
where.String() // WHERE Age IN (?,?,?)
where.GetParameters() // []interface{}{18, 20, 30}
```

## Searching for entities

Method ``engine.Search()`` is used to search entities using SQL query condition.
It requires ``beeorm.Where``, ``beeorm.Pager`` and reference to slice of entities.

<code-group>
<code-block title="code">
```go{25}
package main

import "github.com/latolukasz/beeorm"

type UserEntity struct {
    beeorm.ORM
    ID         uint
    FirstName  string `beeorm:"required"`
    LastName   string `beeorm:"required"`
    Email      string `beeorm:"required"`
    Supervisor *UserEntity
}

func main() {
    registry := beeorm.NewRegistry()
    registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/users")
    registry.RegisterEntity(&UserEntity{})
    validatedRegistry, err := registry.Validate(context.Background())
    if err != nil {
        panic(err)
    }
    engine := validatedRegistry.CreateEngine(context.Background())

    var users []*UserEntity
    engine.Search(beeorm.NewWhere("Age >= ?", 18), beeorm.NewPager(1, 100), &users)
    len(users) // 1000
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


Pager is optional, you can provide nil but BeeORM will still limit results to **50000** rows.

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

You can also provide optional parameters to define which references should me loaded. 
You can read more about this feature on [CRUD/loading references](/guide/crud.html#loading-references) page.

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

If you need total found rows you can use ``engine.SearchWithCount()`` method that works exactly
the same as ``engine.Search()`` with only one difference - it returns total found rows as `int`.

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

## Searching for entity

If you need to search one entity use ``engine.SearchOne()``:

<code-group>
<code-block title="code">
```go{2}
var user *UserEntity
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
This method is always adding `LIMIT 1` in SQL queries so in case your query selects more
than one row from database first row will be returned.
:::

## Searching for primary keys

You can also search for entity primary keys only with ``engine.SearchIDs()``:

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

:::tip
If Entity has [FakeDelete](guide/entity_fields.html#fake-delete) field do not forget
to add `WHERE FakeDelete = 0` in your query.
:::
