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

const BACK_LABELS = {
	'/dashboard': 'Dashboard',
	'/wo': 'Work Orders',
	'/receiving': 'Receiving',
	'/po': 'Purchase Orders',
	'/shipments': 'Shipments',
	'/production': 'Production',
	'/matrix': 'Overview',
	'/calendar': 'Calendar',
	'/customers': 'Customers',
	'/': 'Home',
};

export function backLabel(returnTo, fallback = 'Back') {
	const path = returnTo?.split('?')[0];
	const label = path ? BACK_LABELS[path] : null;
	return label ? `← ${label}` : `← ${fallback}`;
}

export function withReturnTo(href, returnTo) {
	const safe = safeReturnTo(returnTo, '');
	if (!safe) return href;
	const url = new URL(href, 'http://pands.local');
	url.searchParams.set('returnTo', safe);
	return `${url.pathname}${url.search}${url.hash}`;
}
