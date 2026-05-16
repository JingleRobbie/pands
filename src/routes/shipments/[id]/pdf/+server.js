import puppeteer from 'puppeteer';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

export async function GET({ params, request, cookies, locals }) {
	if (!locals.appUser) return new Response('Unauthorized', { status: 401 });

	const userId = cookies.get('app_user_id');
	const origin = new URL(request.url).origin;
	const printUrl = `${origin}/shipments/${params.id}/print`;

	let browser;
	try {
		browser = await puppeteer.launch({
			executablePath: CHROME_PATH,
			args: ['--no-sandbox', '--disable-setuid-sandbox'],
			headless: true,
		});
		const page = await browser.newPage();

		// Forward auth cookie
		const domain = new URL(origin).hostname;
		await page.setCookie({ name: 'app_user_id', value: userId, domain, path: '/' });

		await page.goto(printUrl, { waitUntil: 'networkidle0', timeout: 15000 });

		const pdf = await page.pdf({
			format: 'Letter',
			printBackground: true,
			margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
		});

		return new Response(pdf, {
			headers: {
				'Content-Type': 'application/pdf',
				'Content-Disposition': `inline; filename="packing-slip-${params.id}.pdf"`,
			},
		});
	} finally {
		await browser?.close();
	}
}
