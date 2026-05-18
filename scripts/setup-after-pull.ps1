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
	Invoke-Step 'Checking for running dev server' {
		$devServer = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
		if ($devServer) {
			Write-Host ""
			Write-Host "ERROR: Dev server is running on port 5173." -ForegroundColor Red
			Write-Host "Stop it (Ctrl+C in its terminal), then re-run this script." -ForegroundColor Yellow
			exit 1
		}
		Write-Host "No dev server detected."
	}

	Invoke-Step 'Installing npm dependencies' {
		$env:PUPPETEER_SKIP_DOWNLOAD = 'true'
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

Invoke-Step 'Applying database migrations' {
	if (-not (Get-Command mysql -ErrorAction SilentlyContinue)) {
		Write-Warning 'mysql CLI not found - skipping migrations.'
		return
	}

	# Parse .env; unescape \$ sequences Vite requires in passwords
	$envVars = @{}
	if (Test-Path '.env') {
		Get-Content '.env' | Where-Object { $_ -match '^\s*[^#]' } | ForEach-Object {
			if ($_ -match '^([^=]+)=(.*)$') { $envVars[$Matches[1].Trim()] = $Matches[2].Trim() }
		}
	}
	$dbHost = if ($envVars['DB_HOST']) { $envVars['DB_HOST'] } else { 'localhost' }
	$dbPort = if ($envVars['DB_PORT']) { $envVars['DB_PORT'] } else { '3306' }
	$dbUser = if ($envVars['DB_USER']) { $envVars['DB_USER'] } else { 'root' }
	$dbPass = if ($envVars['DB_PASSWORD']) { $envVars['DB_PASSWORD'] } else { '' }
	$dbPass = $dbPass -replace '\\(.)', '$1'
	$dbName = if ($envVars['DB_NAME']) { $envVars['DB_NAME'] } else { 'pands' }

	$connArgs = @("-h$dbHost", "-P$dbPort", "-u$dbUser", "--password=$dbPass", $dbName)

	# Test connectivity
	Write-Output 'SELECT 1;' | mysql @connArgs --silent
	if ($LASTEXITCODE -ne 0) {
		Write-Warning 'Cannot connect to database - skipping migrations.'
		return
	}

	# Bootstrap tracking table if missing
	$tableExists = Write-Output "SHOW TABLES LIKE 'schema_migrations';" | mysql @connArgs --skip-column-names --silent
	if (-not $tableExists) {
		$bootstrap = Get-ChildItem 'db/migrations' -Filter '*.sql' | Sort-Object Name |
			Where-Object { $_.Name -match 'schema_migrations' } | Select-Object -First 1
		if ($bootstrap) {
			Write-Host "  Bootstrapping via $($bootstrap.Name)..."
			Get-Content $bootstrap.FullName | mysql @connArgs
			if ($LASTEXITCODE -ne 0) { throw "Bootstrap migration failed." }
		} else {
			# No bootstrap file - create table and mark all on-disk files as already applied
			$names = (Get-ChildItem 'db/migrations' -Filter '*.sql' | Sort-Object Name |
				ForEach-Object { "('$($_.Name)')" }) -join ', '
			$sql = "CREATE TABLE schema_migrations (migration VARCHAR(255) NOT NULL PRIMARY KEY, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP); INSERT IGNORE INTO schema_migrations (migration) VALUES $names;"
			Write-Output $sql | mysql @connArgs
		}
	}

	# Normalize column name if table was created with old 'filename' schema
	$hasFilenameCol = Write-Output "SHOW COLUMNS FROM schema_migrations LIKE 'filename';" | mysql @connArgs --skip-column-names --silent
	if ($hasFilenameCol) {
		Write-Host "  Renaming schema_migrations.filename to migration..."
		Write-Output "ALTER TABLE schema_migrations CHANGE filename migration VARCHAR(255) NOT NULL;" | mysql @connArgs
		if ($LASTEXITCODE -ne 0) { throw "Failed to normalize schema_migrations column." }
	}

	# Fetch applied migrations
	$applied = @(Write-Output 'SELECT migration FROM schema_migrations;' | mysql @connArgs --skip-column-names --silent | ForEach-Object { $_.Trim() })
	if ($LASTEXITCODE -ne 0) { throw "Could not read schema_migrations table." }

	# Run pending migrations in filename order
	$count = 0
	foreach ($f in (Get-ChildItem 'db/migrations' -Filter '*.sql' | Sort-Object Name)) {
		if ($applied -contains $f.Name) {
			Write-Host "  [skip]  $($f.Name)"
			continue
		}
		Write-Host "  [apply] $($f.Name)"
		Get-Content $f.FullName | mysql @connArgs
		if ($LASTEXITCODE -ne 0) { throw "Migration $($f.Name) failed." }
		Write-Output "INSERT IGNORE INTO schema_migrations (migration) VALUES ('$($f.Name)');" | mysql @connArgs
		$count++
	}
	if ($count -eq 0) { Write-Host '  All migrations up to date.' }
	else { Write-Host "  $count migration(s) applied." }
}

Write-Host ""
Write-Host 'Post-pull setup complete.'
Write-Host 'Run npm run dev for local development, or node build/index.js after a production build.'
