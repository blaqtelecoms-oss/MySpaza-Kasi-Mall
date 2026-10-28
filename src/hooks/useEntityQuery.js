// Reusable cache-first entity query hook built on the offline-aware base44
// client. Every page gets: instant render from persisted IndexedDB cache,
// background refresh when online, and automatic invalidation on sync.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

function stableArgs(args) {
  return JSON.stringify(args || []);
}

// Stable, colocated key: ['entities', entity, method, serializedArgs].
// Invalidating ['entities', entity] refreshes every query for that entity.
export function entityQueryKey(entity, method, args = []) {
  return ["entities", entity, method, stableArgs(args)];
}

// entity: e.g. "Product" · method: "list" | "filter" | "get" · args: the call args
export function useEntityQuery(entity, method, args = [], options = {}) {
  return useQuery({
    queryKey: entityQueryKey(entity, method, args),
    queryFn: () => base44.entities[entity][method](...args),
    staleTime: 1000 * 60 * 2, // serve cached data for 2 min, then refetch in background
    gcTime: 1000 * 60 * 30,
    ...options,
  });
}

// After a write (create/update/delete), call to refetch that entity's queries.
export function useInvalidateEntity() {
  const qc = useQueryClient();
  return (entity) => qc.invalidateQueries({ queryKey: ["entities", entity] });
}

export function invalidateEntity(qc, entity) {
  qc.invalidateQueries({ queryKey: ["entities", entity] });
}