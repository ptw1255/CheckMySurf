using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace DotNetWebApp.Tests;

public class CustomWebAppFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            // Remove the real IHttpClientFactory and replace with one that uses our mock handler
            var descriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(IHttpClientFactory));
            if (descriptor != null)
                services.Remove(descriptor);

            // Also remove any HttpClient registrations
            var httpClientDescriptors = services
                .Where(d => d.ServiceType.FullName?.Contains("HttpClient") == true)
                .ToList();
            foreach (var d in httpClientDescriptors)
                services.Remove(d);

            services.AddSingleton<IHttpClientFactory>(sp =>
                new MockHttpClientFactory());
        });
    }
}

public class MockHttpClientFactory : IHttpClientFactory
{
    public HttpClient CreateClient(string name)
    {
        var handler = new MockOpenMeteoHandler();
        return new HttpClient(handler);
    }
}

public class MockOpenMeteoHandler : HttpMessageHandler
{
    protected override async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var url = request.RequestUri?.ToString() ?? "";
        string json;

        if (url.Contains("marine-api.open-meteo.com"))
        {
            json = await File.ReadAllTextAsync(
                Path.Combine("Fixtures", "marine-response.json"), cancellationToken);
        }
        else if (url.Contains("api.open-meteo.com"))
        {
            json = await File.ReadAllTextAsync(
                Path.Combine("Fixtures", "weather-response.json"), cancellationToken);
        }
        else
        {
            return new HttpResponseMessage(HttpStatusCode.NotFound);
        }

        return new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(json, System.Text.Encoding.UTF8, "application/json")
        };
    }
}
