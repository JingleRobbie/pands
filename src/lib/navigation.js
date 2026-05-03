export function pathWithSearch(url) {
	return `${url.pathname}${url.search}`;
}

export function safeReturnTo(value, fallback = '/') {
	if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
		return fallback;
	}
	if (value.includes('\n') || value.includes('\r') || value.includes('\\')) {
		return fallback;
	}
	return value;
}

export function getReturnTo(url, fallback = '/') {
	return safeReturnTo(url.searchParams.get('returnTo'), fallback);
}

export function withReturnTo(href, returnTo) {
	const safe = safeReturnTo(returnTo, '');
	if (!safe) return href;
	const url = new URL(href, 'http://pands.local');
	url.searchParams.set('returnTo', safe);
	return `${url.pathname}${url.search}${url.hash}`;
}
