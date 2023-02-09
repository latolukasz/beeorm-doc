# Cached Queries

In the [Search section](/guide/search.html) of this guide, you learned how to search for entities using the `engine.Search()` method. However, executing SQL queries in a MySQL database can lead to performance issues in high availability applications. To improve performance, it is good practice to use a NoSQL cache layer to cache the results of these queries. This way, subsequent searches will not hit the MySQL database and instead load data from the cache.

One issue with this solution is that every time data in the MySQL database is changed (e.g., through inserts, updates, or deletes), the corresponding data in the cached search results must also be updated. Fortunately, BeeORM provides a feature called "CachedQuery" that simplifies this process and allows you to easily cache search results with simple code.

## Single Entity

Let's assume we have a `UserEntity` struct:

```go
type UserEntity struct {
	beeorm.ORM
    Email      string `orm:"unique=email;required"` 
    Supervisor *UserEntity
}
```

In our application, we often search for a user using their email:

```go{2}
user := &UserEntity{}
found := engine.SearchOne(beeorm.NewWhere("Email = ?", "bee@beeorm.io"), user)
```

```sql
SELECT `ID`,`FirstName`,`LastName`,`Email` FROM `UserEntity` WHERE Email = "bee@beeorm.io" LIMIT 1
```

To cache this query, we first need to define the cache layer that will be used to store the data. In this example, we will use Redis.

```go{2}
type UserEntity struct {
	beeorm.ORM `orm:"redisCache"`
    Email      string `orm:"unique=email;required"` 
    Supervisor *UserEntity
}
```

Next, we need to add an extra field of type `*beeorm.CachedQuery` with the `queryOne` tag:

```go{5}
type UserEntity struct {
	beeorm.ORM       `orm:"redisCache"`
    Email            string `orm:"unique=email;required"` 
    Supervisor       *UserEntity
    CachedQueryEmail *beeorm.CachedQuery `queryOne:":Email = ?"`
}
```

This enables us to cache search queries for the `UserEntity` struct. The `queryOne` tag specifies the SQL query conditions, where each entity field must be prefixed with `:`. This allows BeeORM to track which entity fields need to be updated in the cache when changes are made to the data.

We can now run a cached search query using `engine.CachedSearchOne()`:

```go{2}
var user *UserEntity
found := engine.CachedSearchOne(user, "CachedQueryEmail", "bee@beeorm.io")
```

```redis
GET query_cache_key
```

```sql
REDIS GET query_cache_key
SELECT `ID`,`FirstName`,`LastName`,`Email` FROM `UserEntity` WHERE Email = "bee@beeorm.io" LIMIT 1
REDIS SET cache_key ID_OF_ENTITY
```

`engine.CachedSearchOne()` requires the name of the entity field used to define the cached query and a list of parameters required in the SQL query condition defined in the queryOne tag.

BeeORM will automatically update the cached query results when the entity is updated. For example:

```go
var user *UserEntity
found := engine.CachedSearchOne(user, "CachedQueryEmail", "bee@beeorm.io")
found == true // false, we have no rows in table

user = &UserEntity{Email: "bee@beeorm.io"}
found = engine.CachedSearchOne(user, "CachedQueryEmail", "bee@beeorm.io")
found == true // true

user.Email = "fish@beeorm.io"
engine.Flush(user)
found = engine.CachedSearchOne(user, "CachedQueryEmail", "bee@beeorm.io")
found == true // false
found = engine.CachedSearchOne(user, "CachedQueryEmail", "fish@beeorm.io")
found == true // true

engine.Delete(user)
found = engine.CachedSearchOne(user, "CachedQueryEmail", "fish@beeorm.io")
found == true // false
```

## Many Entities

We can also search for multiple entities using a cached query. To do so, we first need to define another cached query in our `UserEntity` struct:

```go{9}
type UserEntity struct {
	beeorm.ORM        `orm:"redisCache"`
    Email             string `orm:"unique=email;required"` 
    Supervisor        *UserEntity
    Admin             bool
    Age               uint8
    CreatedAt         time.Time
    CachedQueryEmail  *beeorm.CachedQuery `queryOne:":Email = ?"`
    CachedQueryAdmins *beeorm.CachedQuery `query:":Admin = ? AND :Age >= ? ORDER BY :CreatedAt DESC"`
}
```

Note that we added another field of type `*beeorm.CachedQuery`, but this time with the query tag instead of queryOne. You can also use the `ORDER BY` syntax in your cached query SQL condition. Remember to prefix all fields with `:`, or else the cache data will not be updated when the entity field changes.

We can now run our search using `engine.CachedSearch()`:

```go{2}
var users []*UserEntity
totalRows := engine.CachedSearch(&users, "CachedQueryAdmins", orm.NewPager(1, 100), true, 18)
```

```queries hits
REDIS GET query_cache_key
```

```queries misses
REDIS GET query_cache_key
SELECT `ID`,`FirstName`,`LastName`,`Email` FROM `UserEntity` WHERE Admin = 1 AND Age >= 18 ORDER BY CreatedAt DESC LIMIT 1,100
REDIS SET cache_key ID_OF_ENTITY
```

You can also request a different page, but keep in mind that BeeORM only allows caching a maximum of 50,000 rows. If you skip the pager, all rows will be returned, but no more than 50,000.

```go
// LIMIT 100,100
engine.CachedSearch(&users, "CachedQueryAdmins", orm.NewPager(2, 100), true, 18)
// LIMIT 50000
engine.CachedSearch(&users, "CachedQueryAdmins", nil, true, 18)
// LIMIT 60000, will panic
engine.CachedSearch(&users, "CachedQueryAdmins", orm.NewPager(1, 60000), true, 18)
// LIMIT 60000,20000, will panic
engine.CachedSearch(&users, "CachedQueryAdmins", orm.NewPager(3, 20000), true, 18)
```

f you only need to search for the total number of found rows, you can use `engine.CachedSearchCount()`:

```go{2}
var user *UserEntity
total := engine.CachedSearchCount(user, "CachedQueryAdmins", true, 18)
fmt.Printf("Total rows: %d\n", total) 
```
To search for primary keys, you can use `engine.CachedSearchIDs()`:

```go{2}
var user *UserEntity
total, ids := engine.CachedSearchIDs(user, "CachedQueryAdmins", orm.NewPager(1, 100), true, 18)
fmt.Printf("Total rows: %d\n", total) 
for _, id := range ids {
    fmt.Printf("ID: %d\n", id) 
}
```

:::tip
If your entity has the [FakeDelete](/guide/entity_fields.html#fake-delete) field, you do not need to include `WHERE FakeDelete = 0` in your cached query condition. BeeORM will automatically filter out rows with `FakeDelete = 1` when executing a search.
:::
