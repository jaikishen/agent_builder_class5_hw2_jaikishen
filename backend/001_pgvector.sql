-- 1. Extension
create extension if not exists vector;

-- 2. Documents table (LangChain SupabaseVectorStore convention)
create table if not exists documents (
  id          bigserial primary key,
  content     text          not null,
  metadata    jsonb,
  embedding   vector(1536)  not null
);

-- 3. Cosine similarity match function
-- match_documents runs with caller's privileges (security invoker, plpgsql
-- default). The agent backend calls it via psycopg3 as the `postgres` role,
-- which bypasses RLS. If you ever expose this RPC over PostgREST under the
-- anon or authenticated role, the inner SELECT will be blocked by RLS and
-- the function will return zero rows silently.
create or replace function match_documents (
  query_embedding vector(1536),
  match_count     int    default 4,
  filter          jsonb  default '{}'
) returns table (
  id        bigint,
  content   text,
  metadata  jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select d.id, d.content, d.metadata,
         1 - (d.embedding <=> query_embedding) as similarity
  from documents d
  where d.metadata @> filter
  order by d.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- 4. IVFFlat index
create index if not exists documents_embedding_idx
  on documents
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- 5. Defense-in-depth: deny anon/authenticated; postgres role still works
alter table documents enable row level security;