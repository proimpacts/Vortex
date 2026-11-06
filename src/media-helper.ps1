# Reads and controls the music that is playing on this PC, through Windows' own media controls (the ones behind the volume flyout).
# It is started by the Vortex launcher and talks over stdin/stdout, one JSON object per line. Nothing here touches the network.
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.IRandomAccessStreamReference, Windows.Storage.Streams, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage.Streams, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.IRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.IContentTypeProvider, Windows.Storage.Streams, ContentType = WindowsRuntime]
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await($op, $type) { $t = $asTask.MakeGenericMethod($type).Invoke($null, @($op)); $t.Wait(8000) | Out-Null; return $t.Result }

$mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])

function Pick($filter) {
  $all = @($mgr.GetSessions())
  if ($filter -eq 'any') {
    $cur = $mgr.GetCurrentSession(); if ($cur) { return $cur }
    return ($all | Select-Object -First 1)
  }
  $sp = @($all | Where-Object { $_.SourceAppUserModelId -match 'spotify' })
  if ($sp.Count -gt 0) { return $sp[0] }
  return $null
}

$lastKey = ''
function State($req) {
  $s = Pick $req.filter
  if (-not $s) { return @{ ok = $true; none = $true } }
  $props = Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
  $pb = $s.GetPlaybackInfo(); $tl = $s.GetTimelineProperties()
  $key = '{0}|{1}|{2}' -f $props.Title, $props.Artist, $props.AlbumTitle
  $r = @{
    ok = $true; none = $false; app = $s.SourceAppUserModelId; key = $key
    title = [string]$props.Title; artist = [string]$props.Artist; album = [string]$props.AlbumTitle
    status = [string]$pb.PlaybackStatus
    position = [math]::Round($tl.Position.TotalSeconds, 2); start = [math]::Round($tl.StartTime.TotalSeconds, 2); end = [math]::Round($tl.EndTime.TotalSeconds, 2)
    sinceUpdate = [math]::Round(([DateTimeOffset]::Now - $tl.LastUpdatedTime).TotalSeconds, 2)
    shuffle = $(if ($pb.IsShuffleActive -ne $null) { [bool]$pb.IsShuffleActive } else { $null })
    repeat = $(if ($pb.AutoRepeatMode -ne $null) { [string]$pb.AutoRepeatMode } else { $null })
    can = @{ play = [bool]$pb.Controls.IsPlayEnabled; pause = [bool]$pb.Controls.IsPauseEnabled; next = [bool]$pb.Controls.IsNextEnabled; prev = [bool]$pb.Controls.IsPreviousEnabled; seek = [bool]$pb.Controls.IsPlaybackPositionEnabled; shuffle = [bool]$pb.Controls.IsShuffleEnabled; repeat = [bool]$pb.Controls.IsRepeatEnabled }
  }
  if (($req.art -eq $true) -or $key -ne $lastKey) {
    $lastKey = $key
    try {
      if ($props.Thumbnail) {
        $stream = Await ($props.Thumbnail.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
        # The stream comes back as an untyped COM object, so its size and type are read through reflection.
        $size = [uint32][Windows.Storage.Streams.IRandomAccessStream].GetProperty('Size').GetValue($stream)
        $ctype = [string][Windows.Storage.Streams.IContentTypeProvider].GetProperty('ContentType').GetValue($stream)
        if ($size -gt 0 -and $size -lt 3000000) {
          $reader = [Activator]::CreateInstance([Windows.Storage.Streams.DataReader], @(, $stream))
          $null = Await ($reader.LoadAsync($size)) ([uint32])
          $bytes = New-Object byte[] $size
          $reader.ReadBytes($bytes)
          $r.art = 'data:' + $(if ($ctype) { $ctype } else { 'image/jpeg' }) + ';base64,' + [Convert]::ToBase64String($bytes)
        }
      }
    } catch { $r.artError = [string]$_.Exception.Message }
  }
  return $r
}

function Act($req) {
  $s = Pick $req.filter
  if (-not $s) { return @{ ok = $false; error = 'nothing is playing' } }
  $ok = $false
  switch ($req.op) {
    'play'    { $ok = Await ($s.TryPlayAsync()) ([bool]) }
    'pause'   { $ok = Await ($s.TryPauseAsync()) ([bool]) }
    'toggle'  { $ok = Await ($s.TryTogglePlayPauseAsync()) ([bool]) }
    'next'    { $ok = Await ($s.TrySkipNextAsync()) ([bool]) }
    'prev'    { $ok = Await ($s.TrySkipPreviousAsync()) ([bool]) }
    'seek'    { $ok = Await ($s.TryChangePlaybackPositionAsync([long]([double]$req.value * 10000000))) ([bool]) }
    'shuffle' { $ok = Await ($s.TryChangeShuffleActiveAsync([bool]$req.value)) ([bool]) }
    'repeat'  { $mode = [Windows.Media.MediaPlaybackAutoRepeatMode]::None; if ($req.value -eq 'track') { $mode = [Windows.Media.MediaPlaybackAutoRepeatMode]::Track } elseif ($req.value -eq 'list') { $mode = [Windows.Media.MediaPlaybackAutoRepeatMode]::List }; $ok = Await ($s.TryChangeAutoRepeatModeAsync($mode)) ([bool]) }
    default   { return @{ ok = $false; error = 'unknown action' } }
  }
  return @{ ok = [bool]$ok }
}

[Console]::Out.WriteLine('{"ready":true}'); [Console]::Out.Flush()
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  $id = 0
  try {
    $req = $line | ConvertFrom-Json; $id = $req.id
    $res = if ($req.op -eq 'state') { State $req } else { Act $req }
  } catch { $res = @{ ok = $false; error = ([string]$_.Exception.Message) } }
  $res.id = $id
  [Console]::Out.WriteLine(($res | ConvertTo-Json -Compress -Depth 5)); [Console]::Out.Flush()
}
