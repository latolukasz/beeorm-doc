---
sidebar: auto
---

# Benchmarks

## LoadByID

Loading one entity using primary key.

### Using local cache

Cached in local in-memory cache.

<code-group>
<code-block title="Results">
```
BenchmarkLoadByIDdLocalCache-10    	 3629475	       325.9 ns/op	     152 B/op	       6 allocs/op
```
</code-block>

<code-block title="Code">
```go
package orm

func BenchmarkLoadByIDdLocalCache(b *testing.B) {
	benchmarkLoadByIDLocalCache(b, true, false)
}

func benchmarkLoadByIDLocalCache(b *testing.B, local, redis bool) {
	entity := &loadByIDBenchmarkEntity{}
	registry := &Registry{}
	registry.RegisterEnumStruct("beeorm.TestEnum", TestEnum)
	registry.RegisterLocalCache(10000)
	engine := prepareTables(nil, registry, 5, 6, "", entity)
	schema := engine.GetRegistry().GetTableSchemaForEntity(entity).(*tableSchema)
	if local {
		schema.localCacheName = "default"
		schema.hasLocalCache = true
	} else {
		schema.localCacheName = ""
		schema.hasLocalCache = false
	}
	if redis {
		schema.redisCacheName = "default"
		schema.hasRedisCache = true
	} else {
		schema.redisCacheName = ""
		schema.hasRedisCache = false
	}

	entity.Name = "Name"
	entity.Int = 1
	entity.Float = 1.3
	entity.Decimal = 12.23
	engine.Flush(entity)
	_ = engine.LoadByID(1, entity)
	b.ResetTimer()
	b.ReportAllocs()
	for n := 0; n < b.N; n++ {
		_ = engine.LoadByID(1, entity)
	}
}

```
</code-block>

<code-block title="Entity">
```go

type loadByIDBenchmarkEntity struct {
	ORM
	ID      uint
	Name    string
	Int     int
	Bool    bool
	Float   float64
	Decimal float32 `orm:"decimal=10,2"`
}
```
</code-block>
</code-group>

## LoadByIDs

Loading many entities using primary key.

### Using local cache

Cached in local in-memory cache.

<code-group>
<code-block title="Results">
```
BenchmarkLoadByIDsdLocalCache-10    	  906974	      1326 ns/op	    1104 B/op	      12 allocs/op
```
</code-block>

<code-block title="Code">
```go
package orm

func BenchmarkLoadByIDsdLocalCache(b *testing.B) {
	benchmarkLoadByIDsLocalCache(b)
}

func benchmarkLoadByIDsLocalCache(b *testing.B) {
	entity := &schemaEntity{}
	ref := &schemaEntityRef{}
	registry := &Registry{}
	registry.RegisterEnumStruct("beeorm.TestEnum", TestEnum)
	registry.RegisterLocalCache(10000)
	engine := prepareTables(nil, registry, 5, 6, "", entity, ref)

	ids := make([]uint64, 0)
	for i := 1; i <= 1; i++ {
		e := &schemaEntity{}
		e.GetID()
		e.Name = fmt.Sprintf("Name %d", i)
		e.Uint32 = uint32(i)
		e.Int32 = int32(i)
		e.Int8 = 1
		e.Enum = TestEnum.A
		e.RefOne = &schemaEntityRef{}
		engine.Flush(e)
		_ = engine.LoadByID(uint64(i), e)
		ids = append(ids, uint64(i))
	}
	rows := make([]*schemaEntity, 0)
	b.ResetTimer()
	b.ReportAllocs()
	for n := 0; n < b.N; n++ {
		engine.LoadByIDs(ids, &rows)
	}
}

```
</code-block>

<code-block title="Entity">
```go

type schemaEntity struct {
	ORM             `orm:"localCache;log;unique=TestUniqueGlobal:Year,SubStructSubAge|TestUniqueGlobal2:Uint32"`
	ID              uint
	Name            string `orm:"index=TestIndex;required"`
	NameNullable    string
	NameMax         string  `orm:"length=max"`
	NameMaxRequired string  `orm:"length=max;required"`
	Year            *uint16 `orm:"year"`
	Uint8           uint8
	Uint16          uint16 `orm:"index=TestIndex:2"`
	Uint32          uint32
	Uint32Medium    uint32 `orm:"mediumint"`
	YearRequired    uint16 `orm:"year"`
	Uint64          uint64
	Int8            int8
	Int16           int16
	Int32           int32 `orm:"unique=TestUniqueIndex"`
	Int32Medium     int32 `orm:"mediumint"`
	Int64           int64
	Int             int
	IntNullable     *int
	Bool            bool
	BoolNullable    *bool
	Interface       interface{}
	Float32         float32
	Float32Nullable *float32
	Float64         float64
	Time            time.Time
	TimeFull        time.Time `orm:"time"`
	TimeNull        *time.Time
	Blob            []uint8
	MediumBlob      []uint8 `orm:"mediumblob"`
	LongBlob        []uint8 `orm:"longblob"`
	SubStruct       schemaSubFields
	SubStructIndex  schemaSubFieldsIndex
	schemaSubFields
	CachedQuery    *CachedQuery
	Ignored        string `orm:"ignore"`
	NameTranslated map[string]string
	RefOne         *schemaEntityRef
	RefMany        []*schemaEntityRef
	Decimal        float32  `orm:"decimal=10,2"`
	Enum           string   `orm:"enum=beeorm.TestEnum;required"`
	Set            []string `orm:"set=beeorm.TestEnum;required"`
	FakeDelete     bool
	IndexAll       *CachedQuery `query:""`
}
```
</code-block>
</code-group>
