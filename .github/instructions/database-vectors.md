# Engineering Memory: Database Vectors

**Domain**: database-vectors
**Scope**: workspace

## Rules

### 1. Vector Parameter Binding
**Summary**:
The `pg` driver serializes JS arrays as Postgres arrays (`{...}`), which are incompatible with `pgvector` (`[...]`).
Queries must ensure vector parameters are transmitted in `pgvector` literal syntax (`[...]`) and cast to `::vector` when necessary.

**Action**:
- Prefer parameter binding with explicit casts (`$1::vector`) over string interpolation.
- Today, this is achieved by `JSON.stringify(vector)` + param binding `$n::vector`.
    - **Reasoning**: We stringify vectors because the `pg` driver binds JS arrays as `{}` Postgres arrays, which `pgvector` can’t parse.
- (Future): If/when we use a driver/helper that supports native `pgvector` parameter binding, revisit and remove `JSON.stringify`.

**Why**:
Prevents `invalid input syntax for type vector` and `operator does not exist` errors.

**Evidence**:
Verified in `server/scripts/verify_vector_cast.ts`:
- **Failure**: Default array binding sends `"{0.1,0.1...}"` -> `invalid input syntax`.
- **Success**: JSON stringified binding sends `"[0.1,0.1...]"` -> Query succeeds.
