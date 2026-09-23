[CmdletBinding()]
param(
    [switch]$Execute,
    [switch]$AuthorizeCatalogWrite
)

$ErrorActionPreference = "Stop"

function Stop-P16 {
    param([string]$Code)
    throw "P16 CATALOG BOOTSTRAP / FAIL / $Code"
}

Write-Host "============================================================"
Write-Host "P16 STAGING CATALOG BOOTSTRAP OPERATOR"
Write-Host "CONTROLLED STAGING CATALOG OPERATOR"
Write-Host "============================================================"

$RepoRoot = git rev-parse --show-toplevel 2>$null

if (-not $RepoRoot) {
    Stop-P16 "NOT_IN_GIT_REPOSITORY"
}

$RepoRoot = $RepoRoot.Trim()
Set-Location $RepoRoot

$Branch = (git branch --show-current).Trim()
$Head = (git rev-parse HEAD).Trim()

if ($Branch -ne "phase/p16-staging-deployment") {
    Stop-P16 "WRONG_BRANCH"
}

$SqlPath = Join-Path $RepoRoot "scripts\p16-staging-catalog-bootstrap.sql"

if (-not (Test-Path $SqlPath -PathType Leaf)) {
    Stop-P16 "SQL_BOOTSTRAP_FILE_MISSING"
}

if ($Execute) {

    if (-not $env:P16_RELEASE_COMMIT) {
        Stop-P16 "P16_RELEASE_COMMIT_MISSING"
    }

    if ($env:P16_RELEASE_COMMIT -ne $Head) {
        Stop-P16 "P16_RELEASE_COMMIT_MISMATCH"
    }

    if (-not $env:P16_SSH_TARGET) {
        Stop-P16 "P16_SSH_TARGET_MISSING"
    }

if ($env:P16_SSH_TARGET -ne "u781802397@187.124.120.195") {
    Stop-P16 "P16_SSH_TARGET_INVALID"
}

    $SshPort = 0

    if (-not [int]::TryParse($env:P16_SSH_PORT, [ref]$SshPort)) {
        Stop-P16 "P16_SSH_PORT_INVALID"
    }

    if ($SshPort -ne 65002) {
    Stop-P16 "P16_SSH_PORT_INVALID"
}

    if ($env:P16_DB_HOST -ne "srv1527.hstgr.io") {
        Stop-P16 "P16_DB_HOST_INVALID"
    }

    if ($env:P16_DB_USER -notmatch '^[A-Za-z0-9_]+$') {
        Stop-P16 "P16_DB_USER_INVALID"
    }

    if ($env:P16_DB_NAME -notmatch '^[A-Za-z0-9_-]+$') {
        Stop-P16 "P16_DB_NAME_INVALID"
    }

    $DbTokens = $env:P16_DB_NAME.ToLowerInvariant() -split '[_-]'

    if (-not ($DbTokens -contains "stage" -or $DbTokens -contains "staging")) {
        Stop-P16 "DATABASE_NOT_UNAMBIGUOUS_STAGING"
    }

    if ($env:P16_DB_NAME -match '(?i)(dev(elopment)?|local|test|prod(uction)?|live)') {
        Stop-P16 "DATABASE_NOT_UNAMBIGUOUS_STAGING"
    }

    if ($env:P16_DB_CA_FILE -ne "/etc/pki/tls/certs/ca-bundle.crt") {
        Stop-P16 "P16_DB_CA_FILE_INVALID"
    }

    Write-Host "EXECUTION CONFIGURATION / PASS"
    Write-Host "RELEASE COMMIT BINDING / PASS"
    Write-Host "SSH CONFIGURATION / PASS"
    Write-Host "DATABASE TARGET / STAGING / PASS"
    Write-Host "DATABASE HOST / CANONICAL / PASS"
    Write-Host "CA PATH / CANONICAL / PASS"

    if (-not $AuthorizeCatalogWrite) {
        Stop-P16 "CATALOG_WRITE_AUTHORIZATION_REQUIRED"
    }

    $WorktreeState = @(
        & git status --porcelain=v1 2>$null
    )

    if ($LASTEXITCODE -ne 0) {
        Stop-P16 "GIT_STATUS_FAILED"
    }

    if ($WorktreeState.Count -ne 0) {
        Stop-P16 "WORKTREE_NOT_CLEAN"
    }

    Write-Host "WORKTREE / CLEAN / PASS"


    $RemoteBranchRef = "refs/heads/$Branch"


    $RemoteBranchOutput = @(

        & git ls-remote --heads origin $RemoteBranchRef 2>$null

    )


    if ($LASTEXITCODE -ne 0) {

        Stop-P16 "REMOTE_AUTHORITY_LOOKUP_FAILED"

    }


    if ($RemoteBranchOutput.Count -ne 1) {

        Stop-P16 "REMOTE_BRANCH_STATE_INVALID"

    }


    $RemoteHead = (

        ($RemoteBranchOutput[0] -split '\s+')[0]

    ).ToLowerInvariant()


    if ($RemoteHead -notmatch '^[0-9a-f]{40}$') {

        Stop-P16 "REMOTE_HEAD_INVALID"

    }


    if ($RemoteHead -ne $Head.ToLowerInvariant()) {

        Stop-P16 "REMOTE_BRANCH_NOT_AT_HEAD"

    }


    Write-Host "REMOTE BRANCH AUTHORITY / PASS"
    $SshCommand = Get-Command ssh -ErrorAction SilentlyContinue
    if (-not $SshCommand) {
        Stop-P16 "LOCAL_SSH_NOT_FOUND"
    }

    $ScpCommand = Get-Command scp -ErrorAction SilentlyContinue
    if (-not $ScpCommand) {
        Stop-P16 "LOCAL_SCP_NOT_FOUND"
    }

    $SqlTransportPath = Join-Path $PSScriptRoot "p16-staging-catalog-bootstrap.sql"

    if (-not (Test-Path -LiteralPath $SqlTransportPath -PathType Leaf)) {
        Stop-P16 "SQL_BOOTSTRAP_FILE_NOT_FOUND"
    }

    $LocalSqlHash = (
        Get-FileHash -LiteralPath $SqlTransportPath -Algorithm SHA256
    ).Hash.ToLowerInvariant()

    if ($LocalSqlHash -notmatch '^[0-9a-f]{64}$') {
        Stop-P16 "LOCAL_SQL_SHA256_INVALID"
    }

    $RemoteSqlPath = "/tmp/lessenc-p16-catalog-$([guid]::NewGuid().ToString('N')).sql"

    if ($RemoteSqlPath -notmatch '^/tmp/lessenc-p16-catalog-[0-9a-f]{32}\.sql$') {
        Stop-P16 "REMOTE_TEMP_PATH_INVALID"
    }

    Write-Host "LOCAL SSH / PRESENT / PASS"
    Write-Host "LOCAL SCP / PRESENT / PASS"
    Write-Host "LOCAL SQL SHA256 / VALID / PASS"
    Write-Host "REMOTE TEMP PATH / GENERATED / PASS"

    $RemoteDestination = "$($env:P16_SSH_TARGET):$RemoteSqlPath"
    $RemotePathMayExist = $false
    $ExecutionCompleted = $false

    try {

        $RemotePathMayExist = $true

        & $ScpCommand.Source `
            -q `
            -P $env:P16_SSH_PORT `
            -o ConnectTimeout=10 `
            -o StrictHostKeyChecking=yes `
            $SqlTransportPath `
            $RemoteDestination

        if ($LASTEXITCODE -ne 0) {
            Stop-P16 "SCP_UPLOAD_FAILED"
        }


        Write-Host "SQL TRANSPORT UPLOAD / PASS"

        $RemoteHashCommand = "chmod 600 '$RemoteSqlPath' && sha256sum '$RemoteSqlPath'"

        $RemoteHashOutput = @(
            & $SshCommand.Source `
                -p $env:P16_SSH_PORT `
                -o ConnectTimeout=10 `
                -o StrictHostKeyChecking=yes `
                $env:P16_SSH_TARGET `
                $RemoteHashCommand
        )

        $RemoteHashExit = $LASTEXITCODE

        if ($RemoteHashExit -ne 0) {
            Stop-P16 "REMOTE_HASH_COMMAND_FAILED"
        }

        $RemoteHashMatch = [regex]::Match(
            ($RemoteHashOutput -join "`n"),
            '(?im)^([0-9a-f]{64})\s+'
        )

        if (-not $RemoteHashMatch.Success) {
            Stop-P16 "REMOTE_SQL_SHA256_INVALID"
        }

        $RemoteSqlHash = $RemoteHashMatch.Groups[1].Value.ToLowerInvariant()

        if ($RemoteSqlHash -ne $LocalSqlHash) {
            Stop-P16 "SQL_SHA256_MISMATCH"
        }

        Write-Host "REMOTE SQL MODE / 600 / PASS"
        Write-Host "SQL SHA256 INTEGRITY / PASS"

        $RemoteDatabaseCommand = "mariadb --protocol=TCP --host='$($env:P16_DB_HOST)' --port=3306 --user='$($env:P16_DB_USER)' --password --database='$($env:P16_DB_NAME)' --ssl --ssl-ca='$($env:P16_DB_CA_FILE)' --ssl-verify-server-cert --connect-timeout=10 --batch --raw --skip-column-names < '$RemoteSqlPath'"

        $DatabaseSshArgs = @(
            "-tt"
            "-p"
            $env:P16_SSH_PORT
            "-o"
            "ConnectTimeout=10"
            "-o"
            "StrictHostKeyChecking=yes"
            $env:P16_SSH_TARGET
            $RemoteDatabaseCommand
        )

        Write-Host "DATABASE EXECUTION / START"

        & $SshCommand.Source @DatabaseSshArgs

        $DatabaseExit = $LASTEXITCODE

        if ($DatabaseExit -ne 0) {
            Stop-P16 "DATABASE_EXECUTION_FAILED"
        }

        Write-Host "DATABASE EXECUTION / PASS"
        Write-Host "DATABASE RESULT / STREAMED / NOT CAPTURED"

        $ExecutionCompleted = $true

    } finally {

        if ($RemotePathMayExist) {

            & $SshCommand.Source `
                -p $env:P16_SSH_PORT `
                -o ConnectTimeout=10 `
                -o StrictHostKeyChecking=yes `
                $env:P16_SSH_TARGET `
                "rm -f '$RemoteSqlPath'" |
                Out-Null

            $CleanupExit = $LASTEXITCODE

            if ($CleanupExit -ne 0) {
                throw "P16 CATALOG BOOTSTRAP / FAIL / REMOTE_TEMP_CLEANUP_FAILED"
            }

            Write-Host "REMOTE TEMP CLEANUP / PASS"
        }
    }
}

if ($Execute) {

    if (-not $ExecutionCompleted) {
        Stop-P16 "UNEXPECTED_EXECUTION_FALLTHROUGH"
    }

    Write-Host "============================================================"
    Write-Host "P16 CATALOG BOOTSTRAP OPERATOR / EXECUTION PASS"
    Write-Host "DATABASE EXECUTION / PASS"
    Write-Host "CATALOG RESULT / SEE MARIADB OUTPUT ABOVE"
    Write-Host "DEPLOY / NOT EXECUTED"
    Write-Host "============================================================"

    return
}

Write-Host "BRANCH / PASS"
Write-Host "HEAD / $Head"
Write-Host "SQL BOOTSTRAP FILE / PRESENT"
Write-Host "MODE / DRY RUN"
Write-Host "DATABASE CONNECTION / NOT ATTEMPTED"
Write-Host "DATABASE MUTATION / NONE"
Write-Host "DEPLOY / NOT EXECUTED"
Write-Host "============================================================"
Write-Host "P16 CATALOG BOOTSTRAP OPERATOR / DRY RUN PASS"
Write-Host "============================================================"
