using sib_api_v3_sdk.Api;
using sib_api_v3_sdk.Model;

namespace Services;

public class EmailService
{
    private readonly IConfiguration _config;

    public EmailService(IConfiguration config)
    {
        _config = config;
    }

    public void SendVerificationEmail(string toEmail, string toName, int userId, string token)
    {
        var apiKey = _config["Brevo:ApiKey"]
            ?? throw new InvalidOperationException("Falta la API key de Brevo en appsettings.json");
        var frontendUrl = _config["Brevo:FrontendUrl"]
            ?? throw new InvalidOperationException("Falta FrontendUrl en appsettings.json");

        var configuration = new sib_api_v3_sdk.Client.Configuration();
        configuration.ApiKey.Add("api-key", apiKey);

        var apiInstance = new TransactionalEmailsApi(configuration);

        var verificationUrl = $"{frontendUrl}/verify-email?userId={userId}&token={Uri.EscapeDataString(token)}&email={Uri.EscapeDataString(toEmail)}";

        var sendSmtpEmail = new SendSmtpEmail
        {
            To = new List<SendSmtpEmailTo> { new SendSmtpEmailTo(toEmail, toName) },
            TemplateId = 2,
            Params = new Dictionary<string, object>
            {
                { "verificationURL", verificationUrl }
            }
        };

        apiInstance.SendTransacEmail(sendSmtpEmail);
    }
}