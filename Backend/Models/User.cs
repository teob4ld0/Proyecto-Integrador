using System.Text.Json.Serialization;

namespace Models;

public class User
{
    public int Id { get; set; }
    public string Username { get; set; } = null!;
    public string Email { get; set; } = null!;

    [JsonIgnore]
    public string Password { get; set; } = null!;

    [JsonIgnore]
    public ICollection<Friend> Friends { get; set; } = new List<Friend>();
    [JsonIgnore]
    public ICollection<Friend> FriendOf { get; set; } = new List<Friend>();
    [JsonIgnore]
    public ICollection<FriendRequest> SentFriendRequests { get; set; } = new List<FriendRequest>();
    [JsonIgnore]
    public ICollection<FriendRequest> ReceivedFriendRequests { get; set; } = new List<FriendRequest>();
}