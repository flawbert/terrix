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

        landLotService = new LandLotService(landLotRepository, authService, List.of(overlapStrategy, areaStrategy), proposalRepository);
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

        when(landLotRepository.calculateGeodesicAreaSqMeters(any())).thenReturn(60_000_000.0);
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

    @Test
    void shouldEditLandLotOnlyByOwnerAndWhileNotSold() {
        User owner = new User(UUID.randomUUID(), "Owner", "owner@terrix.io", "hash");
        LandLot lot = new LandLot(UUID.randomUUID(), "Old Title", "Old desc", new BigDecimal("50000"),
                1000.0, "old contact", LandStatus.AVAILABLE, samplePolygon, owner);

        when(landLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));
        when(landLotRepository.save(any(LandLot.class))).thenAnswer(inv -> inv.getArgument(0));

        UpdateLandLotRequest request = new UpdateLandLotRequest(
                "  New Title ", " New desc ", new BigDecimal("80000"), " new contact ");

        assertThrows(BusinessRuleException.class,
                () -> landLotService.updateLandLot(lot.getId(), request, "other@terrix.io"));
        assertThrows(BusinessRuleException.class,
                () -> landLotService.updateLandLot(lot.getId(), request, null));

        LandLotResponse updated = landLotService.updateLandLot(lot.getId(), request, "OWNER@terrix.io");
        assertEquals("New Title", updated.title());
        assertEquals("New desc", updated.description());
        assertEquals(new BigDecimal("80000"), updated.price());
        assertEquals("new contact", updated.contactInfo());
        assertEquals(new BigDecimal("80.00"), updated.pricePerSqMeter());

        lot.setStatus(LandStatus.SOLD);
        assertThrows(BusinessRuleException.class,
                () -> landLotService.updateLandLot(lot.getId(), request, "owner@terrix.io"));

        UUID missingId = UUID.randomUUID();
        when(landLotRepository.findById(missingId)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class,
                () -> landLotService.updateLandLot(missingId, request, "owner@terrix.io"));
    }

    @Test
    void shouldListLandLotsAndProposalsOfAuthenticatedUser() {
        User owner = new User(UUID.randomUUID(), "Owner", "owner@terrix.io", "hash");
        User buyer = new User(UUID.randomUUID(), "Buyer", "buyer@terrix.io", "hash");
        LandLot lot = new LandLot(UUID.randomUUID(), "Lot 1", "Desc", new BigDecimal("50000"),
                1000.0, "contact", LandStatus.RESERVED, samplePolygon, owner);
        Proposal proposal = new Proposal(UUID.randomUUID(), lot, buyer, new BigDecimal("48000"), "Cash");
        proposal.setStatus(ProposalStatus.ACCEPTED);

        when(landLotRepository.findAllByOwnerEmail("owner@terrix.io")).thenReturn(List.of(lot));
        when(userRepository.findByEmailIgnoreCase("buyer@terrix.io")).thenReturn(Optional.of(buyer));
        when(proposalRepository.findSentProposalsByBuyerId(buyer.getId())).thenReturn(List.of(proposal));

        List<LandLotResponse> myLands = landLotService.listLandLotsForOwner("owner@terrix.io");
        assertEquals(1, myLands.size());
        assertEquals("Lot 1", myLands.get(0).title());
        assertThrows(BusinessRuleException.class, () -> landLotService.listLandLotsForOwner(" "));
        assertThrows(BusinessRuleException.class, () -> landLotService.listLandLotsForOwner(null));

        List<ProposalResponse> myProposals = proposalService.listProposalsForBuyer("buyer@terrix.io");
        assertEquals(1, myProposals.size());
        assertEquals(ProposalStatus.ACCEPTED, myProposals.get(0).status());
        assertEquals(LandStatus.RESERVED, myProposals.get(0).landLotStatus());
        assertEquals(new BigDecimal("50000"), myProposals.get(0).landLotPrice());

        when(userRepository.findByEmailIgnoreCase("ghost@terrix.io")).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> proposalService.listProposalsForBuyer("ghost@terrix.io"));
    }

    @Test
    void shouldEnforceAllLandStatusTransitionsAndPreventReopeningSoldLand() {
        User owner = new User(UUID.randomUUID(), "Owner", "owner@terrix.io", "hash");
        User buyer = new User(UUID.randomUUID(), "Buyer", "buyer@terrix.io", "hash");
        LandLot lot = new LandLot(UUID.randomUUID(), "Status Lot", "Desc", new BigDecimal("120000"),
                2000.0, "owner@terrix.io", LandStatus.AVAILABLE, samplePolygon, owner);

        Proposal acceptedProposal = new Proposal(UUID.randomUUID(), lot, buyer, new BigDecimal("118000"), "Accepted offer");
        acceptedProposal.setStatus(ProposalStatus.ACCEPTED);

        when(landLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));
        when(landLotRepository.save(any(LandLot.class))).thenAnswer(inv -> inv.getArgument(0));
        when(proposalRepository.countByLandLotId(lot.getId())).thenReturn(3L);
        when(proposalRepository.findByLandLotIdWithDetails(lot.getId())).thenReturn(List.of(acceptedProposal));

        // 0. AVAILABLE -> SOLD directly (without an accepted offer / RESERVED status) must be blocked!
        BusinessRuleException directSoldEx = assertThrows(BusinessRuleException.class,
                () -> landLotService.updateLandStatus(lot.getId(), LandStatus.SOLD, "owner@terrix.io"));
        assertTrue(directSoldEx.getMessage().toLowerCase().contains("proposal"));
        assertEquals(LandStatus.AVAILABLE, lot.getStatus());

        // 1. AVAILABLE -> RESERVED (when offer is accepted)
        LandLotResponse reservedRes = landLotService.updateLandStatus(lot.getId(), LandStatus.RESERVED, "owner@terrix.io");
        assertEquals(LandStatus.RESERVED, reservedRes.status());
        assertEquals(3L, reservedRes.proposalCount());

        // 2. RESERVED -> AVAILABLE (reopening a reserved lot cancels the accepted proposal and blocks marking as SOLD again)
        LandLotResponse reopenedRes = landLotService.updateLandStatus(lot.getId(), LandStatus.AVAILABLE, "owner@terrix.io");
        assertEquals(LandStatus.AVAILABLE, reopenedRes.status());
        assertEquals(ProposalStatus.REJECTED, acceptedProposal.getStatus());
        assertThrows(BusinessRuleException.class,
                () -> landLotService.updateLandStatus(lot.getId(), LandStatus.SOLD, "owner@terrix.io"));

        // 3. AVAILABLE -> RESERVED -> Edit while RESERVED (allowed for owner, blocked for others)
        landLotService.updateLandStatus(lot.getId(), LandStatus.RESERVED, "owner@terrix.io");
        UpdateLandLotRequest editReq = new UpdateLandLotRequest("Updated While Reserved", "New Desc", new BigDecimal("125000"), "contact");
        assertThrows(BusinessRuleException.class,
                () -> landLotService.updateLandLot(lot.getId(), editReq, "stranger@terrix.io"));
        LandLotResponse editedReserved = landLotService.updateLandLot(lot.getId(), editReq, "owner@terrix.io");
        assertEquals("Updated While Reserved", editedReserved.title());
        assertEquals(LandStatus.RESERVED, editedReserved.status());

        // 4. RESERVED -> SOLD (closing deal is allowed for owner once lot has an accepted offer / is RESERVED)
        LandLotResponse soldRes = landLotService.updateLandStatus(lot.getId(), LandStatus.SOLD, "owner@terrix.io");
        assertEquals(LandStatus.SOLD, soldRes.status());

        // 5. Once SOLD, reopening as AVAILABLE or changing status to RESERVED must be strictly blocked!
        BusinessRuleException reopenEx = assertThrows(BusinessRuleException.class,
                () -> landLotService.updateLandStatus(lot.getId(), LandStatus.AVAILABLE, "owner@terrix.io"));
        assertTrue(reopenEx.getMessage().toLowerCase().contains("sold"));

        assertThrows(BusinessRuleException.class,
                () -> landLotService.updateLandStatus(lot.getId(), LandStatus.RESERVED, "owner@terrix.io"));
        assertEquals(LandStatus.SOLD, lot.getStatus());

        // 6. Once SOLD, editing the land lot is strictly blocked even for the owner
        assertThrows(BusinessRuleException.class,
                () -> landLotService.updateLandLot(lot.getId(), editReq, "owner@terrix.io"));
    }

    @Test
    void shouldEnforceProposalRulesAcrossAllLandStatuses() {
        User owner = new User(UUID.randomUUID(), "Owner", "owner@terrix.io", "hash");
        User buyer1 = new User(UUID.randomUUID(), "Buyer 1", "buyer1@terrix.io", "hash");
        User buyer2 = new User(UUID.randomUUID(), "Buyer 2", "buyer2@terrix.io", "hash");
        LandLot lot = new LandLot(UUID.randomUUID(), "Negotiation Lot", "Desc", new BigDecimal("90000"),
                1500.0, "owner@terrix.io", LandStatus.AVAILABLE, samplePolygon, owner);

        when(userRepository.findByEmailIgnoreCase("owner@terrix.io")).thenReturn(Optional.of(owner));
        when(userRepository.findByEmailIgnoreCase("buyer1@terrix.io")).thenReturn(Optional.of(buyer1));
        when(userRepository.findByEmailIgnoreCase("buyer2@terrix.io")).thenReturn(Optional.of(buyer2));
        when(landLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));
        when(landLotRepository.save(any(LandLot.class))).thenAnswer(inv -> inv.getArgument(0));
        when(proposalRepository.save(any(Proposal.class))).thenAnswer(inv -> inv.getArgument(0));

        CreateProposalRequest offerReq = new CreateProposalRequest(new BigDecimal("85000"), "Offer");

        // Owner cannot submit a proposal on their own AVAILABLE land lot
        assertThrows(BusinessRuleException.class,
                () -> proposalService.createProposal(lot.getId(), offerReq, "owner@terrix.io"));

        // Two buyers submit proposals while lot is AVAILABLE
        Proposal p1 = new Proposal(UUID.randomUUID(), lot, buyer1, new BigDecimal("85000"), "Offer 1");
        Proposal p2 = new Proposal(UUID.randomUUID(), lot, buyer2, new BigDecimal("88000"), "Offer 2");
        Proposal p3 = new Proposal(UUID.randomUUID(), lot, buyer2, new BigDecimal("89000"), "Offer 3");
        when(proposalRepository.findById(p1.getId())).thenReturn(Optional.of(p1));
        when(proposalRepository.findById(p2.getId())).thenReturn(Optional.of(p2));
        when(proposalRepository.findById(p3.getId())).thenReturn(Optional.of(p3));

        // Non-owner cannot evaluate proposals
        assertThrows(BusinessRuleException.class,
                () -> proposalService.evaluateProposal(p1.getId(), true, "buyer1@terrix.io"));

        // Owner rejects p1 -> p1 becomes REJECTED, lot stays AVAILABLE
        ProposalResponse rejected = proposalService.evaluateProposal(p1.getId(), false, "owner@terrix.io");
        assertEquals(ProposalStatus.REJECTED, rejected.status());
        assertEquals(LandStatus.AVAILABLE, lot.getStatus());

        // Owner accepts p2 -> p2 becomes ACCEPTED, lot transitions to RESERVED
        ProposalResponse accepted = proposalService.evaluateProposal(p2.getId(), true, "owner@terrix.io");
        assertEquals(ProposalStatus.ACCEPTED, accepted.status());
        assertEquals(LandStatus.RESERVED, lot.getStatus());

        // While lot is RESERVED, buyers CANNOT submit new proposals
        assertThrows(BusinessRuleException.class,
                () -> proposalService.createProposal(lot.getId(), offerReq, "buyer1@terrix.io"));

        // While lot is RESERVED, owner CANNOT accept another pending proposal (p3)
        assertThrows(BusinessRuleException.class,
                () -> proposalService.evaluateProposal(p3.getId(), true, "owner@terrix.io"));

        // When lot becomes SOLD, buyers CANNOT submit proposals and owner CANNOT evaluate proposals
        lot.setStatus(LandStatus.SOLD);
        assertThrows(BusinessRuleException.class,
                () -> proposalService.createProposal(lot.getId(), offerReq, "buyer1@terrix.io"));
        assertThrows(BusinessRuleException.class,
                () -> proposalService.evaluateProposal(p3.getId(), false, "owner@terrix.io"));
        assertThrows(BusinessRuleException.class,
                () -> proposalService.evaluateProposal(p3.getId(), true, "owner@terrix.io"));
    }
}
