param(
	[switch]$SkipInstall,
	[switch]$SkipCss,
	[switch]$SkipBuild,
	[switch]$RunTests
)

$ErrorActionPreference = 'Stop'

function Invoke-Step {
	param(
		[string]$Name,
		[scriptblock]$Command
	)

	Write-Host ""
	Write-Host "== $Name =="
	& $Command
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $repoRoot

Invoke-Step 'Checking Node.js and npm' {
	$nodeVersion = (& node --version).TrimStart('v')
	$nodeMajor = [int]($nodeVersion.Split('.')[0])
	if ($nodeMajor -lt 20) {
		throw "Node.js 20+ is required. Current version: $nodeVersion"
	}

	$npmVersion = & npm --version
	Write-Host "Node.js $nodeVersion"
	Write-Host "npm $npmVersion"
}

if (-not (Test-Path '.env')) {
	Invoke-Step 'Creating .env from .env.example' {
		Copy-Item '.env.example' '.env'
		Write-Warning 'Created .env from .env.example. Edit DB_USER and DB_PASSWORD before running the app against MySQL.'
	}
}

if (-not $SkipInstall) {
	Invoke-Step 'Installing npm dependencies' {
		if (Test-Path 'package-lock.json') {
			npm ci
		} else {
			npm install
		}
	}
}

Invoke-Step 'Regenerating SvelteKit local files' {
	npm run sync
}

if (-not $SkipCss) {
	Invoke-Step 'Building generated Tailwind CSS' {
		npm run build:css
	}
}

if (-not $SkipBuild) {
	Invoke-Step 'Verifying production build' {
		npm run build
	}
}

if ($RunTests) {
	Invoke-Step 'Running tests' {
		npm run test
	}
}

Write-Host ""
Write-Host 'Post-pull setup complete.'
Write-Host 'Run npm run dev for local development, or node build/index.js after a production build.'
