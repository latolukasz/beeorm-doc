# Redis search

Redis is used mostly as nosql in-memory database. 
Thanks to great [redis search module](https://github.com/RediSearch/RediSearch)
you can also use redis to run search queries including full text search.


## Redis search pool

First step is to register redis data pool for redis that
has search module installed:

```go{4}
registry.RegisterRedis("localhost:6379", 0, "search") 
```

::: warning
Redis search works only with redis database nr **0**. So be sure you are using pool with this value.
:::

## Entity search data pool

Next step is to define in which redis entity should keep redis search index.
By default index is created in `default` redis data pool, so you don't need to 
create any tag in entity:

```go
registry.RegisterRedis("localhost:6379", 0)
type UserEntity struct {
	beeorm.ORM
	ID   uint
} 
```

In above example redis search index is created in deafult ('localhost:6379') redis.
You can define another redis data pool with `redisSearch` tag:

```go{1,3}
registry.RegisterRedis("localhost:6379", 0, "search")
type UserEntity struct {
	beeorm.ORM `orm:"redisSearch=search"`
	ID   uint
} 
```

::: tip
We strongly recommend using one redis pool for cache data
(without [Redis search](https://oss.redislabs.com/redisearch/) module) and another one
for redis search indices.
Reasons are two:
* Redis search module slow down redis queries a bit
* In real life you may want to clear Entity cache data and keep redis search index untouched

Simply use `orm:"redisCache=first_pool;redisSearch=another_pool"` tag.
:::

To access RedisSearch pool use `engine.GetRedisSearch() method`:

```go
defaultRedisSearch := engine.GetRedisSearch()
anotherRedisSearch := engine.GetRedisSearch("another_pool")
```

## Searchable entity fields

You must define which entity fields should be added to redis search index.
Simply add `searchable` tag for every field that should be indexed and used
in redis search queries. If you need to sort search results by this field
you should add `sortable` tag also:

```go{3-6}
type UserEntity struct {
	beeorm.ORM
	ID        uint `orm:"sortable"`
	FirstName string `orm:"searchable"`
	LastName  string `orm:"searchable"`
	Age       uint8 `orm:"searchable;sortable"`
} 
```

In above example we can search users by `FirstName`,`LastName`,`Age`
and sort results by `ID` and `Age`. Below table explains how entity 
fields are stored in redis search index and how you can use them
in search query:

| Go field type        | Redis field type         | Data mapping | Example query | 
| :------------- |:------------- |:------------- |:------------- |
| `int8`<br > `int16`<br /> `int32`<br /> `int64`<br /> `uint8`<br /> `uint16`<br /> `uint32`<br /> `uint64`<br />      | NUMERIC  | numbers are stored 1:1  | Age BETWEEN 18 AND 20<br />`@Age:[18 20]`  |
| `*int8`<br > `*int16`<br /> `*int32`<br /> `*int64`<br /> `*uint8`<br /> `*uint16`<br /> `*uint32`<br /> `*uint64`<br />      | NUMERIC  | numbers are stored 1:1<br /><br />nul is stored as<br />`-math.MaxInt64` (-9223372036854775807)  | Age = 18<br />`@Age:[18 18]`<br /><br />Age = nil<br />`@Age:[-9223372036854775807 -9223372036854775807]`<br /><br />Age < 0 AND NOT NULL<br />`@Age:[-9223372036854775806 0]`  |
| `float32`<br > `float64` | NUMERIC  | numbers are stored 1:1  | Balance BETWEEN -18.1 AND 20.22<br />`@Balance:[-18.1 20.22]`  |
| `*float32`<br > `*float64`<br />  | NUMERIC  | numbers are stored 1:1<br /><br />nul is stored as<br />`-math.MaxInt64` (-9223372036854775807)  | Balance = 18.22<br />`@Balance:[18.22 18.22]`<br /><br />Balance = nil<br />`@Balance:[-9223372036854775807 -9223372036854775807]`  |
| `string`     | TEXT  | not empty string is stored 1:1<br /><br />empty string is stored as `NULL`  | Name = "foo"<br />`@Name:foo`<br /><br />Name != ""<br />`-@Name:NULL`  |
| `string enum=X`     | TAG  | enum values are stored as tags<br /><br />empty string is stored as tag `NULL`  | Status IN ("foo", "bar")<br />`@Status:{foo | bar}`<br /><br />Status != ""<br />`-@Status:{NULL}`  |
| `[]string setX`     |  TAG | set values are stored as tags<br /><br />empty set is stored as tag `NULL`  |  Status IN ("foo", "bar")<br />`@Status:{foo | bar}` |
| `[]uin8`     |   | not supported  |   |
| `bool`     | TAG  | `true` is stored as tag `"true"`<br /><br />`false` is stored as tag `"false"`  | Active = true<br />`@Active:{true}`<br /><br />Active = false<br />`@Active:{false}`  |
| `*bool`     | TAG  | `true` is stored as tag `"true"`<br /><br />`false` is stored as tag `"false"`<br /><br />`nil` is stored as tag `"NULL"`  | Active = true<br />`@Active:{true}`<br /><br />Active IS NULL<br />`@Active:{NULL}`  |
| `time.Time`     | NUMERIC  | date is stored as unix timestamp (`time.Unix()`)  | CreatedAt BETWEEN "2020-08-21" AND "2020-09-01"<br />`@CreatedAt:[1597960800 1598911200]`  |
| `*time.Time`     | NUMERIC  | date is stored as unix timestamp (`time.Unix()`)<br /><br />nul is stored as<br />`-math.MaxInt64`  | CreatedAt BETWEEN "2020-08-21" AND "2020-09-01"<br />`@CreatedAt:[1597960800 1598911200]`<br /><br />CreatedAt = nil<br />`@CreatedAt:[-9223372036854775807 -9223372036854775807]`  |
| `*Entity`     | NUMERIC  | entity one-one reference is stored as number (entity `ID`)<br /><br />nul is stored as `0`  | UserEntity = 23<br />`@UserEntity:[23 23]`  |

## Stemming

By default all entity searchable string fields have `NOSTEM` redis search field attribute
which will disable [stemming](https://oss.redislabs.com/redisearch/Stemming/#stemming_support) 
when indexing its values. You can remove this attribute with `stem` tag:

```go{4}
type ProductEntity struct {
	beeorm.ORM
	ID    uint `orm:"sortable"`
	Title string `orm:"searchable;stem"`
} 
```

## Redis search index alters

So far we defined `UserEntity` that contains at least one field with `searchable` or `sortable` tag.
Now it's time to create redis search indexes:

```go{1,7}
for _, alter := range engine.GetRedisSearchIndexAlters() {
    alter.Pool // "default"
    alter.Name // "namespace.UserEntity"
    alter.Documents // 0 (current number of documents in index)
    alter.Query // "FT.CREATE ..."
    alter.Changes // []string{"new field XX", "unneeded field YY"}
    alter.Execute()
}
```

You should execute above code every time entity structure was changed.
:::warning
Every time you run `alter.Execute()` current index is removed and new empty one is created.
Until new index is filled with new data search queries will return empty results.
:::

## Filling index with data 

Now it's time to fill our index with data. You have two options.

Using [entity schema](/guide/validated_registry.html#entity-schema) (recommended):

```go{2}
var userEntity *UserEntity
validateRegistry.GetTableSchemaForEntity(userEntity).ForceReindex(engine)
```

You can also force reindex by choosing redis search pool name and index name:

```go
engine.GetRedisSearch().ForceReindex("namespace.UserEntity")
```

Above methods actually do not fill index with data. Behind the scenes `ForceReindex()` 
adds event to special redis stream that is consumed by [background consumer](/guide/background_consumer.html)
that starts filling index by reading data from entity MySQL table starting from rows with the lowest ID.
That's why you must run at least one [background consumer](/guide/background_consumer.html) in your application
when you want to use Redis Search feature.

## Index statistics

To get [statistics](https://oss.redislabs.com/redisearch/Commands/#ftinfo) related to 
specific index use `RedisSearch.Info()` method:

```go
info := engine.GetRedisSearch().Info("namespace.UserEntity")
info.NumDocs // number of documents in index
info.DocTableSizeMB // index size
...
```

## Listing indexes

Use `RedisSearch.ListIndices()` to get names of all redis search indexes defined
in specific data pool:

```go
engine.GetRedisSearch().ListIndices() // []string{"namespace.UserEntity"}
```

## Running redis search queries

Now it's time to run our first query - search for first 100
users sorted by `ID`:

<code-group>
<code-block title="entity">
```go
var users []*redisSearchEntity
query := beeorm.NewRedisSearchQuery()
query.Sort("ID", false) // ASC
total := engine.RedisSearch(&users, query, beeorm.NewPager(1, 100))
```
</code-block>

<code-block title="query">
```
FT.SEARCH beeorm.UserEntity * SORTBY ID LIMIT 0 100
```
</code-block>
</code-group>

You can also query only for one row:

<code-group>
<code-block title="entity">
```go{4}
var user *redisSearchEntity
query := beeorm.NewRedisSearchQuery()
query.FilterUint("NationalID", 123992)
found := engine.RedisSearchOne(user, query)
```
</code-block>

<code-block title="query">
```
FT.SEARCH beeorm.UserEntity * FILTER NationalID 123992 123992
```
</code-block>
</code-group>

If you need only number of found rows:

<code-group>
<code-block title="entity">
```go{4}
var user *redisSearchEntity
query := beeorm.NewRedisSearchQuery()
query.FilterDate("LoggedAt", time.Now())
found := engine.RedisSearchCount(user, query)
```
</code-block>

<code-block title="query">
```
FT.SEARCH beeorm.UserEntity * FILTER LoggedAt 1626645600 1626645600 LIMIT 0 0
```
</code-block>
</code-group>

You can search only for entity primary keys too:

<code-group>
<code-block title="entity">
```go{4}
var user *redisSearchEntity
query := beeorm.NewRedisSearchQuery()
query.FilterDate("LoggedAt", time.Now())
ids, total := engine.RedisSearchIds(user, query, beeorm.NewPager(1, 100))
```
</code-block>

<code-block title="query">
```
FT.SEARCH beeorm.UserEntity * FILTER LoggedAt 1626645600 1626645600 LIMIT 0 100
```
</code-block>
</code-group>


As you can see in all queries we are using `beeorm.RedisSearchQuery` object.
Below tables demonstrates how you can build redis search query using this struct:


| Method        | Query         | 
| :------------- |:------------- |
| q.Query("adam") | FT.SEARCH index "adam" |
| q.Sort("Age", false) | FT.SEARCH index * SORTBY Age ASC |
| q.Sort("Age", true) | FT.SEARCH index * SORTBY Age DESC |
| q.FilterInt("Age", 18) | FT.SEARCH index * @Age:[18 18] |
| q.FilterInt("Age", 18, 20) | FT.SEARCH index * @Age:[18 18]\|@ID:[20 20] |
| q.FilterIntMinMax("Age", 18, 20) | FT.SEARCH index * @Age:[18 20] |
| q.FilterNotInt("Age", 18) | FT.SEARCH index * -@Age:18 |
| q.FilterIntNull("Age") | FT.SEARCH index * @Age:-9223372036854775807 |
| q.FilterNotIntNull("Age") | FT.SEARCH index * -@Age:-9223372036854775807 |
| q.FilterIntGreaterEqual("Age", 18) | FT.SEARCH index * @Age:[18 +inf] |
| q.FilterIntGreater("Age", 18) | FT.SEARCH index * @Age:[(18 +inf] |
| q.FilterIntLessEqual("Age", 18) | FT.SEARCH index * @Age:[-inf 18] |
| q.FilterIntLess("Age", 18) | FT.SEARCH index * @Age:[-ind (18] |
| q.FilterString("Name", "jump high") | FT.SEARCH index * @Name:"jump high" |
| q.FilterStringStartsWith("Name", "high") | FT.SEARCH index * @Name:high* |
| q.FilterString("Name", "sky", "yellow") | FT.SEARCH index * @Name:("sky"\|"yellow") |
| q.QueryString("Name", "jump high") | FT.SEARCH index * @Name:jump high |
| q.FilterFloat("Balance", 17) | FT.SEARCH index * @Balance:[16.99999 17.00001] |
| q.FilterFloatGreaterEqual("Balance", 17) | FT.SEARCH index * @Balance:[16.99999 +inf] |
| q.FilterFloatGreater("Balance", 17) | FT.SEARCH index * @Balance:[(16.99999 +inf] |
| q.FilterFloatLessEqual("Balance", 17) | FT.SEARCH index * @Balance:[-inf, 17.00001] |
| q.FilterFloatLess("Balance", 17) | FT.SEARCH index * @Balance:[-inf (17.00001] |
| q.FilterFloatMinMax("Balance", 17, 18.2) | FT.SEARCH index * @Balance:[16.99999 12.20001] |
| q.FilterFloatNull("Balance") | FT.SEARCH index * @Balance:-9223372036854775807 |
| q.FilterDate("AddedAt", time.Now()) | FT.SEARCH index * @AddedAt:[1626645600 1626645600] |
| q.FilterNotDate("AddedAt", time.Now()) | FT.SEARCH index * -@AddedAt:1626645600 |
| q.FilterDateNull("AddedAt") | FT.SEARCH index * @AddedAt:-9223372036854775807 |
| q.FilterNotDateNull("AddedAt") | FT.SEARCH index * -@AddedAt:-9223372036854775807 |
| q.FilterDateGreaterEqual("AddedAt", time.Now()) | FT.SEARCH index * @AddedAt:[1626645600, +inf] |
| q.FilterDateGreater("AddedAt", time.Now()) | FT.SEARCH index * @AddedAt:[(1626645600, +inf] |
| q.FilterDateLessEqual("AddedAt", time.Now()) | FT.SEARCH index * @AddedAt:[-inf 1626645600] |
| q.FilterDateLess("AddedAt", time.Now()) | FT.SEARCH index * @AddedAt:[-ind (1626645600] |
| q.FilterDateTime("AddedAt", time.Now()) | FT.SEARCH index * @AddedAt:[1626645600 1626645600] |
| q.FilterNotDateTime("AddedAt", time.Now()) | FT.SEARCH index * -@AddedAt:1626645600 |
| q.FilterDateTimeNull("AddedAt") | FT.SEARCH index * @AddedAt:-9223372036854775807 |
| q.FilterNotDateTimeNull("AddedAt") | FT.SEARCH index * -@AddedAt:-9223372036854775807 |
| q.FilterDateTimeGreaterEqual("AddedAt", time.Now()) | FT.SEARCH index * @AddedAt:[1626645600, +inf] |
| q.FilterDateTimeGreater("AddedAt", time.Now()) | FT.SEARCH index * @AddedAt:[(1626645600, +inf] |
| q.FilterDateTimeLessEqual("AddedAt", time.Now()) | FT.SEARCH index * @AddedAt:[-inf 1626645600] |
| q.FilterDateTimeLess("AddedAt", time.Now()) | FT.SEARCH index * @AddedAt:[-ind (1626645600] |
| q.FilterTag("Status", "active") | FT.SEARCH index * @Status:{active} |
| q.FilterTag("Status", "active", "inactive") | FT.SEARCH index * @Status:{active\|inactive} |
| q.FilterNotTag("Status", "active") | FT.SEARCH index * -@Status:{active} |
| q.FilterBool("Active", true) | FT.SEARCH index * @Active:{true} |
| q.FilterGeo("Point", 12.2342, 34.23432, 10, "km") | FT.SEARCH index * GEOFILTER 12.2342 34.23432 10 "km"  |


You can also define query manually with `query.QueryRaw()`:

```go
query := beeorm.NewRedisSearchQuery()
query.QueryRaw("(@Bool:{true})")
query.AppendQueryRaw(" | (@Ref:[32 32])")
```

:::warning
When you are building query with `QueryRaw()` all string parameters
used in filters or query text must be escaped with `EscapeRedisSearchString()` 
function:
```go
query.QueryRaw("@title: " + EscapeRedisSearchString("adam@gmail.com"))
```
:::

You can define also additional query options:
```go
query := beeorm.NewRedisSearchQuery()
query.Verbatim() // ads VERBATIM
query.NoStopWords() // ads NOSTOPWORDS
query.InKeys("a", "b") // ads INKEYS a b
query.InFields("a", "b") // ads INFIELDS a b
query.Slop(3) // ads SLOP 3
query.InOrder() // ads INORDER
query.Lang("de") // ads LANGUAGE de
query.Highlight("Title") // ads HIGHLIGHT Title
query.HighlightTags("<b>", "</b>") // ads HIGHLIGHT .. TAGS <b> </b>
```

## Custom redis search index

So far we used redis search to index and search entities.
You can also use beeORM to define your own index.

First you need to define redis search index:

```go
indexDogs := &beeorm.NewRedisSearchIndex{"test", "search", []string{"dogs:"}}
indexDogs.AddTextField("name", 1, true, false, false)
testIndex.AddTagField("breed", true, false, ",")
```

In above example we defined index with name `test` that use `search` redis
pool and `dogs:` hash prefix. This index has 
one `TEXT` field `Name` and one `TAG` field `bread`.


`RedisSearchIndex` object provides methods used to define index options.
Below some examples:

```go
indexDogs.LanguageField = "_lang"
indexDogs.DefaultScore = 0.8
indexDogs.StopWords =  []string{"and", "in"}
indexDogs.NoOffsets = true
```

Now it's time to register our index:

```go{3}
registry := &beeorm.NewRegistry()
registry.RegisterRedis("localhost:6382", 0, "search")
registry.RegisterRedisSearchIndex(indexDogs)
validatedRegistry, deferF, err := registry.Validate(ctx)
if err != nil {
    panic(err)
}
defer deferF()
// creates missing index
for _, alter := range engine.GetRedisSearchIndexAlters() {
    alter.Execute()
}
```

We are almost there. Time to fill our `dogs` index with data.
You have three options:

Using hash:

```go
engine.GetRedis("search").HSet("dogs:1", "name", "Fiffy", "breed", "bulldog")
```
Using `RedisSearchIndexPusher`:

```go
pusher := engine.NewRedisSearchIndexPusher("search")

pusher.NewDocument("dogs:1")
pusher.SetString("name", "Fiffy")
pusher.SetTag("breed", "bulldog")
pusher.PushDocument()

pusher.NewDocument("dogs:2")
pusher.SetString("name", "Fluffy")
pusher.SetTag("breed", "poodle")
pusher.PushDocument()

pusher.Flush()
```

Using indexer (recommended):

```go
testIndex2.Indexer = func(engine *beeorm.Engine, lastID uint64, pusher beeorm.RedisSearchIndexPusher) (newID uint64, hasMore bool) {
    query := "SELECT ID, Name, Breed FROM dogs WHERE ID > ? ORDER ID LIMIT 0, 100"
    results, def := engine.GetMysql(mysql).Query(query, lastID)
    defer def()
    total := 0
    var id uint64
    var name string
    var breed string
    for results.Next() {
        results.Scan(&id, &name, &breed)
        lastID = *id
        pusher.NewDocument("dogs:" + strconv.FormatUint(lastID, 10))
        pusher.SetString("name", name)
        pusher.SetTag("breed", breed)
        pusher.PushDocument()
        total++
    }
    return lastID, total == 100
}
```

Now every time you execute `engine.GetRedisSearch().ForceReindex("test")` above
function will be executed in [background consumer](/guide/background_consumer.html).
Notice that this function returns two variables:
 * `newID uint64` - id of last pushed document
 * `hasMore bool` - you should return false if all documents are pushed
 

