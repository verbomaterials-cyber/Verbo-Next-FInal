$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$manifest = Join-Path $projectRoot '.local/toefl/form-1-audio.json'
$audioRoot = Join-Path $projectRoot 'public/audio/toefl-2026/form-1'
$scripts = Get-Content -LiteralPath $manifest -Raw -Encoding UTF8 | ConvertFrom-Json
New-Item -ItemType Directory -Force -Path $audioRoot | Out-Null
$voice = New-Object -ComObject SAPI.SpVoice
$english = [System.Collections.Generic.List[object]]::new()
foreach ($candidate in $voice.GetVoices()) {
    if ($candidate.GetDescription() -match 'English|David|Zira|Mark') { $english.Add($candidate) }
}
if ($english.Count -eq 0) { throw 'Se necesita una voz inglesa de Windows.' }
$voice.Rate = 0
foreach ($script in $scripts) {
    if ([string]$script.id -notmatch '^[a-z0-9-]+$') { throw 'Identificador de audio inválido.' }
    $destination = Join-Path $audioRoot ($script.id + '.wav')
    if ((Test-Path -LiteralPath $destination) -and (Get-Item -LiteralPath $destination).Length -gt 1000) { continue }
    $stream = New-Object -ComObject SAPI.SpFileStream
    try {
        $stream.Open($destination, 3, $false)
        $voice.AudioOutputStream = $stream
        foreach ($turn in $script.turns) {
            $voice.Voice = $english[([int]$turn.voice % $english.Count)]
            [void]$voice.Speak([string]$turn.text, 0)
        }
    } finally { $stream.Close() }
}
Write-Output ('Audios disponibles: ' + $scripts.Count + '; voces inglesas: ' + $english.Count)
