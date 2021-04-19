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
cpu: Intel(R) Core(TM) i7-9750H CPU @ 2.60GHz
BenchmarkLoadByIDdLocalCache-12     4088002	       294.7 ns/op	       8 B/op	       1 allocs/op
BenchmarkLoadByIDLocalCacheLazy-12  5783040	       204.4 ns/op	       8 B/op	       1 allocs/op
```
</code-block>

<code-block title="Code">
```go
package orm

func BenchmarkLoadByIDLocalCache(b *testing.B) {
	benchmarkLoadByIDLocalCache(b, false)
}

func BenchmarkLoadByIDLocalCacheLazy(b *testing.B) {
	benchmarkLoadByIDLocalCache(b, true)
}

func benchmarkLoadByIDLocalCache(b *testing.B, lazy bool) {
	entity := &loadByIdBenchmarkEntity{}

	registry := &Registry{}
	registry.RegisterMySQLPool("root:root@tcp(localhost:3306)/test")
	registry.RegisterLocalCache(10)
	registry.RegisterEntity(entity)
	validatedRegistry, _ := registry.Validate()
	engine := validatedRegistry.CreateEngine()
	
	entity.Name = "Name"
	entity.Int = 1
	entity.Float = 1.3
	entity.Decimal = 12.23
	engine.Flush(entity)

	b.ResetTimer()
	b.ReportAllocs()
	for n := 0; n < b.N; n++ {
	if lazy {
		if lazy {
			engine.LoadByIDLazy(1, entity)
		} else {
			engine.LoadByID(1, entity)
		}
	}
}

```
</code-block>

<code-block title="Entity">
```go

type LoadByIdBenchmarkEntity struct {
	ORM      `orm:"localCache"`
	ID       uint
	Name     string
	Int      int
	Bool     bool
	Float    float64
	Decimal  float32   `orm:"decimal=10,2"`
}
```
</code-block>
</code-group>

