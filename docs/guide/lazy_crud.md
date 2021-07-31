# Lazy CRUD

So far you have learned how to work with [CRUD](/guide/crud.html) actions. 
We are always trying to optimise our code in a way every CRUD operation is as
fast as possible and use minimum number of memory and allocations. 
In some scenarios you may require even better performance, for instance in 
scripts that operates on huge amount of data. BeeORM provides special
feature called *lazy* that helps you get top performance.

## Lazy flush

In many scenarios adding, editing and deleting entities can be executed asynchronously.
BeeORM provides ``engine.Flush`` methods with prefix ``Lazy`` which adds all SQL queries
into special redis stream. Then [background consumer](/guide/background_consumer.html) script
will read these queries from redis stream and execute them:

<code-group>
<code-block title="code">
```go{3,8,12}
// adding new entity
user := &UserEntity{FirstName: "Tom", LastName: "Bee", Email: "bee@beeorm.io"}
engine.FlushLazy(user) 

// updating entity
engine.LoadByID(1, user)
user.Name = "John"
engine.FlushLazy(user)

// deleting entity
engine.LoadByID(2, user)
engine.DeleteLazy(user)
```
</code-block>

<code-block title="queries">
```sql
REDIS XAdd orm-lazy-channel event
REDIS XAdd orm-lazy-channel event
REDIS XAdd orm-lazy-channel event
```
</code-block>
</code-group>

::: tip
As you can see all queries are added as events to redis stream called 
``orm-lazy-channel``. If length of this stream is high or is growing it means 
you forgot to run [background consumer](/guide/background_consumer.html) in your 
application.
:::

In case you need to flush more than one entity [Flusher](/guide/crud.html#flusher) you can use
``flusger.FLushLazy()`` method:

<code-group>
<code-block title="code">
```go{13}
flusher := engine.NewFlusher()

user := &UserEntity{FirstName: "Tom", LastName: "Bee", Email: "bee@beeorm.io"}
flusher.Track(user) 
var userToUpdate *UserEntity
engine.LoadByID(1, userToUpdate)
userToUpdate.Name = "John"
flusher.Track(userToUpdate)
var userToDelete *UserEntity
engine.LoadByID(2, userToDelete)
flusher.Delete(userToDelete)

flusher.FlushLazy()
```
</code-block>

<code-block title="queries">
```sql
REDIS XAdd orm-lazy-channel event event event
```
</code-block>
</code-group>
