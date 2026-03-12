namespace DTOs;
using System.ComponentModel.DataAnnotations;

public class RegisterDto
{
    [Required]
    [StringLength(11, MinimumLength = 3, ErrorMessage = "El nombre de usuario debe tener entre 3 y 11 caracteres.")]
    [RegularExpression(@"^[a-zA-Z0-9_]+$", ErrorMessage = "El nombre de usuario solo puede contener letras, números y guiones bajos.")]
    public string Username { get; set; } = null!;
    
    [Required]
    [EmailAddress]
    public string Email { get; set; } = null!;
    
    [Required]
    [MinLength(6)]
    public string Password { get; set; } = null!;
}
