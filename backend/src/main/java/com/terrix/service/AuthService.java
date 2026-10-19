package com.terrix.service;

import com.terrix.domain.entity.User;
import com.terrix.domain.repository.UserRepository;
import com.terrix.dto.request.LoginRequest;
import com.terrix.dto.request.RegisterRequest;
import com.terrix.dto.response.AuthResponse;
import com.terrix.exception.BusinessRuleException;
import com.terrix.security.JwtService;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String normalizedEmail = request.email().trim().toLowerCase();
        if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new BusinessRuleException("An account with this email already exists.");
        }

        User user = new User(
                UUID.randomUUID(),
                request.name().trim(),
                normalizedEmail,
                passwordEncoder.encode(request.password())
        );

        User saved = userRepository.save(user);
        String token = jwtService.generateToken(saved.getId(), saved.getEmail());
        return new AuthResponse(token, saved.getId(), saved.getName(), saved.getEmail());
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmailIgnoreCase(request.email().trim())
                .orElseThrow(() -> new BadCredentialsException("Invalid credentials"));

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new BadCredentialsException("Invalid credentials");
        }

        String token = jwtService.generateToken(user.getId(), user.getEmail());
        return new AuthResponse(token, user.getId(), user.getName(), user.getEmail());
    }

    @Transactional
    public User resolveCurrentUserOrGuest(String authenticatedEmail) {
        if (authenticatedEmail != null && !authenticatedEmail.isBlank() && !"anonymousUser".equals(authenticatedEmail)) {
            return userRepository.findByEmailIgnoreCase(authenticatedEmail)
                    .orElseGet(this::getOrCreateDefaultGuestUser);
        }
        return getOrCreateDefaultGuestUser();
    }

    private User getOrCreateDefaultGuestUser() {
        String guestEmail = "guest@terrix.io";
        return userRepository.findByEmailIgnoreCase(guestEmail)
                .orElseGet(() -> userRepository.save(new User(
                        UUID.randomUUID(),
                        "Public Advertiser",
                        guestEmail,
                        passwordEncoder.encode(UUID.randomUUID().toString())
                )));
    }
}
