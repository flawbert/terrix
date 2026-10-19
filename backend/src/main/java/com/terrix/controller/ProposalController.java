package com.terrix.controller;

import com.terrix.dto.request.CreateProposalRequest;
import com.terrix.dto.response.ProposalResponse;
import com.terrix.service.ProposalService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class ProposalController {

    private final ProposalService proposalService;

    public ProposalController(ProposalService proposalService) {
        this.proposalService = proposalService;
    }

    @PostMapping("/lands/{landLotId}/proposals")
    public ResponseEntity<ProposalResponse> createProposal(
            @PathVariable UUID landLotId,
            @Valid @RequestBody CreateProposalRequest request,
            Authentication authentication) {
        ProposalResponse response = proposalService.createProposal(landLotId, request, authentication.getName());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/proposals/received")
    public ResponseEntity<List<ProposalResponse>> listReceivedProposals(Authentication authentication) {
        return ResponseEntity.ok(proposalService.listProposalsForOwner(authentication.getName()));
    }

    @PatchMapping("/proposals/{proposalId}/evaluate")
    public ResponseEntity<ProposalResponse> evaluateProposal(
            @PathVariable UUID proposalId,
            @RequestParam boolean accept,
            Authentication authentication) {
        return ResponseEntity.ok(proposalService.evaluateProposal(proposalId, accept, authentication.getName()));
    }
}
