# Entities

In this section you will learn how to define golang structs that
are used to represent data stored in database. In BeeORM we call these 
structs **Entity**.

## The simplest Entity

Entity is a struct that follows 3 rules:
 * first field is an anonymous with type of `beeorm.ORM`
 * second field has a name **ID** with type any of `uint`, `uint8`, `uin16`, `uint32`, `uint64`
 * everywhere in code struct must be used as a reference

```go
import "github.com/latolukasz/beeorm"

type SimpleEntity struct {
	beeorm.ORM
	ID   uint
}
```

## Registering Entity

Every entity must be registered in `beeomr.Registry`:

```go{2}
registry := beeorm.NewRegistry()
registry.RegisterEntity(&beeorm.NewRegistry()) 
```

As you can see you must pass reference to actual variable, not a string 
with name of entity. Thanks to this approach if entity was removed from your
code you will see compilation error in above code.

## Defining data pools

### Mysql pool

By default, Entity is connected to `default` [data pool](/guide/datapools.html#mysql-pool).
You can define different pool with special setting **mysql=pool_name** put in tag `beeorm` 
for `beeorm.ORM` field:

```go{6}
package main

import "github.com/latolukasz/beeorm"

type OrderEntity struct {
	beeorm.ORM `orm:"mysql=sales"`
	ID   uint
}

func main() {
    registry := beeorm.NewRegistry()
    registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/sales", "sales") 
    registry.RegisterEntity(&OrderEntity{}) 
}  
```

### Redis pool

Entity can be automatically cached in Redis to protect MySQL from queries when Entity
data is needed. Use setting **redisCache=pool_name**
in tag `beeorm` for `beeorm.ORM` field to enable redis cache for this entity and define 
which redis server or sentinel pool should be used to store data.

For pool with name `default` you can use short version without pool name ``orm:"redisCache"``.

```go{6,11}
package main

import "github.com/latolukasz/beeorm"

type UserEntity struct {
	beeorm.ORM `orm:"redisCache"`
	ID   uint
}

type OrderEntity struct {
	beeorm.ORM `orm:"redisCache=sales"`
	ID   uint
}

func main() {
    registry := beeorm.NewRegistry()
    registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/data")
    egistry.RegisterRedis("localhost:6379", 0) 
    poolSales := []string{":26379", "192.23.12.11:26379", "192.23.12.12:26379"}
    registry.RegisterRedisSentinel("master", 1, poolSales, "sales") 
    
    registry.RegisterEntity(&UserEntity{}, &OrderEntity{}) 
}  
```

::: tip
For redis used as cache for Entities you should always set `maxmemory` setting to some value 
(below machine memory size) and enable `allkeys-lru` policy. 
Also, you should disable persistence storage because if data is lost
in redis BeeORM will fill it back from MySQL. Thanks to that you can get top performance and even
if you reach max memory application should be up and running.
:::

### Local in-memory pool

In the same way as registering redis pool (see example above) you can enable local in-memory
cache to cache Entity data using this time **localCache=pool_name** setting.

```go{6,11}
package main

import "github.com/latolukasz/beeorm"

type CategoryEntity struct {
	beeorm.ORM `orm:"localCache"`
	ID   uint
}

type BrandEntity struct {
	beeorm.ORM `orm:"localCache=settings"`
	ID   uint
}

func main() {
    registry := beeorm.NewRegistry()
    registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/data")
    registry.RegisterLocalCache(100000)
    registry.RegisterLocalCache(1000, "settings") 
    
    registry.RegisterEntity(&CategoryEntity{}, &BrandEntity{}) 
}  
```

::: tip
Local cache is not shared across all servers. Entity updated on one server is
still cached with old value on other servers. Data is cached forever until it's evicted
by LRU algorithm. That's why you should use local cache for data that is not changed very often 
(developer is responsible to clear local cache on all machines if needed).
:::

### Using both redis and local cache at once

What if you want to cache Entity in local cache and redis? In BeeORM it's possible:

```go{2,7}
type CategoryEntity struct {
	beeorm.ORM `orm:"localCache;redisCache"`
	ID   uint
}

type BrandEntity struct {
	beeorm.ORM `orm:"localCache=settings;redisCache=settings"`
	ID   uint
}
```

::: tip
We strongly recommend enabling local cache in entity together with redis cache.
It helps protect MySQL from queries when your code is distributed across many physical servers, 
or you are autoscaling your services based on actual traffic. 
When data is missing in local cache BeORM will try to load it from redis cache, if still not there
data is loaded from MySQL, stored in redis and local cache. So next request to the same app loads
data from local cache, and request on another machine loads data from redis, not MySQL and store it
in local cache.
:::


### Defining entity table name

By default, BeORM uses entity struct name as a MySQL table name.
You can define your own name using `table=table_name` tag setting:

```go{2}
type UserEntity struct {
	beeorm.ORM `orm:"table=users"`
	ID   uint
}
```
