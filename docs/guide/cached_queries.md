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
}
```

Next we need to add extra field type of ``*beeorm.CachedQuery`` with tag `queryOne`: 

```go{5}
type UserEntity struct {
	beeorm.ORM       `orm:"redisCache"`
	ID               uint
    Email            string `beeorm:"unique=email;required"` 
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

TODO many, order by

TODO fake delete
