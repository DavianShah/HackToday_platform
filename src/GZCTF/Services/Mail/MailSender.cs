using System.Collections.Concurrent;
using System.Net.Security;
using System.Text;
using GZCTF.Models.Internal;
using MailKit.Net.Smtp;
using Microsoft.Extensions.Localization;
using Microsoft.Extensions.Options;
using MimeKit;
using MimeKit.Text;

namespace GZCTF.Services.Mail;

public sealed class MailSender : IMailSender, IDisposable
{
    private readonly CancellationToken _cancellationToken;
    private readonly CancellationTokenSource _cancellationTokenSource = new();
    private readonly ILogger<MailSender> _logger;
    private readonly ConcurrentQueue<MailContent> _mailQueue = new();
    private readonly EmailConfig? _options;
    private readonly AsyncManualResetEvent _resetEvent = new();
    private readonly SmtpClient? _smtpClient;
    private bool _disposed;

    public MailSender(
        IOptions<AccountPolicy> accountPolicy,
        IOptions<EmailConfig> options,
        ILogger<MailSender> logger)
    {
        _logger = logger;
        _options = options.Value;
        _cancellationToken = _cancellationTokenSource.Token;

        if (string.IsNullOrWhiteSpace(_options.SenderAddress) ||
            string.IsNullOrWhiteSpace(_options.Smtp?.Host) || _options.Smtp.Port <= 0)
            return;

        _smtpClient = new();
        _smtpClient.AuthenticationMechanisms.Remove("XOAUTH2");

        if (!OperatingSystem.IsWindows())
            // Some systems may not enable old (non-recommend) ciphers in TLS configuration and lead to failures when
            // connecting to some SMTP servers, override the default policy to include all ciphers except MD5, SHA1, and NULL
            _smtpClient.SslCipherSuitesPolicy = new CipherSuitesPolicy(Enum.GetValues<TlsCipherSuite>()
                .Where(cipher =>
                {
                    var cipherName = cipher.ToString();
                    // Exclude MD5, SHA1, and NULL ciphers for security reasons
                    return !cipherName.EndsWith("MD5") && !cipherName.EndsWith("SHA") &&
                           !cipherName.EndsWith("NULL");
                }));

        _smtpClient.ServerCertificateValidationCallback = (_, _, _, errors)
            => errors is SslPolicyErrors.None || options.Value.Smtp?.BypassCertVerify is true;

        if (!TestSmtpClient())
        {
            if (accountPolicy.Value.EmailConfirmationRequired)
                ExitWithFatalMessage(StaticLocalizer[nameof(Resources.Program.MailSender_InvalidEmailConfig)]);

            _smtpClient.Dispose();
            _smtpClient = null;
            return;
        }

        _logger.SystemLog(StaticLocalizer[nameof(Resources.Program.MailSender_ConnectedToSmtp),
            $"{_options.Smtp.Host}:{_options.Smtp.Port}"], TaskStatus.Success, LogLevel.Debug);

        Task.Factory.StartNew(MailSenderWorker, _cancellationToken, TaskCreationOptions.LongRunning,
            TaskScheduler.Default);
    }

    public void Dispose()
    {
        if (_disposed)
            return;

        _disposed = true;
        _cancellationTokenSource.Cancel();
        _smtpClient?.Dispose();
        GC.SuppressFinalize(this);
    }

    public async Task SendMailContent(MailContent content)
    {
        // TODO: use GlobalConfig.DefaultEmailTemplate
        // TODO: use a string formatter library
        // TODO: update default template with new names
        var emailContent = new StringBuilder(content.Template)
            .Replace("{title}", content.Title)
            .Replace("{information}", content.Information)
            .Replace("{btnmsg}", content.ButtonMessage)
            .Replace("{email}", content.Email)
            .Replace("{userName}", content.UserName)
            .Replace("{url}", content.Url)
            .Replace("{nowtime}", content.Time)
            .Replace("{platform}", content.Platform)
            .Replace("{platformHtml}", content.PlatformHtml)
            .Replace("{teamNameHtml}", content.TeamNameHtml)
            .Replace("{emailHtml}", content.EmailHtml)
            .Replace("{urlHtml}", content.UrlHtml)
            .Replace("{gamesHtml}", content.GamesHtml)
            .Replace("{expiresHtml}", content.ExpiresHtml)
            .ToString();

        var title = content.Type == MailType.CaptainOnboarding
            ? content.Title
            : $"{content.Title} - {content.Platform}";

        var sender = string.IsNullOrWhiteSpace(_options!.SenderName) ? content.Platform : _options.SenderName;

        // SenderAddress is checked in constructor, so it won't be null here
        var from = new MailboxAddress(sender, _options.SenderAddress!);

        var to = new MailboxAddress(content.UserName, content.Email);

        if (!await SendEmailAsync(title, emailContent, from, to))
            _logger.SystemLog(StaticLocalizer[nameof(Resources.Program.MailSender_MailSendFailed)],
                TaskStatus.Failed);
    }

    public bool SendConfirmEmailUrl(string? userName, string? email, string? confirmLink,
        IStringLocalizer<Program> localizer, IOptionsSnapshot<GlobalConfig> options) =>
        EnqueueMailTask(userName, email, confirmLink, MailType.ConfirmEmail, localizer, options);

    public bool SendChangeEmailUrl(string? userName, string? email, string? resetLink,
        IStringLocalizer<Program> localizer, IOptionsSnapshot<GlobalConfig> options) =>
        EnqueueMailTask(userName, email, resetLink, MailType.ChangeEmail, localizer, options);

    public bool SendResetPasswordUrl(string? userName, string? email, string? resetLink,
        IStringLocalizer<Program> localizer, IOptionsSnapshot<GlobalConfig> options) =>
        EnqueueMailTask(userName, email, resetLink, MailType.ResetPassword, localizer, options);

    public bool SendCaptainOnboardingUrl(string? teamName, string? email, string? onboardingLink,
        IReadOnlyCollection<string> gameTitles, DateTimeOffset expiresAtUtc,
        IStringLocalizer<Program> localizer, IOptionsSnapshot<GlobalConfig> options) =>
        EnqueueMailTask(teamName, email, onboardingLink, MailType.CaptainOnboarding, localizer, options,
            gameTitles, expiresAtUtc);

    private async Task<bool> SendEmailAsync(string subject, string content, MailboxAddress from, MailboxAddress to)
    {
        if (_smtpClient is null)
            return false;

        using var msg = new MimeMessage();
        msg.From.Add(from);
        msg.To.Add(to);
        msg.Subject = subject;
        msg.Body = new TextPart(TextFormat.Html) { Text = content };

        try
        {
            await _smtpClient.SendAsync(msg, _cancellationToken);

            _logger.SystemLog(StaticLocalizer[nameof(Resources.Program.MailSender_SendMail), to],
                TaskStatus.Success, LogLevel.Information);
            return true;
        }
        catch (Exception e)
        {
            _logger.LogErrorMessage(e, StaticLocalizer[nameof(Resources.Program.MailSender_MailSendFailed)]);
            return false;
        }
    }

    private async Task MailSenderWorker()
    {
        if (_smtpClient is null)
            return;

        while (!_cancellationToken.IsCancellationRequested)
        {
            await _resetEvent.WaitAsync(_cancellationToken);
            _resetEvent.Reset();

            try
            {
                if (!_smtpClient.IsConnected)
                    await _smtpClient.ConnectAsync(_options!.Smtp!.Host, _options.Smtp.Port,
                        cancellationToken: _cancellationToken);

                if (!_smtpClient.IsAuthenticated)
                    await _smtpClient.AuthenticateAsync(_options!.UserName, _options.Password,
                        _cancellationToken);

                while (_mailQueue.TryDequeue(out var content))
                    await SendMailContent(content);
            }
            catch (Exception e)
            {
                // Failed to establish SMTP connection, clear the queue
                _mailQueue.Clear();

                _logger.LogErrorMessage(e, StaticLocalizer[nameof(Resources.Program.MailSender_MailSendFailed)]);
            }
            finally
            {
                await _smtpClient.DisconnectAsync(true, _cancellationToken);
            }
        }
    }

    private bool EnqueueMailTask(string? userName, string? email, string? resetLink, MailType type,
        IStringLocalizer<Program> localizer, IOptionsSnapshot<GlobalConfig> options,
        IReadOnlyCollection<string>? gameTitles = null, DateTimeOffset? expiresAtUtc = null)
    {
        if (_smtpClient is null)
            return false;

        if (string.IsNullOrEmpty(userName) || string.IsNullOrEmpty(email) || string.IsNullOrEmpty(resetLink))
        {
            _logger.SystemLog(StaticLocalizer[nameof(Resources.Program.MailSender_InvalidRequest)],
                TaskStatus.Failed);
            return false;
        }

        var content = new MailContent(userName, email, resetLink, type, localizer, options,
            gameTitles, expiresAtUtc);

        _mailQueue.Enqueue(content);
        _resetEvent.Set();

        return true;
    }

    private bool TestSmtpClient(CancellationToken token = default)
    {
        if (_smtpClient is null)
            return false;

        try
        {
            _smtpClient.Connect(_options!.Smtp!.Host, _options.Smtp.Port, cancellationToken: token);
            _smtpClient.Authenticate(_options.UserName, _options.Password, token);
            _smtpClient.Disconnect(true, token);
            return true;
        }
        catch (Exception e)
        {
            _logger.LogDebug(e, "{msg}",
                StaticLocalizer[nameof(Resources.Program.MailSender_MailSendFailed)]);
            return false;
        }
    }

    ~MailSender()
    {
        Dispose();
    }
}

/// <summary>
/// 邮件类型
/// </summary>
public enum MailType
{
    ConfirmEmail,
    ChangeEmail,
    ResetPassword,
    CaptainOnboarding
}

/// <summary>
/// 邮件内容
/// </summary>
public class MailContent(
    string userName,
    string email,
    string resetLink,
    MailType type,
    // DO NOT use IStringLocalizer<Program> after construction
    IStringLocalizer<Program> localizer,
    IOptionsSnapshot<GlobalConfig> globalConfig,
    IReadOnlyCollection<string>? gameTitles = null,
    DateTimeOffset? expiresAtUtc = null)
{
    private const string CaptainOnboardingTemplate =
        """
        <!doctype html>
        <html lang="id">
        <body style="margin:0;padding:0;background-color:#F4F4FF;font-family:Arial,Helvetica,sans-serif;color:#201D70;">
          <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
            Aktivasi akun captain tim untuk HackToday 2026.
          </div>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
                 style="width:100%;background-color:#F4F4FF;">
            <tr>
              <td align="center" style="padding:40px 12px;">
                <table role="presentation" width="620" cellspacing="0" cellpadding="0" border="0"
                       style="width:100%;max-width:620px;background-color:#ffffff;border:1px solid #d9d8f4;border-radius:18px;overflow:hidden;">
                  <tr>
                    <td height="6" style="height:6px;background-color:#635FC9;font-size:0;line-height:0;">&nbsp;</td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:32px 28px 20px;text-align:center;">
                      <p style="margin:0 0 14px;color:#635FC9;font-size:12px;font-weight:700;line-height:18px;letter-spacing:2px;text-transform:uppercase;">
                        HackToday 2026 &bull; Captain Onboarding
                      </p>
                      <h1 style="margin:0 0 10px;color:#201D70;font-size:30px;line-height:38px;font-weight:700;">
                        Selamat datang, Captain.
                      </h1>
                      <p style="margin:0;color:#201D70;font-size:15px;line-height:24px;">
                        Tim kamu telah terdaftar. Aktifkan akun captain untuk menyiapkan akses kompetisi HackToday 2026.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 28px 12px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
                             style="width:100%;background-color:#F4F4FF;border:1px solid #d9d8f4;border-radius:12px;">
                        <tr>
                          <td style="padding:20px 22px;">
                            <p style="margin:0;color:#635FC9;font-size:11px;font-weight:700;line-height:17px;letter-spacing:1.4px;text-transform:uppercase;">Nama tim</p>
                            <p style="margin:4px 0 0;color:#201D70;font-size:22px;font-weight:700;line-height:30px;">{teamNameHtml}</p>
                            <p style="margin:7px 0 0;color:#201D70;font-size:13px;line-height:20px;">Captain: {emailHtml}</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:10px 28px 4px;">
                      <p style="margin:0 0 10px;color:#635FC9;font-size:11px;font-weight:700;line-height:17px;letter-spacing:1.4px;text-transform:uppercase;">
                        Akses kompetisi
                      </p>
                      <div style="line-height:28px;">{gamesHtml}</div>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:24px 28px 14px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td align="center" bgcolor="#635FC9" style="background-color:#635FC9;border-radius:9px;">
                            <a href="{urlHtml}"
                               style="display:block;padding:15px 20px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;line-height:20px;letter-spacing:.5px;">
                              AKTIVASI AKUN CAPTAIN
                            </a>
                          </td>
                        </tr>
                      </table>
                      <p style="margin:13px 0 0;color:#201D70;font-size:12px;line-height:19px;">
                        Link aktivasi berlaku sampai <strong>{expiresHtml}</strong> dan hanya dapat digunakan satu kali.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px 28px 28px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
                             style="width:100%;border-top:1px solid #d9d8f4;">
                        <tr>
                          <td align="center" style="padding:22px 0 0;">
                            <p style="margin:0 0 14px;color:#201D70;font-size:13px;line-height:21px;">
                              Bergabunglah ke Discord untuk informasi teknis, pengumuman, dan komunikasi selama kompetisi.
                            </p>
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                              <tr>
                                <td align="center" style="border:1px solid #635FC9;border-radius:9px;">
                                  <a href="https://discord.gg/UYMjSBgB8"
                                     style="display:block;padding:13px 20px;color:#635FC9;text-decoration:none;font-size:14px;font-weight:700;line-height:20px;letter-spacing:.5px;">
                                    JOIN DISCORD
                                  </a>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" bgcolor="#201D70" style="padding:20px 28px;background-color:#201D70;">
                      <p style="margin:0;color:#F4F4FF;font-size:11px;line-height:18px;">
                        Dikirim oleh {platformHtml} &bull; HackToday 2026
                      </p>
                      <p style="margin:5px 0 0;color:#F4F4FF;font-size:11px;line-height:18px;">
                        Jika kamu tidak merasa mendaftarkan tim ini, abaikan email dan hubungi panitia.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
        """;

    /// <summary>
    /// 邮件模板
    /// </summary>
    public MailType Type { get; } = type;

    public string Template { get; } = type == MailType.CaptainOnboarding
        ? CaptainOnboardingTemplate
        : localizer[nameof(Resources.Program.MailSender_Template)];

    /// <summary>
    /// 邮件标题
    /// </summary>
    public string Title { get; } = type switch
    {
        MailType.ConfirmEmail => localizer[nameof(Resources.Program.MailSender_VerifyEmailTitle)],
        MailType.ChangeEmail => localizer[nameof(Resources.Program.MailSender_ChangeEmailTitle)],
        MailType.ResetPassword => localizer[nameof(Resources.Program.MailSender_ResetPasswordTitle)],
        MailType.CaptainOnboarding =>
            $"HackToday 2026 - Aktivasi Captain Tim {userName.Replace('\r', ' ').Replace('\n', ' ')}",
        _ => throw new ArgumentOutOfRangeException(nameof(type), type, null)
    };

    /// <summary>
    /// 邮件信息
    /// </summary>
    public string Information { get; } = type switch
    {
        MailType.ConfirmEmail => localizer[nameof(Resources.Program.MailSender_VerifyEmailContent), email],
        MailType.ChangeEmail => localizer[nameof(Resources.Program.MailSender_ChangeEmailContent)],
        MailType.ResetPassword => localizer[nameof(Resources.Program.MailSender_ResetPasswordContent)],
        MailType.CaptainOnboarding =>
            $"Your paid team registration for <strong>{System.Net.WebUtility.HtmlEncode(userName)}</strong> is ready. Use the secure link below to create the captain account.",
        _ => throw new ArgumentOutOfRangeException(nameof(type), type, null)
    };

    /// <summary>
    /// 邮件按钮显示内容
    /// </summary>
    public string ButtonMessage { get; } = type switch
    {
        MailType.ConfirmEmail => localizer[nameof(Resources.Program.MailSender_VerifyEmailButton)],
        MailType.ChangeEmail => localizer[nameof(Resources.Program.MailSender_ChangeEmailButton)],
        MailType.ResetPassword => localizer[nameof(Resources.Program.MailSender_ResetPasswordButton)],
        MailType.CaptainOnboarding => "Create Captain Account",
        _ => throw new ArgumentOutOfRangeException(nameof(type), type, null)
    };

    /// <summary>
    /// 用户名
    /// </summary>
    public string UserName { get; } = userName;

    /// <summary>
    /// 用户邮箱
    /// </summary>
    public string Email { get; } = email;

    /// <summary>
    /// 邮件链接
    /// </summary>
    public string Url { get; } = resetLink;

    /// <summary>
    /// 发信时间
    /// </summary>
    public string Time { get; } = DateTimeOffset.UtcNow.ToString("u");

    /// <summary>
    /// 平台名称
    /// </summary>
    public string Platform { get; } = globalConfig.Value.Platform;

    public string PlatformHtml { get; } =
        System.Net.WebUtility.HtmlEncode(globalConfig.Value.Platform);

    public string TeamNameHtml { get; } = System.Net.WebUtility.HtmlEncode(userName);

    public string EmailHtml { get; } = System.Net.WebUtility.HtmlEncode(email);

    public string UrlHtml { get; } = System.Net.WebUtility.HtmlEncode(resetLink);

    public string GamesHtml { get; } = gameTitles is { Count: > 0 }
        ? string.Join(" ", gameTitles.Select(title =>
            $"<span style=\"display:inline-block;margin:0 6px 8px 0;padding:7px 11px;border-radius:999px;" +
            "background:#F4F4FF;border:1px solid #635FC9;color:#201D70;font-size:12px;font-weight:700;\">" +
            $"{System.Net.WebUtility.HtmlEncode(title)}</span>"))
        : "<span style=\"color:#201D70;font-size:13px;\">Akses kompetisi HackToday 2026</span>";

    public string ExpiresHtml { get; } = expiresAtUtc.HasValue
        ? expiresAtUtc.Value.ToOffset(TimeSpan.FromHours(7)).ToString("dd MMM yyyy HH:mm 'WIB'")
        : "-";
}
