package cn.zhaoge.interview.auth;

public record LoginResponse(String token, String username, String displayName) {
}
