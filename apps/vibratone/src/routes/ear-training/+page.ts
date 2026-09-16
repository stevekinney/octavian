import type { PageLoad } from './$types';

export const load: PageLoad = ({ url }) => {
	const seed = url.searchParams.get('seed');
	return {
		seed: seed && seed.length > 0 ? seed : null
	};
};
