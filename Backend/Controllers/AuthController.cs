using data;
using DTOs;
using Models;
using Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Security.Cryptography;

namespace Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IConfiguration _config;
    private readonly EmailService _emailService;

    public AuthController(AppDbContext context, IConfiguration config, EmailService emailService)
    {
        _context = context;
        _config = config;
        _emailService = emailService;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest("Error: datos inválidos.");

        if (_context.Users.Any(u => u.Email == dto.Email))
            return BadRequest("Error: el email ya está registrado.");

        var user = new User
        {
            Username = dto.Username,
            Email = dto.Email,
            Password = BCrypt.Net.BCrypt.HashPassword(dto.Password),
            EmailVerificationToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)),
            IsEmailVerified = false
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        _emailService.SendVerificationEmail(user.Email, user.Username, user.Id, user.EmailVerificationToken);

        return Ok("Revisa tu correo para verificar tu cuenta.");
    }

    [HttpGet]
    public IActionResult GetAll()
    {
        var users = _context.Users.ToList();
        return Ok(users);
    }

    [HttpGet("verify-email")]
    public async Task<IActionResult> VerifyEmail([FromQuery] int userId, [FromQuery] string token, [FromQuery] string email)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId && u.Email == email);
        if (user == null)
            return BadRequest("Error: usuario no encontrado.");

        if (user.IsEmailVerified)
            return Ok("El correo ya fue verificado.");

        if (user.EmailVerificationToken != token)
            return BadRequest("Error: token de verificación inválido.");

        user.IsEmailVerified = true;
        user.EmailVerificationToken = null;
        await _context.SaveChangesAsync();

        return Ok("Correo verificado exitosamente.");
    }

    [HttpPost("login")]
    public IActionResult Login([FromBody] LoginDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest("Error: datos inválidos.");

        var user = _context.Users.FirstOrDefault(u => u.Email == dto.Email);
        if (user == null || !BCrypt.Net.BCrypt.Verify(dto.Password, user.Password))
            return Unauthorized("Error: credenciales incorrectas.");

        if (!user.IsEmailVerified)
            return Unauthorized("Error: debes verificar tu correo antes de iniciar sesión.");

        // ---- CREACIÓN DEL JWT ----
        var jwtKey = _config["Jwt:Key"] ?? throw new InvalidOperationException("Falta la clave JWT en el appsettings.json");
        var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
        var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

        var claims = new[] {
            new Claim(JwtRegisteredClaimNames.Sub, user.Username),
            new Claim(JwtRegisteredClaimNames.Email, user.Email)
        };

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],
            audience: _config["Jwt:Audience"],
            claims: claims,
            expires: DateTime.Now.AddHours(2),
            signingCredentials: credentials);

        var jwt = new JwtSecurityTokenHandler().WriteToken(token);

        return Ok(new { token = jwt });
    }
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteUser(int id)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null)
        {
            return NotFound("Error: usuario no encontrado.");
        }

        _context.Users.Remove(user);
        await _context.SaveChangesAsync();

        return Ok("Usuario eliminado exitosamente.");
    }
}