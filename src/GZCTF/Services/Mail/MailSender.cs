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
    private const string CaptainOnboardingLogoContentId = "hacktoday-logo@hacktoday.web.id";
    private const string CaptainOnboardingLogoResourceName = "GZCTF.Resources.HackTodayLogo.png";
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

        if (!await SendEmailAsync(title, emailContent, from, to, content.Type == MailType.CaptainOnboarding))
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

    private async Task<bool> SendEmailAsync(string subject, string content, MailboxAddress from, MailboxAddress to,
        bool includeCaptainOnboardingLogo)
    {
        if (_smtpClient is null)
            return false;

        using var msg = new MimeMessage();
        msg.From.Add(from);
        msg.To.Add(to);
        msg.Subject = subject;

        try
        {
            if (includeCaptainOnboardingLogo)
            {
                await using var logoStream = typeof(MailSender).Assembly
                    .GetManifestResourceStream(CaptainOnboardingLogoResourceName);

                if (logoStream is null)
                    throw new InvalidOperationException("The embedded HackToday email logo was not found.");

                using var logoBuffer = new MemoryStream();
                await logoStream.CopyToAsync(logoBuffer, _cancellationToken);

                var bodyBuilder = new BodyBuilder { HtmlBody = content };
                var logo = bodyBuilder.LinkedResources.Add("hacktoday-logo.png", logoBuffer.ToArray());
                logo.ContentId = CaptainOnboardingLogoContentId;
                msg.Body = bodyBuilder.ToMessageBody();
            }
            else
            {
                msg.Body = new TextPart(TextFormat.Html) { Text = content };
            }

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
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <meta name="x-apple-disable-message-reformatting">
          <title>HackToday IT TODAY 2026</title>
          <style>
            @media only screen and (max-width:640px) {
              .email-shell { width:100% !important; }
              .mobile-pad { padding-left:20px !important; padding-right:20px !important; }
              .hero-title { font-size:30px !important; line-height:38px !important; }
              .step-number { width:48px !important; }
            }
          </style>
        </head>
        <body style="margin:0;padding:0;background-color:#F4F4FF;font-family:Arial,Helvetica,sans-serif;color:#171631;">
          <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">
            Kredensial dan akses tim CTF HackToday IT TODAY 2026 siap digunakan.
          </div>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#F4F4FF"
                 style="width:100%;background-color:#F4F4FF;">
            <tr>
              <td align="center" style="padding:32px 12px;">
                <!--[if mso]><table role="presentation" width="620" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
                <table role="presentation" width="620" cellspacing="0" cellpadding="0" border="0" class="email-shell"
                       style="width:100%;max-width:620px;background-color:#ffffff;border:1px solid #dcdaf6;border-radius:20px;overflow:hidden;box-shadow:0 12px 36px rgba(32,29,112,.10);">
                  <tr>
                    <td height="6" bgcolor="#635FC9" style="height:6px;background-color:#635FC9;font-size:0;line-height:0;">&nbsp;</td>
                  </tr>
                  <tr>
                    <td align="center" bgcolor="#201D70" class="mobile-pad"
                        style="padding:38px 44px 42px;background-color:#201D70;text-align:center;">
                      <img src="cid:hacktoday-logo@hacktoday.web.id" width="88" height="88" alt="Logo HackToday"
                           style="display:block;width:88px;height:88px;margin:0 auto 20px;border:0;outline:none;text-decoration:none;">
                      <p style="margin:0 0 12px;color:#d9d8ff;font-size:12px;font-weight:700;line-height:18px;letter-spacing:2.2px;text-transform:uppercase;">
                        HackToday IT TODAY 2026
                      </p>
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto 20px;">
                        <tr>
                          <td bgcolor="#635FC9" style="padding:7px 13px;background-color:#635FC9;border:1px solid #7d79dd;border-radius:999px;">
                            <span style="color:#ffffff;font-size:10px;font-weight:700;line-height:14px;letter-spacing:1.6px;text-transform:uppercase;">CTF Team Access</span>
                          </td>
                        </tr>
                      </table>
                      <h1 class="hero-title" style="margin:0;color:#ffffff;font-size:36px;line-height:44px;font-weight:700;letter-spacing:-.5px;">
                        Tim kamu sudah siap untuk berkompetisi.
                      </h1>
                      <p style="margin:16px 0 0;color:#d9d8ff;font-size:15px;line-height:24px;">
                        Akses resmi menuju arena CTF HackToday telah disiapkan untuk tim kamu.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td class="mobile-pad" style="padding:38px 44px 10px;">
                      <p style="margin:0 0 10px;color:#201D70;font-size:19px;font-weight:700;line-height:28px;">
                        Halo, Peserta HackToday IT TODAY 2026!
                      </p>
                      <p style="margin:0;color:#4c4a68;font-size:15px;line-height:25px;">
                        Tim kamu telah disiapkan oleh panitia di platform CTF. Aktifkan akun captain untuk membuat tim dan mendapatkan kode bergabung yang dapat digunakan oleh seluruh anggota.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td class="mobile-pad" style="padding:30px 44px 12px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td style="padding:0 0 12px;">
                            <span style="color:#635FC9;font-size:11px;font-weight:700;line-height:16px;letter-spacing:1.7px;text-transform:uppercase;">Kredensial Tim</span>
                          </td>
                          <td align="right" style="padding:0 0 12px;">
                            <span style="color:#7774a3;font-size:11px;line-height:16px;">Akses resmi</span>
                          </td>
                        </tr>
                      </table>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#F4F4FF"
                             style="width:100%;background-color:#F4F4FF;border:1px solid #d9d8f4;border-radius:14px;">
                        <tr>
                          <td style="padding:23px 24px 18px;">
                            <p style="margin:0;color:#635FC9;font-size:10px;font-weight:700;line-height:15px;letter-spacing:1.4px;text-transform:uppercase;">Nama Tim</p>
                            <p style="margin:5px 0 0;color:#201D70;font-size:23px;font-weight:700;line-height:31px;">{teamNameHtml}</p>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:0 24px;">
                            <div style="height:1px;background-color:#d9d8f4;font-size:0;line-height:0;">&nbsp;</div>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:17px 24px;">
                            <p style="margin:0 0 4px;color:#635FC9;font-size:10px;font-weight:700;line-height:15px;letter-spacing:1.3px;text-transform:uppercase;">Email Captain</p>
                            <p style="margin:0;color:#201D70;font-size:14px;font-weight:700;line-height:22px;word-break:break-word;">{emailHtml}</p>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:0 24px;">
                            <div style="height:1px;background-color:#d9d8f4;font-size:0;line-height:0;">&nbsp;</div>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:17px 24px 8px;">
                            <p style="margin:0 0 4px;color:#635FC9;font-size:10px;font-weight:700;line-height:15px;letter-spacing:1.3px;text-transform:uppercase;">Kode Tim</p>
                            <p style="margin:0;color:#201D70;font-size:14px;font-weight:700;line-height:22px;">Diterbitkan setelah aktivasi captain</p>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:8px 24px 23px;">
                            <p style="margin:0 0 4px;color:#635FC9;font-size:10px;font-weight:700;line-height:15px;letter-spacing:1.3px;text-transform:uppercase;">Password Tim</p>
                            <p style="margin:0;color:#4c4a68;font-size:13px;line-height:21px;">Tidak digunakan. Setiap peserta membuat password akun masing-masing.</p>
                          </td>
                        </tr>
                      </table>
                      <p style="margin:14px 0 8px;color:#7774a3;font-size:11px;font-weight:700;line-height:17px;letter-spacing:1.3px;text-transform:uppercase;">Kompetisi yang ditugaskan</p>
                      <div style="line-height:28px;">{gamesHtml}</div>
                    </td>
                  </tr>
                  <tr>
                    <td class="mobile-pad" style="padding:22px 44px 34px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#171546"
                             style="width:100%;background-color:#171546;border-radius:14px;">
                        <tr>
                          <td align="center" style="padding:24px 24px 9px;text-align:center;">
                            <p style="margin:0 0 4px;color:#ffffff;font-size:16px;font-weight:700;line-height:24px;">Platform CTF</p>
                            <a href="https://ctf.hacktoday.web.id/" style="color:#b9b6ff;font-size:13px;line-height:20px;text-decoration:none;">https://ctf.hacktoday.web.id/</a>
                          </td>
                        </tr>
                        <tr>
                          <td align="center" style="padding:10px 24px 14px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                              <tr>
                                <td align="center" bgcolor="#635FC9" style="background-color:#635FC9;border-radius:9px;">
                                  <a href="{urlHtml}" style="display:block;padding:15px 20px;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;line-height:20px;letter-spacing:.8px;">
                                    BUKA PLATFORM CTF
                                  </a>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        <tr>
                          <td align="center" style="padding:0 24px 22px;text-align:center;">
                            <p style="margin:0;color:#c8c6ee;font-size:11px;line-height:18px;">
                              Link aktivasi berlaku hingga <strong style="color:#ffffff;">{expiresHtml}</strong> dan hanya dapat digunakan satu kali.
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td bgcolor="#FAFAFF" class="mobile-pad" style="padding:34px 44px;background-color:#FAFAFF;border-top:1px solid #ebeafd;border-bottom:1px solid #ebeafd;">
                      <p style="margin:0 0 20px;color:#201D70;font-size:18px;font-weight:700;line-height:26px;">Cara Masuk</p>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td width="58" valign="top" class="step-number" style="width:58px;padding:0 0 18px;vertical-align:top;">
                            <table role="presentation" width="40" cellspacing="0" cellpadding="0" border="0">
                              <tr><td align="center" bgcolor="#635FC9" style="width:40px;height:40px;background-color:#635FC9;border-radius:10px;color:#ffffff;font-size:12px;font-weight:700;line-height:40px;">01</td></tr>
                            </table>
                          </td>
                          <td valign="top" style="padding:0 0 18px;vertical-align:top;">
                            <p style="margin:0 0 3px;color:#201D70;font-size:14px;font-weight:700;line-height:21px;">Daftar Akun</p>
                            <p style="margin:0;color:#5c5a76;font-size:13px;line-height:21px;">Setiap peserta mendaftarkan akun baru pada platform CTF.</p>
                          </td>
                        </tr>
                        <tr>
                          <td width="58" valign="top" class="step-number" style="width:58px;padding:0 0 18px;vertical-align:top;">
                            <table role="presentation" width="40" cellspacing="0" cellpadding="0" border="0">
                              <tr><td align="center" bgcolor="#4d49a9" style="width:40px;height:40px;background-color:#4d49a9;border-radius:10px;color:#ffffff;font-size:12px;font-weight:700;line-height:40px;">02</td></tr>
                            </table>
                          </td>
                          <td valign="top" style="padding:0 0 18px;vertical-align:top;">
                            <p style="margin:0 0 3px;color:#201D70;font-size:14px;font-weight:700;line-height:21px;">Login</p>
                            <p style="margin:0;color:#5c5a76;font-size:13px;line-height:21px;">Setiap peserta login menggunakan akun yang telah didaftarkan.</p>
                          </td>
                        </tr>
                        <tr>
                          <td width="58" valign="top" class="step-number" style="width:58px;vertical-align:top;">
                            <table role="presentation" width="40" cellspacing="0" cellpadding="0" border="0">
                              <tr><td align="center" bgcolor="#201D70" style="width:40px;height:40px;background-color:#201D70;border-radius:10px;color:#ffffff;font-size:12px;font-weight:700;line-height:40px;">03</td></tr>
                            </table>
                          </td>
                          <td valign="top" style="vertical-align:top;">
                            <p style="margin:0 0 3px;color:#201D70;font-size:14px;font-weight:700;line-height:21px;">Join Tim</p>
                            <p style="margin:0;color:#5c5a76;font-size:13px;line-height:21px;">Join tim menggunakan kode tim yang diberikan oleh captain setelah aktivasi.</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td class="mobile-pad" style="padding:34px 44px 12px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#EEF7FF"
                             style="width:100%;background-color:#EEF7FF;border-left:4px solid #4ca7d9;border-radius:10px;">
                        <tr>
                          <td width="48" valign="top" style="width:48px;padding:19px 0 19px 18px;vertical-align:top;">
                            <span style="color:#201D70;font-size:20px;line-height:24px;">&#128274;</span>
                          </td>
                          <td style="padding:18px 18px 18px 10px;">
                            <p style="margin:0 0 4px;color:#201D70;font-size:12px;font-weight:700;line-height:18px;letter-spacing:.8px;text-transform:uppercase;">Security Notice</p>
                            <p style="margin:0;color:#41405d;font-size:12px;line-height:20px;">Kredensial tim bersifat rahasia dan hanya digunakan oleh anggota tim yang terdaftar. Mohon untuk tidak membagikan kredensial kepada pihak lain.</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td class="mobile-pad" style="padding:22px 44px 10px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#F4F4FF"
                             style="width:100%;background-color:#F4F4FF;border:1px solid #dfdef7;border-radius:14px;">
                        <tr>
                          <td align="center" style="padding:25px 24px 12px;text-align:center;">
                            <span style="display:inline-block;margin:0 0 10px;padding:5px 10px;background-color:#e1e0ff;border-radius:999px;color:#4d49a9;font-size:10px;font-weight:700;line-height:14px;letter-spacing:1px;text-transform:uppercase;">Komunikasi Resmi</span>
                            <p style="margin:0 0 7px;color:#201D70;font-size:17px;font-weight:700;line-height:25px;">Bergabung ke Discord HackToday IT TODAY 2026</p>
                            <p style="margin:0;color:#55536f;font-size:13px;line-height:21px;">Seluruh peserta diwajibkan bergabung ke server Discord resmi. Informasi Warm-Up dan babak penyisihan akan disampaikan melalui Discord.</p>
                          </td>
                        </tr>
                        <tr>
                          <td align="center" style="padding:5px 24px 24px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                              <tr>
                                <td align="center" bgcolor="#635FC9" style="background-color:#635FC9;border-radius:9px;">
                                  <a href="https://discord.gg/4hhvCARdWC" style="display:block;padding:14px 20px;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;line-height:20px;letter-spacing:.8px;">JOIN DISCORD</a>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td class="mobile-pad" style="padding:12px 44px 34px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border:1px solid #dfdef7;border-radius:14px;">
                        <tr>
                          <td align="center" style="padding:24px 24px 12px;text-align:center;">
                            <p style="margin:0 0 6px;color:#201D70;font-size:16px;font-weight:700;line-height:24px;">Guidebook Kompetisi</p>
                            <p style="margin:0;color:#5c5a76;font-size:13px;line-height:21px;">Pastikan peserta telah membaca guidebook resmi sebelum kompetisi.</p>
                          </td>
                        </tr>
                        <tr>
                          <td align="center" style="padding:5px 24px 24px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                              <tr>
                                <td align="center" style="border:1px solid #635FC9;border-radius:9px;">
                                  <a href="https://ipb.link/guidebook-hacktoday2026-revised" style="display:block;padding:13px 20px;color:#4d49a9;text-decoration:none;font-size:13px;font-weight:700;line-height:20px;letter-spacing:.8px;">BUKA GUIDEBOOK</a>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" class="mobile-pad" style="padding:0 44px 36px;text-align:center;">
                      <div style="height:1px;background-color:#ebeafd;font-size:0;line-height:0;">&nbsp;</div>
                      <p style="margin:27px 0 7px;color:#201D70;font-size:16px;font-weight:700;line-height:24px;">Sampai jumpa di kompetisi, dan selamat berkompetisi!</p>
                      <p style="margin:0;color:#635FC9;font-size:13px;font-weight:700;line-height:21px;">Panitia HackToday IT TODAY 2026</p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" bgcolor="#12112F" class="mobile-pad" style="padding:24px 44px;background-color:#12112F;text-align:center;">
                      <p style="margin:0 0 5px;color:#ffffff;font-size:12px;font-weight:700;line-height:19px;letter-spacing:.7px;">HackToday IT TODAY 2026</p>
                      <p style="margin:0;color:#a9a7ce;font-size:11px;line-height:18px;">{platformHtml}</p>
                    </td>
                  </tr>
                </table>
                <!--[if mso]></td></tr></table><![endif]-->
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
        MailType.CaptainOnboarding => "Kredensial Tim CTF HackToday IT TODAY 2026",
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
            $"Akses tim <strong>{System.Net.WebUtility.HtmlEncode(userName)}</strong> siap diaktifkan oleh captain.",
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
        MailType.CaptainOnboarding => "Buka Platform CTF",
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
        : "<span style=\"color:#201D70;font-size:13px;\">Akses kompetisi HackToday IT TODAY 2026</span>";

    public string ExpiresHtml { get; } = expiresAtUtc.HasValue
        ? expiresAtUtc.Value.ToOffset(TimeSpan.FromHours(7)).ToString("dd MMM yyyy HH:mm 'WIB'")
        : "-";
}
