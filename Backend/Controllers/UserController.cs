using data;
using DTOs;
using Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace Controllers;

[ApiController]
[Route("api/users")]
public class UserController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IConfiguration _config;

    public UserController(AppDbContext context, IConfiguration config)
    {
        _context = context;
        _config = config;
    }

    // ---- FRIEND REQUEST ENDPOINTS ----

    // POST api/users/{id}/friend-request  — Send a friend request to user {id}
    [Authorize]
    [HttpPost("{id}/friend-request")]
    public async Task<IActionResult> SendFriendRequest(int id)
    {
        var email = User.FindFirstValue(ClaimTypes.Email);
        var sender = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (sender == null) return Unauthorized();

        if (sender.Id == id)
            return BadRequest("No puedes enviarte una solicitud a ti mismo.");

        var receiver = await _context.Users.FindAsync(id);
        if (receiver == null)
            return NotFound("Usuario no encontrado.");

        // Check if already friends
        var alreadyFriends = await _context.Friends.AnyAsync(f =>
            f.UserId == sender.Id && f.FriendUserId == id);
        if (alreadyFriends)
            return BadRequest("Ya son amigos.");

        // Check for existing pending request in either direction
        var alreadyPending = await _context.FriendRequests.AnyAsync(fr =>
            fr.Status == FriendRequestStatus.Pendiente &&
            ((fr.SenderId == sender.Id && fr.ReceiverId == id) ||
             (fr.SenderId == id && fr.ReceiverId == sender.Id)));
        if (alreadyPending)
            return BadRequest("Ya hay una solicitud pendiente.");

        var request = new FriendRequest
        {
            SenderId = sender.Id,
            ReceiverId = id
        };

        _context.FriendRequests.Add(request);
        await _context.SaveChangesAsync();

        return Ok("Solicitud de amistad enviada.");
    }

    // GET api/users/{id}/friend-requests  — Get pending friend requests received by user {id}
    [Authorize]
    [HttpGet("{id}/friend-requests")]
    public async Task<IActionResult> GetMyFriendRequests(int id)
    {
        var email = User.FindFirstValue(ClaimTypes.Email);
        var currentUser = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (currentUser == null || currentUser.Id != id)
            return Unauthorized("No tienes permiso.");

        var requests = await _context.FriendRequests
            .Where(fr => fr.ReceiverId == id && fr.Status == FriendRequestStatus.Pendiente)
            .Include(fr => fr.Sender)
            .Select(fr => new
            {
                RequestId = fr.Id,
                fr.SenderId,
                SenderName = fr.Sender.Username,
                Status = fr.Status.ToString(),
                fr.CreatedAt
            })
            .ToListAsync();

        return Ok(requests);
    }

    // POST api/users/friend-requests/{requestId}/accept  — Accept a friend request
    [Authorize]
    [HttpPost("friend-requests/{requestId}/accept")]
    public async Task<IActionResult> AcceptFriendRequest(int requestId)
    {
        var email = User.FindFirstValue(ClaimTypes.Email);
        var currentUser = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (currentUser == null) return Unauthorized();

        var request = await _context.FriendRequests.FirstOrDefaultAsync(fr => fr.Id == requestId);
        if (request == null)
            return NotFound("Solicitud no encontrada.");

        if (request.ReceiverId != currentUser.Id)
            return Unauthorized("Esta solicitud no es para ti.");

        if (request.Status != FriendRequestStatus.Pendiente)
            return BadRequest("Esta solicitud ya fue procesada.");

        request.Status = FriendRequestStatus.Aceptada;

        // Create bidirectional friendship
        _context.Friends.AddRange(
            new Friend { UserId = request.SenderId, FriendUserId = request.ReceiverId },
            new Friend { UserId = request.ReceiverId, FriendUserId = request.SenderId }
        );

        await _context.SaveChangesAsync();

        return Ok("Solicitud aceptada. Ahora son amigos.");
    }
}
