param(
	[Parameter(Mandatory)][string]$Migration
)

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $repoRoot

# Load .env
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

$migrationPath = "db/migrations/$Migration"
if (-not (Test-Path $migrationPath)) {
	Write-Host "ERROR: Migration file not found: $migrationPath" -ForegroundColor Red
	exit 1
}

$fileName = [System.IO.Path]::GetFileName($migrationPath)

Write-Host "Applying migration: $fileName"
Get-Content $migrationPath | mysql -h $dbHost -P $dbPort -u $dbUser -p $dbName
if ($LASTEXITCODE -ne 0) {
	Write-Host "ERROR: Migration failed. Database unchanged." -ForegroundColor Red
	exit 1
}

Write-Host "Recording migration in schema_migrations..."
mysql -h $dbHost -P $dbPort -u $dbUser -p $dbName -e "INSERT IGNORE INTO schema_migrations (migration) VALUES ('$fileName');"
if ($LASTEXITCODE -ne 0) {
	Write-Host "WARNING: Migration applied but failed to record in schema_migrations." -ForegroundColor Yellow
	Write-Host "Run manually: INSERT IGNORE INTO schema_migrations (migration) VALUES ('$fileName');" -ForegroundColor Yellow
	exit 1
}

Write-Host "Done: $fileName" -ForegroundColor Green
