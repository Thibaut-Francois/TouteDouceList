import type { ParamMatcher } from '@sveltejs/kit';
import { isProfileId } from '$lib/spaces';

export const match = ((param) => isProfileId(param)) satisfies ParamMatcher;
