import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = () => {
	if (!import.meta.env.DEV) {
		redirect(307, '/ear-training');
	}
};
