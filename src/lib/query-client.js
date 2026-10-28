import { QueryClient } from '@tanstack/react-query';

export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
			staleTime: 1000 * 60 * 2,
			gcTime: 1000 * 60 * 30,
		},
	},
});

// When the offline sync engine finishes pushing queued writes, invalidate all
// cached queries so pages refetch fresh server data.
if (typeof window !== 'undefined') {
	window.addEventListener('myspaza:synced', () => {
		queryClientInstance.invalidateQueries();
	});
}