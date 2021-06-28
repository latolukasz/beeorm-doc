# Dirty channel

BeeORM provides special feature called `dirty channel` that
is used to track changes in entity. The easiest way to explain
how it works is an example. In our scenario we use `UserEntity` 
defined as:

```go
type UserEntity struct {
    beeorm.ORM
    ID        uint
    Name      string
    Email     string `beeorm:"unique=email;required"` 
    Latitude  float32
    Longitude float32
}
```

## Entity dirty stream

Let's assume we need to implement full text search in our 
application using elastic search. Every time user is added, updated 
or removed we must send request to elastic search
with the newest user data. First we need to define
[redis stream and consumer group](/guide/event_broker.html#registering-streams) that
will be used to store and consume events publish by BeORM every time user entity is changed:

<code-group>
<code-block title="code">
```go{3}
registry := beeorm.NewRegistry()
registry.RegisterRedis("localhost:6379", 0)
registry.RegisterRedisStream("user-changed", "default", []string{"update-es-document"})
```
</code-block>

<code-block title="yaml">
```yml{3-5}
default:
    redis: localhost:6379:0
    streams:
        user-changed:
          - update-es-document
```
</code-block>
</code-group>

Now we need to add special tag `dirty` in our entity:

```go{2}
type UserEntity struct {
    beeorm.ORM `orm:"dirty=user-changed"`
    ID        uint
    Name      string
    Email     string `beeorm:"unique=email;required"` 
    Latitude  float32
    Longitude float32
}
```

Tag is defined for `beeorm.ORM ` field that's why 
every time user is added, updated (any field) or deleted special event
is published to `user-changed` channel. Now it's time to consumer these events:

```go{4}
consumer := engine.GetEventBroker().Consumer("update-es-document")
consumer.Consume(10, func(events []Event) {
    for _, event := range events {
        dityEvent := beeorm.EventDirtyEntity(event)
        if dityEvent.Deleted() { 
            yourESService.DeleteDocument("users_index", dityEvent.ID())
        } else {
            user := &UserEntity{}
            if engine.LoadByID(dityEvent.ID(), user) {
                esUserDocument := esDocument{Name: user.Name, Email: user.Email....}
                yourESService.AddUpdateDocument(("users_index", dityEvent.ID(), esUserDocument)
            }
        }
    }
})
```

``beeorm.EventDirtyEntity`` provides few useful methods that you can use in your consumers:

```go
// primary ID of entity
dityEvent.ID()
// true if entity was inserted into DB
dityEvent.Added()
// true if entity was updated in DB
dityEvent.Updated()
// true if entity was deleted from DB
dityEvent.Deteled()
// entity 
tableSchema := dityEvent.TableSchema()
```

You can get also entity [table schema](/guide/validated_registry.html#entity-schema):
```go{1}
tableSchema:= dityEvent.TableSchema()
tableSchema.GetTableName() // "UserEntity"
entity := tableSchema.NewInstance()
found := engine.LoadByID(dityEvent.ID(), entity)
```

Now let's assume we need another feature - time user is added or updated 
we should send email. We can add extra code in already created consumer:

```go{11}
consumer := engine.GetEventBroker().Consumer("update-es-document")
consumer.Consume(10, func(events []Event) {
    for _, event := range events {
        dityEvent := beeorm.EventDirtyEntity(event)
        if dityEvent.Deleted() { 
            yourESService.DeleteDocument("users_index", dityEvent.ID())
        } else {
            user := &UserEntity{}
            if engine.LoadByID(dityEvent.ID(), user) {
                esUserDocument := esDocument{Name: user.Name, Email: user.Email....}
                yourEmailService.SendEmail(user.Email, "Your account was changed")
                yourESService.AddUpdateDocument(("users_index", dityEvent.ID(), esUserDocument)
            }
        }
    }
})
```

Well, this code works perfectly but there is one problem with this implementation -
try to imagine elastic search sever is down. Then after sending email code will
panic in next line, so next time you run consumer email will be send again.
Adding different functionalities in one consumer is a bad idea. 
BeeORM helps you solve this problem very ease - simply define two different consumer groups
for one dirty stream:

<code-group>
<code-block title="registry">
```go{3}
registry := beeorm.NewRegistry()
registry.RegisterRedis("localhost:6379", 0)
registry.RegisterRedisStream("user-changed", "default", []string{"update-es-document", "send-user-updated-mail"})
```
</code-block>

<code-block title="consumer #1">
```go{1}
consumer := engine.GetEventBroker().Consumer("update-es-document")
consumer.Consume(10, func(events []Event) {
    for _, event := range events {
        dityEvent := beeorm.EventDirtyEntity(event)
        if dityEvent.Deleted() { 
            yourESService.DeleteDocument("users_index", dityEvent.ID())
        } else {
            user := &UserEntity{}
            if engine.LoadByID(dityEvent.ID(), user) {
                esUserDocument := esDocument{Name: user.Name, Email: user.Email....}
                yourESService.AddUpdateDocument(("users_index", dityEvent.ID(), esUserDocument)
            }
        }
    }
})
```
</code-block>

<code-block title="consumer #2">
```go{1}
consumer := engine.GetEventBroker().Consumer("send-user-updated-mail")
consumer.Consume(10, func(events []Event) {
    for _, event := range events {
        dityEvent := beeorm.EventDirtyEntity(event)
        if !dityEvent.Deleted() { 
            user := &UserEntity{}
            if engine.LoadByID(dityEvent.ID(), user) {
                yourEmailService.SendEmail(user.Email, "Your account was changed")
            }    
        }
    }
})
```
</code-block>
</code-group>

## Field dirty stream

TODO:
 * sending emails for two different entities
 * only inserted dirty (close to ID)
