package cn.zhaoge.interview.auth;

import cn.zhaoge.interview.auth.mapper.AdminUserMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AdminAuthService {
    private final AdminUserMapper adminUserMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenService jwtTokenService;

    public AdminAuthService(AdminUserMapper adminUserMapper, PasswordEncoder passwordEncoder, JwtTokenService jwtTokenService) {
        this.adminUserMapper = adminUserMapper;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenService = jwtTokenService;
    }

    public LoginResponse login(LoginRequest request) {
        AdminUser user = adminUserMapper.selectOne(new LambdaQueryWrapper<AdminUser>()
                .eq(AdminUser::getUsername, request.username())
                .eq(AdminUser::getEnabled, true));
        if (user == null || !passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid username or password");
        }
        return new LoginResponse(jwtTokenService.issue(user), user.getUsername(), user.getDisplayName());
    }

    @Service
    @ConditionalOnProperty(prefix = "app.bootstrap-admin", name = "enabled", havingValue = "true")
    static class BootstrapAdminRunner implements CommandLineRunner {
        private final AdminUserMapper adminUserMapper;
        private final PasswordEncoder passwordEncoder;
        private final String username;
        private final String password;
        private final String displayName;

        BootstrapAdminRunner(
                AdminUserMapper adminUserMapper,
                PasswordEncoder passwordEncoder,
                @Value("${app.bootstrap-admin.username}") String username,
                @Value("${app.bootstrap-admin.password}") String password,
                @Value("${app.bootstrap-admin.display-name}") String displayName
        ) {
            this.adminUserMapper = adminUserMapper;
            this.passwordEncoder = passwordEncoder;
            this.username = username;
            this.password = password;
            this.displayName = displayName;
        }

        @Override
        public void run(String... args) {
            AdminUser existing = adminUserMapper.selectOne(new LambdaQueryWrapper<AdminUser>().eq(AdminUser::getUsername, username));
            if (existing != null) {
                return;
            }
            AdminUser user = new AdminUser();
            user.setUsername(username);
            user.setPasswordHash(passwordEncoder.encode(password));
            user.setDisplayName(displayName);
            user.setEnabled(true);
            adminUserMapper.insert(user);
        }
    }
}
