$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$contentPath = Join-Path $projectRoot 'content/toefl-2026/diagnostic.json'
$audioRoot = Join-Path $projectRoot 'public/audio/toefl-2026'
$questions = (Get-Content -LiteralPath $contentPath -Raw -Encoding UTF8 | ConvertFrom-Json).questions
New-Item -ItemType Directory -Force -Path $audioRoot | Out-Null
$voice = New-Object -ComObject SAPI.SpVoice
$englishVoice = $null
foreach ($candidate in $voice.GetVoices()) {
    if ($candidate.GetDescription() -match 'English|David|Zira|Mark') { $englishVoice = $candidate; break }
}
if ($null -eq $englishVoice) { throw 'No se encontró una voz inglesa de Windows para generar los audios.' }
$voice.Voice = $englishVoice
$voice.Rate = 0
foreach ($question in $questions) {
    if (!$question.prompt.audioUrl -or !$question.prompt.transcript) { continue }
    $filename = [System.IO.Path]::GetFileName([string]$question.prompt.audioUrl)
    $destination = Join-Path $audioRoot $filename
    $stream = New-Object -ComObject SAPI.SpFileStream
    try {
        $stream.Open($destination, 3, $false)
        $voice.AudioOutputStream = $stream
        [void]$voice.Speak([string]$question.prompt.transcript, 0)
    } finally { $stream.Close() }
    Write-Output ('Generado: ' + $filename)
}
