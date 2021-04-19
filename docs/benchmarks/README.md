---
sidebar: auto
---

# Benchmarks

## LoadByID using local cache

Loading one entity using primary KEY cached in local in-memory cache.

<code-group>
<code-block title="Results">
```bash

    sh aaa

```
</code-block>

<code-block title="Test">
```go
package orm

func BenchmarkLoadByIDLocalCache(b *testing.B) {
    entity := &TestEntity{}
    ref := &TestReferenceEntity{}
    registry := &Registry{}
    registry.RegisterEnumStruct("orm.TestEnum", TestEnum)
    registry.RegisterLocalCache(100)
    engine := PrepareTables(nil, registry, 5, entity, ref)
    entity.Name = "Name"
    entity.Uint32 = 1
    entity.Int32 = 1
    entity.Int8 = 1
    entity.Enum = TestEnum.A
    entity.RefOne = ref
    engine.Flush(e)
    _ = engine.LoadByID(1, e)
    b.ResetTimer()
    b.ReportAllocs()
    for n := 0; n < b.N; n++ {
        _ = engine.LoadByID(1, e)
    }
}

```
</code-block>

<code-block title="Entity">
```go

type testEnum struct {
    EnumModel
    A string
    B string
    C string
}
var TestEnum = &testEnum{
    A: "a",
    B: "b",
    C: "c",
}

type TestReferenceEntity struct {
    ORM
    ID   uint
    Name string
}

type TestSubFields struct {
    Name        string
    Age         uint16
}

type TestEntity struct {
	ORM             `orm:"localCache"`
	ID              uint
	Name            string `orm:"index=TestIndex;required"`
	NameNullable    string
	NameMax         string  `orm:"length=max"`
	Year            *uint16 `orm:"year"`
	Uint8           uint8
	Uint16          uint16 `orm:"index=TestIndex:2"`
	Uint32          uint32
	Uint32Medium    uint32 `orm:"mediumint"`
	YearRequired    uint16 `orm:"year"`
	Uint64          uint64
	Int8            int8
	Int16           int16
	Int32           int32
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
	SubStruct       TestSubFields
	CachedQuery     *CachedQuery
	Ignored         string `orm:"ignore"`
	NameTranslated  map[string]string
	RefOne          *TestReferenceEntity
	RefMany         []*TestReferenceEntity
	Decimal         float32  `orm:"decimal=10,2"`
	Enum            string   `orm:"enum=TestEnum;required"`
	Set             []string `orm:"set=TestEnum;required"`
	FakeDelete      bool
}
```
</code-block>
</code-group>

