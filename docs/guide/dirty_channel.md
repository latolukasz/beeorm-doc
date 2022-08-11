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
    Email     string `orm:"unique=email;required"` 
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
will be used to store and consume events publish by BeeORM every time user entity is changed:

<code-group>
<code-block title="code">
```go{3}
registry := beeorm.NewRegistry()
registry.RegisterRedis("localhost:6379", "", 0)
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
    Email     string `orm:"unique=email;required"` 
    Latitude  float32
    Longitude float32
}
```

Tag is defined for `beeorm.ORM ` field that's why 
every time user is added, updated (any field) or deleted special event
is published to `user-changed` channel. Now it's time to consume these events:

```go{4}
consumer := engine.GetEventBroker().Consumer("update-es-document")
consumer.Consume(context.Background(), 10, func(events []Event) {
    for _, event := range events {
        dirtyEvent := beeorm.EventDirtyEntity(event)
        if dirtyEvent.Deleted() { 
            yourESService.DeleteDocument("users_index", dirtyEvent.ID())
        } else {
            user := &UserEntity{}
            if engine.LoadByID(dirtyEvent.ID(), user) {
                esUserDocument := esDocument{Name: user.Name, Email: user.Email....}
                yourESService.AddUpdateDocument(("users_index", dirtyEvent.ID(), esUserDocument)
            }
        }
    }
})
```

``beeorm.EventDirtyEntity`` provides few useful methods that you can use in your consumers:

```go
// primary ID of entity
dirtyEvent.ID()
// true if entity was inserted into DB
dirtyEvent.Added()
// true if entity was updated in DB
dirtyEvent.Updated()
// true if entity was deleted from DB
dirtyEvent.Deteled()
// entity 
tableSchema := dirtyEvent.TableSchema()
```

You can also get entity [table schema](/guide/validated_registry.html#entity-schema):
```go{1}
tableSchema := dirtyEvent.TableSchema()
tableSchema.GetTableName() // "UserEntity"
entity := tableSchema.NewInstance()
found := engine.LoadByID(dirtyEvent.ID(), entity)
```

Now let's assume we need another feature - every time user is added or updated 
we should send email. We can add extra code in already created consumer:

```go{11}
consumer := engine.GetEventBroker().Consumer("update-es-document")
consumer.Consume(context.Background(), 10, func(events []Event) {
    for _, event := range events {
        dirtyEvent := beeorm.EventDirtyEntity(event)
        if dirtyEvent.Deleted() { 
            yourESService.DeleteDocument("users_index", dirtyEvent.ID())
        } else {
            user := &UserEntity{}
            if engine.LoadByID(dirtyEvent.ID(), user) {
                esUserDocument := esDocument{Name: user.Name, Email: user.Email....}
                yourEmailService.SendEmail(user.Email, "Your account was changed")
                yourESService.AddUpdateDocument(("users_index", dirtyEvent.ID(), esUserDocument)
            }
        }
    }
})
```

Well, this code works perfectly but there is one problem with this implementation -
try to imagine elastic search server is down. Then after sending email, code will
panic in next line, so next time you run consumer email will be send again.
Adding different functionalities in one consumer is a bad idea. 
BeeORM helps you solve this problem very easily - simply define two different consumer groups
for one dirty stream:

<code-group>
<code-block title="registry">
```go{3}
registry := beeorm.NewRegistry()
registry.RegisterRedis("localhost:6379", "", 0)
registry.RegisterRedisStream("user-changed", "default", []string{"update-es-document", "send-user-updated-mail"})
```
</code-block>

<code-block title="consumer #1">
```go{1}
consumer := engine.GetEventBroker().Consumer("update-es-document")
consumer.Consume(context.Background(), 10, func(events []Event) {
    for _, event := range events {
        dirtyEvent := beeorm.EventDirtyEntity(event)
        if dirtyEvent.Deleted() { 
            yourESService.DeleteDocument("users_index", dirtyEvent.ID())
        } else {
            user := &UserEntity{}
            if engine.LoadByID(dirtyEvent.ID(), user) {
                esUserDocument := esDocument{Name: user.Name, Email: user.Email....}
                yourESService.AddUpdateDocument(("users_index", dirtyEvent.ID(), esUserDocument)
            }
        }
    }
})
```
</code-block>

<code-block title="consumer #2">
```go{1}
consumer := engine.GetEventBroker().Consumer("send-user-updated-mail")
consumer.Consume(context.Background(), 10, func(events []Event) {
    for _, event := range events {
        dirtyEvent := beeorm.EventDirtyEntity(event)
        if !dirtyEvent.Deleted() { 
            user := &UserEntity{}
            if engine.LoadByID(dirtyEvent.ID(), user) {
                yourEmailService.SendEmail(user.Email, "Your account was changed")
                event.Ack()
            }    
        }
    }
})
```
</code-block>
</code-group>

## Field dirty stream

Now imagine we need another feature in our application - every
time user updates location (`Latitude` or `Longitude`) we should send
email "your location was changed". In previous example we added `dirty` tag
for `beeorm.ORM` entity field to track all changes in all fields. But in this
example we should track changes only in these two field. That's why
this time are adding `dirty` tag for entity fields that should be tracked:

<code-group>
<code-block title="entity">
```go{6,7}
type UserEntity struct {
    beeorm.ORM `orm:"dirty=user-changed"`
    ID         uint
    Name       string
    Email      string `orm:"unique=email;required"` 
    Latitude   float32 `orm:"dirty=location-changed"`
    Longitude  float32 `orm:"dirty=location-changed"`
}
```
</code-block>

<code-block title="consumer">
```go
consumer := engine.GetEventBroker().Consumer("location-changed")
consumer.Consume(context.Background(), 10, func(events []Event) {
    for _, event := range events {
        dityEvent := beeorm.EventDirtyEntity(event)
        if dityEvent.Updated()() { 
            user := &UserEntity{}
            if engine.LoadByID(dityEvent.ID(), user) {
                yourEmailService.SendEmail(user.Email, "your location was changed")
                events.Ack()
            }
        }
    }
})
```
</code-block>
</code-group>

Now only if `Latitude` or `Longitude` field is changed, dirty event is published 
to `location-changed` channel. If both fields are changed only one dirty event
is published, not two.

Now imagine we need last feature - every time user updates location or name 
we should send email "your account data was changed". In BeeORM
you can define more than one dirty stream in `dirty` tag, simply divide them by `,`:

<code-group>
<code-block title="entity">
```go{4,6,7}
type UserEntity struct {
    beeorm.ORM `orm:"dirty=user-changed"`
    ID         uint
    Name       string `orm:"dirty=data-changed"`
    Email      string `orm:"unique=email;required"` 
    Latitude   float32 `orm:"dirty=location-changed,data-changed"`
    Longitude  float32 `orm:"dirty=location-changed,data-changed"`
}
```
</code-block>

<code-block title="consumer">
```go
consumer := engine.GetEventBroker().Consumer("data-changed")
consumer.Consume(context.Background(), 10, func(events []Event) {
    for _, event := range events {
        dityEvent := beeorm.EventDirtyEntity(event)
        if dityEvent.Updated()() { 
            user := &UserEntity{}
            if engine.LoadByID(dityEvent.ID(), user) {
                yourEmailService.SendEmail(user.Email, "your account data was changed")
                events.Ack()
            }
        }
    }
})
```
</code-block>
</code-group>

## Mark entities as dirty

You can publish entity dirty event manually with `engine.MarkDirty()` method:

```go{2}
var entity *UserEntity
engine.MarkDirty(entity, "location-changed", 1, 14, 35)
```
Above code publish 3 dirty events for `UserEntity` with ID 1,14,35 into
`location-changed` channel. All entities have `events.Updated() == true`.

Below code demonstrates how we can mark all entities as dirty:

```go{9}
var user *UserEntity
where := beeorm.NewWhere("ID > ? ORDER BY ID")
pager := beeorm.NewPager(1, 1000)
lastID := 0
for {
    where.SetParameter(1, lastID)
    ids := engine.SearchIDs(where, pager, user)
    if len(ids) > 0 {
        engine.MarkDirty(user, "user-changed", ids...)    
    }
    if len(users) < pager.GetPageSize() {
        break
    }
    lastID = ids[len(ids)-1]
}

```
