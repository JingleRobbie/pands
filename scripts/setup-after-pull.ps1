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

Invoke-Step 'Checking database migrations' {
	$migrations = Get-ChildItem 'db/migrations/*.sql' | Sort-Object Name
	if ($migrations.Count -eq 0) {
		Write-Host "No migration files found."
	} else {
		# Load .env to get DB credentials
		$envVars = @{}
		if (Test-Path '.env') {
			Get-Content '.env' | Where-Object { $_ -match '^\s*[^#]' } | ForEach-Object {
				if ($_ -match '^([^=]+)=(.*)$') { $envVars[$Matches[1].Trim()] = $Matches[2].Trim() }
			}
		}
		$dbHost = if ($envVars['DB_HOST']) { $envVars['DB_HOST'] } else { 'localhost' }
		$dbPort = if ($envVars['DB_PORT']) { $envVars['DB_PORT'] } else { '3306' }
		$dbUser = if ($envVars['DB_USER']) { $envVars['DB_USER'] } else { 'root' }
		$dbName = if ($envVars['DB_NAME']) { $envVars['DB_NAME'] } else { 'pands' }

		# Try to detect applied migrations via schema_migrations table
		$mysqlAvailable = $null -ne (Get-Command mysql -ErrorAction SilentlyContinue)
		$applied = @()
		$canConnect = $false

		if ($mysqlAvailable) {
			try {
				$result = mysql -h $dbHost -P $dbPort -u $dbUser $dbName -e "SELECT migration FROM schema_migrations;" --skip-column-names 2>&1
				if ($LASTEXITCODE -eq 0) {
					$canConnect = $true
					$applied = $result | Where-Object { $_ -match '\S' }
				}
			} catch { }
		}

		if ($canConnect) {
			$pending = $migrations | Where-Object { $applied -notcontains $_.Name }
			if ($pending.Count -eq 0) {
				Write-Host "All $($migrations.Count) migrations applied."
			} else {
				Write-Host ""
				Write-Host "PENDING MIGRATIONS ($($pending.Count)):" -ForegroundColor Yellow
				foreach ($f in $pending) {
					Write-Host "  npm run migrate $($f.Name)" -ForegroundColor Cyan
				}
				Write-Host ""
				Write-Host "Run each command above in order. You will be prompted for your DB password." -ForegroundColor Yellow
			}
		} else {
			Write-Host ""
			if (-not $mysqlAvailable) {
				Write-Host "mysql CLI not found — cannot check migration status." -ForegroundColor Yellow
			} else {
				Write-Host "Could not connect to MySQL — cannot check migration status." -ForegroundColor Yellow
			}
			Write-Host "Apply any new migrations manually using:" -ForegroundColor Yellow
			foreach ($f in $migrations) {
				Write-Host "  npm run migrate $($f.Name)" -ForegroundColor Cyan
			}
		}
	}
}

Write-Host ""
Write-Host 'Post-pull setup complete.'
Write-Host 'Run npm run dev for local development, or node build/index.js after a production build.'
