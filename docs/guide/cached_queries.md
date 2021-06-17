# Cached queries

In [Search](/guide/search.html) section of this guide you learned
how to search for entities. Every time you run `engine.Search()` method
SQL query is executed in MySQL database. In high availability applications
it may cause performance issues. Good practice is to use no-sql cache layer
to cache results from this query so next search will not hit MySQL database but
data will be loaded from this cache. There are one issue with this solution - 
every time data in MySQL is changed (inserts, updates, deletes) also corresponding
data in cached search results should be updated. Lucky you BeeORM provides
a feature called ``CachedQuery`` that hides this complexity from you and allows
you to write simple code used to cache search results.

## Single entity

Let's assume we have ``UserEntity``:

```go
type UserEntity struct {
	beeorm.ORM
	ID         uint
    Email      string `beeorm:"unique=email;required"` 
    Supervisor *UserEntity
}
```

In our application very often we are searching for a user with his email:

<code-group>
<code-block title="code">
```go{2}
var user *UserEntity
found := engine.SearchOne(beeorm.NewWhere("Email = ?", "bee@beeorm.io"), user)
```
</code-block>

<code-block title="queries">
```sql
SELECT `ID`,`FirstName`,`LastName`,`Email` FROM `UserEntity` WHERE Email = "bee@beeorm.io" LIMIT 1
```
</code-block>
</code-group>

To cache this query first you need to define cache layer that will be used to store data.
In our example we will use redis:

```go{2}
type UserEntity struct {
	beeorm.ORM `orm:"redisCache"`
	ID         uint
    Email      string `beeorm:"unique=email;required"` 
    Supervisor *UserEntity
}
```

Next we need to add extra field type of ``*beeorm.CachedQuery`` with tag `queryOne`: 

```go{6}
type UserEntity struct {
	beeorm.ORM       `orm:"redisCache"`
	ID               uint
    Email            string `beeorm:"unique=email;required"` 
    Supervisor       *UserEntity
    cachedQueryEmail *beeorm.CachedQuery `queryOne:":Email = ?"`
}
```

That's it. Now you are ready to search for user using cache. 
In `queryOne` that we simply define SQL query conditions where every entity
field must be prefixed with `:`. Thanks to that BeeORM knows which entity fields 
must be tracked for changes so cache in updated when needed.

:::tip
You should always use private fields (starts with lover case letter) to define
cached queries and keep public one for data that is stored in database.
:::

Now it's time to run our cached search query:

<code-group>
<code-block title="code">
```go{2}
var user *UserEntity
found := engine.CachedSearchOne(user, "cachedQueryEmail", "bee@beeorm.io")
```
</code-block>

<code-block title="queries hit">
```sql
REDIS GET query_cache_key
```
</code-block>

<code-block title="queries miss">
```sql
REDIS GET query_cache_key
SELECT `ID`,`FirstName`,`LastName`,`Email` FROM `UserEntity` WHERE Email = "bee@beeorm.io" LIMIT 1
REDIS SET cache_key ID_OF_ENTITY
```
</code-block>
</code-group>

That's it. `engine.CachedSearchOne` method required name of entity field used to define
cached query and list of parameters that are required in SQL query condition defined
in`queryOne` tag.

You don't need to worry when entity is updated. BeeORM will update cached query results
for you. Look at this example:

```go
var user *UserEntity
found := engine.CachedSearchOne(user, "cachedQueryEmail", "bee@beeorm.io")
found == true // false, we have no rows in table

user = &UserEntity{Email: "bee@beeorm.io"}
found = engine.CachedSearchOne(user, "cachedQueryEmail", "bee@beeorm.io")
found == true // true

user.Email = "fish@beeorm.io"
engine.Flush(user)
found = engine.CachedSearchOne(user, "cachedQueryEmail", "bee@beeorm.io")
found == true // false
found = engine.CachedSearchOne(user, "cachedQueryEmail", "fish@beeorm.io")
found == true // true

engine.Delete(user)
found = engine.CachedSearchOne(user, "cachedQueryEmail", "fish@beeorm.io")
found == true // false
```

## Many entities

Now it's time to search for many entities using cached query.
First we need to define another cached query in our entity:

```go{6-8,10}
type UserEntity struct {
	beeorm.ORM        `orm:"redisCache"`
	ID                uint
    Email             string `beeorm:"unique=email;required"` 
    Supervisor        *UserEntity
    Admin             bool
    Age               uint8
    CreatedAt         time.Time
    cachedQueryEmail  *beeorm.CachedQuery `queryOne:":Email = ?"`
    cachedQueryAdmins *beeorm.CachedQuery `query:":Admin = ? AND :Age >= ? ORDER BY :CreatedAt DESC"`
}
```

As you can see we simply added another field type of `*beeorm.CachedQuery` but this
time with tag `query` instead of `queryOne`. 

:::tip
Notice that you can use also `ORDER BY` syntax
in your query cache SQL condition. Never forget to prefix all fields
with `:` otherwise cache data will be not updated when entity field was changed.
:::

Now we are ready to run our search:

<code-group>
<code-block title="code">
```go{2}
var users []*UserEntity
totalRows := engine.CachedSearch(&users, "cachedQueryAdmins", orm.NewPager(1, 100), true, 18)
```
</code-block>

<code-block title="queries hit">
```sql
REDIS GET query_cache_key
```
</code-block>

<code-block title="queries miss">
```sql
REDIS GET query_cache_key
SELECT `ID`,`FirstName`,`LastName`,`Email` FROM `UserEntity` WHERE Admin = 1 AND Age >= 18 ORDER BY CreatedAt DESC LIMIT 1,100
REDIS SET cache_key ID_OF_ENTITY
```
</code-block>
</code-group>

Of course, you can also ask for another page but with one condition - BeeORM allows caching max *50 000* rows.
If you skip pager all rows will be returned but no more than 50 000:

```go
// LIMIT 100,100
engine.CachedSearch(&users, "cachedQueryAdmins", orm.NewPager(2, 100), true, 18)
// LIMIT 50000
engine.CachedSearch(&users, "cachedQueryAdmins", nil, true, 18)
// LIMIT 60000, will panic
engine.CachedSearch(&users, "cachedQueryAdmins", orm.NewPager(1, 60000), true, 18)
// LIMIT 60000,20000, will panic
engine.CachedSearch(&users, "cachedQueryAdmins", orm.NewPager(3, 20000), true, 18)
```

All cached searches supports [references loading](/guide/crud.html#loading-references) and 
[lazy search](/guide/lazy_crud.html#lazy-search):

```go{2-4,7-9}
var user *UserEntity
engine.CachedSearchOneWithReferences(user, "cachedQueryEmail", []interface{}{"bee@beeorm.io"}, []string{"Supervisor"})
engine.CachedSearchOnesLazy(user, "cachedQueryEmail", "bee@beeorm.io")
engine.CachedSearchOneWithReferencesLazy(user, "cachedQueryEmail", []interface{}{"bee@beeorm.io"}, []string{"Supervisor"})
var users []*UserEntity
pager := orm.NewPager(1, 100)
engine.CachedSearchWithReferences(&users, "cachedQueryAdmins", pager, []interface{}{true, 18}, []string{"Supervisor"})
engine.CachedSearchLazy(&users, "cachedQueryAdmins", pager, true, 18)
engine.CachedSearchWithReferencesLazy(&users, "cachedQueryAdmins", pager, []interface{}{true, 18}, []string{"Supervisor"})
```

If you need only search for total found rows:
```go{2}
var user *UserEntity
total := engine.CachedSearchCount(user, "cachedQueryAdmins", true, 18)
fmt.Printf("Total rows: %d\n", total) 
```
To search for primary keys:

```go{2}
var user *UserEntity
total, ids := engine.CachedSearchIDs(user, "cachedQueryAdmins", orm.NewPager(1, 100), true, 18)
fmt.Printf("Total rows: %d\n", total) 
for _, id := range ids {
    fmt.Printf("ID: %d\n", id) 
}
```

:::tip
If Entity has [FakeDelete](guide/entity_fields.html#fake-delete) you don't need to
add `WHERE FakeDelete = 0` in your cached query condition. BeeORM is search for rows
with `FakeDelete = 0` automatically.
:::
