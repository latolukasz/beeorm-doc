# Introduction

All ORM libraries such as [GORM](https://gorm.io/) 
focus on converting data between a relational database and object-oriented language.
Most of them provide an interface to many databases like  MySQL, PostgreSQL, SQLite, SQL Server.

## Designed for MySQL

BeeORM has a different concept. In real life, developers choose one database software and stick to it.
It's very unlikely you want to switch from MySQL to SQL Server and later to PostgreSQL. 
Every database has unique features and requires different optimization to squeeze top performance.
Our team is following a simple rule - **"don't be average in many technologies, be expert in few"**.
That's why BeeORM supports only one database - [MySQL](https://www.mysql.com/). It's designed from
the beginning to use all MySQL features most optimally. We are following new releases of MySQL
implementing all required changes and improvements, so you can be sure that BeeORM supports everything that MySQL provides.

## Centralised data model

Supporting only MySQL is not what makes BeeORM so unique. Our ORM is created by developers for developers
to help build high-traffic applications. Our team spent the last 20 years
building projects that are used by more than 400 million daily active users. What we learned
is relational database such as MySQL is only a small piece in a big machine called 
"application data model". MySQL should be treated as persistent data storage that can be easily backup. That's it. You should always try to protect it from queries because it's not designed to
get top performance. Many other technologies are needed in your application to be able
to handle huge traffic such as NoSQL in-memory databases and message brokers. BeeORM supports them out
of the box.

## It's all about cache

Let's say you are using typical ORM in your code, and you need to implement login form.
At some stage, you need to search in users database for a user with the provided login name.
So probably your code looks like:

```go
user := someorm.QueryByField("user_name = ?", userNameFromForm)
```

It's not a real code but just an overview to demonstrate the big picture.
Ok, looks simple right? In real life, this code can produce a dangerous bottleneck.
Every time users try to log in MySQL query is executed. Yes, it's fast query 
(if you add a unique index on "user_name" field) but still, it's a query that uses MySQL resources.
Many developers (unfortunately) may say "and what? if there is a problem we can add more RAM or better CPU".
"Smart" developers know that there is a better way to deal with this bottleneck - adding a caching layer:

```go
var user User
cacheKey := "user:name:" + userNameFromForm
userInCache, has := someredislibrary.Get(cacheKey)
if !has {
    user, found := someorm.QueryByField("user_name = ?", userNameFromForm)
    if found {
        someredislibrary.Set(cacheKey, serialise(user))    
    }
} else {
    user = unserialise(userInCache)
}
```

Better right? But code is much more complicated. Also, you need to configure connections
to redis server, choose redis library and best serialization method and remove data from the cache when user 
is deleted:

```go
someorm.Delete(user)
someredislibrary.Delete("user:name:" + userNameFromForm)
```

So you should always remember to clear the cache when user is deleted. 
But what if someone is trying to log in with a name that doesn't exist in the database?
It will always generate a query to MySQL table. Because we are caching data only when user is found.
So we still have a bottleneck. You can improve your code and cache special value in redis that
means "data does not exist":

```go
var user User
cacheKey := "user:name:" + userNameFromForm
userInCache, has := someredislibrary.Get(cacheKey)
if !has {
    user, found := someorm.QueryByField("user_name = ?", userNameFromForm)
    if found {
        someredislibrary.Set(cacheKey, serialise(user))    
    }
} else if (userInCache != "nil") {
    user = unserialise(userInCache)
}
```
Code is getting even more complicated right? Now you should also remember to remove cache
when a new user is created because we may cache "nil" value if someone tried to log in before using new 
usernameCode is getting even more complicated right? Now you should also remember to remove cache
when a new user is created because we may cache "nil" value if someone tried to log in before using new 
username:

```go
someorm.Add(user)
someredislibrary.Delete("user:name:" + user.Name)
```

Ok, so now you have two places where you should not forget to clear the cache. What if user decided
to change his username? Now the situation is getting very complicated. You should remove two keys from the cache,
one for the previous username because new users can register using this name, and of course, you should remove
also the key with a new username because maybe someone tried to log in with this name and "nil" is cached:

```go
oldName := user.Name
user.Name = "new"
someorm.Update(user)
someredislibrary.Delete("user:name:" + oldName, "user:name:" + user.Name)
```

Now try to imagine you should use cache for most of your data. Keeping cache updated in
all scenarios is much more complicated than you can expect. The above examples demonstrate only a small
part of this topic. In real life, you need to load and modify many objects at the same time.
You should always group queries to redis as much as possible, using [redis pipelines](https://redis.io/topics/pipelining)
for instance. Deletes in the cache should be executed only after `COMMIT` when MySQL transaction is used and so on.

What if all this complexity is managed automatically by BeeORM. Look how easy is to work with cache using our ORM:

```go
user := UserEntity{}
beeORMEngine.RedisSearchOne(user, beeORMEngine.NewRedisSearchQuery().FilterString("user_name", userNameFromForm))
```

That's it. You don't need to worry about cache, everything is updated when need in the most optimal way.
For example, if you want to change username:

```go
user.Name = "new"
beeORMEngine.Flush(user)
```

I hope the above example helped you understand why BeeORM is different from other ORM libraries. BeeORM
is used to work with every data your application is storing and using. You don't need any other libraries to
implement your application data model.

## Redis client

BeeORM provides its own redis client. You don't need to use any other client library like
[go-redis](https://github.com/go-redis/redis). Our client supports all redis commands plus extend
it with some additional features like shared lock and rate limiter.

```go
value, has := beeORMEngine.GetRedis().Get("key")
```

## Events streaming

Building modern high-traffic applications very often requires the implementation of event streaming systems. 
It helps developers to distribute (as events) data between services in an asynchronous and scalable way. 
There are many solutions available such us [Apache Kafka](https://kafka.apache.org/) or 
[RabbitMQ](https://www.rabbitmq.com/). Do you remember our golden rule 
*"don't be average in many technologies, be expert in few"*? There is no need to add
additional complexity to your infrastructure. We are using Redis as a key-value database.
Redis provides also amazing feature [streams](https://redis.io/topics/streams-intro) that
can be used to build fast event streaming system. Thanks to BeeORM it's very easy:

```go
broker := beeORMEngine.GetEventBroker()
broker.Publish("stream-name", event)
broker.Consumer("my-consumer", "my-group").Consume(...)
```

## Full text and advanced search

In many applications, you also need to implement full-text search.
The natural choice is probably [Elastic search](https://www.elastic.co/). 
It's adding of course extra complexity to your code and infrastructure.
You need to set up and monitor Elastic Search cluster, define indexes and create a code that with every data change updates data in ES index. 
Also, there is a short delay between data is changed in the database and ES index 
that you should handle in your code. 

Probably you need to search for data using simple and complex conditions without
full-text support. For example, you want to find 100 users with the status "active" 
added in the last one hour sorted by registration date. You don't need a full-text search here
but a query to database `WHERE status = ? AND created_at >= ? ORDER BY LIMIT 100`.
Using MySQL queries to get data is a bad idea. It's fast if you use MySQL indexes, 
but you may have many WHERE conditions, so you will need to create many indexes n MySQL table that takes memory and slow down inserts and updates. In high-traffic
applications such queries are often the first bottleneck. Of course, you still
use Elastic Search to query for this data. You can also cache queries in Redis.
Both solutions are very difficult to implement. You need to build special ES indexes and keep
them up to date. You also need to update the cache in Redis when data changed and believe us, it's
extremely difficult to calculate which keys in Redis should be removed.

Lucky you, BeeORM hides this complexity from you. Thanks to amazing 
[Redis Search module](https://github.com/RediSearch/RediSearch) you can implement full-text and advanced search very easily. It provides top-edge performance, protects MySQL
from queries, and simplify your code:

```go
user := &User{CreatedAt: time.Now(), Status: "active"}
beeORMEngine.Flush()

query := beeORMEngine.NewRedisSearchQuery()
query.FilterTag("Status", "active")
query.FilterDateGreaterEqual("CreatedAt", time.Now().Sub(time.Hour))
query.Sort("CreatedAt", false)
var users []*User
total := beeORMEngine.RedisSearch(&users, query, NewPager(1, 100))
```

## And much much more...

BeeORM has many great features. Please spend some time and read the rest of this
[guide](/guide/registry.html) to discover all of them.
