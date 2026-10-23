import type { ParamMatcher } from '@sveltejs/kit';
import { isSpaceId } from '$lib/spaces';

export const match = ((param) => isSpaceId(param)) satisfies ParamMatcher;
