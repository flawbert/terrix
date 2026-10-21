package com.terrix.service;

import com.terrix.domain.entity.LandLot;
import com.terrix.domain.entity.Proposal;
import com.terrix.domain.entity.User;
import com.terrix.domain.enums.LandStatus;
import com.terrix.domain.enums.ProposalStatus;
import com.terrix.domain.repository.LandLotRepository;
import com.terrix.domain.repository.ProposalRepository;
import com.terrix.domain.repository.UserRepository;
import com.terrix.dto.request.*;
import com.terrix.dto.response.AuthResponse;
import com.terrix.dto.response.LandLotResponse;
import com.terrix.dto.response.ProposalResponse;
import com.terrix.exception.BusinessRuleException;
import com.terrix.exception.InvalidGeometryException;
import com.terrix.exception.LandOverlapException;
import com.terrix.exception.ResourceNotFoundException;
import com.terrix.security.JwtService;
import com.terrix.service.strategy.MinimumAreaValidationStrategy;
import com.terrix.service.strategy.PolygonOverlapValidationStrategy;
import com.terrix.util.GeometryUtils;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.locationtech.jts.geom.Polygon;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class ServicesAndStrategiesTest {

    private UserRepository userRepository;
    private LandLotRepository landLotRepository;
    private ProposalRepository proposalRepository;
    private PasswordEncoder passwordEncoder;
    private JwtService jwtService;
    private AuthService authService;
    private LandLotService landLotService;
    private ProposalService proposalService;
    private Polygon samplePolygon;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        landLotRepository = mock(LandLotRepository.class);
        proposalRepository = mock(ProposalRepository.class);
        passwordEncoder = new BCryptPasswordEncoder();
        jwtService = new JwtService(java.util.Base64.getEncoder().encodeToString("terrix-test-only-dummy-key-with-at-least-32-bytes!".getBytes()), 3600000L);

        authService = new AuthService(userRepository, passwordEncoder, jwtService);
        PolygonOverlapValidationStrategy overlapStrategy = new PolygonOverlapValidationStrategy(landLotRepository);
        MinimumAreaValidationStrategy areaStrategy = new MinimumAreaValidationStrategy(landLotRepository);

        landLotService = new LandLotService(landLotRepository, authService, List.of(overlapStrategy, areaStrategy));
        proposalService = new ProposalService(proposalRepository, landLotRepository, userRepository);

        samplePolygon = GeometryUtils.toPolygon(List.of(List.of(
                List.of(-47.0626, -22.9056),
                List.of(-47.0616, -22.9056),
                List.of(-47.0616, -22.9046),
                List.of(-47.0626, -22.9046),
                List.of(-47.0626, -22.9056)
        )));
    }

    @Test
    void shouldRegisterAndLoginUserSuccessfully() {
        when(userRepository.existsByEmailIgnoreCase("john@terrix.io")).thenReturn(false);
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        AuthResponse registerRes = authService.register(new RegisterRequest("John Doe", "john@terrix.io", "secret123"));
        assertNotNull(registerRes.token());
        assertEquals("john@terrix.io", registerRes.email());

        User savedUser = new User(registerRes.userId(), "John Doe", "john@terrix.io", passwordEncoder.encode("secret123"));
        when(userRepository.findByEmailIgnoreCase("john@terrix.io")).thenReturn(Optional.of(savedUser));

        AuthResponse loginRes = authService.login(new LoginRequest("john@terrix.io", "secret123"));
        assertNotNull(loginRes.token());

        assertThrows(BadCredentialsException.class, () -> authService.login(new LoginRequest("john@terrix.io", "wrong")));
        assertThrows(BadCredentialsException.class, () -> authService.login(new LoginRequest("unknown@terrix.io", "secret123")));
    }

    @Test
    void shouldRejectDuplicateEmailRegistration() {
        when(userRepository.existsByEmailIgnoreCase("dup@terrix.io")).thenReturn(true);
        assertThrows(BusinessRuleException.class,
                () -> authService.register(new RegisterRequest("Dup", "dup@terrix.io", "secret123")));
    }

    @Test
    void shouldCreateLandLotWhenNoOverlapAndAreaIsValid() {
        when(landLotRepository.existsOverlappingLand(any())).thenReturn(false);
        when(landLotRepository.calculateGeodesicAreaSqMeters(any())).thenReturn(5000.0);
        User owner = new User(UUID.randomUUID(), "Owner", "owner@terrix.io", "hash");
        when(userRepository.findByEmailIgnoreCase("owner@terrix.io")).thenReturn(Optional.of(owner));
        when(landLotRepository.save(any(LandLot.class))).thenAnswer(inv -> inv.getArgument(0));

        CreateLandLotRequest request = new CreateLandLotRequest(
                "Prime Lot",
                "Great location",
                new BigDecimal("100000.00"),
                "owner@terrix.io",
                new GeoJsonPolygonDto("Polygon", GeometryUtils.fromPolygon(samplePolygon))
        );

        LandLotResponse response = landLotService.createLandLot(request, "owner@terrix.io");
        assertEquals("Prime Lot", response.title());
        assertEquals(5000.0, response.areaSqMeters());
        assertEquals(new BigDecimal("20.00"), response.pricePerSqMeter());
    }

    @Test
    void shouldBlockLandCreationWhenOverlapDetectedOrAreaTooSmall() {
        CreateLandLotRequest request = new CreateLandLotRequest(
                "Overlap Lot",
                "Desc",
                new BigDecimal("100000.00"),
                "contact",
                new GeoJsonPolygonDto("Polygon", GeometryUtils.fromPolygon(samplePolygon))
        );

        when(landLotRepository.existsOverlappingLand(any())).thenReturn(true);
        assertThrows(LandOverlapException.class, () -> landLotService.createLandLot(request, null));

        when(landLotRepository.existsOverlappingLand(any())).thenReturn(false);
        when(landLotRepository.calculateGeodesicAreaSqMeters(any())).thenReturn(2.0);
        assertThrows(InvalidGeometryException.class, () -> landLotService.createLandLot(request, null));
    }

    @Test
    void shouldListGetSearchAndDeleteLandLots() {
        User owner = new User(UUID.randomUUID(), "Owner", "owner@terrix.io", "hash");
        LandLot lot = new LandLot(UUID.randomUUID(), "Lot 1", "Desc", new BigDecimal("50000"),
                1000.0, "contact", LandStatus.AVAILABLE, samplePolygon, owner);

        when(landLotRepository.findAllWithOwner()).thenReturn(List.of(lot));
        when(landLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));
        when(landLotRepository.searchWithinCircle(anyDouble(), anyDouble(), anyDouble(), any(), any()))
                .thenReturn(List.of(lot));

        assertEquals(1, landLotService.listAllLandLots().size());
        assertEquals("Lot 1", landLotService.getLandLotById(lot.getId()).title());
        assertEquals(1, landLotService.searchByCircle(-47.06, -22.90, 500, null, LandStatus.AVAILABLE).size());

        assertThrows(BusinessRuleException.class,
                () -> landLotService.searchByCircle(-47.06, -22.90, 0, null, null));
        assertThrows(BusinessRuleException.class,
                () -> landLotService.searchByCircle(-200.0, -22.90, 500, null, null));

        assertThrows(BusinessRuleException.class,
                () -> landLotService.deleteLandLot(lot.getId(), "other@terrix.io"));

        when(landLotRepository.save(any(LandLot.class))).thenAnswer(inv -> inv.getArgument(0));
        assertEquals(LandStatus.RESERVED, landLotService.updateLandStatus(lot.getId(), LandStatus.RESERVED, "owner@terrix.io").status());
        assertThrows(BusinessRuleException.class, () -> landLotService.updateLandStatus(lot.getId(), LandStatus.SOLD, "other@terrix.io"));
        landLotService.deleteLandLot(lot.getId(), "owner@terrix.io");
        verify(landLotRepository).delete(lot);
    }

    @Test
    void shouldCreateAndEvaluateProposals() {
        User owner = new User(UUID.randomUUID(), "Owner", "owner@terrix.io", "hash");
        User buyer = new User(UUID.randomUUID(), "Buyer", "buyer@terrix.io", "hash");
        LandLot lot = new LandLot(UUID.randomUUID(), "Lot 1", "Desc", new BigDecimal("50000"),
                1000.0, "contact", LandStatus.AVAILABLE, samplePolygon, owner);

        when(userRepository.findByEmailIgnoreCase("buyer@terrix.io")).thenReturn(Optional.of(buyer));
        when(userRepository.findByEmailIgnoreCase("owner@terrix.io")).thenReturn(Optional.of(owner));
        when(landLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));
        when(proposalRepository.save(any(Proposal.class))).thenAnswer(inv -> inv.getArgument(0));

        ProposalResponse created = proposalService.createProposal(
                lot.getId(),
                new CreateProposalRequest(new BigDecimal("48000"), "Cash offer"),
                "buyer@terrix.io"
        );
        assertEquals(ProposalStatus.PENDING, created.status());

        Proposal proposal = new Proposal(created.id(), lot, buyer, new BigDecimal("48000"), "Cash offer");
        when(proposalRepository.findById(proposal.getId())).thenReturn(Optional.of(proposal));
        when(proposalRepository.findReceivedProposalsByOwnerId(owner.getId())).thenReturn(List.of(proposal));

        assertEquals(1, proposalService.listProposalsForOwner("owner@terrix.io").size());

        ProposalResponse accepted = proposalService.evaluateProposal(proposal.getId(), true, "owner@terrix.io");
        assertEquals(ProposalStatus.ACCEPTED, accepted.status());
        assertEquals(LandStatus.RESERVED, lot.getStatus());

        assertThrows(BusinessRuleException.class,
                () -> proposalService.evaluateProposal(proposal.getId(), false, "owner@terrix.io"));
    }
}
