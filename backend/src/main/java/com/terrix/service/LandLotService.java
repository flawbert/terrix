package com.terrix.service;

import com.terrix.domain.entity.LandLot;
import com.terrix.domain.entity.Proposal;
import com.terrix.domain.entity.User;
import com.terrix.domain.enums.LandStatus;
import com.terrix.domain.enums.ProposalStatus;
import com.terrix.domain.repository.LandLotRepository;
import com.terrix.domain.repository.ProposalRepository;
import com.terrix.dto.request.CreateLandLotRequest;
import com.terrix.dto.request.GeoJsonPolygonDto;
import com.terrix.dto.request.UpdateLandLotRequest;
import com.terrix.dto.response.LandLotResponse;
import com.terrix.exception.BusinessRuleException;
import com.terrix.exception.ResourceNotFoundException;
import com.terrix.service.strategy.LandValidationStrategy;
import com.terrix.util.GeometryUtils;
import org.locationtech.jts.geom.Polygon;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class LandLotService {

    private final LandLotRepository landLotRepository;
    private final AuthService authService;
    private final List<LandValidationStrategy> validationStrategies;
    private final ProposalRepository proposalRepository;

    public LandLotService(
            LandLotRepository landLotRepository,
            AuthService authService,
            List<LandValidationStrategy> validationStrategies) {
        this(landLotRepository, authService, validationStrategies, null);
    }

    @Autowired
    public LandLotService(
            LandLotRepository landLotRepository,
            AuthService authService,
            List<LandValidationStrategy> validationStrategies,
            ProposalRepository proposalRepository) {
        this.landLotRepository = landLotRepository;
        this.authService = authService;
        this.validationStrategies = validationStrategies;
        this.proposalRepository = proposalRepository;
    }

    @Transactional
    public LandLotResponse createLandLot(CreateLandLotRequest request, String authenticatedEmail) {
        Polygon polygon = GeometryUtils.toPolygon(request.geometry().coordinates());

        for (LandValidationStrategy strategy : validationStrategies) {
            strategy.validate(polygon);
        }

        Double areaSqMeters = landLotRepository.calculateGeodesicAreaSqMeters(polygon);
        User owner = authService.resolveCurrentUserOrGuest(authenticatedEmail);

        LandLot landLot = new LandLot(
                UUID.randomUUID(),
                request.title().trim(),
                request.description().trim(),
                request.price(),
                Math.round(areaSqMeters * 100.0) / 100.0,
                request.contactInfo().trim(),
                LandStatus.AVAILABLE,
                polygon,
                owner
        );

        LandLot saved = landLotRepository.save(landLot);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<LandLotResponse> listAllLandLots() {
        return landLotRepository.findAllWithOwner()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public LandLotResponse getLandLotById(UUID id) {
        LandLot landLot = landLotRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Land lot not found with id: " + id));
        return toResponse(landLot);
    }

    @Transactional(readOnly = true)
    public List<LandLotResponse> searchByCircle(
            double centerLon,
            double centerLat,
            double radiusMeters,
            BigDecimal maxPrice,
            LandStatus status) {

        if (radiusMeters <= 0 || radiusMeters > 50_000) {
            if (radiusMeters > 50_000) throw new BusinessRuleException("Search radius cannot exceed 50 km (50,000 meters).");
            throw new BusinessRuleException("Search radius must be greater than zero meters.");
        }
        if (centerLon < -180 || centerLon > 180 || centerLat < -90 || centerLat > 90) {
            throw new BusinessRuleException("Search center coordinates are out of valid WGS84 bounds.");
        }

        String statusFilter = status != null ? status.name() : null;
        return landLotRepository.searchWithinCircle(centerLon, centerLat, radiusMeters, maxPrice, statusFilter)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<LandLotResponse> listLandLotsForOwner(String ownerEmail) {
        if (ownerEmail == null || ownerEmail.isBlank()) {
            throw new BusinessRuleException("Authentication is required to list your land lots.");
        }
        return landLotRepository.findAllByOwnerEmail(ownerEmail)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public LandLotResponse updateLandLot(UUID id, UpdateLandLotRequest request, String authenticatedEmail) {
        LandLot landLot = landLotRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Land lot not found with id: " + id));

        if (authenticatedEmail == null || !landLot.getOwner().getEmail().equalsIgnoreCase(authenticatedEmail)) {
            throw new BusinessRuleException("Only the owner of the land lot can edit this listing.");
        }

        if (landLot.getStatus() != LandStatus.AVAILABLE) {
            throw new BusinessRuleException("Reserved or sold land lots can no longer be edited.");
        }

        landLot.setTitle(request.title().trim());
        landLot.setDescription(request.description().trim());
        landLot.setPrice(request.price());
        landLot.setContactInfo(request.contactInfo().trim());
        landLot.setUpdatedAt(OffsetDateTime.now());

        LandLot saved = landLotRepository.save(landLot);
        return toResponse(saved);
    }

    @Transactional
    public LandLotResponse updateLandStatus(UUID id, LandStatus newStatus, String authenticatedEmail) {
        LandLot landLot = landLotRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Land lot not found with id: " + id));

        if (authenticatedEmail == null || !landLot.getOwner().getEmail().equalsIgnoreCase(authenticatedEmail)) {
            throw new BusinessRuleException("Only the owner of the land lot can change its status.");
        }

        if (landLot.getStatus() == LandStatus.SOLD) {
            throw new BusinessRuleException("Sold land lots cannot be reopened or have their status changed.");
        }

        if (newStatus == LandStatus.SOLD && landLot.getStatus() != LandStatus.RESERVED) {
            throw new BusinessRuleException("A land lot can only be marked as SOLD after a purchase proposal has been accepted.");
        }

        if (landLot.getStatus() == LandStatus.RESERVED && newStatus == LandStatus.AVAILABLE && proposalRepository != null) {
            List<Proposal> lotProposals = proposalRepository.findByLandLotIdWithDetails(id);
            for (Proposal proposal : lotProposals) {
                if (proposal.getStatus() == ProposalStatus.ACCEPTED) {
                    proposal.setStatus(ProposalStatus.REJECTED);
                    proposalRepository.save(proposal);
                }
            }
        }

        landLot.setStatus(newStatus);
        landLot.setUpdatedAt(OffsetDateTime.now());
        LandLot saved = landLotRepository.save(landLot);
        return toResponse(saved);
    }

    @Transactional
    public void deleteLandLot(UUID id, String authenticatedEmail) {
        LandLot landLot = landLotRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Land lot not found with id: " + id));

        if (authenticatedEmail == null || !landLot.getOwner().getEmail().equalsIgnoreCase(authenticatedEmail)) {
            throw new BusinessRuleException("Only the owner of the land lot can delete this listing.");
        }

        if (landLot.getStatus() != LandStatus.AVAILABLE) {
            throw new BusinessRuleException("Reserved or sold land lots can no longer be deleted.");
        }

        landLotRepository.delete(landLot);
    }

    public LandLotResponse toResponse(LandLot landLot) {
        GeoJsonPolygonDto geoJson = new GeoJsonPolygonDto(
                "Polygon",
                GeometryUtils.fromPolygon(landLot.getGeometry())
        );

        BigDecimal pricePerSqMeter = BigDecimal.ZERO;
        if (landLot.getAreaSqMeters() != null && landLot.getAreaSqMeters() > 0) {
            pricePerSqMeter = landLot.getPrice().divide(
                    BigDecimal.valueOf(landLot.getAreaSqMeters()), 2, RoundingMode.HALF_UP
            );
        }

        long proposalCount = (proposalRepository != null && landLot.getId() != null)
                ? proposalRepository.countByLandLotId(landLot.getId())
                : 0L;

        return new LandLotResponse(
                landLot.getId(),
                landLot.getTitle(),
                landLot.getDescription(),
                landLot.getPrice(),
                landLot.getAreaSqMeters(),
                pricePerSqMeter,
                landLot.getContactInfo(),
                landLot.getStatus(),
                geoJson,
                landLot.getOwner().getId(),
                landLot.getOwner().getName(),
                landLot.getCreatedAt(),
                proposalCount
        );
    }
}
