package com.terrix.controller;

import com.terrix.dto.response.LandLotResponse;
import com.terrix.dto.response.ProposalResponse;
import com.terrix.service.LandLotService;
import com.terrix.service.ProposalService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Endpoints scoped to the authenticated user's profile ("/me").
 * Every route here requires a valid JWT (see SecurityConfig: anyRequest().authenticated()).
 */
@RestController
@RequestMapping("/api/v1/me")
public class ProfileController {

    private final LandLotService landLotService;
    private final ProposalService proposalService;

    public ProfileController(LandLotService landLotService, ProposalService proposalService) {
        this.landLotService = landLotService;
        this.proposalService = proposalService;
    }

    /** Land lots announced (listed) by the authenticated user. */
    @GetMapping("/lands")
    public ResponseEntity<List<LandLotResponse>> listMyLandLots(Authentication authentication) {
        return ResponseEntity.ok(landLotService.listLandLotsForOwner(authentication.getName()));
    }

    /** Purchase proposals / reservation requests submitted by the authenticated user. */
    @GetMapping("/proposals")
    public ResponseEntity<List<ProposalResponse>> listMyProposals(Authentication authentication) {
        return ResponseEntity.ok(proposalService.listProposalsForBuyer(authentication.getName()));
    }
}
