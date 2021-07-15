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

Simply use `beeorm:"redisCache=first_pool;redisSearch=another_pool"` tag.
:::

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
| `[]string`     |   | not supported  |   |
| `[]uin8`     |   | not supported  |   |
| `bool`     | TAG  | `true` is stored as tag `"true"`<br /><br />`false` is stored as tag `"false"`  | Active = true<br />`@Active:{true}`<br /><br />Active = false<br />`@Active:{false}`  |
| `*bool`     | TAG  | `true` is stored as tag `"true"`<br /><br />`false` is stored as tag `"false"`<br /><br />`nil` is stored as tag `"NULL"`  | Active = true<br />`@Active:{true}`<br /><br />Active IS NULL<br />`@Active:{NULL}`  |
| `time.Time`     | NUMERIC  | date is stored as unix timestamp (`time.Unix()`)  | CreatedAt BETWEEN "2020-08-21" AND "2020-09-01"<br />`@CreatedAt:[1597960800 1598911200]`  |

## Sortable entity fields

TODO
