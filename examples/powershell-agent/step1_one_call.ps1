<#
Step 1 - One call. No loop, no tools, no agent.

    $env:ANTHROPIC_API_KEY = 'sk-ant-...'
    .\step1_one_call.ps1
#>

$ApiUrl = 'https://api.anthropic.com/v1/messages'
$Model  = 'claude-haiku-4-5'

# Windows PowerShell 5.1 negotiates TLS 1.0 by default; the API refuses it.
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12


function Invoke-Claude {
    param([Parameter(Mandatory)] $Messages)

    if (-not $env:ANTHROPIC_API_KEY) { throw 'Set ANTHROPIC_API_KEY first.' }

    $payload = @{
        model      = $Model
        max_tokens = 16000
        messages   = $Messages
    }

    # UTF8 bytes rather than the string: PowerShell would otherwise send it as
    # ISO-8859-1 and mangle anything non-ASCII.
    $body = [Text.Encoding]::UTF8.GetBytes(($payload | ConvertTo-Json -Depth 100))

    $headers = @{
        'x-api-key'         = $env:ANTHROPIC_API_KEY
        'anthropic-version' = '2023-06-01'
    }

    try {
        # Not Invoke-RestMethod: the API sends no charset in its content type, and
        # PowerShell 5.1 then decodes the body as ISO-8859-1 - turning every degree
        # sign, em dash and accent into mojibake. Decode the bytes ourselves.
        $raw = Invoke-WebRequest -Uri $ApiUrl -Method Post -Body $body -Headers $headers -ContentType 'application/json' -UseBasicParsing
        [Text.Encoding]::UTF8.GetString($raw.RawContentStream.ToArray()) | ConvertFrom-Json
    }
    catch {
        # The API explains itself in the response body, which 5.1 buries here.
        $detail = $_.ErrorDetails.Message
        if (-not $detail) { $detail = $_.Exception.Message }
        throw "API error: $detail"
    }
}


# --- main ------------------------------------------------------------------

# Any local text will do; a real error off this machine beats a toy prompt.
$evt  = Get-WinEvent -FilterHashtable @{ LogName = 'System'; Level = 2 } -MaxEvents 1 -ErrorAction SilentlyContinue
$text = if ($evt) { $evt.Message } else { 'The service did not respond in a timely fashion.' }

$response = Invoke-Claude -Messages @(
    @{ role = 'user'; content = "In a few sentences, explain this error: $text" }
)

# The response is a list of content blocks, not a string. Even with one block
# of one type, you go and get it.
($response.content | Where-Object { $_.type -eq 'text' }).text

"`n[in $($response.usage.input_tokens) / out $($response.usage.output_tokens) tokens]"
