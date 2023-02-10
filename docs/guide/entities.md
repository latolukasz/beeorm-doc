# Entities

In BeeORM, an Entity is a struct that represents data stored in a database. In this section, you will learn how to define golang structs as Entity types.

## Defining an Entity
To define an Entity struct, you must follow one rule - the first field of the struct should be an anonymous field with a type of beeorm.ORM.

Here is an example of a simple Entity struct:

```go
import "github.com/latolukasz/beeorm/v2"

type SimpleEntity struct {
	beeorm.ORM
}
```

## Registering Entity

In order to use an entity in beeorm, it must be registered in the Registry:

```go{2}
registry := beeorm.NewRegistry()
registry.RegisterEntity(&entity.UserEntity()) 
```

## Defining data pools

### Mysql pool

By default, Entity is connected to `default` [data pool](/guide/datapools.html#mysql-pool).
You can define different pool with special setting **mysql=pool_name** put in tag `orm` 
for `beeorm.ORM` field:

```go{6}
package main

import "github.com/latolukasz/beeorm/v2"

type OrderEntity struct {
	beeorm.ORM `orm:"mysql=sales"`
}

func main() {
    registry := beeorm.NewRegistry()
    registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/sales", "sales") 
    registry.RegisterEntity(&OrderEntity{}) 
}  
```

### Redis pool

To protect MySQL from unnecessary queries, entities can be automatically cached in Redis. To enable Redis cache for an entity, use the setting redisCache=pool_name in the orm tag of the beeorm.ORM field. This specifies which Redis server or Sentinel pool should be used to store the data.

For a pool with the name default, you can use the short version orm:"redisCache" without specifying the pool name.

Here is an example in Go code:

```go{6,11}
package main

import "github.com/latolukasz/beeorm/v2"

type UserEntity struct {
	beeorm.ORM `orm:"redisCache"`
}

type OrderEntity struct {
	beeorm.ORM `orm:"redisCache=sales"`
}

func main() {
    registry := beeorm.NewRegistry()
    registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/data")
    registry.RegisterRedis("localhost:6379", 0) 
    poolSales := []string{":26379", "192.23.12.11:26379", "192.23.12.12:26379"}
    registry.RegisterRedisSentinel("master", 1, poolSales, "sales") 
    
    registry.RegisterEntity(&UserEntity{}, &OrderEntity{}) 
}  
```

::: tip
To optimize Redis as a cache for entities, it is recommended to set the maxmemory setting to a value below the machine's memory size, and enable the allkeys-lru policy. This will prevent Redis from using too much memory and potentially crashing the application.

Additionally, it is a good idea to disable persistence storage in Redis. If data is lost, BeeORM will automatically refill it from MySQL, ensuring top performance and preventing the application from going down.
:::

### Local in-memory pool

To cache Entity data in memory locally, you can use the setting localCache=pool_name in the same way as registering a Redis pool (see the example above). This will enable a local in-memory cache to store the data.

```go{6,11}
package main

import "github.com/latolukasz/beeorm/v2"

type CategoryEntity struct {
	beeorm.ORM `orm:"localCache"`
}

type BrandEntity struct {
	beeorm.ORM `orm:"localCache=settings"`
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
It is important to note that the local cache is not shared across all servers. If an Entity is updated on one server, it will still have the old value cached on other servers. The data in the local cache is cached indefinitely, until it is evicted by the LRU (Least Recently Used) algorithm. Therefore, it is recommended to use the local cache for data that does not change frequently. If necessary, the developer is responsible for clearing the local cache on all machines.
:::

### Using Both Redis and Local Cache Simultaneously

It is possible to cache an Entity in both a local cache and Redis using BeeORM. To do so, you can use the following syntax:

```go{2,6}
type CategoryEntity struct {
	beeorm.ORM `orm:"localCache;redisCache"`
}

type BrandEntity struct {
	beeorm.ORM `orm:"localCache=settings;redisCache=settings"`
}
```

This allows you to take advantage of the benefits of both types of caching in your application. The local cache can provide faster access to frequently used data, while Redis can store larger amounts of data and be accessed by multiple servers.

::: tip
It is highly recommended to enable both local caching and Redis caching for Entity in your application. This can greatly improve the performance of your system by reducing the number of queries made to the MySQL database.

When data is requested and not found in the local cache, BeeORM will try to load it from the Redis cache. If the data is still not available, it will be retrieved from MySQL, stored in Redis, and then also stored in the local cache. This means that subsequent requests for the same data from the same machine will be served from the local cache, while requests from other machines will be served from the Redis cache.

Enabling both local caching and Redis caching helps to distribute the load on the MySQL database and can be especially useful when your code is running on multiple physical servers or when you are using autoscaling based on traffic.
:::


### Customizing the Entity Table Name

By default, BeeORM will use the name of the Entity struct as the name of the corresponding MySQL table. However, you can specify a custom table name by using the table tag setting:

```go{2}
type UserEntity struct {
	beeorm.ORM `orm:"table=users"`
}
```

This allows you to specify a table name that may be more descriptive or follow a naming convention that you have established for your database tables.


### Customizing the Entity ID column

By default, BeeORM will use `bigint` mysql type for column `ID`. You can change it using `id` tag:


```go{2}
type UserEntity struct {
	beeorm.ORM `orm:"id=tinyint"`
}
```

Possible values are:

 * tinyint
 * smallint
 * mediumint
 * int