package com.terrix.service;

import com.terrix.domain.entity.LandLot;
import com.terrix.domain.entity.Proposal;
import com.terrix.domain.entity.User;
import com.terrix.domain.enums.LandStatus;
import com.terrix.domain.enums.ProposalStatus;
import com.terrix.domain.repository.LandLotRepository;
import com.terrix.domain.repository.ProposalRepository;
import com.terrix.domain.repository.UserRepository;
import com.terrix.dto.request.CreateProposalRequest;
import com.terrix.dto.response.ProposalResponse;
import com.terrix.exception.BusinessRuleException;
import com.terrix.exception.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class ProposalService {

    private final ProposalRepository proposalRepository;
    private final LandLotRepository landLotRepository;
    private final UserRepository userRepository;

    public ProposalService(
            ProposalRepository proposalRepository,
            LandLotRepository landLotRepository,
            UserRepository userRepository) {
        this.proposalRepository = proposalRepository;
        this.landLotRepository = landLotRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public ProposalResponse createProposal(UUID landLotId, CreateProposalRequest request, String buyerEmail) {
        User buyer = userRepository.findByEmailIgnoreCase(buyerEmail)
                .orElseThrow(() -> new ResourceNotFoundException("Authenticated buyer not found."));

        LandLot landLot = landLotRepository.findById(landLotId)
                .orElseThrow(() -> new ResourceNotFoundException("Land lot not found with id: " + landLotId));

        if (landLot.getStatus() != LandStatus.AVAILABLE) {
            throw new BusinessRuleException("Proposals can only be submitted for AVAILABLE land lots.");
        }

        if (landLot.getOwner().getId().equals(buyer.getId())) {
            throw new BusinessRuleException("You cannot submit a purchase proposal for your own land lot.");
        }

        Proposal proposal = new Proposal(
                UUID.randomUUID(),
                landLot,
                buyer,
                request.offeredPrice(),
                request.message()
        );

        Proposal saved = proposalRepository.save(proposal);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<ProposalResponse> listProposalsForOwner(String ownerEmail) {
        User owner = userRepository.findByEmailIgnoreCase(ownerEmail)
                .orElseThrow(() -> new ResourceNotFoundException("Owner user not found."));

        return proposalRepository.findReceivedProposalsByOwnerId(owner.getId())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ProposalResponse> listProposalsForBuyer(String buyerEmail) {
        User buyer = userRepository.findByEmailIgnoreCase(buyerEmail)
                .orElseThrow(() -> new ResourceNotFoundException("Authenticated buyer not found."));

        return proposalRepository.findSentProposalsByBuyerId(buyer.getId())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public ProposalResponse evaluateProposal(UUID proposalId, boolean accept, String ownerEmail) {
        Proposal proposal = proposalRepository.findById(proposalId)
                .orElseThrow(() -> new ResourceNotFoundException("Proposal not found with id: " + proposalId));

        LandLot landLot = proposal.getLandLot();
        if (!landLot.getOwner().getEmail().equalsIgnoreCase(ownerEmail)) {
            throw new BusinessRuleException("Only the owner of the land lot can accept or reject proposals.");
        }

        if (proposal.getStatus() != ProposalStatus.PENDING) {
            throw new BusinessRuleException("This proposal has already been evaluated.");
        }

        if (accept) {
            proposal.setStatus(ProposalStatus.ACCEPTED);
            landLot.setStatus(LandStatus.RESERVED);
            landLot.setUpdatedAt(OffsetDateTime.now());
            landLotRepository.save(landLot);
        } else {
            proposal.setStatus(ProposalStatus.REJECTED);
        }

        Proposal saved = proposalRepository.save(proposal);
        return toResponse(saved);
    }

    private ProposalResponse toResponse(Proposal proposal) {
        return new ProposalResponse(
                proposal.getId(),
                proposal.getLandLot().getId(),
                proposal.getLandLot().getTitle(),
                proposal.getBuyer().getId(),
                proposal.getBuyer().getName(),
                proposal.getBuyer().getEmail(),
                proposal.getOfferedPrice(),
                proposal.getMessage(),
                proposal.getStatus(),
                proposal.getCreatedAt(),
                proposal.getLandLot().getStatus(),
                proposal.getLandLot().getPrice()
        );
    }
}
