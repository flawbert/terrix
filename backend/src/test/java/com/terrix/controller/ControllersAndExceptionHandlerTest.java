package com.terrix.controller;

import com.terrix.domain.entity.LandLot;
import com.terrix.domain.entity.Proposal;
import com.terrix.domain.entity.User;
import com.terrix.domain.enums.LandStatus;
import com.terrix.domain.enums.ProposalStatus;
import com.terrix.dto.request.*;
import com.terrix.dto.response.AuthResponse;
import com.terrix.dto.response.LandLotResponse;
import com.terrix.dto.response.ProposalResponse;
import com.terrix.exception.*;
import com.terrix.service.AuthService;
import com.terrix.service.LandLotService;
import com.terrix.service.ProposalService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ControllersAndExceptionHandlerTest {

    @Test
    void shouldTestAuthLandAndProposalControllersDirectly() {
        AuthService authService = mock(AuthService.class);
        LandLotService landLotService = mock(LandLotService.class);
        ProposalService proposalService = mock(ProposalService.class);

        AuthController authController = new AuthController(authService);
        LandLotController landLotController = new LandLotController(landLotService);
        ProposalController proposalController = new ProposalController(proposalService);

        AuthResponse authRes = new AuthResponse("jwt", UUID.randomUUID(), "User", "u@terrix.io");
        when(authService.register(any())).thenReturn(authRes);
        when(authService.login(any())).thenReturn(authRes);

        assertEquals(HttpStatus.CREATED, authController.register(new RegisterRequest("User", "u@terrix.io", "123456")).getStatusCode());
        assertEquals(HttpStatus.OK, authController.login(new LoginRequest("u@terrix.io", "123456")).getStatusCode());

        UUID lotId = UUID.randomUUID();
        LandLotResponse lotRes = new LandLotResponse(
                lotId, "Title", "Desc", BigDecimal.TEN, 100.0, BigDecimal.ONE,
                "contact", LandStatus.AVAILABLE, new GeoJsonPolygonDto("Polygon", List.of()),
                UUID.randomUUID(), "Owner", OffsetDateTime.now()
        );
        when(landLotService.createLandLot(any(), any())).thenReturn(lotRes);
        when(landLotService.listAllLandLots()).thenReturn(List.of(lotRes));
        when(landLotService.getLandLotById(lotId)).thenReturn(lotRes);
        when(landLotService.searchByCircle(anyDouble(), anyDouble(), anyDouble(), any(), any())).thenReturn(List.of(lotRes));

        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken("u@terrix.io", null);
        assertEquals(HttpStatus.CREATED, landLotController.createLandLot(
                new CreateLandLotRequest("T", "D", BigDecimal.TEN, "C", new GeoJsonPolygonDto("Polygon", List.of())), auth).getStatusCode());
        assertEquals(1, landLotController.listAllLandLots().getBody().size());
        assertEquals(lotId, landLotController.getLandLotById(lotId).getBody().id());
        assertEquals(1, landLotController.searchByCircle(-47.0, -22.0, 100, null, null).getBody().size());
        assertEquals(HttpStatus.NO_CONTENT, landLotController.deleteLandLot(lotId, auth).getStatusCode());

        ProposalResponse propRes = new ProposalResponse(
                UUID.randomUUID(), lotId, "Title", UUID.randomUUID(), "Buyer", "b@terrix.io",
                BigDecimal.TEN, "Msg", ProposalStatus.PENDING, OffsetDateTime.now()
        );
        when(proposalService.createProposal( any(), any(), any())).thenReturn(propRes);
        when(proposalService.listProposalsForOwner(any())).thenReturn(List.of(propRes));
        when(proposalService.evaluateProposal(any(), anyBoolean(), any())).thenReturn(propRes);

        assertEquals(HttpStatus.CREATED, proposalController.createProposal(lotId, new CreateProposalRequest(BigDecimal.TEN, "M"), auth).getStatusCode());
        assertEquals(1, proposalController.listReceivedProposals(auth).getBody().size());
        assertEquals(HttpStatus.OK, proposalController.evaluateProposal(propRes.id(), true, auth).getStatusCode());
    }

    @Test
    void shouldTestGlobalExceptionHandlerAndEntities() {
        GlobalExceptionHandler handler = new GlobalExceptionHandler();

        ProblemDetail p1 = handler.handleLandOverlap(new LandOverlapException("Overlap"));
        assertEquals(409, p1.getStatus());

        ProblemDetail p2 = handler.handleInvalidGeometry(new InvalidGeometryException("Invalid geom"));
        assertEquals(400, p2.getStatus());

        ProblemDetail p3 = handler.handleNotFound(new ResourceNotFoundException("Not found"));
        assertEquals(404, p3.getStatus());

        ProblemDetail p4 = handler.handleBusinessRule(new BusinessRuleException("Rule error"));
        assertEquals(422, p4.getStatus());

        ProblemDetail p5 = handler.handleBadCredentials(new BadCredentialsException("Bad creds"));
        assertEquals(401, p5.getStatus());

        User u = new User();
        u.setId(UUID.randomUUID());
        u.setName("N");
        u.setEmail("E");
        u.setPasswordHash("P");
        u.setCreatedAt(OffsetDateTime.now());
        assertEquals("N", u.getName());

        LandLot l = new LandLot();
        l.setId(UUID.randomUUID());
        l.setTitle("T");
        l.setDescription("D");
        l.setPrice(BigDecimal.ONE);
        l.setAreaSqMeters(10.0);
        l.setContactInfo("C");
        l.setStatus(LandStatus.SOLD);
        l.setOwner(u);
        l.setCreatedAt(OffsetDateTime.now());
        l.setUpdatedAt(OffsetDateTime.now());
        assertEquals(LandStatus.SOLD, l.getStatus());

        Proposal pr = new Proposal();
        pr.setId(UUID.randomUUID());
        pr.setLandLot(l);
        pr.setBuyer(u);
        pr.setOfferedPrice(BigDecimal.ONE);
        pr.setMessage("M");
        pr.setStatus(ProposalStatus.REJECTED);
        pr.setCreatedAt(OffsetDateTime.now());
        assertEquals(ProposalStatus.REJECTED, pr.getStatus());
    }
}
